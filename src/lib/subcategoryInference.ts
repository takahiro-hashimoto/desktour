/**
 * Amazon商品情報からサブカテゴリーを自動推論する
 */

import { SUBCATEGORIES } from "./constants";

interface ProductInfo {
  category: string;
  title?: string;
  features?: string[];
  technicalInfo?: Record<string, string>;
  currentSubcategory?: string | null;
}

/**
 * 商品情報からサブカテゴリーを推論
 */
export function inferSubcategory(data: ProductInfo): string | null {
  const { category, title = "", features = [], technicalInfo = {}, currentSubcategory } = data;

  // 既にサブカテゴリーがあればそれを優先
  if (currentSubcategory) return currentSubcategory;

  const titleLower = title.toLowerCase();
  const featuresText = features.join(" ").toLowerCase();
  const allText = (titleLower + " " + featuresText).toLowerCase();

  // カテゴリー別の推論ロジック
  if (category === "キーボード") {
    return inferKeyboardSubcategory(allText, technicalInfo);
  }

  if (category === "マウス") {
    return inferMouseSubcategory(allText, technicalInfo);
  }

  if (category === "ディスプレイ・モニター" || category === "ディスプレイ/モニター") {
    return inferMonitorSubcategory(allText, technicalInfo);
  }

  if (category === "ヘッドホン・イヤホン" || category === "ヘッドホン/イヤホン") {
    return inferHeadphoneSubcategory(allText, technicalInfo);
  }

  if (category === "チェア") {
    return inferChairSubcategory(allText, technicalInfo);
  }

  if (category === "デスク") {
    return inferDeskSubcategory(allText, technicalInfo);
  }

  if (category === "マイク") {
    return inferMicSubcategory(allText, technicalInfo);
  }

  if (category === "スピーカー") {
    return inferSpeakerSubcategory(allText, technicalInfo);
  }

  if (category === "照明・ライト") {
    return inferLightSubcategory(allText, technicalInfo);
  }

  if (category === "ウェブカメラ") {
    return inferWebcamSubcategory(allText, technicalInfo);
  }

  if (category === "PC本体") {
    return inferPCSubcategory(allText, technicalInfo);
  }

  if (category === "HDD・SSD" || category === "HDD/SSD") {
    return inferStorageSubcategory(allText, technicalInfo);
  }

  if (category === "コントローラー") {
    return inferControllerSubcategory(allText, technicalInfo);
  }

  if (category === "ストリームデッキ") {
    return inferStreamDeckSubcategory(allText, technicalInfo);
  }

  if (category === "キャプチャーボード") {
    return inferCaptureCardSubcategory(allText, technicalInfo);
  }

  if (category === "NAS") {
    return inferNASSubcategory(allText, technicalInfo);
  }

  return null;
}

// キーボードのサブカテゴリー推論
function inferKeyboardSubcategory(text: string, specs: Record<string, string>): string | null {
  if (
    text.includes("mechanical") ||
    text.includes("メカニカル") ||
    text.includes("cherry mx") ||
    text.includes("gateron") ||
    text.includes("kailh") ||
    text.includes("赤軸") ||
    text.includes("青軸") ||
    text.includes("茶軸")
  ) {
    return "メカニカルキーボード";
  }

  if (
    text.includes("hhkb") ||
    text.includes("realforce") ||
    text.includes("静電容量") ||
    text.includes("無接点") ||
    text.includes("capacitive")
  ) {
    return "静電容量無接点";
  }

  if (
    text.includes("パンタグラフ") ||
    text.includes("pantograph") ||
    text.includes("シザー") ||
    text.includes("scissor") ||
    (text.includes("薄型") && text.includes("キーボード")) ||
    text.includes("magic keyboard") ||
    text.includes("apple keyboard")
  ) {
    return "パンタグラフ";
  }

  if (
    text.includes("split") ||
    text.includes("分割") ||
    text.includes("ergodox") ||
    text.includes("kinesis")
  ) {
    return "分割キーボード";
  }

  if (
    text.includes("tkl") ||
    text.includes("tenkeyless") ||
    text.includes("テンキーレス") ||
    text.includes("87キー") ||
    text.includes("87key")
  ) {
    return "テンキーレス";
  }

  if (
    text.includes("60%") ||
    text.includes("65%") ||
    text.includes("66キー") ||
    text.includes("68キー") ||
    text.includes("60 percent") ||
    text.includes("65 percent")
  ) {
    return "60%・65%キーボード";
  }

  if (
    text.includes("フルサイズ") ||
    text.includes("full size") ||
    text.includes("108キー") ||
    text.includes("テンキー付き")
  ) {
    return "フルサイズキーボード";
  }

  if (
    text.includes("ロープロファイル") ||
    text.includes("low profile") ||
    text.includes("薄型") ||
    text.includes("ultra slim")
  ) {
    return "ロープロファイル";
  }

  return null;
}

