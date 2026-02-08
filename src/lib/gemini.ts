import { GoogleGenerativeAI } from "@google/generative-ai";
import { PRODUCT_CATEGORIES, SUBCATEGORIES_FOR_PROMPT, OCCUPATION_TAGS } from "./constants";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

// JSONパースエラーを修復を試みるヘルパー関数
function cleanupMalformedJson(jsonStr: string): string | null {
  try {
    // まずそのままパースを試みる
    JSON.parse(jsonStr);
    return jsonStr;
  } catch {
    // 不完全なJSON（途中で切れている）を修復
    let cleaned = jsonStr;

    // 末尾の不完全な文字列リテラルを削除
    // 例: "reason": "テキストが途中で
    cleaned = cleaned.replace(/,\s*"[^"]*":\s*"[^"]*$/g, "");

    // 未閉じの配列を閉じる
    const openBrackets = (cleaned.match(/\[/g) || []).length;
    const closeBrackets = (cleaned.match(/\]/g) || []).length;
    cleaned += "]".repeat(openBrackets - closeBrackets);

    // 未閉じのオブジェクトを閉じる
    const openBraces = (cleaned.match(/\{/g) || []).length;
    const closeBraces = (cleaned.match(/\}/g) || []).length;
    cleaned += "}".repeat(openBraces - closeBraces);

    // 末尾のカンマを削除
    cleaned = cleaned.replace(/,(\s*[\]}])/g, "$1");

    try {
      JSON.parse(cleaned);
      return cleaned;
    } catch {
      console.error("[Gemini] Failed to repair JSON");
      return null;
    }
  }
}

// GeminiのJSON応答をパースするヘルパー関数
function parseGeminiJsonResponse(text: string): AnalysisResult {
  // JSONを抽出（コードブロックで囲まれている場合も考慮）
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("No valid JSON found in response");
  }

  let parsed: AnalysisResult;
  try {
    parsed = JSON.parse(jsonMatch[0]) as AnalysisResult;
  } catch (parseError) {
    // JSONパースエラー時は、問題箇所を特定するための詳細ログを出力
    console.error("[Gemini] JSON parse error:", parseError);
    console.error("[Gemini] Raw JSON length:", jsonMatch[0].length);

    // JSONを修復を試みる
    const cleanedJson = cleanupMalformedJson(jsonMatch[0]);
    if (cleanedJson) {
      console.log("[Gemini] Successfully repaired JSON, attempting to parse...");
      parsed = JSON.parse(cleanedJson) as AnalysisResult;
    } else {
      throw parseError;
    }
  }

  // デフォルト値を設定
  if (!parsed.tags) {
    parsed.tags = [];
  }
  if (!parsed.influencerOccupationTags) {
    parsed.influencerOccupationTags = [];
  }
  if (parsed.influencerOccupation === undefined) {
    parsed.influencerOccupation = null;
  }
  if (!parsed.products) {
    parsed.products = [];
  }

  // 各商品のブランドがない場合は空文字を設定
  for (const product of parsed.products) {
    if (!product.brand) {
      product.brand = "";
    }
  }

  return parsed;
}

export interface ExtractedProduct {
  name: string;
  brand: string;
  category: string;
  subcategory?: string | null;
  reason: string;
  confidence: "high" | "medium" | "low";
}

export interface AnalysisResult {
  products: ExtractedProduct[];
  summary: string;
  tags: string[];
  influencerOccupation: string | null;
  influencerOccupationTags: string[];
}

// PRODUCT_CATEGORIES は constants.ts からインポート済み

// サイトで使用するタグに合わせた定義（constants.tsのSTYLE_TAGS + ENVIRONMENT_TAGSと同期）
const DESK_SETUP_TAGS = [
  // スタイルタグ（雰囲気・テイスト）
  "ミニマリスト",
  "ゲーミング",
  "おしゃれ",
  "ホワイト",
  "ブラック",
  "モノトーン",
  "ナチュラル",
  "北欧風",
  "インダストリアル",
  "かわいい",
  // 環境タグ（デスク環境・機材構成）
  "リモートワーク",
  "オフィス",
  "昇降デスク",
  "L字デスク",
  "デュアルモニター",
  "トリプルモニター",
  "ウルトラワイド",
  "Mac環境",
  "Windows環境",
];

