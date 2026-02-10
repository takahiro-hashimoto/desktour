import { GoogleGenerativeAI } from "@google/generative-ai";
import {
  PRODUCT_CATEGORIES, OCCUPATION_TAGS,
  TAG_GROUP_STYLE, TAG_GROUP_MONITOR, TAG_GROUP_DESK, TAG_GROUP_OS, TAG_GROUP_FEATURES,
  DESK_SETUP_TAGS, selectPrimaryOccupation, validateTags,
} from "./constants";
import { CAMERA_PRODUCT_CATEGORIES, CAMERA_OCCUPATION_TAGS, CAMERA_TYPE_TAGS, CAMERA_LENS_TAGS, CAMERA_BODY_TAGS } from "./camera/constants";

/** 解析対象のドメイン（desktour / camera） */
export type AnalysisDomain = "desktour" | "camera";

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
function parseGeminiJsonResponse(text: string, domain: AnalysisDomain = "desktour"): AnalysisResult {
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
  if (domain === "desktour") {
    // desktour: 排他グループのバリデーション（矛盾するタグを自動修正）
    parsed.tags = validateTags(parsed.tags);
  }
  // camera: タグバリデーション不要（スタイルタグなし）
  if (!parsed.influencerOccupationTags) {
    parsed.influencerOccupationTags = [];
  }
  if (domain === "desktour") {
    // desktour: Geminiが複数タグを返した場合、優先度順で1つに絞る
    if (parsed.influencerOccupationTags.length > 1) {
      const primary = selectPrimaryOccupation(parsed.influencerOccupationTags);
      parsed.influencerOccupationTags = primary ? [primary] : [];
    }
  } else {
    // camera: 最初の1つだけ残す（camera用の職業タグバリデーション）
    if (parsed.influencerOccupationTags.length > 1) {
      const validTags = parsed.influencerOccupationTags.filter(
        (t: string) => (CAMERA_OCCUPATION_TAGS as readonly string[]).includes(t)
      );
      parsed.influencerOccupationTags = validTags.length > 0 ? [validTags[0]] : [];
    }
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
  subcategory?: string;
  lensTags?: string[];
  bodyTags?: string[];
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
// reason補完（2ndパス）
// ============================================================

/** reasonが不十分かどうかを判定 */
function isReasonInsufficient(reason: string | undefined): boolean {
  if (!reason) return true;
  const trimmed = reason.trim();
  if (trimmed.length < 20) return true;
  // 「言及なし」「言及がない」「不明」等のプレースホルダ判定
  if (/^(言及なし|言及がない|言及されていない|不明|なし|特になし|N\/A)/.test(trimmed)) return true;
  // 2ndパスのフォールバック的な文言を検出
  if (/詳細な言及はない/.test(trimmed)) return true;
  if (/愛用(機材|アイテム)の一つとして紹介/.test(trimmed)) return true;
  return false;
}

/**
 * reasonが不十分な商品に対し、追加のGemini呼び出しでreasonを補完する
 * コンテンツ（文字起こしor記事本文）を渡し、対象商品だけのreasonを生成
 */
async function supplementReasons(
  result: AnalysisResult,
  contentText: string,
  sourceLabel: string,
): Promise<AnalysisResult> {
  const insufficientProducts = result.products.filter(p => isReasonInsufficient(p.reason));
  if (insufficientProducts.length === 0) return result;

  console.log(`[Gemini] Supplementing reasons for ${insufficientProducts.length} products...`);

  const model = genAI.getGenerativeModel({
    model: "gemini-2.0-flash",
    generationConfig: { maxOutputTokens: 8192 },
  });

  const productList = insufficientProducts
    .map((p, i) => `${i + 1}. ${p.brand ? p.brand + " " : ""}${p.name}`)
    .join("\n");

  const prompt = `以下の${sourceLabel}で紹介されている商品について、それぞれの商品コメント（reason）を記述してください。

${sourceLabel}:
${contentText.slice(0, 30000)}

【対象商品】
${productList}

【記述ルール】
- 発信者本人の視点・言葉として書くこと（一人称視点）
- 「〜とのこと」「〜だそうだ」のような第三者目線の表現は禁止
- 「〜が気に入っている」「〜で使っている」のように本人が語っている口調で書く
- 100-200文字程度で、なぜ選んだか・気に入っている点・特徴を具体的に記述
- ${sourceLabel}の内容を丁寧に読み、各商品について必ず具体的なコメントを書くこと
- 「言及なし」「言及がない」「不明」「紹介されている」だけの抽象的なコメントは絶対に禁止

以下のJSON形式で回答してください。reasonsは対象商品と同じ順番の配列で返してください。必ず有効なJSONのみを出力してください。
{
  "reasons": [
    "1番目の商品のreason文",
    "2番目の商品のreason文"
  ]
}`;

  try {
    const genResult = await model.generateContent(prompt);
    const response = await genResult.response;
    const text = response.text();

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.warn("[Gemini] No JSON in reason supplement response");
      return result;
    }

    let parsed: { reasons: string[] };
    try {
      parsed = JSON.parse(jsonMatch[0]);
    } catch {
      const cleaned = cleanupMalformedJson(jsonMatch[0]);
      if (!cleaned) {
        console.warn("[Gemini] Failed to parse reason supplement response");
        return result;
      }
      parsed = JSON.parse(cleaned);
    }

    if (!parsed.reasons || !Array.isArray(parsed.reasons)) return result;

    console.log(`[Gemini] Supplement returned ${parsed.reasons.length} reasons for ${insufficientProducts.length} products`);

    // 配列のインデックスで1:1マッチング
    let supplementIndex = 0;
    for (const product of result.products) {
      if (!isReasonInsufficient(product.reason)) continue;

      const supplementedReason = parsed.reasons[supplementIndex];
      supplementIndex++;

      if (supplementedReason && supplementedReason.length >= 10 && !isReasonInsufficient(supplementedReason)) {
        console.log(`[Gemini] Supplemented reason for "${product.name}"`);
        product.reason = supplementedReason;
      } else {
        console.warn(`[Gemini] Supplement still insufficient for "${product.name}": "${supplementedReason?.slice(0, 30) || "(empty)"}..."`);
      }
    }

    return result;
  } catch (error) {
    console.error("[Gemini] Error supplementing reasons:", error);
    return result; // 補完失敗でも元の結果をそのまま返す
  }
}

// ============================================================
// 共通プロンプトテンプレート（analyzeTranscript / analyzeArticle で共有）
// ============================================================

/** JSON出力指示の共通ヘッダ */
const PROMPT_JSON_INSTRUCTION = `以下のJSON形式で回答してください。必ず有効なJSONのみを出力し、他の説明は含めないでください。`;

/** productsフィールドのJSONスキーマ（name, brand, category, reason, confidence） */
function buildProductFieldsSchema(categories: readonly string[], options?: {
  typeTags?: Record<string, string[]>;
  lensTags?: Record<string, string[]>;
  bodyTags?: Record<string, string[]>;
}): string {
  const subcategoryField = options?.typeTags
    ? `,
      "subcategory": "サブカテゴリ名（categoryに応じた種類タグから1つ選択。該当なしの場合は空文字）"`
    : "";
  const lensTagsField = options?.lensTags
    ? `,
      "lensTags": ["レンズ用タグ（categoryが「レンズ」の場合のみ。焦点距離・明るさ・機能・規格から該当するものを複数選択。レンズ以外は空配列[]）"]`
    : "";
  const bodyTagsField = options?.bodyTags
    ? `,
      "bodyTags": ["カメラ本体用タグ（categoryが「カメラ本体」の場合のみ。撮像サイズから1つ選択。カメラ本体以外は空配列[]）"]`
    : "";
  return `{
      "name": "商品名（ブランド名は含めない。Amazonで検索して特定できる名前にすること。スペック文字列や一般名詞だけはNG。例：ERGO M575S, LX デスクマウント モニターアーム, ScreenBar Halo 2）",
      "brand": "ブランド/メーカー名（例：Apple, Logicool, HHKB, Keychron, FLEXISPOT, エルゴトロン等。必ず記載すること。不明な場合のみ空文字）",
      "category": "カテゴリ名（以下から選択: ${categories.join(", ")}）"${subcategoryField}${lensTagsField}${bodyTagsField},
      "reason": "【重要】以下の観点を含めて詳しく記述（100-200文字程度）：
        1. なぜこの商品を選んだのか（導入理由・きっかけ）
        2. 実際に使ってみて気に入っている点
        3. 他の商品と比較した優位性があれば
        4. どんな人におすすめか",
      "confidence": "high/medium/low（商品名の特定に対する確信度）"
    }`;
}
const PRODUCT_FIELDS_SCHEMA = buildProductFieldsSchema(PRODUCT_CATEGORIES);

/** サブカテゴリ選択肢のルールテキストを構築 */
function buildSubcategoryRules(typeTags: Record<string, string[]>): string {
  const lines = Object.entries(typeTags)
    .filter(([, tags]) => tags.length > 0)
    .map(([cat, tags]) => `  - ${cat}: ${tags.join(", ")}`);
  return `【サブカテゴリ（subcategory）の選択ルール】★重要★
- categoryごとに定義されたサブカテゴリから最も適切な1つを選択すること
- 該当するものがない場合は空文字""を設定
${lines.join("\n")}`;
}

/** レンズ用タグのルールテキストを構築 */
function buildLensTagRules(lensTags: Record<string, string[]>): string {
  const lines = Object.entries(lensTags).map(
    ([group, tags]) => `  - ${group}: ${tags.join(", ")}`
  );
  return `【レンズ用タグ（lensTags）の選択ルール】★レンズの場合のみ★
- categoryが「レンズ」の商品にのみ適用
- 以下の各軸から該当するタグを複数選択（配列で返す）
- 商品スペックや動画/記事内の言及から判断すること
- 不明な場合はそのグループからは選択しなくてよい
${lines.join("\n")}
- レンズ以外のカテゴリの商品は空配列[]を設定`;
}

/** カメラ本体用タグのルールテキストを構築 */
function buildBodyTagRules(bodyTags: Record<string, string[]>): string {
  const lines = Object.entries(bodyTags).map(
    ([group, tags]) => `  - ${group}: ${tags.join(", ")}`
  );
  return `【カメラ本体用タグ（bodyTags）の選択ルール】★カメラ本体の場合のみ★
- categoryが「カメラ本体」の商品にのみ適用
- 以下から最も適切な1つを選択（配列で返す）
${lines.join("\n")}
- カメラ本体以外のカテゴリの商品は空配列[]を設定`;
}

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
    `- ★重要★ 発信者本人の視点・言葉として書くこと（一人称視点）。第三者が紹介する文体にしない`,
    `- 「〜とのこと」「〜だそうだ」「〜されている」のような第三者目線の表現は禁止`,
    `- 「〜が気に入っている」「〜で使っている」「〜が魅力」「〜で購入した」のように、本人が語っている口調で書く`,
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
- デスクツアーや撮影機材に関係ない商品（飲料、服など）は除外
- タグは${contentLabel}の内容に合致するものだけを選択（無理に全部選ばない）
- ★重要★ ${sourceLabel}にAmazon・楽天などの購入リンクが貼られている商品は、小物やアクセサリー類であっても漏れなくすべて抽出すること。メイン機材だけでなく、ストラップ、フィルター、バッグ、充電器、LEDライト、リモコン等の周辺機材・アクセサリーも含める`;
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
  thumbnailUrl?: string,
  domain: AnalysisDomain = "desktour"
): Promise<AnalysisResult> {
  const model = genAI.getGenerativeModel({
    model: "gemini-2.0-flash",
    generationConfig: { maxOutputTokens: 16384 },
  });
  const isCamera = domain === "camera";

  // チャンネル・動画概要欄から職業を推測するための情報を追加
  const contextInfo = [];
  if (videoDescription) {
    contextInfo.push(`【動画概要欄】\n${videoDescription.slice(0, 2000)}`);
  }
  if (channelDescription) {
    contextInfo.push(`【チャンネル概要欄】\n${channelDescription.slice(0, 1000)}`);
  }
  const additionalContext = contextInfo.length > 0 ? `\n\n${contextInfo.join("\n\n")}` : "";

  const thumbnailNote = !isCamera && thumbnailUrl
    ? "\n※ サムネイル画像が添付されています。スタイルタグの判定（色味・雰囲気）の参考にしてください。"
    : "";

  // ドメインに応じたカテゴリ・職業タグ・タグの切り替え
  const categories = isCamera ? CAMERA_PRODUCT_CATEGORIES : PRODUCT_CATEGORIES;
  const occupationTags = isCamera ? [...CAMERA_OCCUPATION_TAGS] : OCCUPATION_TAGS;
  const productSchema = isCamera
    ? buildProductFieldsSchema(categories, { typeTags: CAMERA_TYPE_TAGS, lensTags: CAMERA_LENS_TAGS, bodyTags: CAMERA_BODY_TAGS })
    : buildProductFieldsSchema(categories);

  const prompt = isCamera
    ? `あなたは撮影機材紹介動画を分析する専門家です。視聴者が機材購入の参考にできるよう、詳細で具体的な情報を抽出してください。

動画タイトル: ${videoTitle}
${additionalContext}

【文字起こし】
${transcript.slice(0, 18000)}

${PROMPT_JSON_INSTRUCTION}

{
  "influencerOccupation": "動画投稿者の職業を具体的に記述（例：フリーランスの映像クリエイター、写真スタジオ勤務のフォトグラファー等）。動画内・概要欄・チャンネル説明から推測可能な場合は記載。不明な場合はnull",
  "influencerOccupationTags": ["最も適切な職業タグを1つだけ選択: ${occupationTags.join(", ")}"],
  "products": [
    ${productSchema}
  ],
  "summary": "【重要】以下の観点を含めて詳しく要約（200-400文字程度）：
    1. 撮影環境のコンセプト・テーマ（ポートレート撮影、映像制作、Vlog等）
    2. 最もこだわっている機材やセットアップ
    3. 主な撮影環境（スタジオ/ロケ/自宅等）
    4. 機材セットアップの総評や特筆すべき点
    【書き出しルール】★最重要★
    - 必ず「〇〇系の情報発信をしている〇〇さんの撮影機材紹介動画です。」で始めること
    - 〇〇系の部分は発信ジャンルを簡潔に表現（例：夜景写真系、映像制作系、ポートレート系、風景写真系、Vlog系など）
    - 〇〇さんの部分は投稿者名やチャンネル名を使用
    【文体ルール】
    - 丁寧なです・ます調を基本とする
    - ただし同じ語尾が2文連続しないよう、体言止め等で変化をつける
    - 良い例：「夜景写真系の情報発信をしている〇〇さんの撮影機材紹介動画です。フルサイズミラーレスを中心とした機材構成で、特に夜景撮影に適したレンズ選びへのこだわりが特徴的。三脚やリモートシャッターなど、長時間露光に必要なアクセサリーも充実しています」",
  "tags": []
}

${buildOccupationRules(
  [
    "- 動画内の発言（「自分は◯◯をしています」「◯◯として撮影している」等）から推測",
    "- チャンネル概要欄の自己紹介文からも推測可能",
  ],
  "全く推測できない場合のみnullと空配列を設定"
)}
- influencerOccupationは具体的に自由記述（例：「フリーランスで企業VP撮影をしている映像クリエイター」等）

【カテゴリ判定ルール】★最重要★
- 以下のカテゴリ定義に従って正確に分類すること：
  - カメラ本体: ミラーレス一眼、一眼レフ、シネマカメラ、コンデジ、アクションカメラ等（カメラボディ本体のみ）
  - レンズ: 交換レンズ（単焦点・ズーム・シネマレンズ等）
  - 三脚: 三脚、一脚、ミニ三脚、トラベル三脚、ビデオ三脚、雲台等
  - ジンバル: カメラ用ジンバル、スマホ用ジンバル、メカニカルスタビライザー等
  - マイク・音声: マイク全般、レコーダー、オーディオインターフェース等
  - 照明: 定常光ライト（LEDパネル、チューブライト等）、ストロボ、照明アクセサリー等
  - ストレージ: SDカード、CFexpressカード、ポータブルSSD、外付けHDD、カードリーダー等
  - カメラ装着アクセサリー: 外部モニター、ケージ・リグ、フォローフォーカス、レンズフィルター、バッテリー、充電器等
  - 収録・制御機器: キャプチャーデバイス、外部レコーダー、制御アクセサリー、キャリブレーションツール等
  - バッグ・収納: カメラバッグ、バックパック、スリングバッグ、ハードケース等
  - ドローンカメラ: ドローン本体（カメラ内蔵のドローン製品）
- 「カメラ本体」はカメラボディ本体のみ。レンズやアクセサリーは必ず該当カテゴリに分類すること
- 三脚は「三脚」カテゴリに、ジンバルは「ジンバル」カテゴリに分類（「カメラ装着アクセサリー」に入れない）
- メモリーカード・SSDは「ストレージ」カテゴリに分類（「収録・制御機器」に入れない）
- ドローンは「ドローンカメラ」カテゴリに分類（「カメラ本体」に入れない）
- レンズフィルターは「カメラ装着アクセサリー」に分類（「レンズ」に入れない）

${buildSubcategoryRules(CAMERA_TYPE_TAGS)}

${buildLensTagRules(CAMERA_LENS_TAGS)}

${buildBodyTagRules(CAMERA_BODY_TAGS)}

${buildProductNameRules(
  "概要欄のAmazon/楽天リンクから正確な商品名を取得できる場合はそれを最優先で使用",
  "動画/記事内で「〇〇の△△」「△△ by 〇〇」と紹介されている場合、〇〇がブランド、△△が商品名"
)}

${BRAND_NAME_RULES}

${buildReasonRules("動画内", [
  "- 例（良い例）：「映像制作で暗所撮影が多いため、高感度耐性に優れたこの機種を選んだ。ISO12800でもノイズが少なく、ダイナミックレンジの広さが色補正の余地を生んでくれる。同価格帯の他社機と比較してAFの食いつきも良い」",
  "- 例（悪い例）：「画質が良くておすすめ」「高感度耐性に優れているとのこと」",
])}

${buildGeneralNotes("動画内", "動画")}`
    : `あなたはデスクツアー動画を分析する専門家です。視聴者が商品購入の参考にできるよう、詳細で具体的な情報を抽出してください。${thumbnailNote}

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
  "summary": "【重要】以下の観点を含めて詳しく要約（200-400文字程度）：
    1. デスク環境のコンセプト・テーマ（ミニマル、ゲーミング、クリエイター向け等）
    2. 最もこだわっているポイント
    3. 使用しているPC/OS環境（Mac/Windows/両方）
    4. デスク環境の総評や特筆すべき点
    【書き出しルール】★最重要★
    - 必ず「〇〇系の情報発信をしている〇〇さんのデスクツアー動画です。」で始めること
    - 〇〇系の部分は発信ジャンルを簡潔に表現（例：ガジェット系、テック系、プログラミング系、デザイン系、ライフスタイル系など）
    - 〇〇さんの部分は投稿者名やチャンネル名を使用
    【文体ルール】
    - 丁寧なです・ます調を基本とする
    - ただし同じ語尾が2文連続しないよう、体言止め等で変化をつける
    - 良い例：「ガジェット系の情報発信をしている〇〇さんのデスクツアー動画です。ミニマルな白基調で、生産性と美学の両立を追求した構成が特徴的。MacBook Proをクラムシェルモードでウルトラワイドモニターに接続し、配線は徹底的に隠すこだわりが見られます」",
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
  "- 例（良い例）：「在宅勤務で長時間座ることが増えて、腰痛対策として購入した。ランバーサポートが腰にフィットして、8時間座っても疲れにくい。メッシュ素材で夏場も蒸れないのが気に入っている」",
  "- 例（悪い例）：「座り心地が良くておすすめ」「腰痛対策として購入されたとのこと」",
])}