// マウスのサブカテゴリー推論
function inferMouseSubcategory(text: string, specs: Record<string, string>): string | null {
  if (
    text.includes("trackball") ||
    text.includes("トラックボール") ||
    text.includes("mx ergo") ||
    text.includes("m575") ||
    text.includes("sw-m570")
  ) {
    return "トラックボール";
  }

  if (
    text.includes("vertical") ||
    text.includes("縦型") ||
    text.includes("mx vertical")
  ) {
    return "縦型マウス";
  }

  if (
    text.includes("gaming") ||
    text.includes("ゲーミング") ||
    text.includes("g pro") ||
    text.includes("deathadder") ||
    text.includes("viper") ||
    text.includes("rival") ||
    text.includes("dpi") && text.includes("16000")
  ) {
    return "ゲーミングマウス";
  }

  if (
    text.includes("ergonomic") ||
    text.includes("エルゴノミクス") ||
    text.includes("mx master") ||
    text.includes("mx anywhere")
  ) {
    return "エルゴノミクスマウス";
  }

  if (
    text.includes("wireless") ||
    text.includes("ワイヤレス") ||
    text.includes("bluetooth")
  ) {
    return "ワイヤレスマウス";
  }

  return null;
}

// モニターのサブカテゴリー推論
function inferMonitorSubcategory(text: string, specs: Record<string, string>): string | null {
  if (
    text.includes("4k") ||
    text.includes("3840") ||
    text.includes("2160") ||
    text.includes("uhd")
  ) {
    return "4Kモニター";
  }

  if (
    text.includes("ultrawide") ||
    text.includes("ウルトラワイド") ||
    text.includes("21:9") ||
    text.includes("34インチ") && text.includes("曲面")
  ) {
    return "ウルトラワイドモニター";
  }

  if (
    text.includes("144hz") ||
    text.includes("165hz") ||
    text.includes("240hz") ||
    text.includes("g-sync") ||
    text.includes("freesync") ||
    text.includes("gaming") && text.includes("hz")
  ) {
    return "ゲーミングモニター";
  }

  if (
    text.includes("mobile") ||
    text.includes("モバイル") ||
    text.includes("portable") ||
    text.includes("ポータブル") ||
    text.includes("13.3") ||
    text.includes("15.6")
  ) {
    return "モバイルモニター";
  }

  if (
    text.includes("5k") ||
    text.includes("6k") ||
    text.includes("5120")
  ) {
    return "5K・6Kモニター";
  }

  return null;
}

