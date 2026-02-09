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
  "PCスタンド・ノートPCスタンド",
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
  "配線整理グッズ",
  "その他デスクアクセサリー",
];

// 種類タグ定義（表示名ベース）- 旧サブカテゴリ
export const TYPE_TAGS: Record<string, string[]> = {
  "キーボード": [
    "メカニカルキーボード",
    "静電容量無接点",
    "パンタグラフ",
    "分割キーボード",
    "テンキーレス",
    "60%・65%キーボード",
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
  "ディスプレイ・モニター": [
    "4Kモニター",
    "ウルトラワイドモニター",
    "ゲーミングモニター",
    "縦置きモニター",
    "5K・6Kモニター",
  ],
  "モバイルモニター": [
    "13インチモバイルモニター",
    "15インチモバイルモニター",
    "タッチ対応モバイルモニター",
  ],
  "ヘッドホン・イヤホン": [
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
    "Windows",
  ],
  "HDD・SSD": [
    "外付けSSD",
    "外付けHDD",
    "HDDケース",
    "内蔵SSD",
    "内蔵HDD",
  ],
  "コントローラー": [
    "PlayStation用コントローラー",
    "Xbox用コントローラー",
    "Switch用コントローラー",
    "PCゲーム用コントローラー",
    "レーシングホイール",
    "アーケードスティック",
    "関連アクセサリー",
  ],
  "左手デバイス": [
    "ストリームデッキ",
    "マクロパッド",
    "左手キーボード",
    "プログラマブルキーパッド",
    "Elgato Stream Deck",
    "TourBox",
    "Orbital2",
  ],
  "キャプチャーボード": [
    "外付けキャプチャーボード",
    "内蔵キャプチャーボード",
    "4Kキャプチャーボード",
    "HDMIキャプチャーボード",
  ],
  "NAS": [
    "2ベイNAS",
    "4ベイNAS",
    "デスクトップ型NAS",
    "ラックマウント型NAS",
  ],
  "マイクアーム": [
    "デスクマウント型マイクアーム",
    "クランプ式マイクアーム",
    "ロープロファイルマイクアーム",
  ],
  "充電器・電源タップ": [
    "USB充電器",
    "ワイヤレス充電器",
    "電源タップ",
    "ポータブル電源",
    "ACアダプター",
  ],
  "デスクシェルフ・モニター台": [
    "デスクシェルフ",
    "モニター台",
    "モニタースタンド",
    "卓上ラック",
    "机上台",
    "デスクオーガナイザー",
  ],
  "配線整理グッズ": [
    "ケーブルトレイ",
    "ケーブルクリップ",
    "ケーブルチューブ",
    "ケーブルボックス",
    "マジックテープ",
    "ケーブルホルダー",
  ],
};

// 全種類タグのフラットリスト
export const ALL_TYPE_TAGS = Object.values(TYPE_TAGS).flat();

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
  "PCスタンド・ノートPCスタンド": "pc-stand",
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
  "配線整理グッズ": "cable-management",
  "その他デスクアクセサリー": "other-accessories",
};

// ============================================================
// デスクセットアップタグ（グループ別・排他制御あり）
// ============================================================

// --- グループ定義 ---

