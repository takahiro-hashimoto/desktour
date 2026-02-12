// ========================================
// 撮影機材DB - 商品カテゴリ一覧
// ========================================

export const CAMERA_PRODUCT_CATEGORIES = [
  "カメラ本体",
  "レンズ",
  "三脚",
  "ジンバル",
  "マイク・音声",
  "照明",
  "ストレージ",
  "カメラ装着アクセサリー",
  "収録・制御機器",
  "バッグ・収納",
  "ドローンカメラ",
] as const;

// ========================================
// タグ定義は camera-tag-definitions.ts に統合済み
// 既存コードの import を維持するための re-export
// ========================================

export {
  CAMERA_TYPE_TAGS,
  CAMERA_ALL_TYPE_TAGS,
  CAMERA_LENS_TAGS,
  CAMERA_ALL_LENS_TAGS,
  CAMERA_BODY_TAGS,
  CAMERA_ALL_BODY_TAGS,
} from "./camera-tag-definitions";

// カテゴリ→英語スラッグのマッピング
const CAMERA_CATEGORY_SLUG_MAP: Record<string, string> = {
  "カメラ本体": "camera-body",
  "レンズ": "lens",
  "三脚": "tripod",
  "ジンバル": "gimbal",
  "マイク・音声": "audio",
  "照明": "lighting",
  "ストレージ": "storage",
  "カメラ装着アクセサリー": "accessories",
  "収録・制御機器": "recording",
  "バッグ・収納": "bag",
  "ドローンカメラ": "drone",
};

// サブカテゴリ→英語スラッグのマッピング
const CAMERA_SUBCATEGORY_SLUG_MAP: Record<string, string> = {
  // カメラ本体
  "ミラーレス一眼": "mirrorless",
  "一眼レフ": "dslr",
  "コンパクトデジタルカメラ": "compact",
  "シネマカメラ": "cinema-camera",
  "アクションカメラ": "action-camera",
  // レンズ
  "単焦点レンズ": "prime",
  "ズームレンズ": "zoom",
  "シネマレンズ": "cinema-lens",
  // 三脚
  "三脚": "tripod",
  "一脚": "monopod",
  "ミニ三脚": "mini-tripod",
  "トラベル三脚": "travel-tripod",
  "ビデオ三脚": "video-tripod",
  "雲台": "head",
  // ジンバル
  "カメラ用ジンバル": "camera-gimbal",
  "スマホ用ジンバル": "smartphone-gimbal",
  "メカニカルスタビライザー": "mechanical-stabilizer",
  // マイク・音声
  "マイク": "microphone",
  "レコーダー": "recorder",
  "オーディオインターフェース": "audio-interface",
  // 照明
  "定常光ライト": "continuous-light",
  "ストロボ": "strobe",
  "照明アクセサリー": "lighting-accessory",
  // ストレージ
  "メモリーカード": "memory-card",
  "外部ストレージ": "external-storage",
  "カードリーダー": "card-reader",
  // カメラ装着アクセサリー
  "外部モニター": "external-monitor",
  "ケージ・リグ": "cage-rig",
  "フォローフォーカス": "follow-focus",
  "レンズフィルター": "lens-filter",
  "電子マウントアダプター": "mount-adapter",
  "バッテリー": "battery",
  "充電器": "charger",
  "カメラストラップ": "camera-strap",
  "ハンドストラップ": "hand-strap",
  // 収録・制御機器
  "キャプチャーデバイス": "capture-device",
  "外部レコーダー": "external-recorder",
  "制御アクセサリー": "control-accessory",
  "キャリブレーションツール": "calibration-tool",
  // バッグ・収納
  "カメラバッグ": "camera-bag",
  "カメラリュック": "camera-backpack",
  "ハードケース": "hard-case",
  "インナーケース": "inner-case",
};

// ========================================
// 被写体タグ（動画・記事解析時に付与）
// ========================================

export const CAMERA_SUBJECT_TAGS = [
  "人物",
  "商品",
  "風景",
  "動物",
  "乗り物",
] as const;

// ========================================
// 撮影目的タグ（動画・記事解析時に付与）
// ========================================

export const CAMERA_PURPOSE_TAGS = [
  "日常記録",
  "移動記録",
  "旅行記録",
  "アウトドア記録",
  "商品紹介・検証",
  "配信・収録",
] as const;

