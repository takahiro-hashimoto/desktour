// 商品カテゴリ
export const PRODUCT_CATEGORIES = [
  "キーボード",
  "マウス",
  "ディスプレイ/モニター",
  "デスク",
  "チェア",
  "マイク",
  "ウェブカメラ",
  "ヘッドホン/イヤホン",
  "スピーカー",
  "照明・ライト",
  "PCスタンド/ノートPCスタンド",
  "モニターアーム",
  "モニター台",
  "ケーブル/ハブ",
  "USBハブ",
  "デスクマット",
  "収納/整理",
  "PC本体",
  "タブレット",
  "ペンタブ",
  "充電器/電源",
  "オーディオインターフェース",
  "ドッキングステーション",
  "左手デバイス",
  "HDD/SSD",
  "その他デスクアクセサリー",
] as const;

// サブカテゴリ定義（カテゴリごとの詳細分類）
export const SUBCATEGORIES: Record<string, string[]> = {
  "キーボード": [
    "メカニカルキーボード",
    "静電容量無接点",
    "分割キーボード",
    "テンキーレス",
    "60%/65%キーボード",
    "フルサイズキーボード",
    "ロープロファイル",
  ],
  "マウス": [
    "トラックボール",
    "エルゴノミクスマウス",
    "ゲーミングマウス",
    "縦型マウス",
    "ワイヤレスマウス",
  ],
  "ディスプレイ/モニター": [
    "4Kモニター",
    "ウルトラワイドモニター",
    "ゲーミングモニター",
    "モバイルモニター",
    "縦置きモニター",
    "5K/6Kモニター",
  ],
  "ヘッドホン/イヤホン": [
    "開放型ヘッドホン",
    "密閉型ヘッドホン",
    "ワイヤレスイヤホン",
    "有線イヤホン",
    "モニターヘッドホン",
    "ゲーミングヘッドセット",
  ],
  "チェア": [
    "ゲーミングチェア",
    "オフィスチェア",
    "エルゴノミクスチェア",
    "メッシュチェア",
    "バランスチェア",
  ],
  "デスク": [
    "昇降デスク",
    "L字デスク",
    "PCデスク",
    "DIYデスク",
    "ゲーミングデスク",
  ],
  "マイク": [
    "コンデンサーマイク",
    "ダイナミックマイク",
    "USBマイク",
    "XLRマイク",
    "ピンマイク",
  ],
  "スピーカー": [
    "モニタースピーカー",
    "PCスピーカー",
    "サウンドバー",
    "Bluetoothスピーカー",
  ],
  "照明・ライト": [
    "デスクライト",
    "モニターライト",
    "間接照明",
    "リングライト",
    "LEDテープ",
  ],
  "ウェブカメラ": [
    "4Kウェブカメラ",
    "フルHDウェブカメラ",
    "広角ウェブカメラ",
  ],
  "PC本体": [
    "デスクトップPC",
    "ノートPC",
    "ミニPC",
    "自作PC",
    "Mac",
  ],
  "HDD/SSD": [
    "外付けSSD",
    "外付けHDD",
    "HDDケース",
    "NAS",
    "内蔵SSD",
    "内蔵HDD",
  ],
};

// 全サブカテゴリのフラットリスト
export const ALL_SUBCATEGORIES = Object.values(SUBCATEGORIES).flat();

// Geminiプロンプト用のフォーマット済みサブカテゴリ文字列
export const SUBCATEGORIES_FOR_PROMPT = Object.entries(SUBCATEGORIES)
  .map(([cat, subs]) => `${cat}: ${subs.join(", ")}`)
  .join("\n  ");