${buildGeneralNotes("動画内", "動画")}`;

  try {
    // サムネイル画像がある場合はマルチモーダル送信（desktourのみ）
    let result;
    if (!isCamera && thumbnailUrl) {
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

    const analysisResult = parseGeminiJsonResponse(text, domain);

    // 2ndパス: reasonが不十分な商品があれば補完
    return await supplementReasons(analysisResult, transcript, "動画内");
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
  articleTitle: string,
  domain: AnalysisDomain = "desktour",
  productHints?: string[]
): Promise<AnalysisResult> {
  const model = genAI.getGenerativeModel({
    model: "gemini-2.0-flash",
    generationConfig: { maxOutputTokens: 16384 },
  });
  const isCamera = domain === "camera";

  const categories = isCamera ? CAMERA_PRODUCT_CATEGORIES : PRODUCT_CATEGORIES;
  const occupationTags = isCamera ? [...CAMERA_OCCUPATION_TAGS] : OCCUPATION_TAGS;
  const productSchema = isCamera
    ? buildProductFieldsSchema(categories, { typeTags: CAMERA_TYPE_TAGS, lensTags: CAMERA_LENS_TAGS, bodyTags: CAMERA_BODY_TAGS })
    : buildProductFieldsSchema(categories);

  // 記事内のAmazon/楽天リンクから取得した商品名ヒント
  const productHintSection = productHints && productHints.length > 0
    ? `\n【記事内の購入リンクから検出された商品一覧】★重要★
