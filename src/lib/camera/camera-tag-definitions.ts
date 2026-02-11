/**
 * 撮影機材DB タグの一元定義（Single Source of Truth）
 *
 * ここにタグを追加すれば、以下すべてに自動反映される:
 * - 管理画面のタグ選択UI
 * - Amazon商品情報からの自動タグ推論
 * - カテゴリページのフィルタリング
 */

// ============================================================
// 型定義
// ============================================================

/** キーワードマッチングルール（OR / AND） */
export interface CameraDetectionRule {
  /** OR条件: いずれかのキーワードを含めばマッチ */
  keywords?: string[];
  /** AND条件: すべてのキーワードを含めばマッチ */
  allOf?: string[];
}

/** 種類タグ（サブカテゴリ）の定義 */
export interface CameraTypeTagDef {
  /** タグ表示名 */
  name: string;
  /** 商品テキストからの検出ルール */
  detect: CameraDetectionRule[];
}

// --- レンズタグ / カメラ本体タグ用の検出方法 ---

/** 特徴タグの検出方法 */
export type CameraFeatureDetector =
  | { type: "keywords"; keywords: string[] }
  | { type: "allOf"; keywords: string[] }
  | {
      type: "regexRange";
      /** 正規表現パターン (キャプチャグループで数値を取得) */
      patterns: string[];
      /** 焦点距離の妥当範囲 [min, max] */
      validRange: [number, number];
      /** 数値 → タグのマッピング（maxの昇順） */
      ranges: { max: number; tag: string }[];
    }
  | {
      type: "regexAperture";
      /** 可変F値の正規表現 */
      variablePattern: string;
      /** 単一F値の正規表現（キャプチャグループで数値を取得） */
      fixedPatterns: string[];
      /** F値の妥当範囲 [min, max] */
      validRange: [number, number];
      /** 数値 → タグのマッピング（maxの昇順） */
      ranges: { max: number; tag: string }[];
      /** 可変F値のタグ名 */
      variableTag: string;
      /** F値の妥当範囲外のフォールバックタグ */
      fallbackTag: string;
    };

/** レンズタグ / カメラ本体タグの軸定義 */
export interface CameraFeatureAxisDef {
  /** 軸名（例: "焦点距離", "撮像サイズ"） */
  axis: string;
  /** 排他的か（true = 1つだけ選択可、false = 複数選択可） */
  exclusive: boolean;
  /** この軸のタグ一覧 */
  tags: CameraFeatureTagDef[];
}

/** レンズタグ / カメラ本体タグの定義 */
export interface CameraFeatureTagDef {
  /** タグ表示名 */
  name: string;
  /** 検出方法（いずれか1つマッチすれば検出） */
  detect: CameraFeatureDetector[];
}

// ============================================================
// 種類タグ（サブカテゴリ）定義
// ============================================================

