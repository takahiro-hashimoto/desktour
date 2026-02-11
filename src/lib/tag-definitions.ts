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
    {
      axis: "形状",
      tags: [
        {
          name: "分割キーボード",
          detect: [{ keywords: ["split", "分割", "ergodox", "kinesis"] }],
        },
        {
          name: "ロープロファイル",
          detect: [{ keywords: ["ロープロファイル", "low profile", "ultra slim"] }],
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
        // 「通常マウス」はデフォルト（トラックボール/縦型に該当しなければ通常）
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

  // ======== モバイルモニター ========
  "モバイルモニター": [
    {
      axis: "サイズ",
      tags: [
        { name: "13インチモバイルモニター", detect: [{ keywords: ["13インチ", "13.3インチ", "13\"", "13.3\""] }] },
        { name: "15インチモバイルモニター", detect: [{ keywords: ["15インチ", "15.6インチ", "15\"", "15.6\""] }] },
      ],
    },
    {
      axis: "機能",
      tags: [
        { name: "タッチ対応モバイルモニター", detect: [{ keywords: ["タッチ", "touch", "タッチパネル"] }] },
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
    {
      axis: "ハウジング",
      tags: [
        {
          name: "開放型",
          detect: [
            { allOf: ["open", "back"] },
            { keywords: ["開放型", "音漏れ", "open-back"] },
          ],
        },
        {
          name: "密閉型",
          detect: [
            { allOf: ["closed", "back"] },
            { keywords: ["密閉型", "遮音", "closed-back"] },
          ],
        },
      ],
    },
    {
      axis: "用途",
      tags: [
        { name: "モニター用", detect: [{ keywords: ["モニターヘッドホン", "dtm", "音楽制作", "studio monitor", "スタジオ"] }] },
        {
          name: "ゲーミング",
          detect: [
            { keywords: ["gaming headset", "ゲーミングヘッドセット", "7.1ch"] },
            { allOf: ["マイク付き", "gaming"] },
          ],
        },
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
      ],
    },
  ],

  // ======== デスク ========
  "デスク": [
    {
      axis: "機構",
      tags: [
        {
          name: "昇降デスク",
          detect: [{ keywords: ["昇降", "standing", "電動", "height adjustable", "スタンディング"] }],
          amazonDetect: [{ keywords: ["昇降", "standing", "height adjustable"] }],
        },
        // 「固定デスク」はデフォルト
      ],
    },
    {
      axis: "形状",
      tags: [
        {
          name: "L字デスク",
          detect: [{ keywords: ["l字", "l型", "l-shaped", "コーナー"] }],
          amazonDetect: [{ keywords: ["l字", "l型", "l-shaped"] }],
        },
        // 「ストレートデスク」はデフォルト
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
    {
      axis: "接続",
      tags: [
        {
          name: "USB",
          detect: [{ keywords: ["usb mic", "usbマイク", "blue yeti", "fifine", "usb接続"] }],
          amazonDetect: [{ keywords: ["usb"] }],
        },
        {
          name: "XLR",
          detect: [{ keywords: ["xlr", "ファンタム電源", "phantom power"] }],
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

  // ======== ウェブカメラ ========
  "ウェブカメラ": [
    {
      axis: "解像度",
      tags: [
        { name: "4K", detect: [{ keywords: ["4k", "3840"] }] },
        { name: "フルHD", detect: [{ keywords: ["1080p", "full hd", "フルhd"] }] },
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
    {
      axis: "OS",
      tags: [
        { name: "Mac", detect: [{ keywords: ["mac", "macbook", "imac", "mac studio", "mac pro", "macos"] }] },
        { name: "Windows", detect: [{ keywords: ["windows"] }] },
      ],
    },
  ],

  // ======== HDD・SSD ========
  "HDD・SSD": [
    {
      axis: "形態",
      tags: [
        { name: "外付けSSD", detect: [{ keywords: ["外付けssd", "external ssd", "portable ssd"] }] },
        { name: "外付けHDD", detect: [{ keywords: ["外付けhdd", "external hdd", "portable hdd"] }] },
        { name: "内蔵SSD", detect: [{ keywords: ["内蔵ssd", "internal ssd", "m.2", "nvme"] }] },
        { name: "内蔵HDD", detect: [{ keywords: ["内蔵hdd", "internal hdd"] }] },
      ],
    },
  ],

  // ======== コントローラー ========
  "コントローラー": [
    {
      axis: "種類",
      tags: [
        { name: "レーシングホイール", detect: [{ keywords: ["racing wheel", "レーシングホイール", "ハンドル"] }] },
        { name: "アーケードスティック", detect: [{ keywords: ["arcade stick", "アーケードスティック", "fight stick"] }] },
        // 「ゲームパッド」はデフォルト
      ],
    },
  ],

  // ======== キャプチャーボード ========
  "キャプチャーボード": [
    {
      axis: "形態",
      tags: [
        { name: "外付け", detect: [{ keywords: ["外付け", "external", "usb"] }] },
        { name: "内蔵", detect: [{ keywords: ["内蔵", "internal", "pcie"] }] },
      ],
    },
  ],

  // ======== NAS ========
  "NAS": [
    {
      axis: "ベイ数",
      tags: [
        { name: "2ベイ", detect: [{ keywords: ["2bay", "2ベイ", "2台"] }] },
        { name: "4ベイ", detect: [{ keywords: ["4bay", "4ベイ", "4台"] }] },
      ],
    },
  ],

  // ======== マイクアーム ========
  "マイクアーム": [
    {
      axis: "種類",
      tags: [
        { name: "ロープロファイルマイクアーム", detect: [{ keywords: ["ロープロファイル", "low profile"] }] },
        { name: "クランプ式マイクアーム", detect: [{ keywords: ["クランプ", "clamp"] }] },
        { name: "デスクマウント型マイクアーム", detect: [{ keywords: ["デスクマウント", "desk mount", "boom arm", "ブームアーム"] }] },
      ],
    },
  ],

  // ======== 充電器・電源タップ ========
  "充電器・電源タップ": [
    {
      axis: "種類",
      tags: [
        { name: "ワイヤレス充電器", detect: [{ keywords: ["wireless charger", "ワイヤレス充電", "qi", "magsafe"] }] },
        { name: "ポータブル電源", detect: [{ keywords: ["ポータブル電源", "portable power"] }] },
        { name: "電源タップ", detect: [{ keywords: ["電源タップ", "power strip", "延長コード"] }] },
        { name: "USB充電器", detect: [{ keywords: ["usb充電器", "usb charger", "急速充電", "gan"] }] },
      ],
    },
  ],

  // ======== 配線整理グッズ ========
  "配線整理グッズ": [
    {
      axis: "種類",
      tags: [
        { name: "ケーブルトレイ", detect: [{ keywords: ["ケーブルトレイ", "cable tray"] }] },
        { name: "ケーブルクリップ", detect: [{ keywords: ["ケーブルクリップ", "cable clip"] }] },
        { name: "ケーブルチューブ", detect: [{ keywords: ["ケーブルチューブ", "cable sleeve", "スリーブ"] }] },
        { name: "ケーブルボックス", detect: [{ keywords: ["ケーブルボックス", "cable box"] }] },
        { name: "マジックテープ", detect: [{ keywords: ["マジックテープ", "velcro", "面ファスナー"] }] },
        { name: "ケーブルホルダー", detect: [{ keywords: ["ケーブルホルダー", "cable holder", "ケーブルクリ"] }] },
      ],
    },
  ],

  // ======== モニターアーム ========
  "モニターアーム": [
    {
      axis: "構成",
      tags: [
        {
          name: "デュアルアーム",
          detect: [{ keywords: ["dual", "デュアル", "2画面", "ダブル"] }],
          amazonDetect: [{ keywords: ["デュアル", "dual", "2画面"] }],
        },
        {
          name: "シングルアーム",
          detect: [{ keywords: ["single", "シングル", "1画面"] }],
          amazonDetect: [{ keywords: ["シングル", "single"] }],
        },
      ],
    },
  ],

  // ======== ペンタブ ========
  "ペンタブ": [
    {
      axis: "種類",
      tags: [
        {
          name: "液タブ",
          detect: [{ keywords: ["液タブ", "液晶タブレット", "cintiq", "kamvas", "pen display"] }],
          amazonDetect: [{ keywords: ["液タブ", "液晶タブレット", "pen display"] }],
        },
        {
          name: "板タブ",
          detect: [{ keywords: ["板タブ", "ペンタブレット", "intuos", "pen tablet"] }],
          amazonDetect: [{ keywords: ["板タブ", "ペンタブレット", "pen tablet"] }],
        },
      ],
    },
  ],
};

// ============================================================
// 特徴タグ定義（カテゴリ固有のみ）
// ============================================================

/** カテゴリ固有の特徴タグ */
export const CATEGORY_FEATURE_TAG_DEFS: Record<string, FeatureTagDef[]> = {
  "キーボード": [
    { name: "ホットスワップ", detect: [{ type: "keywords", keywords: ["hot swap", "ホットスワップ"] }] },
    { name: "日本語配列", detect: [{ type: "keywords", keywords: ["日本語配列", "jis"] }] },
    { name: "英語配列", detect: [{ type: "keywords", keywords: ["英語配列", "us layout", "ansi"] }] },
    { name: "Mac配列", detect: [{ type: "allOf", keywords: ["mac", "配列"] }] },
  ],
  "マウス": [
    { name: "多ボタン", detect: [{ type: "keywords", keywords: ["多ボタン", "multi button", "programmable"] }] },
    { name: "超軽量", detect: [{ type: "numeric", field: "重量", op: "<", value: 80 }] },
  ],
  "ディスプレイ・モニター": [
    { name: "IPS", detect: [{ type: "keywords", keywords: ["ips", "ipsパネル"] }] },
    { name: "VA", detect: [{ type: "keywords", keywords: ["va", "vaパネル"] }] },
    { name: "湾曲", detect: [{ type: "keywords", keywords: ["湾曲", "curved", "曲面"] }] },
    { name: "HDR", detect: [{ type: "keywords", keywords: ["hdr"] }] },
    { name: "USB-C", detect: [{ type: "keywords", keywords: ["usb-c", "type-c"] }] },
    {
      name: "24インチ以下",
      detect: [{
        type: "regexRange",
        pattern: "(\\d+)インチ|(\\d+)\"",
        field: "title",
        ranges: [{ max: 24, tag: "24インチ以下" }, { max: 27, tag: "27インチ" }, { max: 32, tag: "32インチ" }, { max: Infinity, tag: "34インチ以上" }],
      }],
    },
    { name: "27インチ", detect: [] }, // regexRange で自動判定されるのでここでは detect 空
    { name: "32インチ", detect: [] },
    { name: "34インチ以上", detect: [] },
  ],
  "チェア": [
    { name: "リクライニング", detect: [{ type: "keywords", keywords: ["リクライニング"] }] },
    { name: "ハイバック", detect: [{ type: "keywords", keywords: ["ハイバック"] }] },
    { name: "アームレスト付き", detect: [{ type: "keywords", keywords: ["アームレスト", "肘掛け"] }] },
  ],
  "デスク": [
    { name: "電動", detect: [{ type: "keywords", keywords: ["電動", "electric"] }] },
    { name: "手動", detect: [{ type: "keywords", keywords: ["手動"] }] },
    { name: "天板のみ", detect: [{ type: "keywords", keywords: ["天板のみ", "天板単品"] }] },
    { name: "脚のみ", detect: [{ type: "keywords", keywords: ["脚のみ", "脚単品", "フレームのみ"] }] },
    { name: "木目天板", detect: [{ type: "keywords", keywords: ["木目", "ウッド", "wood", "木製"] }] },
    { name: "黒天板", detect: [{ type: "keywords", keywords: ["黒天板"] }, { type: "allOf", keywords: ["黒", "天板"] }] },
    { name: "白天板", detect: [{ type: "keywords", keywords: ["白天板"] }, { type: "allOf", keywords: ["白", "天板"] }] },
    { name: "120cm", detect: [{ type: "keywords", keywords: ["120cm", "120 cm", "幅120"] }] },
    { name: "140cm", detect: [{ type: "keywords", keywords: ["140cm", "140 cm", "幅140"] }] },
    { name: "160cm", detect: [{ type: "keywords", keywords: ["160cm", "160 cm", "幅160"] }] },
    { name: "180cm", detect: [{ type: "keywords", keywords: ["180cm", "180 cm", "幅180"] }] },
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