// ヘッドホン・イヤホンのサブカテゴリー推論
function inferHeadphoneSubcategory(text: string, specs: Record<string, string>): string | null {
  if (
    text.includes("open") && text.includes("back") ||
    text.includes("開放型") ||
    text.includes("音漏れ")
  ) {
    return "開放型ヘッドホン";
  }

  if (
    text.includes("closed") && text.includes("back") ||
    text.includes("密閉型") ||
    text.includes("遮音")
  ) {
    return "密閉型ヘッドホン";
  }

  if (
    text.includes("airpods") ||
    text.includes("完全ワイヤレス") ||
    text.includes("true wireless") ||
    text.includes("tws") ||
    text.includes("bluetooth") && text.includes("イヤホン")
  ) {
    return "ワイヤレスイヤホン";
  }

  if (
    text.includes("有線イヤホン") ||
    text.includes("3.5mm") && text.includes("イヤホン")
  ) {
    return "有線イヤホン";
  }

  if (
    text.includes("モニターヘッドホン") ||
    text.includes("dtm") ||
    text.includes("音楽制作") ||
    text.includes("studio monitor") ||
    text.includes("スタジオ")
  ) {
    return "モニターヘッドホン";
  }

  if (
    text.includes("gaming headset") ||
    text.includes("ゲーミングヘッドセット") ||
    text.includes("7.1ch") ||
    text.includes("マイク付き") && text.includes("gaming")
  ) {
    return "ゲーミングヘッドセット";
  }

  return null;
}

// チェアのサブカテゴリー推論
function inferChairSubcategory(text: string, specs: Record<string, string>): string | null {
  if (
    text.includes("gaming chair") ||
    text.includes("ゲーミングチェア") ||
    text.includes("dxracer") ||
    text.includes("akracing") ||
    text.includes("バケットシート")
  ) {
    return "ゲーミングチェア";
  }

  if (
    text.includes("herman miller") ||
    text.includes("steelcase") ||
    text.includes("ergonomic") ||
    text.includes("エルゴノミクス") ||
    text.includes("腰痛対策") ||
    text.includes("ランバーサポート")
  ) {
    return "エルゴノミクスチェア";
  }

  if (
    text.includes("mesh") ||
    text.includes("メッシュ") ||
    text.includes("通気性")
  ) {
    return "メッシュチェア";
  }

  if (
    text.includes("office chair") ||
    text.includes("オフィスチェア") ||
    text.includes("事務椅子")
  ) {
    return "オフィスチェア";
  }

  if (
    text.includes("balance") ||
    text.includes("バランスチェア") ||
    text.includes("姿勢")
  ) {
    return "バランスチェア";
  }

  return null;
}

// デスクのサブカテゴリー推論
function inferDeskSubcategory(text: string, specs: Record<string, string>): string | null {
  if (
    text.includes("昇降") ||
    text.includes("standing") ||
    text.includes("電動") ||
    text.includes("height adjustable") ||
    text.includes("スタンディング")
  ) {
    return "昇降デスク";
  }

  if (
    text.includes("l字") ||
    text.includes("l型") ||
    text.includes("l-shaped") ||
    text.includes("コーナー")
  ) {
    return "L字デスク";
  }

  if (
    text.includes("diy") ||
    text.includes("自作") ||
    text.includes("天板のみ") ||
    text.includes("カスタム")
  ) {
    return "DIYデスク";
  }

  if (
    text.includes("gaming desk") ||
    text.includes("ゲーミングデスク")
  ) {
    return "ゲーミングデスク";
  }

  if (
    text.includes("pcデスク") ||
    text.includes("パソコンデスク") ||
    text.includes("computer desk")
  ) {
    return "PCデスク";
  }

  return null;
}

// マイクのサブカテゴリー推論
function inferMicSubcategory(text: string, specs: Record<string, string>): string | null {
  if (
    text.includes("condenser") ||
    text.includes("コンデンサー") ||
    text.includes("配信") ||
    text.includes("streaming")
  ) {
    return "コンデンサーマイク";
  }

  if (
    text.includes("dynamic") ||
    text.includes("ダイナミック") ||
    text.includes("sm7b") ||
    text.includes("re20")
  ) {
    return "ダイナミックマイク";
  }

  if (
    text.includes("usb mic") ||
    text.includes("usbマイク") ||
    text.includes("blue yeti") ||
    text.includes("fifine")
  ) {
    return "USBマイク";
  }

  if (
    text.includes("xlr") ||
    text.includes("ファンタム電源") ||
    text.includes("phantom power")
  ) {
    return "XLRマイク";
  }

  if (
    text.includes("lavalier") ||
    text.includes("ピンマイク") ||
    text.includes("ラベリア") ||
    text.includes("襟元")
  ) {
    return "ピンマイク";
  }

  return null;
}

