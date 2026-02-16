/**
 * デスクツアー商品タグの一元定義（Single Source of Truth）
 *
 * ここにタグを追加すれば、以下すべてに自動反映される:
 * - 管理画面のタグ選択UI
 * - Amazon商品情報からの自動タグ推論
 * - カテゴリページのフィルタリング
 */

// ============================================================
// 型定義
// ============================================================

/** キーワードマッチングルール */
export interface DetectionRule {
  /** OR条件: いずれかのキーワードを含めばマッチ */
  keywords?: string[];
  /** AND条件: すべてのキーワードを含めばマッチ */
  allOf?: string[];
}

/** 種類タグの定義（名前 + 推論ルール） */
export interface TypeTagDef {
  /** タグ表示名 */
  name: string;
  /** 商品テキストからの検出ルール（いずれか1つマッチすれば検出） */
  detect: DetectionRule[];
  /** Amazonカテゴリ階層用のフォールバック検出ルール */
  amazonDetect?: DetectionRule[];
}

/** 種類タグの軸定義 */
export interface TypeTagAxisDef {
  /** 軸名（例: "スイッチ方式"） */
  axis: string;
  /** この軸のタグ一覧（優先度順。最初にマッチしたものが選ばれる） */
  tags: TypeTagDef[];
}

/** 特徴タグの検出方法 */
export type FeatureDetector =
  | { type: "keywords"; keywords: string[] }
  | { type: "allOf"; keywords: string[] }
  | { type: "numeric"; field: string; op: "<" | ">" | "<=" | ">="; value: number }
  | { type: "regexRange"; pattern: string; field: "title" | "allText"; ranges: { max: number; tag: string }[] };

/** 特徴タグの定義 */
export interface FeatureTagDef {
  /** タグ表示名 */
  name: string;
  /** 検出方法（いずれか1つマッチすれば検出） */
  detect: FeatureDetector[];
}

// ============================================================
// 種類タグ定義（カテゴリ → 軸 → タグ + 推論キーワード）
// ============================================================

export const TYPE_TAG_DEFS: Record<string, TypeTagAxisDef[]> = {
  // ======== キーボード ========
  "キーボード": [
    {
      axis: "スイッチ方式",
      tags: [
        {
          name: "メカニカルキーボード",
          detect: [{ keywords: ["mechanical", "メカニカル", "cherry mx", "gateron", "kailh", "赤軸", "青軸", "茶軸"] }],
          amazonDetect: [{ keywords: ["メカニカル", "mechanical"] }],
        },
        {
          name: "静電容量無接点",
          detect: [{ keywords: ["hhkb", "realforce", "静電容量", "無接点", "capacitive"] }],
        },
        {
          name: "パンタグラフ",
          detect: [
            { keywords: ["パンタグラフ", "pantograph", "シザー", "scissor", "magic keyboard", "apple keyboard"] },
            { allOf: ["薄型", "キーボード"] },
          ],
        },
      ],
    },
    {
      axis: "サイズ",
      tags: [
        {
          name: "60%・65%",
          detect: [{ keywords: ["60%", "65%", "66キー", "68キー", "60 percent", "65 percent"] }],
        },
        {
          name: "テンキーレス",
          detect: [{ keywords: ["tkl", "tenkeyless", "テンキーレス", "87キー", "87key"] }],
          amazonDetect: [{ keywords: ["テンキーレス", "tenkeyless"] }],
        },
        {
          name: "フルサイズ",
          detect: [{ keywords: ["フルサイズ", "full size", "108キー", "テンキー付き"] }],
        },
      ],
    },
  ],

  // ======== マウス ========
  "マウス": [
    {
      axis: "操作方式",
      tags: [
        {
          name: "トラックボール",
          detect: [{ keywords: ["trackball", "トラックボール", "mx ergo", "m575", "sw-m570"] }],
          amazonDetect: [{ keywords: ["トラックボール", "trackball"] }],
        },
        {
          name: "縦型マウス",
          detect: [{ keywords: ["vertical", "縦型", "mx vertical"] }],
          amazonDetect: [{ keywords: ["縦型", "vertical"] }],
        },
      ],
    },
  ],

  // ======== ディスプレイ・モニター ========
  "ディスプレイ・モニター": [
    {
      axis: "解像度",
      tags: [
        {
          name: "5K・6K",
          detect: [{ keywords: ["5k", "6k", "5120"] }],
        },
        {
          name: "4K",
          detect: [{ keywords: ["4k", "3840", "2160", "uhd"] }],
          amazonDetect: [{ keywords: ["4k"] }],
        },
        {
          name: "フルHD",
          detect: [{ keywords: ["1080p", "full hd", "フルhd", "1920"] }],
        },
      ],
    },
    {
      axis: "アスペクト比",
      tags: [
        {
          name: "ウルトラワイド",
          detect: [
            { keywords: ["ultrawide", "ウルトラワイド", "21:9", "32:9"] },
            { allOf: ["34インチ", "曲面"] },
          ],
          amazonDetect: [{ keywords: ["ウルトラワイド", "ultrawide"] }],
        },
      ],
    },
  ],

  // ======== ヘッドホン・イヤホン ========
  "ヘッドホン・イヤホン": [
    {
      axis: "形状",
      tags: [
        { name: "イヤホン", detect: [{ keywords: ["イヤホン", "earphone", "earbuds", "airpods", "tws", "in-ear"] }] },
        { name: "ヘッドホン", detect: [{ keywords: ["ヘッドホン", "headphone", "headset", "over-ear", "on-ear"] }] },
      ],
    },
  ],

  // ======== チェア ========
  "チェア": [
    {
      axis: "構造",
      tags: [
        {
          name: "ゲーミングチェア",
          detect: [{ keywords: ["gaming chair", "ゲーミングチェア", "dxracer", "akracing", "バケットシート"] }],
          amazonDetect: [{ keywords: ["ゲーミングチェア", "gaming chair"] }],
        },
        {
          name: "メッシュチェア",
          detect: [{ keywords: ["mesh", "メッシュ", "通気性"] }],
          amazonDetect: [{ keywords: ["メッシュ", "mesh"] }],
        },
        {
          name: "バランスチェア",
          detect: [{ keywords: ["balance", "バランスチェア", "姿勢"] }],
        },
        {
          name: "クッションチェア",
          detect: [{ keywords: ["クッションチェア", "クッション", "座椅子", "cushion chair"] }],
        },
      ],
    },
  ],

  // ======== マイク ========
  "マイク": [
    {
      axis: "種類",
      tags: [
        {
          name: "コンデンサーマイク",
          detect: [{ keywords: ["condenser", "コンデンサー"] }],
          amazonDetect: [{ keywords: ["コンデンサー", "condenser"] }],
        },
        {
          name: "ダイナミックマイク",
          detect: [{ keywords: ["dynamic", "ダイナミック", "sm7b", "re20"] }],
          amazonDetect: [{ keywords: ["ダイナミック", "dynamic"] }],
        },
        {
          name: "ピンマイク",
          detect: [{ keywords: ["lavalier", "ピンマイク", "ラベリア", "襟元"] }],
        },
      ],
    },
  ],

  // ======== スピーカー ========
  "スピーカー": [
    {
      axis: "形状",
      tags: [
        {
          name: "ブックシェルフ型",
          detect: [{ keywords: ["monitor speaker", "モニタースピーカー", "dtm", "studio", "音楽制作", "ブックシェルフ", "bookshelf"] }],
          amazonDetect: [{ keywords: ["モニタースピーカー", "ブックシェルフ", "bookshelf"] }],
        },
        {
          name: "サウンドバー",
          detect: [{ keywords: ["soundbar", "サウンドバー", "モニター下"] }],
          amazonDetect: [{ keywords: ["サウンドバー", "soundbar"] }],
        },
      ],
    },
  ],

  // ======== 照明・ライト ========
  "照明・ライト": [
    {
      axis: "種類",
      tags: [
        { name: "モニターライト", detect: [{ keywords: ["screenbar", "モニターライト", "monitor light"] }] },
        { name: "リングライト", detect: [{ keywords: ["ring light", "リングライト", "撮影用"] }] },
        { name: "LEDテープ", detect: [{ keywords: ["led strip", "ledテープ", "led tape", "テープライト"] }] },
        { name: "間接照明", detect: [{ keywords: ["間接照明", "indirect lighting"] }] },
        { name: "デスクライト", detect: [{ keywords: ["desk lamp", "デスクライト", "卓上ライト"] }] },
      ],
    },
  ],

  // ======== PC本体 ========
  "PC本体": [
    {
      axis: "形態",
      tags: [
        { name: "自作PC", detect: [{ keywords: ["自作", "custom build", "btoパソコン"] }] },
        { name: "ミニPC", detect: [{ keywords: ["mini pc", "ミニpc", "nuc"] }] },
        { name: "ノートPC", detect: [{ keywords: ["laptop", "notebook", "ノートpc", "ノートパソコン", "macbook"] }] },
        { name: "デスクトップPC", detect: [{ keywords: ["desktop", "デスクトップpc", "タワー型", "imac", "mac studio", "mac pro"] }] },
      ],
    },
  ],
};