以下は記事内のAmazon/楽天リンクから取得した商品タイトルです。記事本文にはリンク情報が含まれていないため、この一覧を参照してください。
これらの商品が記事内で紹介・言及されている場合は、すべてproductsに含めてください（小物・アクセサリー含む）。
${productHints.map((h, i) => `${i + 1}. ${h}`).join("\n")}\n`
    : "";

  const prompt = isCamera
    ? `あなたは撮影機材紹介記事を分析する専門家です。読者が機材購入の参考にできるよう、詳細で具体的な情報を抽出してください。

記事タイトル: ${articleTitle}
${productHintSection}
記事本文:
${content.slice(0, 30000)}

${PROMPT_JSON_INSTRUCTION}

{
  "influencerOccupation": "記事執筆者の職業（記事内で言及されている場合のみ。例：映像クリエイター、フォトグラファー等。不明な場合はnull）",
  "influencerOccupationTags": ["最も適切な職業タグを1つだけ選択: ${occupationTags.join(", ")}"],
  "products": [
    ${productSchema}
  ],
  "summary": "この記事の撮影機材セットアップの特徴を2-3文で要約。必ず「〇〇系の情報発信をしている〇〇さんの撮影機材紹介記事です。」で書き出すこと（〇〇系＝発信ジャンル、〇〇さん＝執筆者名）。丁寧なです・ます調を基本とし、同じ語尾が2文連続しないよう体言止め等で変化をつけること",
  "tags": []
}

