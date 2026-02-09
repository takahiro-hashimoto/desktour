// ========================================
// ブランドエイリアス・カテゴリ共通モジュール
// description-links.ts と product-search.ts で共有
// ========================================

// ========================================
// ブランドエイリアス（日英対応）
// ========================================
export const BRAND_ALIASES: Record<string, string[]> = {
  "ハーマンミラー": ["herman miller", "hermanmiller"],
  "herman miller": ["ハーマンミラー"],
  "ロジクール": ["logitech", "logicool"],
  "logitech": ["ロジクール", "logicool"],
  "logicool": ["ロジクール", "logitech"],
  "アップル": ["apple"],
  "apple": ["アップル"],
  "ソニー": ["sony"],
  "sony": ["ソニー"],
  "パナソニック": ["panasonic"],
  "panasonic": ["パナソニック"],
  "エレコム": ["elecom"],
  "elecom": ["エレコム"],
  "サンワサプライ": ["sanwa supply", "sanwa"],
  "sanwa supply": ["サンワサプライ", "sanwa"],
  "sanwa": ["サンワサプライ", "sanwa supply"],
  "バッファロー": ["buffalo"],
  "buffalo": ["バッファロー"],
  "アンカー": ["anker"],
  "anker": ["アンカー"],
  "ベルキン": ["belkin"],
  "belkin": ["ベルキン"],
  "doio": ["doio"],
  "サテチ": ["satechi"],
  "satechi": ["サテチ"],
  "デル": ["dell"],
  "dell": ["デル"],
  "エイスース": ["asus"],
  "asus": ["エイスース"],
  "レノボ": ["lenovo"],
  "lenovo": ["レノボ"],
  "ベンキュー": ["benq"],
  "benq": ["ベンキュー"],
  "オウルテック": ["owltech"],
  "owltech": ["オウルテック"],
  "コクヨ": ["kokuyo"],
  "kokuyo": ["コクヨ"],
  "caldigit": ["カルデジット"],
  "カルデジット": ["caldigit"],
  "master & dynamic": ["master and dynamic", "master&dynamic"],
  "ugreen": ["ユーグリーン"],
  "ユーグリーン": ["ugreen"],
  "mcdodo": ["マクドド"],
  "マクドド": ["mcdodo"],
  "earthworks": ["アースワークス"],
  "アースワークス": ["earthworks"],
  "cio": ["シーアイオー"],
  "keychron": ["キークロン"],
  "キークロン": ["keychron"],
  "hhkb": ["happy hacking keyboard"],
  "pfu": ["hhkb"],
  "flexispot": ["フレキシスポット"],
  "フレキシスポット": ["flexispot"],
  "razer": ["レイザー"],
  "レイザー": ["razer"],
  "steelseries": ["スティールシリーズ"],
  "スティールシリーズ": ["steelseries"],
  "realforce": ["リアルフォース", "topre"],
  "リアルフォース": ["realforce", "topre"],
  "topre": ["リアルフォース", "realforce"],
  "filco": ["フィルコ"],
  "フィルコ": ["filco"],
  "ducky": ["ダッキー"],
  "ダッキー": ["ducky"],
  "zowie": ["ゾーウィー"],
  "ゾーウィー": ["zowie"],
  "nzxt": ["エヌゼットエックスティー"],
  "corsair": ["コルセア"],
  "コルセア": ["corsair"],
};

// ブランド名のエイリアスを取得（すべて小文字で返す）
export function getBrandAliases(brand: string): string[] {
  const lowerBrand = brand.toLowerCase();
  const aliases = BRAND_ALIASES[lowerBrand] || [];
  return [lowerBrand, ...aliases.map(a => a.toLowerCase())];
}

// ========================================
// カテゴリキーワード（致命的な誤マッチを防止）
// ========================================
export const CATEGORY_KEYWORDS: Record<string, string[]> = {
  desk: ["デスク", "desk", "テーブル", "table", "机", "天板"],
  chair: ["チェア", "chair", "椅子", "イス", "オフィスチェア", "ゲーミングチェア"],
  bed: ["ベッド", "bed", "マットレス", "mattress", "寝具", "布団"],
  keyboard: ["キーボード", "keyboard", "keypad", "テンキー"],
  mouse: ["マウス", "mouse", "トラックボール", "trackball", "トラックパッド"],
  monitor: ["モニター", "monitor", "ディスプレイ", "display", "液晶"],
  headphone: ["ヘッドホン", "headphone", "ヘッドフォン", "イヤホン", "earphone", "イヤフォン"],
  speaker: ["スピーカー", "speaker"],
  light: ["ライト", "light", "照明", "ランプ", "lamp", "デスクライト", "モニターライト"],
  camera: ["カメラ", "camera", "ウェブカメラ", "webcam"],
  microphone: ["マイク", "microphone", "mic", "コンデンサーマイク"],
  cable: ["ケーブル", "cable", "コード", "cord"],
  adapter: ["アダプタ", "adapter", "変換", "コネクタ", "connector"],
  dock: ["ドック", "dock", "ハブ", "hub", "ドッキングステーション"],
  stand: ["スタンド", "stand", "アーム", "arm", "マウント", "mount"],
};

// テキストからカテゴリを検出
export function detectCategory(text: string): string | null {
  const lowerText = text.toLowerCase();
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some(kw => lowerText.includes(kw.toLowerCase()))) {
      return category;
    }
  }
  return null;
}

// カテゴリの互換性チェック（致命的ミスマッチを検出）
export function isCategoryMismatch(productCategory: string | null, candidateCategory: string | null): boolean {
  if (!productCategory || !candidateCategory) return false;

  // 致命的なミスマッチの組み合わせ
  const fatalMismatches: [string, string][] = [
    ["desk", "bed"],
    ["desk", "chair"],
    ["keyboard", "mouse"],
    ["monitor", "headphone"],
    ["monitor", "speaker"],
    ["camera", "microphone"],
  ];

  for (const [cat1, cat2] of fatalMismatches) {
    if ((productCategory === cat1 && candidateCategory === cat2) ||
        (productCategory === cat2 && candidateCategory === cat1)) {
      return true;
    }
  }
  return false;
}