// ============================================================
// 特徴タグ定義（カテゴリ固有のみ）
// ============================================================

/** カテゴリ固有の特徴タグ */
export const CATEGORY_FEATURE_TAG_DEFS: Record<string, FeatureTagDef[]> = {
  "ディスプレイ・モニター": [
    {
      name: "24インチ以下",
      detect: [{
        type: "regexRange",
        pattern: "(\\d+)インチ|(\\d+)\"",
        field: "title",
        ranges: [{ max: 24, tag: "24インチ以下" }, { max: 27, tag: "27インチ" }, { max: 32, tag: "32インチ" }, { max: Infinity, tag: "34インチ以上" }],
      }],
    },
    { name: "27インチ", detect: [] },
    { name: "32インチ", detect: [] },
    { name: "34インチ以上", detect: [] },
  ],
};

// ============================================================
// 後方互換: 既存コードが使うフラットな型・定数を自動生成
// ============================================================

/** 後方互換用: 軸名 + タグ名配列 */
export interface TypeTagAxis {
  axis: string;
  tags: string[];
}

/** TYPE_TAGS_MULTI_AXIS 互換（名前のみ） */
export const TYPE_TAGS_MULTI_AXIS: Record<string, TypeTagAxis[]> = Object.fromEntries(
  Object.entries(TYPE_TAG_DEFS).map(([cat, axes]) => [
    cat,
    axes.map((a) => ({ axis: a.axis, tags: a.tags.map((t) => t.name) })),
  ])
);

/** TYPE_TAGS フラットマップ互換 */
export const TYPE_TAGS: Record<string, string[]> = Object.fromEntries(
  Object.entries(TYPE_TAGS_MULTI_AXIS).map(([cat, axes]) => [
    cat,
    axes.flatMap((a) => a.tags),
  ])
);

/** ALL_TYPE_TAGS 互換 */
export const ALL_TYPE_TAGS = Object.values(TYPE_TAGS).flat();

/** CATEGORY_FEATURE_TAGS 互換（名前のみ） */
export const CATEGORY_FEATURE_TAGS: Record<string, string[]> = Object.fromEntries(
  Object.entries(CATEGORY_FEATURE_TAG_DEFS).map(([cat, tags]) => [
    cat,
    tags.map((t) => t.name),
  ])
);