【カテゴリ判定ルール】★最重要★
- 以下のカテゴリ定義に従って正確に分類すること：
  - カメラ本体: ミラーレス一眼、一眼レフ、シネマカメラ、コンデジ、アクションカメラ等（カメラボディ本体のみ）
  - レンズ: 交換レンズ（単焦点・ズーム・シネマレンズ等）
  - 三脚: 三脚、一脚、ミニ三脚、トラベル三脚、ビデオ三脚、雲台等
  - ジンバル: カメラ用ジンバル、スマホ用ジンバル、メカニカルスタビライザー等
  - マイク・音声: マイク全般、レコーダー、オーディオインターフェース等
  - 照明: 定常光ライト（LEDパネル、チューブライト等）、ストロボ、照明アクセサリー等
  - ストレージ: SDカード、CFexpressカード、ポータブルSSD、外付けHDD、カードリーダー等
  - カメラ装着アクセサリー: 外部モニター、ケージ・リグ、フォローフォーカス、レンズフィルター、バッテリー、充電器等
  - 収録・制御機器: キャプチャーデバイス、外部レコーダー、制御アクセサリー、キャリブレーションツール等
  - バッグ・収納: カメラバッグ、バックパック、スリングバッグ、ハードケース等
  - ドローンカメラ: ドローン本体（カメラ内蔵のドローン製品）