// 被写体タグ→英語スラッグのマッピング
const CAMERA_SUBJECT_SLUG_MAP: Record<string, string> = {
  "人物": "portrait",
  "商品": "product",
  "風景": "landscape",
  "動物": "animal",
  "乗り物": "vehicle",
};

// 全カメラソースタグ（被写体 + 撮影目的を統合）
export const CAMERA_SOURCE_TAGS = [
  ...CAMERA_SUBJECT_TAGS,
  ...CAMERA_PURPOSE_TAGS,
] as const;

// ========================================
// ソースページ用ブランドフィルター
// ========================================

export const CAMERA_SOURCE_BRAND_FILTERS = [
  "Canon",
  "Nikon",
  "Sony",
  "Fujifilm",
  "Olympus",
  "Panasonic",
  "Leica",
  "Hasselblad",
  "Pentax",
  "GoPro",
  "DJI",
  "Ricoh",
] as const;

// ========================================
// 職業タグ（優先度順）
// ========================================

export const CAMERA_OCCUPATION_TAGS = [
  "フォトグラファー",
  "映像クリエイター",
  "YouTuber",
  "Vlogger",
  "配信者・ストリーマー",
  "企業・法人撮影",
  "ドローン操縦者",
  "映像・写真学生／学習者",
] as const;

// 職業タグの優先度を取得（小さいほど優先度が高い）
export function getCameraOccupationPriority(tag: string): number {
  const index = CAMERA_OCCUPATION_TAGS.indexOf(tag as typeof CAMERA_OCCUPATION_TAGS[number]);
  return index === -1 ? 999 : index;
}

// 複数の職業タグから最も優先度の高い1つを選択
export function selectCameraPrimaryOccupation(tags: string[]): string | null {
  if (!tags || tags.length === 0) return null;
  const validTags = tags.filter(t => CAMERA_OCCUPATION_TAGS.includes(t as typeof CAMERA_OCCUPATION_TAGS[number]));
  if (validTags.length === 0) return null;
  validTags.sort((a, b) => getCameraOccupationPriority(a) - getCameraOccupationPriority(b));
  return validTags[0];
}

// 職業タグ→英語スラッグのマッピング
const CAMERA_OCCUPATION_SLUG_MAP: Record<string, string> = {
  "フォトグラファー": "photographer",
  "映像クリエイター": "video-creator",
  "YouTuber": "youtuber",
  "Vlogger": "vlogger",
  "配信者・ストリーマー": "streamer",
  "企業・法人撮影": "corporate",
  "ドローン操縦者": "drone-pilot",
  "映像・写真学生／学習者": "student",
};

// ========================================
// ブランドタグ（人気ブランド）
// ========================================

export const CAMERA_BRAND_TAGS = [
  "Sony",
  "Canon",
  "Nikon",
  "FUJIFILM",
  "Panasonic",
  "OM SYSTEM",
  "Sigma",
  "Tamron",
  "DJI",
  "Blackmagic Design",
  "RODE",
  "Sennheiser",
  "ZHIYUN",
  "Godox",
  "Aputure",
  "Manfrotto",
  "Gitzo",
  "SmallRig",
  "Tilta",
  "Atomos",
] as const;

// ブランドタグ→英語スラッグのマッピング
const CAMERA_BRAND_SLUG_MAP: Record<string, string> = {
  "Sony": "sony",
  "Canon": "canon",
  "Nikon": "nikon",
  "FUJIFILM": "fujifilm",
  "Panasonic": "panasonic",
  "OM SYSTEM": "om-system",
  "Sigma": "sigma",
  "Tamron": "tamron",
  "DJI": "dji",
  "Blackmagic Design": "blackmagic-design",
  "RODE": "rode",
  "Sennheiser": "sennheiser",
  "ZHIYUN": "zhiyun",
  "Godox": "godox",
  "Aputure": "aputure",
  "Manfrotto": "manfrotto",
  "Gitzo": "gitzo",
  "SmallRig": "smallrig",
  "Tilta": "tilta",
  "Atomos": "atomos",
};

// ========================================
// スラッグ変換関数
// ========================================

export function cameraCategoryToSlug(category: string): string {
  return CAMERA_CATEGORY_SLUG_MAP[category] || category.replace(/[/・]/g, "-").replace(/\s+/g, "-").toLowerCase();
}

export function slugToCameraCategory(slug: string): string | undefined {
  const entry = Object.entries(CAMERA_CATEGORY_SLUG_MAP).find(([, s]) => s === slug);
  return entry ? entry[0] : undefined;
}