// スピーカーのサブカテゴリー推論
function inferSpeakerSubcategory(text: string, specs: Record<string, string>): string | null {
  if (
    text.includes("monitor speaker") ||
    text.includes("モニタースピーカー") ||
    text.includes("dtm") ||
    text.includes("studio") ||
    text.includes("音楽制作")
  ) {
    return "モニタースピーカー";
  }

  if (
    text.includes("soundbar") ||
    text.includes("サウンドバー") ||
    text.includes("モニター下")
  ) {
    return "サウンドバー";
  }

  if (
    text.includes("bluetooth speaker") ||
    text.includes("bluetoothスピーカー") ||
    text.includes("ワイヤレススピーカー")
  ) {
    return "Bluetoothスピーカー";
  }

  if (
    text.includes("pcスピーカー") ||
    text.includes("pc speaker") ||
    text.includes("デスクトップスピーカー")
  ) {
    return "PCスピーカー";
  }

  return null;
}

// 照明のサブカテゴリー推論
function inferLightSubcategory(text: string, specs: Record<string, string>): string | null {
  if (
    text.includes("screenbar") ||
    text.includes("モニターライト") ||
    text.includes("monitor light")
  ) {
    return "モニターライト";
  }

  if (
    text.includes("ring light") ||
    text.includes("リングライト") ||
    text.includes("撮影用")
  ) {
    return "リングライト";
  }

  if (
    text.includes("led strip") ||
    text.includes("ledテープ") ||
    text.includes("led tape") ||
    text.includes("テープライト")
  ) {
    return "LEDテープ";
  }

  if (
    text.includes("間接照明") ||
    text.includes("indirect lighting")
  ) {
    return "間接照明";
  }

  if (
    text.includes("desk lamp") ||
    text.includes("デスクライト") ||
    text.includes("卓上ライト")
  ) {
    return "デスクライト";
  }

  return null;
}

// ウェブカメラのサブカテゴリー推論
function inferWebcamSubcategory(text: string, specs: Record<string, string>): string | null {
  if (text.includes("4k") || text.includes("3840")) {
    return "4Kウェブカメラ";
  }

  if (
    text.includes("1080p") ||
    text.includes("full hd") ||
    text.includes("フルhd")
  ) {
    return "フルHDウェブカメラ";
  }

  if (
    text.includes("wide angle") ||
    text.includes("広角") ||
    text.includes("ultra wide")
  ) {
    return "広角ウェブカメラ";
  }

  return null;
}

// PC本体のサブカテゴリー推論
function inferPCSubcategory(text: string, specs: Record<string, string>): string | null {
  if (
    text.includes("desktop") ||
    text.includes("デスクトップpc") ||
    text.includes("タワー型")
  ) {
    return "デスクトップPC";
  }

  if (
    text.includes("laptop") ||
    text.includes("notebook") ||
    text.includes("ノートpc") ||
    text.includes("ノートパソコン")
  ) {
    return "ノートPC";
  }

  if (
    text.includes("mini pc") ||
    text.includes("ミニpc") ||
    text.includes("nuc")
  ) {
    return "ミニPC";
  }

  if (
    text.includes("自作") ||
    text.includes("custom build") ||
    text.includes("btopパソコン")
  ) {
    return "自作PC";
  }

  if (
    text.includes("mac") ||
    text.includes("macbook") ||
    text.includes("imac")
  ) {
    return "Mac";
  }

  return null;
}

