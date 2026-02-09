/**
 * Amazon商品情報からサブカテゴリーを自動推論する
 * データ駆動型: ルール定義からマッチングを自動実行
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

// カテゴリ別のサブカテゴリ推論ルール（順序が優先度に影響）
const SUBCATEGORY_RULES: Record<string, SubcategoryRule[]> = {
  "キーボード": [
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
    {
      result: "分割キーボード",
      keywords: ["split", "分割", "ergodox", "kinesis"],
    },
    {
      result: "テンキーレス",
      keywords: ["tkl", "tenkeyless", "テンキーレス", "87キー", "87key"],
    },
    {
      result: "60%・65%キーボード",
      keywords: ["60%", "65%", "66キー", "68キー", "60 percent", "65 percent"],
    },
    {
      result: "フルサイズキーボード",
      keywords: ["フルサイズ", "full size", "108キー", "テンキー付き"],
    },
    {
      result: "ロープロファイル",
      keywords: ["ロープロファイル", "low profile", "薄型", "ultra slim"],
    },
  ],
  "マウス": [
    {
      result: "トラックボール",
      keywords: ["trackball", "トラックボール", "mx ergo", "m575", "sw-m570"],
    },
    {
      result: "縦型マウス",
      keywords: ["vertical", "縦型", "mx vertical"],
    },
    {
      result: "ゲーミングマウス",
      keywords: ["gaming", "ゲーミング", "g pro", "deathadder", "viper", "rival"],
    },
    {
      result: "エルゴノミクスマウス",
      keywords: ["ergonomic", "エルゴノミクス", "mx master", "mx anywhere"],
    },
    {
      result: "ワイヤレスマウス",
      keywords: ["wireless", "ワイヤレス", "bluetooth"],
    },
  ],
  "ディスプレイ・モニター": [
    {
      result: "4Kモニター",
      keywords: ["4k", "3840", "2160", "uhd"],
    },
    {
      result: "ウルトラワイドモニター",
      keywords: ["ultrawide", "ウルトラワイド", "21:9"],
    },
    { result: "ウルトラワイドモニター", allOf: ["34インチ", "曲面"] },
    {
      result: "ゲーミングモニター",
      keywords: ["144hz", "165hz", "240hz", "g-sync", "freesync"],
    },
    { result: "ゲーミングモニター", allOf: ["gaming", "hz"] },
    {
      result: "モバイルモニター",
      keywords: ["mobile", "モバイル", "portable", "ポータブル", "13.3", "15.6"],
    },
    {
      result: "5K・6Kモニター",
      keywords: ["5k", "6k", "5120"],
    },
  ],
  "ヘッドホン・イヤホン": [
    { result: "開放型ヘッドホン", allOf: ["open", "back"] },
    { result: "開放型ヘッドホン", keywords: ["開放型", "音漏れ"] },
    { result: "密閉型ヘッドホン", allOf: ["closed", "back"] },
    { result: "密閉型ヘッドホン", keywords: ["密閉型", "遮音"] },
    {
      result: "ワイヤレスイヤホン",
      keywords: ["airpods", "完全ワイヤレス", "true wireless", "tws"],
    },
    { result: "ワイヤレスイヤホン", allOf: ["bluetooth", "イヤホン"] },
    { result: "有線イヤホン", keywords: ["有線イヤホン"] },
    { result: "有線イヤホン", allOf: ["3.5mm", "イヤホン"] },
    {
      result: "モニターヘッドホン",
      keywords: ["モニターヘッドホン", "dtm", "音楽制作", "studio monitor", "スタジオ"],
    },
    {
      result: "ゲーミングヘッドセット",
      keywords: ["gaming headset", "ゲーミングヘッドセット", "7.1ch"],
    },
    { result: "ゲーミングヘッドセット", allOf: ["マイク付き", "gaming"] },
  ],
  "チェア": [
    {
      result: "ゲーミングチェア",
      keywords: ["gaming chair", "ゲーミングチェア", "dxracer", "akracing", "バケットシート"],
    },
    {
      result: "エルゴノミクスチェア",
      keywords: ["herman miller", "steelcase", "ergonomic", "エルゴノミクス", "腰痛対策", "ランバーサポート"],
    },
    {
      result: "メッシュチェア",
      keywords: ["mesh", "メッシュ", "通気性"],
    },
    {
      result: "オフィスチェア",
      keywords: ["office chair", "オフィスチェア", "事務椅子"],
    },
    {
      result: "バランスチェア",
      keywords: ["balance", "バランスチェア", "姿勢"],
    },
  ],
  "デスク": [
    {
      result: "昇降デスク",
      keywords: ["昇降", "standing", "電動", "height adjustable", "スタンディング"],
    },
    {
      result: "L字デスク",
      keywords: ["l字", "l型", "l-shaped", "コーナー"],
    },
    {
      result: "DIYデスク",
      keywords: ["diy", "自作", "天板のみ", "カスタム"],
    },
    {
      result: "ゲーミングデスク",
      keywords: ["gaming desk", "ゲーミングデスク"],
    },
    {
      result: "PCデスク",
      keywords: ["pcデスク", "パソコンデスク", "computer desk"],
    },
  ],
  "マイク": [
    {
      result: "コンデンサーマイク",
      keywords: ["condenser", "コンデンサー", "配信", "streaming"],
    },
    {
      result: "ダイナミックマイク",
      keywords: ["dynamic", "ダイナミック", "sm7b", "re20"],
    },
    {
      result: "USBマイク",
      keywords: ["usb mic", "usbマイク", "blue yeti", "fifine"],
    },
    {
      result: "XLRマイク",
      keywords: ["xlr", "ファンタム電源", "phantom power"],
    },
    {
      result: "ピンマイク",
      keywords: ["lavalier", "ピンマイク", "ラベリア", "襟元"],
    },
  ],
  "スピーカー": [
    {
      result: "モニタースピーカー",
      keywords: ["monitor speaker", "モニタースピーカー", "dtm", "studio", "音楽制作"],
    },
    {
      result: "サウンドバー",
      keywords: ["soundbar", "サウンドバー", "モニター下"],
    },
    {
      result: "Bluetoothスピーカー",
      keywords: ["bluetooth speaker", "bluetoothスピーカー", "ワイヤレススピーカー"],
    },
    {
      result: "PCスピーカー",
      keywords: ["pcスピーカー", "pc speaker", "デスクトップスピーカー"],
    },
  ],
  "照明・ライト": [
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
  "ウェブカメラ": [
    {
      result: "4Kウェブカメラ",
      keywords: ["4k", "3840"],
    },
    {
      result: "フルHDウェブカメラ",
      keywords: ["1080p", "full hd", "フルhd"],
    },
    {
      result: "広角ウェブカメラ",
      keywords: ["wide angle", "広角", "ultra wide"],
    },
  ],
  "PC本体": [
    {
      result: "デスクトップPC",
      keywords: ["desktop", "デスクトップpc", "タワー型"],
    },
    {
      result: "ノートPC",
      keywords: ["laptop", "notebook", "ノートpc", "ノートパソコン"],
    },
    {
      result: "ミニPC",
      keywords: ["mini pc", "ミニpc", "nuc"],
    },
    {
      result: "自作PC",
      keywords: ["自作", "custom build", "btopパソコン"],
    },
    {
      result: "Mac",
      keywords: ["mac", "macbook", "imac"],
    },
  ],
  "HDD・SSD": [
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
    {
      result: "HDDケース",
      keywords: ["hddケース", "enclosure", "ケース"],
    },
  ],
  "コントローラー": [
    {
      result: "PlayStation用コントローラー",
      keywords: ["playstation", "ps4", "ps5", "dualsense", "dualshock"],
    },
    {
      result: "Xbox用コントローラー",
      keywords: ["xbox", "elite"],
    },
    {
      result: "Switch用コントローラー",
      keywords: ["switch", "pro controller", "joy-con"],
    },
    {
      result: "レーシングホイール",
      keywords: ["racing wheel", "レーシングホイール", "ハンドル"],
    },
    {
      result: "アーケードスティック",
      keywords: ["arcade stick", "アーケードスティック", "fight stick"],
    },
    {
      result: "PCゲーム用コントローラー",
      keywords: ["pc game", "pcゲーム"],
    },
  ],
  "左手デバイス": [
    {
      result: "ストリームデッキ",
      keywords: ["stream deck", "elgato"],
    },
    {
      result: "マクロパッド",
      keywords: ["macro pad", "マクロパッド", "macropad"],
    },
    {
      result: "左手キーボード",
      keywords: ["左手", "left hand", "片手"],
    },
    {
      result: "TourBox",
      keywords: ["tourbox"],
    },
    {
      result: "Orbital2",
      keywords: ["orbital"],
    },
    {
      result: "プログラマブルキーパッド",
      keywords: ["プログラマブル", "programmable", "キーパッド", "keypad"],
    },
  ],
  "キャプチャーボード": [
    {
      result: "外付けキャプチャーボード",
      keywords: ["外付け", "external", "usb"],
    },
    {
      result: "内蔵キャプチャーボード",
      keywords: ["内蔵", "internal", "pcie"],
    },
    {
      result: "4Kキャプチャーボード",
      keywords: ["4k", "2160p"],
    },
    {
      result: "HDMIキャプチャーボード",
      keywords: ["hdmi"],
    },
  ],
  "NAS": [
    {
      result: "2ベイNAS",
      keywords: ["2bay", "2ベイ", "2台"],
    },
    {
      result: "4ベイNAS",
      keywords: ["4bay", "4ベイ", "4台"],
    },
    {
      result: "ラックマウント型NAS",
      keywords: ["rackmount", "ラックマウント"],
    },
    {
      result: "デスクトップ型NAS",
      keywords: ["desktop", "デスクトップ"],
    },
  ],
};

// カテゴリ名のエイリアス（DB値のバリエーション → ルールキー）
const CATEGORY_ALIASES: Record<string, string> = {
  "ディスプレイ/モニター": "ディスプレイ・モニター",
  "ヘッドホン/イヤホン": "ヘッドホン・イヤホン",
  "HDD/SSD": "HDD・SSD",
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
 * 商品情報からサブカテゴリーを推論
 */
export function inferSubcategory(data: ProductInfo): string | null {
  const { category, title = "", features = [], currentSubcategory } = data;

  // 既にサブカテゴリーがあればそれを優先
  if (currentSubcategory) return currentSubcategory;

  const titleLower = title.toLowerCase();
  const featuresText = features.join(" ").toLowerCase();
  const allText = (titleLower + " " + featuresText).toLowerCase();

  // カテゴリ名を正規化してルールを取得
  const ruleKey = CATEGORY_ALIASES[category] || category;
  const rules = SUBCATEGORY_RULES[ruleKey];

  if (!rules) return null;

  // 順番にルールを評価（最初にマッチしたものを返す）
  for (const rule of rules) {
    if (matchesRule(allText, rule)) {
      return rule.result;
    }
  }

  return null;
}