- 「カメラ本体」はカメラボディ本体のみ。レンズやアクセサリーは必ず該当カテゴリに分類すること
- 三脚は「三脚」カテゴリに、ジンバルは「ジンバル」カテゴリに分類（「カメラ装着アクセサリー」に入れない）
- メモリーカード・SSDは「ストレージ」カテゴリに分類（「収録・制御機器」に入れない）
- ドローンは「ドローンカメラ」カテゴリに分類（「カメラ本体」に入れない）
- レンズフィルターは「カメラ装着アクセサリー」に分類（「レンズ」に入れない）

${buildSubcategoryRules(CAMERA_TYPE_TAGS)}

${buildLensTagRules(CAMERA_LENS_TAGS)}

${buildBodyTagRules(CAMERA_BODY_TAGS)}

${buildProductNameRules(
  "記事内のAmazon/楽天リンクから正確な商品名を取得できる場合はそれを最優先で使用",
  "記事内で「〇〇の△△」「△△ by 〇〇」と紹介されている場合、〇〇がブランド、△△が商品名"
)}

${BRAND_NAME_RULES}

${buildOccupationRules(
  [
    "- 記事内で「自分は◯◯をしています」「◯◯として撮影している」などの言及があれば抽出",
  ],
  "明確な言及がない場合はnullと空配列を設定"
)}

