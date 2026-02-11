/**
 * Amazon商品情報からサブカテゴリーを自動推論する
 * データ駆動型: ルール定義からマッチングを自動実行
 *
 * 多軸対応: 1商品に対して複数軸のタグを返す（各軸から最大1つ）
 */

interface ProductInfo {
  category: string;
  title?: string;
  features?: string[];
  technicalInfo?: Record<string, string>;
  currentSubcategory?: string | null;
}

// マッチングルール: keywords は OR 条件、allOf は AND 条件（全て含む必要あり）
interface SubcategoryRule {
  result: string;
  keywords?: string[];
  allOf?: string[];
}

// 軸ごとのルール定義
interface AxisRules {
  axis: string;
  rules: SubcategoryRule[];
}

// カテゴリ別の多軸サブカテゴリ推論ルール（軸ごとに順序が優先度に影響）
const SUBCATEGORY_RULES_MULTI_AXIS: Record<string, AxisRules[]> = {
  "キーボード": [
    {
      axis: "スイッチ方式",
      rules: [
        {
          result: "メカニカルキーボード",
          keywords: ["mechanical", "メカニカル", "cherry mx", "gateron", "kailh", "赤軸", "青軸", "茶軸"],
        },
        {
          result: "静電容量無接点",
          keywords: ["hhkb", "realforce", "静電容量", "無接点", "capacitive"],
        },
        {
          result: "パンタグラフ",
          keywords: ["パンタグラフ", "pantograph", "シザー", "scissor", "magic keyboard", "apple keyboard"],
        },
        { result: "パンタグラフ", allOf: ["薄型", "キーボード"] },
      ],
    },
    {
      axis: "サイズ",
      rules: [
        {
          result: "60%・65%",
          keywords: ["60%", "65%", "66キー", "68キー", "60 percent", "65 percent"],
        },
        {
          result: "テンキーレス",
          keywords: ["tkl", "tenkeyless", "テンキーレス", "87キー", "87key"],
        },
        {
          result: "フルサイズ",
          keywords: ["フルサイズ", "full size", "108キー", "テンキー付き"],
        },
      ],
    },
    {
      axis: "形状",
      rules: [
        {
          result: "分割キーボード",
          keywords: ["split", "分割", "ergodox", "kinesis"],
        },
        {
          result: "ロープロファイル",
          keywords: ["ロープロファイル", "low profile", "ultra slim"],
        },
      ],
    },
  ],
  "マウス": [
    {
      axis: "操作方式",
      rules: [
        {
          result: "トラックボール",
          keywords: ["trackball", "トラックボール", "mx ergo", "m575", "sw-m570"],
        },
        {
          result: "縦型マウス",
          keywords: ["vertical", "縦型", "mx vertical"],
        },
        // 「通常マウス」はデフォルト（ルール不要、トラックボール/縦型に該当しなければ通常）
      ],
    },
  ],
  "ディスプレイ・モニター": [
    {
      axis: "解像度",
      rules: [
        {
          result: "5K・6K",
          keywords: ["5k", "6k", "5120"],
        },
        {
          result: "4K",
          keywords: ["4k", "3840", "2160", "uhd"],
        },
        {
          result: "フルHD",
          keywords: ["1080p", "full hd", "フルhd", "1920"],
        },
      ],
    },
    {
      axis: "アスペクト比",
      rules: [
        {
          result: "ウルトラワイド",
          keywords: ["ultrawide", "ウルトラワイド", "21:9", "32:9"],
        },
        { result: "ウルトラワイド", allOf: ["34インチ", "曲面"] },
      ],
    },
  ],
  "モバイルモニター": [
    {
      axis: "サイズ",
      rules: [
        { result: "13インチモバイルモニター", keywords: ["13インチ", "13.3インチ", "13\"", "13.3\""] },
        { result: "15インチモバイルモニター", keywords: ["15インチ", "15.6インチ", "15\"", "15.6\""] },
      ],
    },
    {
      axis: "機能",
      rules: [
        { result: "タッチ対応モバイルモニター", keywords: ["タッチ", "touch", "タッチパネル"] },
      ],
    },
  ],
  "ヘッドホン・イヤホン": [
    {
      axis: "形状",
      rules: [
        {
          result: "イヤホン",
          keywords: ["イヤホン", "earphone", "earbuds", "airpods", "tws", "in-ear"],
        },
        {
          result: "ヘッドホン",
          keywords: ["ヘッドホン", "headphone", "headset", "over-ear", "on-ear"],
        },
      ],
    },
    {
      axis: "ハウジング",
      rules: [
        { result: "開放型", allOf: ["open", "back"] },
        { result: "開放型", keywords: ["開放型", "音漏れ", "open-back"] },
        { result: "密閉型", allOf: ["closed", "back"] },
        { result: "密閉型", keywords: ["密閉型", "遮音", "closed-back"] },
      ],
    },
    {
      axis: "用途",
      rules: [
        {
          result: "モニター用",
          keywords: ["モニターヘッドホン", "dtm", "音楽制作", "studio monitor", "スタジオ"],
        },
        {
          result: "ゲーミング",
          keywords: ["gaming headset", "ゲーミングヘッドセット", "7.1ch"],
        },
        { result: "ゲーミング", allOf: ["マイク付き", "gaming"] },
      ],
    },
  ],
  "チェア": [
    {
      axis: "構造",
      rules: [
        {
          result: "ゲーミングチェア",
          keywords: ["gaming chair", "ゲーミングチェア", "dxracer", "akracing", "バケットシート"],
        },
        {
          result: "メッシュチェア",
          keywords: ["mesh", "メッシュ", "通気性"],
        },
        {
          result: "バランスチェア",
          keywords: ["balance", "バランスチェア", "姿勢"],
        },
      ],
    },
  ],
  "デスク": [
    {
      axis: "機構",
      rules: [
        {
          result: "昇降デスク",
          keywords: ["昇降", "standing", "電動", "height adjustable", "スタンディング"],
        },
        // 「固定デスク」はデフォルト（昇降に該当しなければ固定）
      ],
    },
    {
      axis: "形状",
      rules: [
        {
          result: "L字デスク",
          keywords: ["l字", "l型", "l-shaped", "コーナー"],
        },
        // 「ストレートデスク」はデフォルト（L字に該当しなければストレート）
      ],
    },
  ],
  "マイク": [
    {
      axis: "種類",
      rules: [
        {
          result: "コンデンサーマイク",
          keywords: ["condenser", "コンデンサー"],
        },
        {
          result: "ダイナミックマイク",
          keywords: ["dynamic", "ダイナミック", "sm7b", "re20"],
        },
        {
          result: "ピンマイク",
          keywords: ["lavalier", "ピンマイク", "ラベリア", "襟元"],
        },
      ],
    },
    {
      axis: "接続",
      rules: [
        {
          result: "USB",
          keywords: ["usb mic", "usbマイク", "blue yeti", "fifine", "usb接続"],
        },
        {
          result: "XLR",
          keywords: ["xlr", "ファンタム電源", "phantom power"],
        },
      ],
    },
  ],
  "スピーカー": [
    {
      axis: "形状",
      rules: [
        {
          result: "ブックシェルフ型",
          keywords: ["monitor speaker", "モニタースピーカー", "dtm", "studio", "音楽制作", "ブックシェルフ", "bookshelf"],
        },
        {
          result: "サウンドバー",
          keywords: ["soundbar", "サウンドバー", "モニター下"],
        },
      ],
    },
  ],
  "照明・ライト": [
    {
      axis: "種類",
      rules: [
        {
          result: "モニターライト",
          keywords: ["screenbar", "モニターライト", "monitor light"],
        },
        {
          result: "リングライト",
          keywords: ["ring light", "リングライト", "撮影用"],
        },
        {
          result: "LEDテープ",
          keywords: ["led strip", "ledテープ", "led tape", "テープライト"],
        },
        {
          result: "間接照明",
          keywords: ["間接照明", "indirect lighting"],
        },
        {
          result: "デスクライト",
          keywords: ["desk lamp", "デスクライト", "卓上ライト"],
        },
      ],
    },
  ],
  "ウェブカメラ": [
    {
      axis: "解像度",
      rules: [
        {
          result: "4K",
          keywords: ["4k", "3840"],
        },
        {
          result: "フルHD",
          keywords: ["1080p", "full hd", "フルhd"],
        },
      ],
    },
  ],
  "PC本体": [
    {
      axis: "形態",
      rules: [
        {
          result: "自作PC",
          keywords: ["自作", "custom build", "btoパソコン"],
        },
        {
          result: "ミニPC",
          keywords: ["mini pc", "ミニpc", "nuc"],
        },
        {
          result: "ノートPC",
          keywords: ["laptop", "notebook", "ノートpc", "ノートパソコン", "macbook"],
        },
        {
          result: "デスクトップPC",
          keywords: ["desktop", "デスクトップpc", "タワー型", "imac", "mac studio", "mac pro"],
        },
      ],
    },
    {
      axis: "OS",
      rules: [
        {
          result: "Mac",
          keywords: ["mac", "macbook", "imac", "mac studio", "mac pro", "macos"],
        },
        {
          result: "Windows",
          keywords: ["windows"],
        },
      ],
    },
  ],
  "HDD・SSD": [
    {
      axis: "形態",
      rules: [
        {
          result: "外付けSSD",
          keywords: ["外付けssd", "external ssd", "portable ssd"],
        },
        {
          result: "外付けHDD",
          keywords: ["外付けhdd", "external hdd", "portable hdd"],
        },
        {
          result: "内蔵SSD",
          keywords: ["内蔵ssd", "internal ssd", "m.2", "nvme"],
        },
        {
          result: "内蔵HDD",
          keywords: ["内蔵hdd", "internal hdd"],
        },
      ],
    },
  ],
  "コントローラー": [
    {
      axis: "種類",
      rules: [
        {
          result: "レーシングホイール",
          keywords: ["racing wheel", "レーシングホイール", "ハンドル"],
        },
        {
          result: "アーケードスティック",
          keywords: ["arcade stick", "アーケードスティック", "fight stick"],
        },
        // 「ゲームパッド」はデフォルト（上記に該当しなければゲームパッド）
      ],
    },
  ],
  "キャプチャーボード": [
    {
      axis: "形態",
      rules: [
        {
          result: "外付け",
          keywords: ["外付け", "external", "usb"],
        },
        {
          result: "内蔵",
          keywords: ["内蔵", "internal", "pcie"],
        },
      ],
    },
  ],
  "NAS": [
    {
      axis: "ベイ数",
      rules: [
        {
          result: "2ベイ",
          keywords: ["2bay", "2ベイ", "2台"],
        },
        {
          result: "4ベイ",
          keywords: ["4bay", "4ベイ", "4台"],
        },
      ],
    },
  ],
  "マイクアーム": [
    {
      axis: "種類",
      rules: [
        {
          result: "ロープロファイルマイクアーム",
          keywords: ["ロープロファイル", "low profile"],
        },
        {
          result: "クランプ式マイクアーム",
          keywords: ["クランプ", "clamp"],
        },
        {
          result: "デスクマウント型マイクアーム",
          keywords: ["デスクマウント", "desk mount", "boom arm", "ブームアーム"],
        },
      ],
    },
  ],
  "充電器・電源タップ": [
    {
      axis: "種類",
      rules: [
        {
          result: "ワイヤレス充電器",
          keywords: ["wireless charger", "ワイヤレス充電", "qi", "magsafe"],
        },
        {
          result: "ポータブル電源",
          keywords: ["ポータブル電源", "portable power"],
        },
        {
          result: "電源タップ",
          keywords: ["電源タップ", "power strip", "延長コード"],
        },
        {
          result: "USB充電器",
          keywords: ["usb充電器", "usb charger", "急速充電", "gan"],
        },
      ],
    },
  ],
  "配線整理グッズ": [
    {
      axis: "種類",
      rules: [
        { result: "ケーブルトレイ", keywords: ["ケーブルトレイ", "cable tray"] },
        { result: "ケーブルクリップ", keywords: ["ケーブルクリップ", "cable clip"] },
        { result: "ケーブルチューブ", keywords: ["ケーブルチューブ", "cable sleeve", "スリーブ"] },
        { result: "ケーブルボックス", keywords: ["ケーブルボックス", "cable box"] },
        { result: "マジックテープ", keywords: ["マジックテープ", "velcro", "面ファスナー"] },
        { result: "ケーブルホルダー", keywords: ["ケーブルホルダー", "cable holder", "ケーブルクリ"] },
      ],
    },
  ],
  "モニターアーム": [
    {
      axis: "構成",
      rules: [
        {
          result: "デュアルアーム",
          keywords: ["dual", "デュアル", "2画面", "ダブル"],
        },
        {
          result: "シングルアーム",
          keywords: ["single", "シングル", "1画面"],
        },
      ],
    },
  ],
  "ペンタブ": [
    {
      axis: "種類",
      rules: [
        {
          result: "液タブ",
          keywords: ["液タブ", "液晶タブレット", "cintiq", "kamvas", "pen display"],
        },
        {
          result: "板タブ",
          keywords: ["板タブ", "ペンタブレット", "intuos", "pen tablet"],
        },
      ],
    },
  ],
};

