/**
 * カテゴリ別 Font Awesome アイコンマッピング
 */

const CATEGORY_ICON_MAP: Record<string, string> = {
  "キーボード": "fa-keyboard",
  "マウス": "fa-computer-mouse",
  "ディスプレイ・モニター": "fa-display",
  "モバイルモニター": "fa-mobile-screen",
  "デスク": "fa-table",
  "チェア": "fa-chair",
  "マイク": "fa-microphone",
  "ウェブカメラ": "fa-video",
  "ヘッドホン・イヤホン": "fa-headphones",
  "スピーカー": "fa-volume-high",
  "照明・ライト": "fa-lightbulb",
  "ノートPCスタンド": "fa-laptop",
  "モニターアーム": "fa-desktop",
  "マイクアーム": "fa-grip-lines-vertical",
  "USBハブ": "fa-usb",
  "デスクマット": "fa-rectangle-wide",
  "収納・整理": "fa-box",
  "PC本体": "fa-computer",
  "タブレット": "fa-tablet",
  "ペンタブ": "fa-pen-nib",
  "充電器・電源タップ": "fa-battery-full",
  "オーディオインターフェース": "fa-sliders",
  "ドッキングステーション": "fa-ethernet",
  "左手デバイス": "fa-gamepad",
  "HDD・SSD": "fa-hard-drive",
  "コントローラー": "fa-gamepad",
  "キャプチャーボード": "fa-video",
  "NAS": "fa-server",
  "デスクシェルフ・モニター台": "fa-layer-group",
  "ケーブル": "fa-link",
  "配線整理グッズ": "fa-grip-lines",
  "パームレスト": "fa-hand",
  "掃除グッズ": "fa-broom",
  "文房具": "fa-pen",
  "時計": "fa-clock",
  "その他デスクアクセサリー": "fa-puzzle-piece",
};

export function getCategoryIcon(category: string): string {
  return CATEGORY_ICON_MAP[category] || "fa-cube";
}