${buildReasonRules("記事内", [
  "- Amazonリンクや楽天リンクから商品名を特定できる場合は活用してください",
])}

${buildGeneralNotes("記事内", "記事")}`
    : `あなたはデスクツアー記事を分析する専門家です。読者が商品購入の参考にできるよう、詳細で具体的な情報を抽出してください。

記事タイトル: ${articleTitle}
${productHintSection}
記事本文:
${content.slice(0, 30000)}

${PROMPT_JSON_INSTRUCTION}

{
  "influencerOccupation": "記事執筆者の職業（記事内で言及されている場合のみ。例：エンジニア、デザイナー等。不明な場合はnull）",
  "influencerOccupationTags": ["最も適切な職業タグを1つだけ選択: ${OCCUPATION_TAGS.join(", ")}"],
  "products": [
    ${PRODUCT_FIELDS_SCHEMA}
  ],
  "summary": "この記事のデスク環境の特徴を2-3文で要約。必ず「〇〇系の情報発信をしている〇〇さんのデスクツアー記事です。」で書き出すこと（〇〇系＝発信ジャンル、〇〇さん＝執筆者名）。丁寧なです・ます調を基本とし、同じ語尾が2文連続しないよう体言止め等で変化をつけること",
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

    const analysisResult = parseGeminiJsonResponse(text, domain);

    // 2ndパス: reasonが不十分な商品があれば補完
    return await supplementReasons(analysisResult, content, "記事内");
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
