import { createSlugConverter, brandFallback, inferBrandFromSlug as _inferBrand, selectPrimaryTag, getTagPriority } from "./slug-utils";

// ========================================
// 商品カテゴリ一覧
// ========================================

export const PRODUCT_CATEGORIES = [
  "キーボード",
  "マウス",
  "ディスプレイ・モニター",
  "モバイルモニター",
  "デスク",
  "チェア",
  "マイク",
  "ウェブカメラ",
  "ヘッドホン・イヤホン",
  "スピーカー",
  "照明・ライト",
  "ノートPCスタンド",
  "モニターアーム",
  "マイクアーム",
  "USBハブ",
  "デスクマット",
  "収納・整理",
  "PC本体",
  "タブレット",
  "ペンタブ",
  "充電器・電源タップ",
  "オーディオインターフェース",
  "ドッキングステーション",
  "左手デバイス",
  "HDD・SSD",
  "コントローラー",
  "キャプチャーボード",
  "NAS",
  "デスクシェルフ・モニター台",
  "ケーブル",
  "配線整理グッズ",
  "スマートホーム",
  "その他デスクアクセサリー",
];

// 種類タグ・特徴タグは tag-definitions.ts に一元化
// （タグ追加は tag-definitions.ts のみで完結する）
export {
  TYPE_TAGS_MULTI_AXIS,
  TYPE_TAGS,
  ALL_TYPE_TAGS,
  CATEGORY_FEATURE_TAGS,
} from "./tag-definitions";
export type { TypeTagAxis } from "./tag-definitions";

// カテゴリ→英語スラッグのマッピング（表示名ベース）
const CATEGORY_SLUG_MAP: Record<string, string> = {
  "キーボード": "keyboard",
  "マウス": "mouse",
  "ディスプレイ・モニター": "monitor",
  "モバイルモニター": "mobile-monitor",
  "デスク": "desk",
  "チェア": "chair",
  "マイク": "microphone",
  "ウェブカメラ": "webcam",
  "ヘッドホン・イヤホン": "headphones",
  "スピーカー": "speaker",
  "照明・ライト": "lighting",
  "ノートPCスタンド": "pc-stand",
  "モニターアーム": "monitor-arm",
  "マイクアーム": "mic-arm",
  "USBハブ": "usb-hub",
  "デスクマット": "desk-mat",
  "収納・整理": "storage",
  "PC本体": "pc",
  "タブレット": "tablet",
  "ペンタブ": "pen-tablet",
  "充電器・電源タップ": "charger",
  "オーディオインターフェース": "audio-interface",
  "ドッキングステーション": "docking-station",
  "左手デバイス": "left-hand-device",
  "HDD・SSD": "storage-drive",
  "コントローラー": "controller",
  "キャプチャーボード": "capture-card",
  "NAS": "nas",
  "デスクシェルフ・モニター台": "desk-shelf",
  "ケーブル": "cable",
  "配線整理グッズ": "cable-management",
  "スマートホーム": "smart-home",
  "その他デスクアクセサリー": "other-accessories",
};

// ============================================================
// デスクセットアップタグ（グループ別・排他制御あり）
// ============================================================

// --- グループ定義 ---

/** スタイル（排他: 1つのみ選択可能） */
export const TAG_GROUP_STYLE = [
  "ミニマル",
  "ゲーミング",
  "ナチュラル・北欧",
  "インダストリアル",
  "かわいい",
  "モノトーン",
  "ホワイト",
  "ブラック",
] as const;

/** モニター構成（排他: 1つのみ選択可能） */
export const TAG_GROUP_MONITOR = [
  "シングルモニター",
  "デュアルモニター",
  "トリプルモニター",
  "ウルトラワイド",
] as const;

/** デスク種類（排他: 1つのみ選択可能） */
export const TAG_GROUP_DESK = [
  "通常デスク",
  "昇降デスク",
  "L字デスク",
] as const;

/** メインOS（排他: 1つのみ選択可能） */
export const TAG_GROUP_OS = [
  "Mac",
  "Windows",
  "Linux",
] as const;

/** 特徴（複数選択可能） */
export const TAG_GROUP_FEATURES = [
  "リモートワーク",
  "配線整理",
  "クラムシェル",
  "自作PC",
  "iPad連携",
  "DIY",
] as const;

// --- 排他グループ一覧（バリデーション用） ---
export const EXCLUSIVE_TAG_GROUPS = [
  { name: "スタイル", tags: TAG_GROUP_STYLE },
  { name: "モニター構成", tags: TAG_GROUP_MONITOR },
  { name: "デスク種類", tags: TAG_GROUP_DESK },
  { name: "メインOS", tags: TAG_GROUP_OS },
] as const;

// --- 全タグ一覧（フラット） ---