export const CAMERA_TYPE_TAG_DEFS: Record<string, CameraTypeTagDef[]> = {
  "カメラ本体": [
    { name: "ミラーレス一眼", detect: [{ keywords: ["ミラーレス", "mirrorless"] }] },
    { name: "一眼レフ", detect: [{ keywords: ["一眼レフ", "デジタル一眼レフ", "dslr"] }] },
    { name: "コンパクトデジタルカメラ", detect: [{ keywords: ["コンパクト", "コンデジ", "compact camera", "point and shoot"] }] },
    { name: "シネマカメラ", detect: [{ keywords: ["シネマカメラ", "cinema camera", "シネカメ"] }] },
    { name: "アクションカメラ", detect: [{ keywords: ["アクションカメラ", "action camera", "gopro", "ウェアラブル"] }] },
  ],
  "レンズ": [
    { name: "単焦点レンズ", detect: [{ keywords: ["単焦点", "prime lens"] }] },
    { name: "ズームレンズ", detect: [{ keywords: ["ズームレンズ", "zoom lens", "ズーム"] }] },
    { name: "シネマレンズ", detect: [{ keywords: ["シネマレンズ", "cine lens", "cinema lens"] }] },
  ],
  "三脚": [
    { name: "三脚", detect: [{ keywords: ["三脚", "tripod"] }] },
    { name: "一脚", detect: [{ keywords: ["一脚", "monopod"] }] },
    { name: "ミニ三脚", detect: [{ keywords: ["ミニ三脚", "卓上三脚", "mini tripod", "tabletop"] }] },
    { name: "トラベル三脚", detect: [{ keywords: ["トラベル", "travel tripod", "旅行"] }] },
    { name: "ビデオ三脚", detect: [{ keywords: ["ビデオ三脚", "video tripod", "フルードヘッド"] }] },
    { name: "雲台", detect: [{ keywords: ["雲台", "自由雲台", "ボールヘッド", "ball head", "ビデオヘッド"] }] },
  ],
  "ジンバル": [
    { name: "カメラ用ジンバル", detect: [{ keywords: ["カメラ用", "camera gimbal", "一眼", "ミラーレス"] }] },
    { name: "スマホ用ジンバル", detect: [{ keywords: ["スマホ", "スマートフォン", "smartphone", "phone gimbal"] }] },
    { name: "メカニカルスタビライザー", detect: [{ keywords: ["メカニカル", "mechanical stabilizer"] }] },
  ],
  "マイク・音声": [
    { name: "マイク", detect: [{ keywords: ["マイク", "microphone", "mic"] }] },
    { name: "レコーダー", detect: [{ keywords: ["レコーダー", "recorder", "pcm"] }] },
    { name: "オーディオインターフェース", detect: [{ keywords: ["オーディオインターフェース", "audio interface"] }] },
  ],
  "照明": [
    { name: "定常光ライト", detect: [{ keywords: ["ledライト", "led light", "定常光", "パネルライト", "ビデオライト"] }] },
    { name: "ストロボ", detect: [{ keywords: ["ストロボ", "strobe", "flash", "スピードライト", "speedlight"] }] },
    { name: "照明アクセサリー", detect: [{ keywords: ["ソフトボックス", "ディフューザー", "リフレクター", "ライトスタンド"] }] },
  ],
  "ストレージ": [
    { name: "メモリーカード", detect: [{ keywords: ["sdカード", "cfexpress", "メモリーカード", "memory card", "sd card", "microsd"] }] },
    { name: "外部ストレージ", detect: [{ keywords: ["外付け", "ポータブルssd", "external", "portable ssd", "hdd"] }] },
    { name: "カードリーダー", detect: [{ keywords: ["カードリーダー", "card reader"] }] },
  ],
  "カメラ装着アクセサリー": [
    { name: "外部モニター", detect: [{ keywords: ["外部モニター", "モニター", "monitor", "フィールドモニター"] }] },
    { name: "ケージ・リグ", detect: [{ keywords: ["ケージ", "リグ", "cage", "rig"] }] },
    { name: "フォローフォーカス", detect: [{ keywords: ["フォローフォーカス", "follow focus"] }] },
    { name: "レンズフィルター", detect: [{ keywords: ["フィルター", "filter", "nd", "cpl", "プロテクター"] }] },
    { name: "電子マウントアダプター", detect: [{ keywords: ["マウントアダプター", "mount adapter"] }] },
    { name: "バッテリー", detect: [{ keywords: ["バッテリー", "battery", "充電池"] }] },
    { name: "充電器", detect: [{ keywords: ["充電器", "charger"] }] },
    { name: "カメラストラップ", detect: [{ keywords: ["ストラップ", "strap"] }] },
    { name: "ハンドストラップ", detect: [{ keywords: ["ハンドストラップ", "hand strap"] }] },
    { name: "その他", detect: [] },
  ],
  "収録・制御機器": [
    { name: "キャプチャーデバイス", detect: [{ keywords: ["キャプチャー", "capture"] }] },
    { name: "外部レコーダー", detect: [{ keywords: ["外部レコーダー", "external recorder", "atomos"] }] },
    { name: "制御アクセサリー", detect: [{ keywords: ["リモコン", "remote", "ワイヤレストランスミッター"] }] },
    { name: "キャリブレーションツール", detect: [{ keywords: ["キャリブレーション", "calibration", "カラーチェッカー"] }] },
  ],
  "バッグ・収納": [
    { name: "カメラバッグ", detect: [{ keywords: ["カメラバッグ", "camera bag", "ショルダーバッグ"] }] },
    { name: "バックパック", detect: [{ keywords: ["バックパック", "リュック", "backpack"] }] },
    { name: "スリングバッグ", detect: [{ keywords: ["スリング", "sling"] }] },
    { name: "ハードケース", detect: [{ keywords: ["ハードケース", "hard case", "pelican", "ペリカン"] }] },
    { name: "インナーケース", detect: [{ keywords: ["インナー", "inner case", "仕切り"] }] },
  ],
  "ドローンカメラ": [],
};