// OCCUPATION_TAGS と SUBCATEGORIES_FOR_PROMPT は constants.ts からインポート済み

export async function analyzeTranscript(
  transcript: string,
  videoTitle: string,
  videoDescription?: string,
  channelDescription?: string
): Promise<AnalysisResult> {
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

  // チャンネル・動画概要欄から職業を推測するための情報を追加
  const contextInfo = [];
  if (videoDescription) {
    contextInfo.push(`【動画概要欄】\n${videoDescription.slice(0, 2000)}`);
  }
  if (channelDescription) {
    contextInfo.push(`【チャンネル概要欄】\n${channelDescription.slice(0, 1000)}`);
  }
  const additionalContext = contextInfo.length > 0 ? `\n\n${contextInfo.join("\n\n")}` : "";

  const prompt = `あなたはデスクツアー動画を分析する専門家です。視聴者が商品購入の参考にできるよう、詳細で具体的な情報を抽出してください。

動画タイトル: ${videoTitle}
${additionalContext}

【文字起こし】
${transcript.slice(0, 15000)}

以下のJSON形式で回答してください。必ず有効なJSONのみを出力し、他の説明は含めないでください。

{
  "influencerOccupation": "動画投稿者の職業を具体的に記述（例：フリーランスのWebエンジニア、IT企業勤務のUIデザイナー等）。動画内・概要欄・チャンネル説明から推測可能な場合は記載。不明な場合はnull",
  "influencerOccupationTags": ["該当する職業タグをすべて選択: ${OCCUPATION_TAGS.join(", ")}"],
  "products": [
    {
      "name": "商品名（型番・シリーズ名のみ。ブランド名は含めない。例：ERGO M575S, Professional HYBRID Type-S, EF-1）",
      "brand": "ブランド/メーカー名（例：Apple, Logicool, HHKB, Keychron, FLEXISPOT等。必ず記載すること。不明な場合のみ空文字）",
      "category": "カテゴリ名（以下から選択: ${PRODUCT_CATEGORIES.join(", ")}）",
      "subcategory": "サブカテゴリ（該当する場合のみ。後述のリストから選択。なければnull）",
      "reason": "【重要】以下の観点を含めて詳しく記述（100-200文字程度）：
        1. なぜこの商品を選んだのか（導入理由・きっかけ）
        2. 実際に使ってみて気に入っている点
        3. 他の商品と比較した優位性があれば
        4. どんな人におすすめか",
      "confidence": "high/medium/low（商品名の特定に対する確信度）"
    }
  ],
  "summary": "【重要】以下の5つの観点を含めて詳しく要約（200-400文字程度）：
    1. 発信者の属性（職業・作業内容・在宅/出社など）
    2. デスク環境のコンセプト・テーマ（ミニマル、ゲーミング、クリエイター向け等）
    3. 最もこだわっているポイント
    4. 使用しているPC/OS環境（Mac/Windows/両方）
    5. デスク環境の総評や特筆すべき点",
  "tags": ["該当するタグを選択（複数可）: ${DESK_SETUP_TAGS.join(", ")}"]
}

【職業の抽出ルール】★重要★
- influencerOccupationTagsは以下の10個のタグからのみ選択すること（これ以外のタグは絶対に使用しないこと）：
  ${OCCUPATION_TAGS.join(", ")}
- 動画内の発言（「自分は◯◯をしています」「◯◯として働いている」等）から推測
- チャンネル概要欄の自己紹介文からも推測可能
- 該当する職業タグが複数ある場合はすべて含める
- influencerOccupationは具体的に自由記述（例：「IT企業でWebディレクターとして働いている」「スタートアップで技術支援」等）
- influencerOccupationTagsは必ず上記10タグから選択（「スタートアップ支援」など独自タグは禁止）
- 経営者・社長・CEO・起業家は「経営者」タグを使用
- カメラマン・写真家は「フォトグラファー」タグを使用
- 全く推測できない場合のみnullと空配列を設定

【商品名の記述ルール】★重要★
- 商品名フィールド(name)にはブランド名を含めず、「製品シリーズ名 + 型番」の形式で記述
- ブランド名は別フィールド(brand)に必ず記載すること
- 型番（英数字の組み合わせ）があれば必ず含める
- 例：
  - name: "ERGO M575S", brand: "Logicool"
  - name: "U2720QM", brand: "Dell"
  - name: "Professional HYBRID Type-S", brand: "HHKB"
  - name: "ing ING", brand: "コクヨ"
  - name: "EF-1", brand: "FLEXISPOT"
- 概要欄のAmazon/楽天リンクから正確な商品名を取得できる場合はそれを優先使用

【ブランド名の記述ルール】★重要★
- 正式な表記を使用（スペルミス厳禁）
- 日本語ブランドは日本語で：コクヨ、サンワサプライ、エレコム、無印良品、オウルテック
- 海外ブランドは英語で：Logicool, Dell, ASUS, BenQ, Apple, Anker, Belkin, Satechi, Herman Miller, FLEXISPOT
- 正しいスペル例：
  - ○ Logicool / × Logitech（日本では「Logicool」表記）
  - ○ コクヨ / × Kokuyo / × KOKUYO / × Kokuyo Furniture
  - ○ FLEXISPOT / × FlexiSpot
  - ○ Herman Miller / × HermanMiller
  - ○ サンワサプライ / × Sanwa Supply
- 不明な場合は空文字""を設定

【商品コメント（reason）の記述ルール】
- 動画内で実際に述べられている内容を元に、具体的に記述してください
- 「良い」「おすすめ」などの抽象的な表現ではなく、具体的な特徴やメリットを書いてください
- 例（良い例）：「在宅勤務で長時間座ることが増えたため、腰痛対策として購入。ランバーサポートが腰にフィットし、8時間座っても疲れにくい。メッシュ素材で夏場も蒸れない点が気に入っている」
- 例（悪い例）：「座り心地が良くておすすめ」
- 動画内で言及されていない情報は推測で補わないでください

【サブカテゴリの選択ルール】★重要★
- subcategoryは以下のカテゴリ別リストからのみ選択すること：
  ${SUBCATEGORIES_FOR_PROMPT}
- 商品の特徴に該当するサブカテゴリがある場合のみ設定
- 該当するものがなければnullを設定

【サブカテゴリ判定の具体例】★商品名・型番・特徴から判断★
キーボード:
  Cherry MX/Gateron/Kailh/赤軸/青軸/茶軸 → メカニカルキーボード
  HHKB/Realforce/静電容量/無接点 → 静電容量無接点
  パンタグラフ/Pantograph/シザー/Magic Keyboard/Apple Keyboard → パンタグラフ
  分割/Split/Ergodox/Kinesis → 分割キーボード
  TKL/テンキーレス/87キー → テンキーレス
  60%/65%/66キー/68キー → 60%・65%キーボード
  フルサイズ/108キー/テンキー付き → フルサイズキーボード
  ロープロファイル/薄型/Low Profile → ロープロファイル

マウス:
  MX ERGO/M575/SW-M570/トラックボール → トラックボール
  MX Master/MX Vertical/エルゴノミクス → エルゴノミクスマウス
  G Pro/DeathAdder/Viper/ゲーミング/Gaming → ゲーミングマウス
  縦型/Vertical Mouse → 縦型マウス
  ※ワイヤレス/Bluetoothのみの場合はnull（形状を優先）

ディスプレイ・モニター:
  4K/3840x2160/UHD/2160p → 4Kモニター
  ウルトラワイド/21:9/34インチ曲面 → ウルトラワイドモニター
  144Hz/240Hz/G-SYNC/FreeSync/ゲーミング → ゲーミングモニター
  モバイル/ポータブル/持ち運び/13.3インチ → モバイルモニター
  5K/6K/5120x2880 → 5K・6Kモニター

ヘッドホン・イヤホン:
  開放型/Open-back/音漏れ → 開放型ヘッドホン
  密閉型/Closed-back/遮音 → 密閉型ヘッドホン
  AirPods/完全ワイヤレス/TWS → ワイヤレスイヤホン
  DTM/音楽制作/スタジオ/モニターヘッドホン → モニターヘッドホン
  ゲーミングヘッドセット/マイク付き/7.1ch → ゲーミングヘッドセット

チェア:
  DXRacer/AKRacing/ゲーミングチェア → ゲーミングチェア
  Herman Miller/Steelcase/エルゴノミクス/腰痛対策 → エルゴノミクスチェア
  メッシュ/通気性 → メッシュチェア

デスク:
  昇降/電動/Standing/スタンディング → 昇降デスク
  L字/L型/コーナー → L字デスク
  DIY/自作/天板のみ → DIYデスク
  ゲーミングデスク → ゲーミングデスク

マイク:
  コンデンサー/Condenser/配信 → コンデンサーマイク
  ダイナミック/SM7B/RE20 → ダイナミックマイク
  USB/Blue Yeti → USBマイク
  XLR/ファンタム電源 → XLRマイク
  ピンマイク/ラベリア → ピンマイク

【注意事項】
- 実際に動画内で紹介・言及されている商品のみを抽出
- 商品名が明確でない場合はconfidenceをlowに
- 同じ商品の重複記載は避ける
- デスクツアーに関係ない商品（飲料、服など）は除外
- タグは動画の内容に合致するものだけを選択（無理に全部選ばない）`;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    return parseGeminiJsonResponse(text);
  } catch (error) {
    console.error("Error analyzing transcript:", error);
    return {
      products: [],
      summary: "解析に失敗しました",
      tags: [],
      influencerOccupation: null,
      influencerOccupationTags: [],
    };
  }
}

