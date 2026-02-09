import { GoogleGenerativeAI } from "@google/generative-ai";
import {
  PRODUCT_CATEGORIES, OCCUPATION_TAGS,
  TAG_GROUP_STYLE, TAG_GROUP_MONITOR, TAG_GROUP_DESK, TAG_GROUP_OS, TAG_GROUP_FEATURES,
  DESK_SETUP_TAGS, selectPrimaryOccupation, validateTags,
} from "./constants";

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

  // デフォルト値を設定 & タグバリデーション
  if (!parsed.tags) {
    parsed.tags = [];
  }
  // 排他グループのバリデーション（矛盾するタグを自動修正）
  parsed.tags = validateTags(parsed.tags);
  if (!parsed.influencerOccupationTags) {
    parsed.influencerOccupationTags = [];
  }
  // Geminiが複数タグを返した場合、優先度順で1つに絞る
  if (parsed.influencerOccupationTags.length > 1) {
    const primary = selectPrimaryOccupation(parsed.influencerOccupationTags);
    parsed.influencerOccupationTags = primary ? [primary] : [];
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

// ============================================================
// 共通プロンプトテンプレート（analyzeTranscript / analyzeArticle で共有）
// ============================================================

/** JSON出力指示の共通ヘッダ */
const PROMPT_JSON_INSTRUCTION = `以下のJSON形式で回答してください。必ず有効なJSONのみを出力し、他の説明は含めないでください。`;

/** productsフィールドのJSONスキーマ（name, brand, category, reason, confidence） */
const PRODUCT_FIELDS_SCHEMA = `{
      "name": "商品名（ブランド名は含めない。Amazonで検索して特定できる名前にすること。スペック文字列や一般名詞だけはNG。例：ERGO M575S, LX デスクマウント モニターアーム, ScreenBar Halo 2）",
      "brand": "ブランド/メーカー名（例：Apple, Logicool, HHKB, Keychron, FLEXISPOT, エルゴトロン等。必ず記載すること。不明な場合のみ空文字）",
      "category": "カテゴリ名（以下から選択: ${PRODUCT_CATEGORIES.join(", ")}）",
      "reason": "【重要】以下の観点を含めて詳しく記述（100-200文字程度）：
        1. なぜこの商品を選んだのか（導入理由・きっかけ）
        2. 実際に使ってみて気に入っている点
        3. 他の商品と比較した優位性があれば
        4. どんな人におすすめか",
      "confidence": "high/medium/low（商品名の特定に対する確信度）"
    }`;

/**
 * 商品名の記述ルール（linkSource: リンク元の説明文, sourceRef: ソース参照の説明文）
 */
function buildProductNameRules(linkSource: string, sourceRef: string): string {
  return `【商品名の記述ルール】★最重要★
- 商品名フィールド(name)にはブランド名を含めず、「製品シリーズ名 + 型番」の形式で記述
- ブランド名は別フィールド(brand)に必ず記載すること
- nameは「その商品をAmazonや楽天で検索して一意に特定できる名前」にすること
- 型番（英数字の組み合わせ）があれば必ず含める
- シリーズ名は省略しないこと。同ブランド内のシリーズ共通名は必ず含める
  - 例：BenQのモニターライトなら「ScreenBar Halo 2」であり「Halo 2」だけにしない
  - 例：LogicoolのマウスならERGOシリーズは「ERGO M575S」であり「M575S」だけにしない
- 商品名として絶対にやってはいけないこと：
  - × スペック文字列をそのまま商品名にしない（例：「4ポート (USB-C×2/USB-A×2)10Gbps」はNG）
  - × 一般名詞だけにしない（例：「USBハブ」「モニターアーム」はNG）
  - × 型番が1〜2文字だけの場合は製品カテゴリ名を補足する（例：「LX」→「LX デスクマウント モニターアーム」）
- 正しい例：
  - name: "ERGO M575S", brand: "Logicool"
  - name: "U2720QM", brand: "Dell"
  - name: "Professional HYBRID Type-S", brand: "HHKB"
  - name: "ScreenBar Halo 2", brand: "BenQ"
  - name: "EF-1", brand: "FLEXISPOT"
  - name: "LX デスクマウント モニターアーム", brand: "エルゴトロン"
  - name: "USB-C ハブ 4ポート 10Gbps", brand: "UGREEN"
- ${linkSource}
- ${sourceRef}`;
}

/** ブランド名の記述ルール（両ソース共通） */
const BRAND_NAME_RULES = `【ブランド名の記述ルール】★重要★
- 正式な表記を使用（スペルミス厳禁）
- 日本語ブランドは日本語で：コクヨ、サンワサプライ、エレコム、無印良品、オウルテック
- 海外ブランドは英語で：Logicool, Dell, ASUS, BenQ, Apple, Anker, Belkin, Satechi, Herman Miller, FLEXISPOT
- 正しいスペル例：
  - ○ Logicool / × Logitech（日本では「Logicool」表記）
  - ○ コクヨ / × Kokuyo / × KOKUYO / × Kokuyo Furniture
  - ○ FLEXISPOT / × FlexiSpot
  - ○ Herman Miller / × HermanMiller
  - ○ サンワサプライ / × Sanwa Supply
- 不明な場合は空文字""を設定`;

/**
 * 職業の抽出ルール
 * @param sourceHints ソース固有の推測ヒント行（配列の各要素が "- ..." 行）
 * @param unknownFallback 不明時の指示テキスト
 */
function buildOccupationRules(sourceHints: string[], unknownFallback: string): string {
  return `【職業の抽出ルール】★重要★
- influencerOccupationTagsは以下の9個のタグから「最も適切な1つだけ」を選択すること：
  ${OCCUPATION_TAGS.join(", ")}
- 必ず1つだけ選ぶこと。複数選択は禁止。
${sourceHints.join("\n")}
- 選択の優先度ルール（具体的な職業を優先すること）：
  - エンジニアかつ動画制作もしている → 「エンジニア」を選択（本業を優先）
  - デザイナーかつYouTuber → 「デザイナー」を選択（本業を優先）
- 経営者・社長・CEO・起業家は「経営者」タグを使用
- カメラマン・写真家は「フォトグラファー」タグを使用
- ${unknownFallback}`;
}

/**
 * タグの選択ルール
 * @param sourceLabel ソース種別（"動画" / "記事"）
 * @param extraLine 独自タグ禁止の補足行（動画のみ例を含む）
 */
function buildTagSelectionRules(sourceLabel: string, extraLine: string): string {
  return `【タグの選択ルール】★最重要★
タグは以下の5グループに分類される。各グループのルールに従って選択すること。

■ グループ1: スタイル（★排他★ 1つだけ選択。デスクの見た目で最も支配的な印象を選ぶ）
  選択肢: ${TAG_GROUP_STYLE.join(", ")}
  - サムネイル画像があればその雰囲気を最優先で判断材料にする
  - テキストで「白で統一」「黒基調」等の言及があればそれに従う
  - 判定ガイド:
    - 「ミニマル」: 物が少なく余白が多い
    - 「ゲーミング」: RGB・ゲーミングチェア・ゲーミングデバイス中心
    - 「ナチュラル・北欧」: 木目・暖色・植物
    - 「インダストリアル」: 鉄脚・ダーク・無骨
    - 「かわいい」: パステル・丸みのあるデザイン
    - 「モノトーン」: 白黒が混在（どちらかに偏っていない）
    - 「ホワイト」: 8割以上が白で統一
    - 「ブラック」: 8割以上が黒で統一

■ グループ2: モニター構成（★排他★ 1つだけ選択）
  選択肢: ${TAG_GROUP_MONITOR.join(", ")}
  - 実際に使用しているモニターの枚数・種類で判断

■ グループ3: デスク種類（★排他★ 1つだけ選択）
  選択肢: ${TAG_GROUP_DESK.join(", ")}

■ グループ4: メインOS（★排他★ 1つだけ選択）
  選択肢: ${TAG_GROUP_OS.join(", ")}
  - Mac/Windowsの両方を使っている場合、メインで使っている方を選択

■ グループ5: 特徴（複数選択可能。該当するものをすべて含める）
  選択肢: ${TAG_GROUP_FEATURES.join(", ")}
  - 「クラムシェル」: ノートPCを閉じた状態で外部モニターに接続
  - 「自作PC」: 自分でパーツを選んで組み立てたPC
  - 「iPad連携」: iPadをサブディスプレイや液タブ代わりに活用
  - 「DIY」: デスク天板やパーツを自作・カスタムしている

- ${sourceLabel}の内容に合致するものだけを選択（無理に全グループ埋めなくてよい）
- ${extraLine}`;
}

/**
 * 商品コメント（reason）の記述ルール
 * @param sourceLabel ソース種別（"動画内" / "記事内"）
 * @param extraLines 追加の指示行（記事向けのAmazonリンク活用等）
 */
function buildReasonRules(sourceLabel: string, extraLines: string[]): string {
  const lines = [
    `【商品コメント（reason）の記述ルール】`,
    `- ${sourceLabel}で実際に述べられている内容を元に、具体的に記述してください`,
    `- 「良い」「おすすめ」などの抽象的な表現ではなく、具体的な特徴やメリットを書いてください`,
    ...extraLines,
    `- ${sourceLabel}で言及されていない情報は推測で補わないでください`,
  ];
  return lines.join("\n");
}

/**
 * 注意事項
 * @param sourceLabel ソース種別（"動画内" / "記事内"）
 * @param contentLabel コンテンツ種別（"動画" / "記事"）
 */
function buildGeneralNotes(sourceLabel: string, contentLabel: string): string {
  return `【注意事項】
- 実際に${sourceLabel}で紹介・言及されている商品のみを抽出
- 商品名が明確でない場合はconfidenceをlowに
- 同じ商品の重複記載は避ける
- デスクツアーに関係ない商品（飲料、服など）は除外
- タグは${contentLabel}の内容に合致するものだけを選択（無理に全部選ばない）`;
}

/** 解析失敗時のデフォルト返却値 */
const DEFAULT_ANALYSIS_ERROR: AnalysisResult = {
  products: [],
  summary: "解析に失敗しました",
  tags: [],
  influencerOccupation: null,
  influencerOccupationTags: [],
};

// ============================================================
// analyzeTranscript
// ============================================================

export async function analyzeTranscript(
  transcript: string,
  videoTitle: string,
  videoDescription?: string,
  channelDescription?: string,
  thumbnailUrl?: string
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

  const thumbnailNote = thumbnailUrl
    ? "\n※ サムネイル画像が添付されています。スタイルタグの判定（色味・雰囲気）の参考にしてください。"
    : "";

  const prompt = `あなたはデスクツアー動画を分析する専門家です。視聴者が商品購入の参考にできるよう、詳細で具体的な情報を抽出してください。${thumbnailNote}

動画タイトル: ${videoTitle}
${additionalContext}

【文字起こし】
${transcript.slice(0, 18000)}

${PROMPT_JSON_INSTRUCTION}

{
  "influencerOccupation": "動画投稿者の職業を具体的に記述（例：フリーランスのWebエンジニア、IT企業勤務のUIデザイナー等）。動画内・概要欄・チャンネル説明から推測可能な場合は記載。不明な場合はnull",
  "influencerOccupationTags": ["最も適切な職業タグを1つだけ選択: ${OCCUPATION_TAGS.join(", ")}"],
  "products": [
    ${PRODUCT_FIELDS_SCHEMA}
  ],
  "summary": "【重要】以下の5つの観点を含めて詳しく要約（200-400文字程度）：
    1. 発信者の属性（職業・作業内容・在宅/出社など）
    2. デスク環境のコンセプト・テーマ（ミニマル、ゲーミング、クリエイター向け等）
    3. 最もこだわっているポイント
    4. 使用しているPC/OS環境（Mac/Windows/両方）
    5. デスク環境の総評や特筆すべき点
    【文体ルール】★重要★
    - 投稿者に敬意を持った丁寧な文体で書くこと
    - 投稿者の名前やチャンネル名を呼び捨てにしない。「〇〇さん」と敬称をつけるか、「投稿者」「発信者」と表現する
    - 第三者に紹介する文章として自然な敬体（です・ます調）で記述する
    - 良い例：「〇〇さんは、生産性と美学の両立を追求したデスク環境を紹介されています」
    - 悪い例：「〇〇は、こだわりを持つクリエイター。動画ではデスクツアーを紹介している」",
  "tags": ["該当するタグを選択（複数可）: ${DESK_SETUP_TAGS.join(", ")}"]
}

${buildOccupationRules(
  [
    "- 動画内の発言（「自分は◯◯をしています」「◯◯として働いている」等）から推測",
    "- チャンネル概要欄の自己紹介文からも推測可能",
  ],
  "全く推測できない場合のみnullと空配列を設定"
)}
- influencerOccupationは具体的に自由記述（例：「IT企業でWebディレクターとして働いている」等）

${buildTagSelectionRules("動画", "独自タグの作成は禁止（例：「プログラマー向け」「高コスパ」など勝手に作らない）")}

${buildProductNameRules(
  "概要欄のAmazon/楽天リンクから正確な商品名を取得できる場合はそれを最優先で使用",
  "動画/記事内で「〇〇の△△」「△△ by 〇〇」と紹介されている場合、〇〇がブランド、△△が商品名"
)}

${BRAND_NAME_RULES}

${buildReasonRules("動画内", [
  "- 例（良い例）：「在宅勤務で長時間座ることが増えたため、腰痛対策として購入。ランバーサポートが腰にフィットし、8時間座っても疲れにくい。メッシュ素材で夏場も蒸れない点が気に入っている」",
  "- 例（悪い例）：「座り心地が良くておすすめ」",
])}

${buildGeneralNotes("動画内", "動画")}`;

  try {
    // サムネイル画像がある場合はマルチモーダル送信
    let result;
    if (thumbnailUrl) {
      try {
        const imageResponse = await fetch(thumbnailUrl);
        const imageBuffer = await imageResponse.arrayBuffer();
        const mimeType = imageResponse.headers.get("content-type") || "image/jpeg";
        result = await model.generateContent([
          prompt,
          {
            inlineData: {
              mimeType,
              data: Buffer.from(imageBuffer).toString("base64"),
            },
          },
        ]);
        console.log("[Gemini] Sent with thumbnail image for style analysis");
      } catch (imgError) {
        console.warn("[Gemini] Failed to fetch thumbnail, proceeding without image:", imgError);
        result = await model.generateContent(prompt);
      }
    } else {
      result = await model.generateContent(prompt);
    }
    const response = await result.response;
    const text = response.text();

    return parseGeminiJsonResponse(text);
  } catch (error) {
    console.error("Error analyzing transcript:", error);
    return { ...DEFAULT_ANALYSIS_ERROR };
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
${content.slice(0, 18000)}

${PROMPT_JSON_INSTRUCTION}

{
  "influencerOccupation": "記事執筆者の職業（記事内で言及されている場合のみ。例：エンジニア、デザイナー等。不明な場合はnull）",
  "influencerOccupationTags": ["最も適切な職業タグを1つだけ選択: ${OCCUPATION_TAGS.join(", ")}"],
  "products": [
    ${PRODUCT_FIELDS_SCHEMA}
  ],
  "summary": "この記事のデスク環境の特徴を2-3文で要約（どんなコンセプトのデスクか、こだわりポイントは何か）。執筆者の名前を呼び捨てにせず「〇〇さん」と敬称をつけるか「執筆者」と表現し、丁寧な敬体（です・ます調）で記述すること",
  "tags": ["該当するタグを選択（複数可）: ${DESK_SETUP_TAGS.join(", ")}"]
}

${buildProductNameRules(
  "記事内のAmazon/楽天リンクから正確な商品名を取得できる場合はそれを最優先で使用",
  "記事内で「〇〇の△△」「△△ by 〇〇」と紹介されている場合、〇〇がブランド、△△が商品名"
)}

${BRAND_NAME_RULES}

${buildOccupationRules(
  [
    "- 記事内で「自分は◯◯をしています」「◯◯として働いている」などの言及があれば抽出",
  ],
  "明確な言及がない場合はnullと空配列を設定"
)}

${buildTagSelectionRules("記事", "独自タグの作成は禁止")}

${buildReasonRules("記事内", [
  "- Amazonリンクや楽天リンクから商品名を特定できる場合は活用してください",
])}

${buildGeneralNotes("記事内", "記事")}`;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    return parseGeminiJsonResponse(text);
  } catch (error) {
    console.error("Error analyzing article:", error);
    return { ...DEFAULT_ANALYSIS_ERROR };
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

/**
 * 複数のユーザーコメントからGeminiで「選ばれている理由TOP3」を抽出する
 * @param productName 商品名（ブランド名付き）
 * @param comments コメント文の配列
 * @returns 選ばれている理由TOP3（短いフレーズ3つ）
 */
export async function generateChosenReasons(
  productName: string,
  comments: string[]
): Promise<string[]> {
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

  const prompt = `あなたはデスク周りガジェットの分析アシスタントです。

以下は「${productName}」を実際に使用しているデスクツアー投稿者のコメント（${comments.length}件）です。

---コメント一覧---
${comments.map((c, i) => `${i + 1}. ${c}`).join("\n")}
---

上記コメントを分析し、この商品が選ばれている理由を重要度順にTOP3で抽出してください。

【ルール】
- 各理由は15〜25文字程度の簡潔な日本語フレーズにすること
- 複数のコメントで共通して言及されているポイントを優先すること
- 具体的な特徴やメリットを書くこと（「良い」「人気」のような抽象的な表現はNG）
- 出力は以下のJSON配列のみ。他の説明は不要

出力例:
["打鍵感が心地よく疲れにくい", "コンパクトで省スペース", "Bluetooth接続の安定性が高い"]`;

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();

    // JSON配列を抽出
    const match = text.match(/\[[\s\S]*?\]/);
    if (!match) {
      console.error("[ChosenReasons] Failed to parse response:", text);
      return [];
    }

    const reasons = JSON.parse(match[0]) as string[];
    return reasons.slice(0, 3);
  } catch (error) {
    console.error("[ChosenReasons] Gemini API error:", error);
    return [];
  }
}