// カテゴリ→英語スラッグのマッピング
const CATEGORY_SLUG_MAP: Record<string, string> = {
  "キーボード": "keyboard",
  "マウス": "mouse",
  "ディスプレイ/モニター": "monitor",
  "デスク": "desk",
  "チェア": "chair",
  "マイク": "microphone",
  "ウェブカメラ": "webcam",
  "ヘッドホン/イヤホン": "headphones",
  "スピーカー": "speaker",
  "照明・ライト": "lighting",
  "PCスタンド/ノートPCスタンド": "pc-stand",
  "モニターアーム": "monitor-arm",
  "モニター台": "monitor-stand",
  "ケーブル/ハブ": "cable-hub",
  "USBハブ": "usb-hub",
  "デスクマット": "desk-mat",
  "収納/整理": "storage",
  "PC本体": "pc",
  "タブレット": "tablet",
  "ペンタブ": "pen-tablet",
  "充電器/電源": "charger",
  "オーディオインターフェース": "audio-interface",
  "ドッキングステーション": "docking-station",
  "左手デバイス": "left-hand-device",
  "HDD/SSD": "storage-drive",
  "その他デスクアクセサリー": "other-accessories",
};

// スタイルタグ（デスクのスタイル・雰囲気）
export const STYLE_TAGS = [
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
] as const;

// スタイルタグ→英語スラッグのマッピング
const STYLE_SLUG_MAP: Record<string, string> = {
  "ミニマリスト": "minimalist",
  "ゲーミング": "gaming",
  "おしゃれ": "stylish",
  "ホワイト": "white",
  "ブラック": "black",
  "モノトーン": "monotone",
  "ナチュラル": "natural",
  "北欧風": "nordic",
  "インダストリアル": "industrial",
  "かわいい": "cute",
};

// 環境タグ（デスク環境・機材構成）
export const ENVIRONMENT_TAGS = [
  "リモートワーク",
  "オフィス",
  "昇降デスク",
  "L字デスク",
  "デュアルモニター",
  "トリプルモニター",
  "ウルトラワイド",
  "Mac",
  "Windows",
  "配線整理",
] as const;

// 環境タグ→英語スラッグのマッピング
const ENVIRONMENT_SLUG_MAP: Record<string, string> = {
  "リモートワーク": "remote-work",
  "オフィス": "office",
  "昇降デスク": "standing-desk",
  "L字デスク": "l-shaped-desk",
  "デュアルモニター": "dual-monitor",
  "トリプルモニター": "triple-monitor",
  "ウルトラワイド": "ultrawide",
  "Mac": "mac",
  "Windows": "windows",
  "配線整理": "cable-management",
};

// 環境スラッグ変換関数
export function environmentTagToSlug(tag: string): string {
  return ENVIRONMENT_SLUG_MAP[tag] || tag.toLowerCase().replace(/\s+/g, "-");
}

export function slugToEnvironmentTag(slug: string): string | undefined {
  const entry = Object.entries(ENVIRONMENT_SLUG_MAP).find(([, s]) => s === slug);
  return entry ? entry[0] as typeof ENVIRONMENT_TAGS[number] : undefined;
}

// DESK_SETUP_TAGSはSTYLE_TAGSとENVIRONMENT_TAGSを結合
export const DESK_SETUP_TAGS = [...STYLE_TAGS, ...ENVIRONMENT_TAGS] as const;

// 職業タグ（SEO最適化版 - 10個）
export const OCCUPATION_TAGS = [
  "エンジニア",
  "デザイナー",
  "クリエイター",
  "イラストレーター",
  "配信者",
  "ゲーマー",
  "学生",
  "会社員",
  "経営者",
  "フォトグラファー",
] as const;