// ============================================================
// レンズ用タグ定義（多軸・検出キーワード付き）
// ============================================================

export const CAMERA_LENS_TAG_DEFS: CameraFeatureAxisDef[] = [
  {
    axis: "焦点距離",
    exclusive: true,
    tags: [
      {
        name: "超広角",
        detect: [{
          type: "regexRange",
          patterns: ["(\\d+)(?:\\s*-\\s*\\d+)?\\s*mm", "(\\d+)(?:\\s*-\\s*\\d+)?\\s*ミリ"],
          validRange: [4, 2000],
          ranges: [
            { max: 16, tag: "超広角" },
            { max: 35, tag: "広角" },
            { max: 60, tag: "標準" },
            { max: 100, tag: "中望遠" },
            { max: 300, tag: "望遠" },
            { max: Infinity, tag: "超望遠" },
          ],
        }],
      },
      { name: "広角", detect: [] },       // regexRange で自動判定
      { name: "標準", detect: [] },       // regexRange で自動判定
      { name: "中望遠", detect: [] },     // regexRange で自動判定
      { name: "望遠", detect: [] },       // regexRange で自動判定
      { name: "超望遠", detect: [] },     // regexRange で自動判定
    ],
  },
  {
    axis: "明るさ",
    exclusive: true,
    tags: [
      {
        name: "F1.2-F1.4",
        detect: [{
          type: "regexAperture",
          variablePattern: "[fF][\\s/]?(\\d+\\.?\\d*)\\s*[-\u2013]\\s*(\\d+\\.?\\d*)",
          fixedPatterns: ["[fF][\\s/]?(\\d+\\.?\\d*)", "1\\s*:\\s*(\\d+\\.?\\d*)"],
          validRange: [0.7, 32],
          ranges: [
            { max: 1.4, tag: "F1.2-F1.4" },
            { max: 2, tag: "F1.8-F2" },
            { max: 2.8, tag: "F2.8" },
            { max: 4, tag: "F4" },
          ],
          variableTag: "可変F値",
          fallbackTag: "可変F値",
        }],
      },
      { name: "F1.8-F2", detect: [] },    // regexAperture で自動判定
      { name: "F2.8", detect: [] },       // regexAperture で自動判定
      { name: "F4", detect: [] },         // regexAperture で自動判定
      { name: "可変F値", detect: [] },    // regexAperture で自動判定
    ],
  },
  {
    axis: "機能",
    exclusive: false,
    tags: [
      { name: "マクロ対応", detect: [{ type: "keywords", keywords: ["マクロ", "macro"] }] },
      { name: "等倍マクロ", detect: [{ type: "keywords", keywords: ["等倍マクロ", "1:1 macro", "life-size"] }] },
      { name: "手ブレ補正", detect: [{ type: "keywords", keywords: ["手ブレ補正", "手振れ補正", "image stabilization", " is ", " vr ", " oss ", " ois ", "stabilized"] }] },
      { name: "防塵防滴", detect: [{ type: "keywords", keywords: ["防塵防滴", "防滴", "weather sealed", "weather-sealed", "dust and moisture", "防塵・防滴"] }] },
    ],
  },
  {
    axis: "規格・対応",
    exclusive: false,
    tags: [
      { name: "フルサイズ対応", detect: [{ type: "keywords", keywords: ["フルサイズ対応", "フルサイズ", "full frame", "full-frame", "35mmフルサイズ", "35mm full"] }] },
      { name: "APS-C専用", detect: [{ type: "keywords", keywords: ["aps-c専用", "aps-c only", "apsc専用", "dx format"] }] },
      { name: "Eマウント", detect: [{ type: "keywords", keywords: ["eマウント", "e-mount", "e mount", "sony e "] }] },
      { name: "RFマウント", detect: [{ type: "keywords", keywords: ["rfマウント", "rf-mount", "rf mount", "canon rf"] }] },
      { name: "Zマウント", detect: [{ type: "keywords", keywords: ["zマウント", "z-mount", "z mount", "nikon z"] }] },
      { name: "Lマウント", detect: [{ type: "keywords", keywords: ["lマウント", "l-mount", "l mount"] }] },
      { name: "Xマウント", detect: [{ type: "keywords", keywords: ["xマウント", "x-mount", "x mount", "fujifilm x"] }] },
      { name: "MFT", detect: [{ type: "keywords", keywords: ["マイクロフォーサーズ", "micro four thirds", "micro 4/3", "mft", "m4/3", "m.zuiko"] }] },
    ],
  },
];