// Amazon価格から価格帯を判定
export function getPriceRange(price: number | undefined): string | null {
  if (!price) return null;

  if (price < 5000) return "under_5000";
  if (price < 10000) return "5000_10000";
  if (price < 30000) return "10000_30000";
  if (price < 50000) return "30000_50000";
  return "over_50000";
}

// ブログ・note記事を解析
export async function analyzeArticle(
  content: string,
  articleTitle: string
): Promise<AnalysisResult> {
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

  const prompt = `あなたはデスクツアー記事を分析する専門家です。読者が商品購入の参考にできるよう、詳細で具体的な情報を抽出してください。

記事タイトル: ${articleTitle}

記事本文:
${content.slice(0, 15000)}

以下のJSON形式で回答してください。必ず有効なJSONのみを出力し、他の説明は含めないでください。

{
  "influencerOccupation": "記事執筆者の職業（記事内で言及されている場合のみ。例：エンジニア、デザイナー等。不明な場合はnull）",
  "influencerOccupationTags": ["該当する職業タグを選択（複数可）: ${OCCUPATION_TAGS.join(", ")}"],
  "products": [
    {
      "name": "商品名（型番・シリーズ名のみ。ブランド名は含めない。例：ERGO M575S, Professional HYBRID Type-S, EF-1）",
      "brand": "ブランド/メーカー名（例：Apple, Logicool, HHKB, Keychron, FLEXISPOT等。必ず記載すること。不明な場合のみ空文字）",
      "category": "カテゴリ名（以下から選択: ${PRODUCT_CATEGORIES.join(", ")}）",
      "subcategory": "サブカテゴリ（該当する場合のみ。後述のリストから選択。なければnull）",
      "reason": "【重要】以下の観点を含めて詳しく記述（100-200文字程度）：
        1. なぜこの商品を選んだのか（導入理由・きっかけ）
        2. 実際に使ってみて気に入っている点
        3. 他の商品と比較した優位性があれば
        4. どんな人におすすめか",
      "confidence": "high/medium/low（商品名の特定に対する確信度）"
    }
  ],
  "summary": "この記事のデスク環境の特徴を2-3文で要約（どんなコンセプトのデスクか、こだわりポイントは何か）",
  "tags": ["該当するタグを選択（複数可）: ${DESK_SETUP_TAGS.join(", ")}"]
}

【商品名の記述ルール】★重要★
- 商品名は「ブランド名 + 製品シリーズ名 + 型番」の形式で正確に記述
- 型番（英数字の組み合わせ）は必ず含める
- 例：「Logicool ERGO M575S」「Dell U2720QM」「HHKB Professional HYBRID Type-S」「コクヨ ing ING」
- 記事内のAmazon/楽天リンクから正確な商品名を取得できる場合はそれを優先使用

【ブランド名の記述ルール】★重要★
- 正式な表記を使用（スペルミス厳禁）
- 日本語ブランドは日本語で：コクヨ、サンワサプライ、エレコム、無印良品、オウルテック
- 海外ブランドは英語で：Logicool, Dell, ASUS, BenQ, Apple, Anker, Belkin, Satechi, Herman Miller, FLEXISPOT
- 正しいスペル例：
  - ○ Logicool / × Logitech（日本では「Logicool」表記）
  - ○ コクヨ / × Kokuyo / × KOKUYO / × Kokuyo Furniture
  - ○ FLEXISPOT / × FlexiSpot
  - ○ Herman Miller / × HermanMiller
  - ○ サンワサプライ / × Sanwa Supply
- 不明な場合は空文字""を設定

【職業の抽出ルール】
- 記事内で「自分は◯◯をしています」「◯◯として働いている」などの言及があれば抽出
- 複数の職業に該当する場合はすべてタグに含める（例：フリーランスのエンジニア→["フリーランス", "エンジニア"]）
- 明確な言及がない場合はnullと空配列を設定

【商品コメント（reason）の記述ルール】
- 記事内で実際に述べられている内容を元に、具体的に記述してください
- 「良い」「おすすめ」などの抽象的な表現ではなく、具体的な特徴やメリットを書いてください
- 記事内で言及されていない情報は推測で補わないでください
- Amazonリンクや楽天リンクから商品名を特定できる場合は活用してください

【注意事項】
- 実際に記事内で紹介・言及されている商品のみを抽出
- 商品名が明確でない場合はconfidenceをlowに
- 同じ商品の重複記載は避ける
- デスクツアーに関係ない商品（飲料、服など）は除外
- タグは記事の内容に合致するものだけを選択（無理に全部選ばない）`;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    return parseGeminiJsonResponse(text);
  } catch (error) {
    console.error("Error analyzing article:", error);
    return {
      products: [],
      summary: "解析に失敗しました",
      tags: [],
      influencerOccupation: null,
      influencerOccupationTags: [],
    };
  }
}