// 職業タグのグループ定義（サイトのカテゴリ → Geminiが返す可能性のあるタグ）
// searchProductsでoccupationTagフィルタ時に使用
export const OCCUPATION_TAG_GROUPS: Record<string, string[]> = {
  "エンジニア": [
    "エンジニア", "Webエンジニア", "フロントエンドエンジニア",
    "バックエンドエンジニア", "インフラエンジニア", "モバイルエンジニア",
    "データサイエンティスト", "機械学習エンジニア"
  ],
  "デザイナー": [
    "デザイナー", "UIデザイナー", "UXデザイナー",
    "Webデザイナー", "グラフィックデザイナー", "プロダクトデザイナー"
  ],
  "クリエイター": [
    "クリエイター", "動画編集者", "映像クリエイター", "YouTuber",
    "ライター", "ブロガー", "ガジェットブロガー", "音楽クリエイター", "DTMer"
  ],
  "イラストレーター": ["イラストレーター"],
  "配信者": ["配信者", "VTuber"],
  "ゲーマー": ["ゲーマー"],
  "学生": ["学生", "研究者"],
  "会社員": [
    "会社員", "マーケター", "コンサルタント",
    "営業", "人事", "広報", "Webディレクター",
    "プロジェクトマネージャー", "プロダクトマネージャー", "フリーランス", "教師", "士業"
  ],
  "経営者": [
    "経営者", "CEO", "社長", "起業家", "創業者", "代表取締役", "CTO", "COO", "CFO"
  ],
  "フォトグラファー": [
    "フォトグラファー", "カメラマン", "写真家", "映像作家"
  ],
};

// 職業タグ→英語スラッグのマッピング
const OCCUPATION_SLUG_MAP: Record<string, string> = {
  "エンジニア": "engineer",
  "デザイナー": "designer",
  "クリエイター": "creator",
  "イラストレーター": "illustrator",
  "配信者": "streamer",
  "ゲーマー": "gamer",
  "学生": "student",
  "会社員": "office-worker",
  "経営者": "ceo",
  "フォトグラファー": "photographer",
};