// ============================================================
// カメラ本体用タグ定義（検出キーワード付き）
// ============================================================

export const CAMERA_BODY_TAG_DEFS: CameraFeatureAxisDef[] = [
  {
    axis: "撮像サイズ",
    exclusive: true,
    tags: [
      { name: "フルサイズ", detect: [{ type: "keywords", keywords: ["フルサイズ", "full frame", "full-frame", "35mmフルサイズ", "35mm full frame"] }] },
      { name: "APS-C", detect: [{ type: "keywords", keywords: ["aps-c", "apsc", "dx format", "aps-cサイズ"] }] },
      { name: "マイクロフォーサーズ", detect: [{ type: "keywords", keywords: ["マイクロフォーサーズ", "micro four thirds", "micro 4/3", "mft", "m4/3"] }] },
      { name: "1インチ", detect: [{ type: "keywords", keywords: ["1インチ", "1-inch", "1型", "1.0型", "1 inch sensor"] }] },
      { name: "小型センサー", detect: [{ type: "keywords", keywords: ["1/2.3", "1/1.7", "1/1.3", "2/3型"] }] },
    ],
  },
];

// ============================================================
// 後方互換: 既存コードが使うフラットな定数を自動生成
// ============================================================

/** CAMERA_TYPE_TAGS 互換（名前のみ） */
export const CAMERA_TYPE_TAGS: Record<string, string[]> = Object.fromEntries(
  Object.entries(CAMERA_TYPE_TAG_DEFS).map(([cat, defs]) => [
    cat,
    defs.map((d) => d.name),
  ])
);

/** CAMERA_ALL_TYPE_TAGS 互換 */
export const CAMERA_ALL_TYPE_TAGS = Object.values(CAMERA_TYPE_TAGS).flat();

/** CAMERA_LENS_TAGS 互換（軸名 → タグ名配列） */
export const CAMERA_LENS_TAGS: Record<string, string[]> = Object.fromEntries(
  CAMERA_LENS_TAG_DEFS.map((axis) => [
    axis.axis,
    axis.tags.map((t) => t.name),
  ])
);

/** CAMERA_ALL_LENS_TAGS 互換 */
export const CAMERA_ALL_LENS_TAGS = Object.values(CAMERA_LENS_TAGS).flat();

/** CAMERA_BODY_TAGS 互換（軸名 → タグ名配列） */
export const CAMERA_BODY_TAGS: Record<string, string[]> = Object.fromEntries(
  CAMERA_BODY_TAG_DEFS.map((axis) => [
    axis.axis,
    axis.tags.map((t) => t.name),
  ])
);

/** CAMERA_ALL_BODY_TAGS 互換 */
export const CAMERA_ALL_BODY_TAGS = Object.values(CAMERA_BODY_TAGS).flat();