/**
 * 商品の特徴リストを初心者にもわかりやすく要約する（単品用）
 * @param features Amazon APIから取得した特徴リスト
 * @param productName 商品名（コンテキスト用）
 * @returns 要約された特徴リスト（3〜5項目）
 */
export async function summarizeProductFeatures(
  features: string[],
  productName: string
): Promise<string[]> {
  // 特徴が少ない場合はそのまま返す
  if (features.length <= 3) {
    return features;
  }

  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

  const prompt = `あなたはSEOとユーザー体験を考慮した商品情報ライターです。

以下の商品特徴を、購入検討者が理解しやすいように簡潔に要約してください。

【目的】
- 商品詳細ページに表示し、購入検討者の参考にする
- SEO（検索エンジン最適化）に有効な、わかりやすく具体的な情報を残す

【商品名】
${productName}

【元の特徴】
${features.map((f, i) => `${i + 1}. ${f}`).join("\n")}

【ルール】
- 3〜5項目に要約する
- 各項目は100文字以内で簡潔に
- 専門用語は避け、初心者でもわかる言葉で言い換える
- 元の情報を勝手に補完・追加しない（書かれていないことは書かない）
- 重要度の高い特徴を優先する
- 購入判断やSEOに役立つキーワードを残す
- JSON配列形式のみで出力: ["特徴1", "特徴2", ...]

JSONのみを出力し、説明文は不要です。`;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    // JSON配列を抽出
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      console.error("[summarizeFeatures] No valid JSON array found");
      return features;
    }

    let parsed: string[];
    try {
      parsed = JSON.parse(jsonMatch[0]);
    } catch {
      // JSON修復を試みる
      const cleaned = cleanupMalformedJson(jsonMatch[0]);
      if (cleaned) {
        parsed = JSON.parse(cleaned);
      } else {
        console.error("[summarizeFeatures] Failed to parse JSON");
        return features;
      }
    }

    // 配列であることを確認
    if (!Array.isArray(parsed) || parsed.length === 0) {
      console.error("[summarizeFeatures] Invalid response format");
      return features;
    }

    console.log(`[summarizeFeatures] Summarized ${features.length} → ${parsed.length} items`);
    return parsed;
  } catch (error) {
    console.error("[summarizeFeatures] Error:", error);
    return features; // エラー時は元の特徴をそのまま返す
  }
}

