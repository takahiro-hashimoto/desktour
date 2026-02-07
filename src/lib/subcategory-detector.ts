import { SUBCATEGORIES } from "./constants";

/**
 * 商品名/ブランド/特徴からサブカテゴリを推測するキーワードマッピング
 * キーワードは小文字で定義し、検索時も小文字に変換して比較する
 */
const SUBCATEGORY_KEYWORDS: Record<string, string[]> = {
  // キーボード
  "メカニカルキーボード": [
    "mechanical", "メカニカル", "cherry mx", "gateron", "keychron", "ducky",
    "filco", "leopold", "varmilo", "akko", "kailh", "茶軸", "赤軸", "青軸", "銀軸"
  ],
  "静電容量無接点": [
    "hhkb", "realforce", "topre", "静電容量", "niz", "type-s", "hybrid type"
  ],
  "分割キーボード": [
    "split", "分割", "ergodox", "kinesis", "corne", "lily58", "moonlander",
    "keyball", "crkbd", "helix", "sofle", "iris"
  ],
  "テンキーレス": ["tkl", "tenkeyless", "テンキーレス", "87%", "87キー"],
  "60%/65%キーボード": [
    "60%", "65%", "poker", "anne pro", "nuphy air", "nuphy halo", "gk61", "sk61"
  ],
  "フルサイズキーボード": ["full size", "フルサイズ", "108キー", "104キー"],
  "ロープロファイル": ["low profile", "ロープロファイル", "薄型", "mx keys"],

  // マウス
  "トラックボール": [
    "trackball", "トラックボール", "m575", "ergo m575", "huge", "deft pro",
    "orbit", "slimblade", "expert mouse", "mx ergo"
  ],
  "エルゴノミクスマウス": [
    "mx master", "mx anywhere", "evoluent", "lift", "エルゴノミック"
  ],
  "ゲーミングマウス": [
    "gaming mouse", "ゲーミングマウス", "g502", "g pro", "deathadder", "viper",
    "superlight", "gpro", "basilisk", "pulsefire", "model o", "model d"
  ],
  "縦型マウス": ["vertical", "縦型マウス", "evoluent", "anker vertical", "lift vertical"],
  "ワイヤレスマウス": ["wireless mouse", "ワイヤレスマウス", "bluetooth mouse"],

  // ディスプレイ/モニター
  "4Kモニター": [
    "4k", "3840x2160", "uhd", "u2723", "u2722", "u3223", "ev2785", "ev2795",
    "s2722", "pd2725", "27uk", "27up"
  ],
  "ウルトラワイドモニター": [
    "ultrawide", "ウルトラワイド", "34wk", "34gn", "29wl", "曲面", "curved",
    "34uc", "38wn", "49wl", "super ultrawide"
  ],
  "ゲーミングモニター": [
    "gaming monitor", "ゲーミングモニター", "144hz", "165hz", "240hz", "360hz",
    "g-sync", "freesync", "27gp", "32gk", "xg27"
  ],
  "モバイルモニター": [
    "mobile monitor", "モバイルモニター", "portable monitor", "ポータブルモニター",
    "モバイルディスプレイ", "15.6インチ", "14インチモニター"
  ],
  "縦置きモニター": ["pivot", "回転", "縦置き"],
  "5K/6Kモニター": [
    "5k", "6k", "studio display", "pro display xdr", "ultrafine 5k", "ultrafine 6k"
  ],

  // ヘッドホン/イヤホン
  "開放型ヘッドホン": [
    "open back", "開放型", "hd600", "hd650", "hd660", "hd800", "dt990", "dt880",
    "k701", "k702", "sundara", "arya"
  ],
  "密閉型ヘッドホン": [
    "closed back", "密閉型", "m50x", "m40x", "dt770", "mdr-7506", "mdr-m1",
    "ath-m50", "ath-m40"
  ],
  "ワイヤレスイヤホン": [
    "true wireless", "airpods", "wf-1000", "galaxy buds", "freebuds",
    "linkbuds", "momentum true wireless", "pi7"
  ],
  "有線イヤホン": ["wired earphone", "有線イヤホン", "iem", "カナル型"],
  "モニターヘッドホン": ["monitor headphone", "モニターヘッドホン", "studio headphone"],

  // デスク
  "昇降デスク": [
    "standing desk", "昇降デスク", "flexispot", "電動デスク", "height adjustable",
    "スタンディングデスク", "sit stand", "e7", "e8", "uplift"
  ],
  "L字デスク": ["l-shaped", "l字デスク", "コーナーデスク", "l型"],
  "PCデスク": ["pc desk", "pcデスク", "ゲーミングデスク", "ワークデスク"],
  "DIYデスク": ["diy", "自作デスク", "天板", "かなでもの"],

  // チェア
  "ゲーミングチェア": [
    "gaming chair", "ゲーミングチェア", "akracing", "dxracer", "noblechairs",
    "secretlab", "cougar", "gt racing"
  ],
  "エルゴノミクスチェア": [
    "aeron", "embody", "sayl", "cosm", "mirra", "contessa", "baron", "sylphy",
    "ergohuman", "エルゴヒューマン", "ハーマンミラー", "herman miller", "steelcase"
  ],
  "オフィスチェア": ["office chair", "オフィスチェア", "事務椅子", "オカムラ", "イトーキ"],
  "メッシュチェア": ["mesh chair", "メッシュチェア", "メッシュバック"],

  // マイク
  "コンデンサーマイク": [
    "condenser", "コンデンサー", "at2020", "at2035", "at4040", "blue yeti",
    "elgato wave", "rode nt1", "rode nt-usb", "audio-technica at"
  ],
  "ダイナミックマイク": [
    "dynamic mic", "ダイナミック", "sm7b", "sm58", "podmic", "mv7", "pma-1",
    "broadcaster"
  ],
  "USBマイク": [
    "usb mic", "usbマイク", "yeti", "snowball", "elgato wave", "at2020usb",
    "rode nt-usb", "quadcast", "seiren"
  ],
  "XLRマイク": ["xlr", "xlrマイク", "ファンタム電源"],

  // 照明
  "デスクライト": [
    "desk lamp", "デスクライト", "z-light", "benq screenbar", "スクリーンバー",
    "モニターライト", "led desk"
  ],
  "間接照明": ["間接照明", "ambient light", "hue", "nanoleaf", "ルームライト"],
  "リングライト": ["ring light", "リングライト", "撮影用ライト", "elgato key light"],

  // その他
  "ドッキングステーション": [
    "docking station", "ドッキングステーション", "thunderbolt dock", "usb-c dock",
    "caldigit", "anker dock"
  ],

  // HDD/SSD
  "外付けSSD": [
    "外付けssd", "ポータブルssd", "portable ssd", "external ssd", "sandisk extreme",
    "samsung t7", "samsung t5", "crucial x8", "wd black p50"
  ],
  "外付けHDD": [
    "外付けhdd", "ポータブルhdd", "portable hdd", "external hdd", "ポータブルハードディスク"
  ],
  "HDDケース": [
    "hddケース", "ssdケース", "hdd/ssdケース", "ドライブケース", "2bay", "4bay",
    "hddスタンド", "クレードル", "裸族", "ロジテック"
  ],
  "NAS": [
    "nas", "ネットワークストレージ", "synology", "qnap", "network attached storage"
  ],
  "内蔵SSD": [
    "内蔵ssd", "m.2 ssd", "nvme ssd", "sata ssd", "pcie ssd"
  ],
  "内蔵HDD": [
    "内蔵hdd", "3.5インチhdd", "2.5インチhdd"
  ],
};