/** 旧 STYLE_TAGS 互換 — スタイルグループのみ */
export const STYLE_TAGS = TAG_GROUP_STYLE;

/** 旧 ENVIRONMENT_TAGS 互換 — モニター・デスク・OS・特徴を結合 */
export const ENVIRONMENT_TAGS = [
  ...TAG_GROUP_MONITOR,
  ...TAG_GROUP_DESK,
  ...TAG_GROUP_OS,
  ...TAG_GROUP_FEATURES,
] as const;

/** 全タグ（全グループ結合） */
export const DESK_SETUP_TAGS = [
  ...TAG_GROUP_STYLE,
  ...TAG_GROUP_MONITOR,
  ...TAG_GROUP_DESK,
  ...TAG_GROUP_OS,
  ...TAG_GROUP_FEATURES,
] as const;

// --- スラッグマッピング ---

const STYLE_SLUG_MAP: Record<string, string> = {
  "ミニマル": "minimal",
  "ゲーミング": "gaming",
  "ナチュラル・北欧": "natural-nordic",
  "インダストリアル": "industrial",
  "かわいい": "cute",
  "モノトーン": "monotone",
  "ホワイト": "white",
  "ブラック": "black",
};

const ENVIRONMENT_SLUG_MAP: Record<string, string> = {
  "シングルモニター": "single-monitor",
  "デュアルモニター": "dual-monitor",
  "トリプルモニター": "triple-monitor",
  "ウルトラワイド": "ultrawide",
  "通常デスク": "standard-desk",
  "昇降デスク": "standing-desk",
  "L字デスク": "l-shaped-desk",
  "Mac": "mac",
  "Windows": "windows",
  "Linux": "linux",
  "リモートワーク": "remote-work",
  "配線整理": "cable-management",
  "クラムシェル": "clamshell",
  "自作PC": "custom-pc",
  "iPad連携": "ipad",
  "DIY": "diy",
};

// 環境スラッグ変換関数
const _environmentConverter = createSlugConverter(ENVIRONMENT_SLUG_MAP, brandFallback);
export const environmentTagToSlug = _environmentConverter.toSlug;
export const slugToEnvironmentTag = _environmentConverter.fromSlug;

// --- バリデーション関数 ---

/**
 * タグ配列をバリデーションし、排他ルール違反を修正する。
 * 各排他グループで最初に見つかったタグのみを残し、2つ目以降を除去する。
 */
export function validateTags(tags: string[]): string[] {
  const validTags = tags.filter(t => (DESK_SETUP_TAGS as readonly string[]).includes(t));
  const result: string[] = [];

  for (const group of EXCLUSIVE_TAG_GROUPS) {
    const groupTags = group.tags as readonly string[];
    const found = validTags.filter(t => groupTags.includes(t));
    if (found.length > 0) {
      result.push(found[0]); // 排他: 先頭1つだけ
    }
  }

  // 特徴グループ（複数可）はそのまま追加
  const featureTags = TAG_GROUP_FEATURES as readonly string[];
  for (const t of validTags) {
    if (featureTags.includes(t)) {
      result.push(t);
    }
  }

  return result;
}

// 職業タグ（SEO最適化版 - 9個）
// 優先度順: 具体的な職業ほど上位、曖昧な職業ほど下位
export const OCCUPATION_TAGS = [
  "エンジニア",
  "デザイナー",
  "イラストレーター",
  "フォトグラファー",
  "配信者",
  "ゲーマー",
  "経営者",
  "フリーランス",
  "学生",
  "会社員",
] as const;

// 職業タグの優先度を取得（小さいほど優先度が高い）
export function getOccupationPriority(tag: string): number {
  return getTagPriority(tag, OCCUPATION_TAGS);
}

// 複数の職業タグから最も優先度の高い1つを選択
export function selectPrimaryOccupation(tags: string[]): string | null {
  return selectPrimaryTag(tags, OCCUPATION_TAGS);
}

// 職業タグ→英語スラッグのマッピング
const OCCUPATION_SLUG_MAP: Record<string, string> = {
  "エンジニア": "engineer",
  "デザイナー": "designer",
  "イラストレーター": "illustrator",
  "配信者": "streamer",
  "ゲーマー": "gamer",
  "学生": "student",
  "会社員": "office-worker",
  "経営者": "ceo",
  "フリーランス": "freelance",
  "フォトグラファー": "photographer",
};

// URLスラッグとタグ名の対応（表示名ベース）
const _categoryConverter = createSlugConverter(CATEGORY_SLUG_MAP);
export const categoryToSlug = _categoryConverter.toSlug;
export const slugToCategory = _categoryConverter.fromSlug;

/** 商品詳細ページのURLを生成 */
export function productUrl(product: { slug?: string; id: string }): string {
  return `/desktour/${product.slug || product.id}`;
}