// URLスラッグとタグ名の対応
export function categoryToSlug(category: string): string {
  return CATEGORY_SLUG_MAP[category] || category.replace(/\//g, "-").replace(/\s+/g, "-").toLowerCase();
}

export function slugToCategory(slug: string): string | undefined {
  // 英語スラッグからカテゴリ名を逆引き
  const entry = Object.entries(CATEGORY_SLUG_MAP).find(([, s]) => s === slug);
  return entry ? entry[0] as typeof PRODUCT_CATEGORIES[number] : undefined;
}

export function occupationToSlug(occupation: string): string {
  return OCCUPATION_SLUG_MAP[occupation] || occupation.replace(/\s+/g, "-").toLowerCase();
}

export function slugToOccupation(slug: string): string | undefined {
  const entry = Object.entries(OCCUPATION_SLUG_MAP).find(([, s]) => s === slug);
  return entry ? entry[0] as typeof OCCUPATION_TAGS[number] : undefined;
}

// スタイルタグ変換関数
export function styleTagToSlug(tag: string): string {
  return STYLE_SLUG_MAP[tag] || tag.replace(/\//g, "-").replace(/\s+/g, "-").toLowerCase();
}

export function slugToStyleTag(slug: string): string | undefined {
  const entry = Object.entries(STYLE_SLUG_MAP).find(([, s]) => s === slug);
  return entry ? entry[0] as typeof STYLE_TAGS[number] : undefined;
}

// ブランドタグ（TOPページに表示する人気ブランド）
export const BRAND_TAGS = [
  "FlexiSpot",
  "COFO",
  "Logicool",
  "Keychron",
  "HHKB",
  "Herman Miller",
  "BenQ",
  "DELL",
] as const;

// ブランドタグ→英語スラッグのマッピング
const BRAND_SLUG_MAP: Record<string, string> = {
  "FlexiSpot": "flexispot",
  "COFO": "cofo",
  "Logicool": "logicool",
  "Keychron": "keychron",
  "HHKB": "hhkb",
  "Herman Miller": "herman-miller",
  "BenQ": "benq",
  "DELL": "dell",
};

// ブランドスラッグ変換関数
export function brandToSlug(brand: string): string {
  return BRAND_SLUG_MAP[brand] || brand.toLowerCase().replace(/\s+/g, "-");
}

export function slugToBrand(slug: string): string | undefined {
  const entry = Object.entries(BRAND_SLUG_MAP).find(([, s]) => s === slug);
  return entry ? entry[0] as typeof BRAND_TAGS[number] : undefined;
}

// スラッグからブランド名を推測（登録外ブランドにも対応）
export function inferBrandFromSlug(slug: string): string {
  // 1. まずBRAND_SLUG_MAPで完全一致を試す
  const exactMatch = Object.entries(BRAND_SLUG_MAP).find(([, s]) => s === slug);
  if (exactMatch) return exactMatch[0];

  // 2. スラッグをブランド名に変換（ハイフンをスペースに、先頭大文字化）
  // 例: "apple" → "Apple", "herman-miller" → "Herman Miller"
  return slug
    .split("-")
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

// カテゴリ間の相性マップ（一緒に使われやすい周辺機器）
// 例：モニターを見ている人にはモニターアームやデスクを推薦
export const COMPATIBLE_CATEGORIES: Record<string, string[]> = {
  "ディスプレイ/モニター": ["モニターアーム", "モニター台", "デスク", "照明・ライト", "ウェブカメラ", "PCスタンド/ノートPCスタンド"],
  "モニターアーム": ["ディスプレイ/モニター", "デスク", "ケーブル/ハブ"],
  "モニター台": ["ディスプレイ/モニター", "デスク", "収納/整理"],
  "キーボード": ["マウス", "デスクマット", "PCスタンド/ノートPCスタンド", "左手デバイス"],
  "マウス": ["キーボード", "デスクマット", "マウス"], // トラックボールとマウスの併用もあり
  "デスク": ["チェア", "モニターアーム", "モニター台", "デスクマット", "収納/整理", "照明・ライト"],
  "チェア": ["デスク", "照明・ライト"],
  "マイク": ["オーディオインターフェース", "ヘッドホン/イヤホン", "ウェブカメラ", "照明・ライト"],
  "ウェブカメラ": ["マイク", "照明・ライト", "ディスプレイ/モニター"],
  "ヘッドホン/イヤホン": ["オーディオインターフェース", "マイク", "スピーカー"],
  "スピーカー": ["オーディオインターフェース", "ヘッドホン/イヤホン"],
  "照明・ライト": ["デスク", "ディスプレイ/モニター", "ウェブカメラ"],
  "PCスタンド/ノートPCスタンド": ["キーボード", "マウス", "ディスプレイ/モニター", "ドッキングステーション", "USBハブ"],
  "ケーブル/ハブ": ["充電器/電源", "ドッキングステーション", "デスク", "USBハブ"],
  "USBハブ": ["PC本体", "ドッキングステーション", "充電器/電源", "ケーブル/ハブ"],
  "デスクマット": ["キーボード", "マウス", "デスク"],
  "収納/整理": ["デスク", "ケーブル/ハブ", "モニター台"],
  "PC本体": ["ディスプレイ/モニター", "キーボード", "マウス", "ドッキングステーション", "USBハブ"],
  "タブレット": ["PCスタンド/ノートPCスタンド", "キーボード", "充電器/電源", "ペンタブ"],
  "ペンタブ": ["タブレット", "ディスプレイ/モニター", "左手デバイス", "PCスタンド/ノートPCスタンド"],
  "充電器/電源": ["ケーブル/ハブ", "ドッキングステーション", "USBハブ"],
  "オーディオインターフェース": ["マイク", "ヘッドホン/イヤホン", "スピーカー"],
  "ドッキングステーション": ["PC本体", "ディスプレイ/モニター", "充電器/電源", "ケーブル/ハブ", "USBハブ"],
  "左手デバイス": ["キーボード", "マウス", "ペンタブ"],
  "HDD/SSD": ["PC本体", "ドッキングステーション"],
  "その他デスクアクセサリー": ["デスク", "収納/整理"],
};

// 指定カテゴリと相性の良いカテゴリリストを取得
export function getCompatibleCategories(category: string): string[] {
  return COMPATIBLE_CATEGORIES[category] || [];
}