/** スタイル（排他: 1つのみ選択可能） */
export const TAG_GROUP_STYLE = [
  "ミニマリスト",
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
  "ミニマリスト": "minimalist",
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
export function environmentTagToSlug(tag: string): string {
  return ENVIRONMENT_SLUG_MAP[tag] || tag.toLowerCase().replace(/\s+/g, "-");
}

export function slugToEnvironmentTag(slug: string): string | undefined {
  const entry = Object.entries(ENVIRONMENT_SLUG_MAP).find(([, s]) => s === slug);
  return entry ? entry[0] : undefined;
}

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

// 職業タグ（SEO最適化版 - 10個のみ）
// 優先度順: 具体的な職業ほど上位、曖昧な職業ほど下位
export const OCCUPATION_TAGS = [
  "エンジニア",
  "デザイナー",
  "イラストレーター",
  "フォトグラファー",
  "配信者",
  "ゲーマー",
  "経営者",
  "学生",
  "会社員",
  "クリエイター", // 最も曖昧なため最下位（他に該当がない場合のみ使用）
] as const;

// 職業タグの優先度を取得（小さいほど優先度が高い）
export function getOccupationPriority(tag: string): number {
  const index = OCCUPATION_TAGS.indexOf(tag as typeof OCCUPATION_TAGS[number]);
  return index === -1 ? 999 : index;
}

// 複数の職業タグから最も優先度の高い1つを選択
export function selectPrimaryOccupation(tags: string[]): string | null {
  if (!tags || tags.length === 0) return null;
  const validTags = tags.filter(t => OCCUPATION_TAGS.includes(t as typeof OCCUPATION_TAGS[number]));
  if (validTags.length === 0) return null;
  validTags.sort((a, b) => getOccupationPriority(a) - getOccupationPriority(b));
  return validTags[0];
}

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

// URLスラッグとタグ名の対応（表示名ベース）
export function categoryToSlug(category: string): string {
  return CATEGORY_SLUG_MAP[category] || category.replace(/[/・]/g, "-").replace(/\s+/g, "-").toLowerCase();
}

export function slugToCategory(slug: string): string | undefined {
  // 英語スラッグから表示名を逆引き
  const entry = Object.entries(CATEGORY_SLUG_MAP).find(([, s]) => s === slug);
  return entry ? entry[0] : undefined;
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
  // スタイルとエンvironメント両方のマップから検索
  return STYLE_SLUG_MAP[tag] || ENVIRONMENT_SLUG_MAP[tag] || tag.replace(/[/・]/g, "-").replace(/\s+/g, "-").toLowerCase();
}

export function slugToStyleTag(slug: string): string | undefined {
  // スタイルとエンvironメント両方のマップから検索
  const styleEntry = Object.entries(STYLE_SLUG_MAP).find(([, s]) => s === slug);
  if (styleEntry) return styleEntry[0];
  const envEntry = Object.entries(ENVIRONMENT_SLUG_MAP).find(([, s]) => s === slug);
  return envEntry ? envEntry[0] : undefined;
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

// カテゴリ間の相性マップ（表示名ベース）
export const COMPATIBLE_CATEGORIES: Record<string, string[]> = {
  "ディスプレイ・モニター": ["モニターアーム", "デスクシェルフ・モニター台", "デスク", "照明・ライト", "ウェブカメラ", "PCスタンド・ノートPCスタンド"],
  "モバイルモニター": ["PCスタンド・ノートPCスタンド", "タブレット", "充電器・電源タップ", "USBハブ"],
  "モニターアーム": ["ディスプレイ・モニター", "デスク"],
  "マイクアーム": ["マイク", "デスク", "オーディオインターフェース"],
  "キーボード": ["マウス", "デスクマット", "PCスタンド・ノートPCスタンド", "左手デバイス"],
  "マウス": ["キーボード", "デスクマット", "マウス"],
  "デスク": ["チェア", "モニターアーム", "デスクシェルフ・モニター台", "デスクマット", "収納・整理", "照明・ライト"],
  "チェア": ["デスク", "照明・ライト"],
  "マイク": ["マイクアーム", "オーディオインターフェース", "ヘッドホン・イヤホン", "ウェブカメラ", "照明・ライト"],
  "ウェブカメラ": ["マイク", "照明・ライト", "ディスプレイ・モニター"],
  "ヘッドホン・イヤホン": ["オーディオインターフェース", "マイク", "スピーカー"],
  "スピーカー": ["オーディオインターフェース", "ヘッドホン・イヤホン"],
  "照明・ライト": ["デスク", "ディスプレイ・モニター", "ウェブカメラ"],
  "PCスタンド・ノートPCスタンド": ["キーボード", "マウス", "ディスプレイ・モニター", "ドッキングステーション", "USBハブ"],
  "USBハブ": ["PC本体", "ドッキングステーション", "充電器・電源タップ"],
  "デスクマット": ["キーボード", "マウス", "デスク"],
  "収納・整理": ["デスク", "デスクシェルフ・モニター台", "配線整理グッズ"],
  "PC本体": ["ディスプレイ・モニター", "キーボード", "マウス", "ドッキングステーション", "USBハブ"],
  "タブレット": ["PCスタンド・ノートPCスタンド", "キーボード", "充電器・電源タップ", "ペンタブ"],
  "ペンタブ": ["タブレット", "ディスプレイ・モニター", "左手デバイス", "PCスタンド・ノートPCスタンド"],
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