// ============================================================
// デスクツアー サブカテゴリ（種類タグ → パスベース）
// ============================================================

const DESKTOUR_SUBCATEGORY_SLUG_MAP: Record<string, string> = {
  // キーボード
  "メカニカルキーボード": "mechanical",
  "静電容量無接点": "capacitive",
  "パンタグラフ": "pantograph",
  "60%・65%": "60-65",
  "テンキーレス": "tenkeyless",
  "フルサイズ": "fullsize",
  "分割キーボード": "split",
  "ロープロファイル": "low-profile",
  // マウス
  "トラックボール": "trackball",
  "縦型マウス": "vertical",
  // ディスプレイ・モニター
  "5K・6K": "5k-6k",
  "4K": "4k",
  "フルHD": "full-hd",
  "ウルトラワイド": "ultrawide",
  // モバイルモニター
  "13インチモバイルモニター": "13-inch",
  "15インチモバイルモニター": "15-inch",
  "タッチ対応モバイルモニター": "touch",
  // ヘッドホン・イヤホン
  "イヤホン": "earphone",
  "ヘッドホン": "headphone",
  "開放型": "open-back",
  "密閉型": "closed-back",
  "モニター用": "monitor-headphone",
  "ゲーミング": "gaming-headset",
  // チェア
  "ゲーミングチェア": "gaming-chair",
  "メッシュチェア": "mesh-chair",
  "バランスチェア": "balance-chair",
  // デスク
  "昇降デスク": "standing",
  "L字デスク": "l-shaped",
  // マイク
  "コンデンサーマイク": "condenser",
  "ダイナミックマイク": "dynamic",
  "ピンマイク": "lavalier",
  "USB": "usb-mic",
  "XLR": "xlr",
  // スピーカー
  "ブックシェルフ型": "bookshelf",
  "サウンドバー": "soundbar",
  // 照明・ライト
  "モニターライト": "monitor-light",
  "リングライト": "ring-light",
  "LEDテープ": "led-strip",
  "間接照明": "indirect",
  "デスクライト": "desk-lamp",
  // ウェブカメラ（4K/フルHDはモニターと被るのでwebcam接頭辞）
  // PC本体
  "自作PC": "custom-build",
  "ミニPC": "mini-pc",
  "ノートPC": "laptop",
  "デスクトップPC": "desktop-pc",
  "Mac": "mac",
  "Windows": "windows",
  // HDD・SSD
  "外付けSSD": "external-ssd",
  "外付けHDD": "external-hdd",
  "内蔵SSD": "internal-ssd",
  "内蔵HDD": "internal-hdd",
  // コントローラー
  "レーシングホイール": "racing-wheel",
  "アーケードスティック": "arcade-stick",
  // キャプチャーボード
  "外付け": "external",
  "内蔵": "internal",
  // NAS
  "2ベイ": "2-bay",
  "4ベイ": "4-bay",
  // マイクアーム
  "ロープロファイルマイクアーム": "low-profile-arm",
  "クランプ式マイクアーム": "clamp-arm",
  "デスクマウント型マイクアーム": "desk-mount-arm",
  // 充電器・電源タップ
  "ワイヤレス充電器": "wireless-charger",
  "ポータブル電源": "portable-power",
  "電源タップ": "power-strip",
  "USB充電器": "usb-charger",
  // 配線整理グッズ
  "ケーブルトレイ": "cable-tray",
  "ケーブルクリップ": "cable-clip",
  "ケーブルチューブ": "cable-tube",
  "ケーブルボックス": "cable-box",
  "マジックテープ": "velcro",
  "ケーブルホルダー": "cable-holder",
  // モニターアーム
  "デュアルアーム": "dual-arm",
  "シングルアーム": "single-arm",
  // ペンタブ
  "液タブ": "pen-display",
  "板タブ": "pen-tablet",
};

const _subcategoryConverter = createSlugConverter(DESKTOUR_SUBCATEGORY_SLUG_MAP);
export const desktourSubcategoryToSlug = _subcategoryConverter.toSlug;
export const slugToDesktourSubcategory = _subcategoryConverter.fromSlug;

const _occupationConverter = createSlugConverter(OCCUPATION_SLUG_MAP, brandFallback);
export const occupationToSlug = _occupationConverter.toSlug;
export const slugToOccupation = _occupationConverter.fromSlug;

// スタイルタグ変換関数（スタイル + 環境の両マップを検索）
const _styleConverter = createSlugConverter(STYLE_SLUG_MAP);

export function styleTagToSlug(tag: string): string {
  return STYLE_SLUG_MAP[tag] || _environmentConverter.toSlug(tag);
}