/**
 * 複数商品の特徴を一括で要約する（API呼び出し回数削減）
 * @param productsWithFeatures 商品名と特徴のペア配列（最大10商品/バッチ）
 * @returns 商品名をキーとした要約結果のMap
 */
export async function summarizeProductFeaturesBatch(
  productsWithFeatures: Array<{ productName: string; features: string[] }>
): Promise<Map<string, string[]>> {
  const results = new Map<string, string[]>();

  if (productsWithFeatures.length === 0) {
    return results;
  }

  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

  // 10商品ごとにバッチ処理
  const batchSize = 10;
  for (let i = 0; i < productsWithFeatures.length; i += batchSize) {
    const batch = productsWithFeatures.slice(i, i + batchSize);
    const batchNumber = Math.floor(i / batchSize) + 1;
    const totalBatches = Math.ceil(productsWithFeatures.length / batchSize);

    console.log(`[Features Batch] Processing batch ${batchNumber}/${totalBatches} (${batch.length} products)`);

    const productsText = batch.map((p, idx) => `
--- 商品${idx + 1}: ${p.productName} ---
${p.features.map((f, j) => `${j + 1}. ${f}`).join("\n")}
`).join("\n");

    const prompt = `あなたはSEOとユーザー体験を考慮した商品情報ライターです。

以下の複数商品の特徴を、それぞれ簡潔に要約してください。

【目的】
- 商品詳細ページに表示し、購入検討者の参考にする
- SEO（検索エンジン最適化）に有効な、わかりやすく具体的な情報を残す

【商品一覧】
${productsText}

【ルール】
- 各商品につき3〜5項目に要約
- 各項目は100文字以内
- 専門用語は避け、初心者でもわかる言葉で言い換える
- 元の情報を勝手に補完・追加しない
- 重要度の高い特徴を優先
- 購入判断やSEOに役立つキーワードを残す

【出力形式】
必ず以下のJSON形式のみで出力してください。説明文は不要です。
{
  "商品1の名前": ["特徴1", "特徴2", ...],
  "商品2の名前": ["特徴1", "特徴2", ...],
  ...
}`;

    try {
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      // JSONオブジェクトを抽出
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.error("[Features Batch] No valid JSON object found");
        // フォールバック: 元の特徴をそのまま使用
        for (const p of batch) {
          results.set(p.productName, p.features);
        }
        continue;
      }

      let parsed: Record<string, string[]>;
      try {
        parsed = JSON.parse(jsonMatch[0]);
      } catch {
        // JSON修復を試みる
        const cleaned = cleanupMalformedJson(jsonMatch[0]);
        if (cleaned) {
          parsed = JSON.parse(cleaned);
        } else {
          console.error("[Features Batch] Failed to parse JSON");
          for (const p of batch) {
            results.set(p.productName, p.features);
          }
          continue;
        }
      }

      // 結果をMapに追加
      for (const p of batch) {
        const summarized = parsed[p.productName];
        if (Array.isArray(summarized) && summarized.length > 0) {
          results.set(p.productName, summarized);
          console.log(`  [Batch] ${p.productName}: ${p.features.length} → ${summarized.length} items`);
        } else {
          // 見つからない場合は元の特徴を使用
          results.set(p.productName, p.features);
          console.log(`  [Batch] ${p.productName}: Not found in response, using original`);
        }
      }

    } catch (error) {
      console.error("[Features Batch] Error:", error);
      // エラー時は元の特徴をそのまま使用
      for (const p of batch) {
        results.set(p.productName, p.features);
      }
    }
  }

  return results;
}