/** カメラ商品詳細ページのURLを生成 */
export function cameraProductUrl(product: { slug?: string; id: string }): string {
  return `/camera/${product.slug || product.id}`;
}

export function cameraOccupationToSlug(occupation: string): string {
  return CAMERA_OCCUPATION_SLUG_MAP[occupation] || occupation.replace(/\s+/g, "-").toLowerCase();
}

export function slugToCameraOccupation(slug: string): string | undefined {
  const entry = Object.entries(CAMERA_OCCUPATION_SLUG_MAP).find(([, s]) => s === slug);
  return entry ? entry[0] as typeof CAMERA_OCCUPATION_TAGS[number] : undefined;
}

export function cameraSubcategoryToSlug(subcategory: string): string {
  return CAMERA_SUBCATEGORY_SLUG_MAP[subcategory] || subcategory.replace(/[/・]/g, "-").replace(/\s+/g, "-").toLowerCase();
}

export function slugToCameraSubcategory(slug: string): string | undefined {
  const entry = Object.entries(CAMERA_SUBCATEGORY_SLUG_MAP).find(([, s]) => s === slug);
  return entry ? entry[0] : undefined;
}

export function cameraBrandToSlug(brand: string): string {
  return CAMERA_BRAND_SLUG_MAP[brand] || brand.toLowerCase().replace(/\s+/g, "-");
}

export function slugToCameraBrand(slug: string): string | undefined {
  const entry = Object.entries(CAMERA_BRAND_SLUG_MAP).find(([, s]) => s === slug);
  return entry ? entry[0] as typeof CAMERA_BRAND_TAGS[number] : undefined;
}

export function cameraSubjectToSlug(subject: string): string {
  return CAMERA_SUBJECT_SLUG_MAP[subject] || subject.toLowerCase().replace(/\s+/g, "-");
}

export function slugToCameraSubject(slug: string): string | undefined {
  const entry = Object.entries(CAMERA_SUBJECT_SLUG_MAP).find(([, s]) => s === slug);
  return entry ? entry[0] as typeof CAMERA_SUBJECT_TAGS[number] : undefined;
}

// スラッグからブランド名を推測（登録外ブランドにも対応）
export function inferCameraBrandFromSlug(slug: string): string {
  const exactMatch = Object.entries(CAMERA_BRAND_SLUG_MAP).find(([, s]) => s === slug);
  if (exactMatch) return exactMatch[0];

  return slug
    .split("-")
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

// ========================================
// カテゴリ間の相性マップ
// ========================================

export const CAMERA_COMPATIBLE_CATEGORIES: Record<string, string[]> = {
  "カメラ本体": ["レンズ", "マイク・音声", "三脚", "ジンバル", "ストレージ", "バッグ・収納"],
  "レンズ": ["カメラ本体", "三脚", "カメラ装着アクセサリー", "バッグ・収納"],
  "三脚": ["カメラ本体", "レンズ", "ジンバル", "照明"],
  "ジンバル": ["カメラ本体", "三脚", "カメラ装着アクセサリー"],
  "マイク・音声": ["カメラ本体", "収録・制御機器", "カメラ装着アクセサリー"],
  "照明": ["カメラ本体", "三脚", "カメラ装着アクセサリー", "収録・制御機器"],
  "ストレージ": ["カメラ本体", "収録・制御機器", "カメラ装着アクセサリー"],
  "カメラ装着アクセサリー": ["カメラ本体", "レンズ", "照明", "収録・制御機器"],
  "収録・制御機器": ["カメラ本体", "マイク・音声", "照明", "カメラ装着アクセサリー"],
  "バッグ・収納": ["カメラ本体", "レンズ", "三脚"],
  "ドローンカメラ": ["ストレージ", "バッグ・収納", "カメラ装着アクセサリー"],
};

export function getCameraCompatibleCategories(category: string): string[] {
  return CAMERA_COMPATIBLE_CATEGORIES[category] || [];
}

// ========================================
// 価格帯定義（desktourと共通）
// ========================================

export const CAMERA_PRICE_RANGES = [
  { key: "under_5000", label: "5,000円以下" },
  { key: "5000_10000", label: "5,000〜10,000円" },
  { key: "10000_30000", label: "10,000〜30,000円" },
  { key: "30000_50000", label: "30,000〜50,000円" },
  { key: "50000_100000", label: "50,000〜100,000円" },
  { key: "100000_300000", label: "100,000〜300,000円" },
  { key: "over_300000", label: "300,000円以上" },
] as const;