export function slugToStyleTag(slug: string): string | undefined {
  return _styleConverter.fromSlug(slug) || _environmentConverter.fromSlug(slug);
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
  "Apple",
  "Anker",
  "REALFORCE",
  "Razer",
  "Elgato",
  "SHURE",
  "Audio-Technica",
  "Sony",
  "LG",
  "Samsung",
  "IKEA",
  "ASUS",
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
  "Apple": "apple",
  "Anker": "anker",
  "REALFORCE": "realforce",
  "Razer": "razer",
  "Elgato": "elgato",
  "SHURE": "shure",
  "Audio-Technica": "audio-technica",
  "Sony": "sony",
  "LG": "lg",
  "Samsung": "samsung",
  "IKEA": "ikea",
  "ASUS": "asus",
};

// ブランドスラッグ変換関数
const _brandConverter = createSlugConverter(BRAND_SLUG_MAP, brandFallback);
export const brandToSlug = _brandConverter.toSlug;
export const slugToBrand = _brandConverter.fromSlug;

// スラッグからブランド名を推測（登録外ブランドにも対応）
export function inferBrandFromSlug(slug: string): string {
  return _inferBrand(_brandConverter, slug);
}

// カテゴリ間の相性マップ（表示名ベース）
export const COMPATIBLE_CATEGORIES: Record<string, string[]> = {
  "ディスプレイ・モニター": ["モニターアーム", "デスクシェルフ・モニター台", "デスク", "照明・ライト", "ウェブカメラ", "ノートPCスタンド"],
  "モバイルモニター": ["ノートPCスタンド", "タブレット", "充電器・電源タップ", "USBハブ"],
  "モニターアーム": ["ディスプレイ・モニター", "デスク"],
  "マイクアーム": ["マイク", "デスク", "オーディオインターフェース"],
  "キーボード": ["マウス", "デスクマット", "ノートPCスタンド", "左手デバイス"],
  "マウス": ["キーボード", "デスクマット", "マウス"],
  "デスク": ["チェア", "モニターアーム", "デスクシェルフ・モニター台", "デスクマット", "収納・整理", "照明・ライト"],
  "チェア": ["デスク", "照明・ライト"],
  "マイク": ["マイクアーム", "オーディオインターフェース", "ヘッドホン・イヤホン", "ウェブカメラ", "照明・ライト"],
  "ウェブカメラ": ["マイク", "照明・ライト", "ディスプレイ・モニター"],
  "ヘッドホン・イヤホン": ["オーディオインターフェース", "マイク", "スピーカー"],
  "スピーカー": ["オーディオインターフェース", "ヘッドホン・イヤホン"],
  "照明・ライト": ["デスク", "ディスプレイ・モニター", "ウェブカメラ"],
  "ノートPCスタンド": ["キーボード", "マウス", "ディスプレイ・モニター", "ドッキングステーション", "USBハブ"],
  "USBハブ": ["PC本体", "ドッキングステーション", "充電器・電源タップ"],
  "デスクマット": ["キーボード", "マウス", "デスク"],
  "収納・整理": ["デスク", "デスクシェルフ・モニター台", "配線整理グッズ"],
  "PC本体": ["ディスプレイ・モニター", "キーボード", "マウス", "ドッキングステーション", "USBハブ"],
  "タブレット": ["ノートPCスタンド", "キーボード", "充電器・電源タップ", "ペンタブ"],
  "ペンタブ": ["タブレット", "ディスプレイ・モニター", "左手デバイス", "ノートPCスタンド"],
  "充電器・電源タップ": ["ドッキングステーション", "USBハブ", "配線整理グッズ"],
  "オーディオインターフェース": ["マイク", "ヘッドホン・イヤホン", "スピーカー"],
  "ドッキングステーション": ["PC本体", "ディスプレイ・モニター", "充電器・電源タップ", "USBハブ"],
  "左手デバイス": ["キーボード", "マウス", "ペンタブ"],
  "HDD・SSD": ["PC本体", "ドッキングステーション"],
  "コントローラー": ["PC本体", "デスクマット", "充電器・電源タップ"],
  "キャプチャーボード": ["PC本体", "ディスプレイ・モニター", "ウェブカメラ", "マイク"],
  "NAS": ["PC本体", "ドッキングステーション", "HDD・SSD"],
  "デスクシェルフ・モニター台": ["ディスプレイ・モニター", "デスク", "収納・整理", "キーボード"],
  "配線整理グッズ": ["デスク", "充電器・電源タップ", "収納・整理"],
  "その他デスクアクセサリー": ["デスク", "収納・整理"],
};

// 指定カテゴリと相性の良いカテゴリリストを取得
export function getCompatibleCategories(category: string): string[] {
  return COMPATIBLE_CATEGORIES[category] || [];
}