/**
 * Amazon商品情報からサブカテゴリを推測する
 * @param category - 商品のメインカテゴリ
 * @param productTitle - Amazon商品タイトル
 * @param brand - ブランド名（オプション）
 * @param features - 商品特徴リスト（オプション）
 * @returns 推測されたサブカテゴリ、または null
 */
export function detectSubcategory(
  category: string,
  productTitle: string,
  brand?: string,
  features?: string[]
): string | null {
  // 該当カテゴリのサブカテゴリリストを取得
  const validSubcategories = SUBCATEGORIES[category];
  if (!validSubcategories || validSubcategories.length === 0) {
    return null;
  }

  // 検索対象テキストを構築（小文字に変換）
  const searchText = [
    productTitle,
    brand,
    ...(features || [])
  ].filter(Boolean).join(" ").toLowerCase();

  // 各サブカテゴリのキーワードをチェック
  for (const subcategory of validSubcategories) {
    const keywords = SUBCATEGORY_KEYWORDS[subcategory];
    if (!keywords) continue;

    const matched = keywords.some(kw => searchText.includes(kw.toLowerCase()));
    if (matched) {
      console.log(`[SubcategoryDetector] Detected: "${subcategory}" from "${productTitle.slice(0, 50)}..."`);
      return subcategory;
    }
  }

  return null;
}