// ルールに対してテキストがマッチするかチェック
function matchesRule(text: string, rule: SubcategoryRule): boolean {
  // AND条件: 全てのキーワードが含まれていればマッチ
  if (rule.allOf) {
    return rule.allOf.every((kw) => text.includes(kw));
  }
  // OR条件: いずれかのキーワードが含まれていればマッチ
  if (rule.keywords) {
    return rule.keywords.some((kw) => text.includes(kw));
  }
  return false;
}

/**
 * 商品情報からサブカテゴリーを推論（多軸対応: 各軸から最大1つ）
 * @returns マッチした全軸のタグ配列
 */
export function inferSubcategoryMultiAxis(data: ProductInfo): string[] {
  const { category, title = "", features = [] } = data;

  const titleLower = title.toLowerCase();
  const featuresText = features.join(" ").toLowerCase();
  const allText = (titleLower + " " + featuresText).toLowerCase();

  const axesRules = SUBCATEGORY_RULES_MULTI_AXIS[category];
  if (!axesRules) return [];

  const results: string[] = [];

  for (const { rules } of axesRules) {
    for (const rule of rules) {
      if (matchesRule(allText, rule)) {
        results.push(rule.result);
        break; // この軸は1つだけ
      }
    }
  }

  return results;
}

/**
 * 商品情報からサブカテゴリーを推論（後方互換: 最初にマッチした1つだけ返す）
 */
export function inferSubcategory(data: ProductInfo): string | null {
  const { currentSubcategory } = data;

  // 既にサブカテゴリーがあればそれを優先
  if (currentSubcategory) return currentSubcategory;

  const results = inferSubcategoryMultiAxis(data);
  return results.length > 0 ? results[0] : null;
}