// ストレージのサブカテゴリー推論
function inferStorageSubcategory(text: string, specs: Record<string, string>): string | null {
  if (
    text.includes("外付けssd") ||
    text.includes("external ssd") ||
    text.includes("portable ssd")
  ) {
    return "外付けSSD";
  }

  if (
    text.includes("外付けhdd") ||
    text.includes("external hdd") ||
    text.includes("portable hdd")
  ) {
    return "外付けHDD";
  }

  if (
    text.includes("内蔵ssd") ||
    text.includes("internal ssd") ||
    text.includes("m.2") ||
    text.includes("nvme")
  ) {
    return "内蔵SSD";
  }

  if (
    text.includes("内蔵hdd") ||
    text.includes("internal hdd")
  ) {
    return "内蔵HDD";
  }

  if (
    text.includes("hddケース") ||
    text.includes("enclosure") ||
    text.includes("ケース")
  ) {
    return "HDDケース";
  }

  return null;
}

// コントローラーのサブカテゴリー推論
function inferControllerSubcategory(text: string, specs: Record<string, string>): string | null {
  if (
    text.includes("playstation") ||
    text.includes("ps4") ||
    text.includes("ps5") ||
    text.includes("dualsense") ||
    text.includes("dualshock")
  ) {
    return "PlayStation用コントローラー";
  }

  if (
    text.includes("xbox") ||
    text.includes("elite")
  ) {
    return "Xbox用コントローラー";
  }

  if (
    text.includes("switch") ||
    text.includes("pro controller") ||
    text.includes("joy-con")
  ) {
    return "Switch用コントローラー";
  }

  if (
    text.includes("racing wheel") ||
    text.includes("レーシングホイール") ||
    text.includes("ハンドル")
  ) {
    return "レーシングホイール";
  }

  if (
    text.includes("arcade stick") ||
    text.includes("アーケードスティック") ||
    text.includes("fight stick")
  ) {
    return "アーケードスティック";
  }

  if (
    text.includes("pc game") ||
    text.includes("pcゲーム")
  ) {
    return "PCゲーム用コントローラー";
  }

  return null;
}

// ストリームデッキのサブカテゴリー推論
function inferStreamDeckSubcategory(text: string, specs: Record<string, string>): string | null {
  if (
    text.includes("stream deck") ||
    text.includes("elgato")
  ) {
    return "Elgato Stream Deck";
  }

  if (
    text.includes("macro pad") ||
    text.includes("マクロパッド")
  ) {
    return "マクロパッド";
  }

  if (
    text.includes("カスタマイズ") ||
    text.includes("programmable")
  ) {
    return "カスタマイズ可能デバイス";
  }

  return null;
}

// キャプチャーボードのサブカテゴリー推論
function inferCaptureCardSubcategory(text: string, specs: Record<string, string>): string | null {
  if (
    text.includes("外付け") ||
    text.includes("external") ||
    text.includes("usb")
  ) {
    return "外付けキャプチャーボード";
  }

  if (
    text.includes("内蔵") ||
    text.includes("internal") ||
    text.includes("pcie")
  ) {
    return "内蔵キャプチャーボード";
  }

  if (
    text.includes("4k") ||
    text.includes("2160p")
  ) {
    return "4Kキャプチャーボード";
  }

  if (
    text.includes("hdmi")
  ) {
    return "HDMIキャプチャーボード";
  }

  return null;
}

// NASのサブカテゴリー推論
function inferNASSubcategory(text: string, specs: Record<string, string>): string | null {
  if (
    text.includes("2bay") ||
    text.includes("2ベイ") ||
    text.includes("2台")
  ) {
    return "2ベイNAS";
  }

  if (
    text.includes("4bay") ||
    text.includes("4ベイ") ||
    text.includes("4台")
  ) {
    return "4ベイNAS";
  }

  if (
    text.includes("rackmount") ||
    text.includes("ラックマウント")
  ) {
    return "ラックマウント型NAS";
  }

  if (
    text.includes("desktop") ||
    text.includes("デスクトップ")
  ) {
    return "デスクトップ型NAS";
  }

  return null;
}
