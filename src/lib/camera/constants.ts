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

// サブカテゴリ定義（MECE）
export const CAMERA_TYPE_TAGS: Record<string, string[]> = {
  "カメラ本体": [
    "ミラーレス一眼",
    "一眼レフ",
    "コンパクトデジタルカメラ",
    "シネマカメラ",
    "アクションカメラ",
  ],
  "レンズ": [
    "単焦点レンズ",
    "ズームレンズ",
    "シネマレンズ",
  ],
  "三脚": [
    "三脚",
    "一脚",
    "ミニ三脚",
    "トラベル三脚",
    "ビデオ三脚",
    "雲台",
  ],
  "ジンバル": [
    "カメラ用ジンバル",
    "スマホ用ジンバル",
    "メカニカルスタビライザー",
  ],
  "マイク・音声": [
    "マイク",
    "レコーダー",
    "オーディオインターフェース",
  ],
  "照明": [
    "定常光ライト",
    "ストロボ",
    "照明アクセサリー",
  ],
  "ストレージ": [
    "メモリーカード",
    "外部ストレージ",
    "カードリーダー",
  ],
  "カメラ装着アクセサリー": [
    "外部モニター",
    "ケージ・リグ",
    "フォローフォーカス",
    "レンズフィルター",
    "電子マウントアダプター",
    "バッテリー",
    "充電器",
    "カメラストラップ",
    "ハンドストラップ",
    "その他",
  ],
  "収録・制御機器": [
    "キャプチャーデバイス",
    "外部レコーダー",
    "制御アクセサリー",
    "キャリブレーションツール",
  ],
  "バッグ・収納": [
    "カメラバッグ",
    "バックパック",
    "スリングバッグ",
    "ハードケース",
    "インナーケース",
  ],
  "ドローンカメラ": [],
};

// 全サブカテゴリのフラットリスト
export const CAMERA_ALL_TYPE_TAGS = Object.values(CAMERA_TYPE_TAGS).flat();

// ========================================
// レンズ用タグ（MECE・複数軸）
// ========================================

export const CAMERA_LENS_TAGS: Record<string, string[]> = {
  "焦点距離": [
    "超広角",
    "広角",
    "標準",
    "中望遠",
    "望遠",
    "超望遠",
  ],
  "明るさ": [
    "F1.2-F1.4",
    "F1.8-F2",
    "F2.8",
    "F4",
    "可変F値",
  ],
  "機能": [
    "マクロ対応",
    "等倍マクロ",
    "手ブレ補正",
    "防塵防滴",
  ],
  "規格・対応": [
    "フルサイズ対応",
    "APS-C専用",
    "Eマウント",
    "RFマウント",
    "Zマウント",
    "Lマウント",
    "Xマウント",
    "MFT",
  ],
};

// レンズ用タグのフラットリスト
export const CAMERA_ALL_LENS_TAGS = Object.values(CAMERA_LENS_TAGS).flat();

// ========================================
// カメラ本体用タグ（MECE）
// ========================================

export const CAMERA_BODY_TAGS: Record<string, string[]> = {
  "撮像サイズ": [
    "フルサイズ",
    "APS-C",
    "マイクロフォーサーズ",
    "1インチ",
    "小型センサー",
  ],
};

// カメラ本体用タグのフラットリスト
export const CAMERA_ALL_BODY_TAGS = Object.values(CAMERA_BODY_TAGS).flat();

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
