/**
 * 商品名を正規化して、色違い・サイズ違いを統合するためのユーティリティ
 */

// 除去する色表記（日本語・英語）
const COLOR_PATTERNS = [
  // 日本語
  "ブラック",
  "ホワイト",
  "グレー",
  "グレイ",
  "シルバー",
  "ゴールド",
  "レッド",
  "ブルー",
  "グリーン",
  "イエロー",
  "オレンジ",
  "ピンク",
  "パープル",
  "ネイビー",
  "ベージュ",
  "ブラウン",
  "黒",
  "白",
  "灰",
  "銀",
  "金",
  "赤",
  "青",
  "緑",
  "黄",
  "墨",
  "スノー",
  "ミッドナイト",
  "チャコール",
  "アイボリー",
  "クリア",
  "透明",
  // 英語
  "Black",
  "White",
  "Gray",
  "Grey",
  "Silver",
  "Gold",
  "Red",
  "Blue",
  "Green",
  "Yellow",
  "Orange",
  "Pink",
  "Purple",
  "Navy",
  "Beige",
  "Brown",
  "Midnight",
  "Snow",
  "Space Gray",
  "Space Grey",
  "Graphite",
  "Charcoal",
  "Ivory",
  "Clear",
  "Rose Gold",
  "Starlight",
];

// 除去するサイズ表記
const SIZE_PATTERNS = [
  // 英語
  "XXS",
  "XS",
  "XXL",
  "XL",
  "Small",
  "Medium",
  "Large",
  // 日本語
  "ミニ",
  "レギュラー",
  "コンパクト",
  "ラージ",
  "スモール",
];

// 単独のS/M/Lは誤検出が多いので、パターンマッチで対応
const SIZE_SUFFIX_PATTERN = /[\s\-\/]([SML])(?:\s|$|[\)\]】」])/gi;

/**
 * 商品名を正規化
 * - 色・サイズ表記を除去
 * - 括弧内の色・サイズ情報を除去
 * - 余分な空白を正規化
 */
export function normalizeProductName(name: string): string {
  let normalized = name;

  // 1. 全角スペース→半角スペース
  normalized = normalized.replace(/　/g, " ");

  // 2. 括弧内の色・サイズ情報を除去
  // (ブラック), [ホワイト], 【グレー】, 「シルバー」 などを除去
  const bracketPatterns = [
    /\(([^)]*)\)/g, // ()
    /\[([^\]]*)\]/g, // []
    /【([^】]*)】/g, // 【】
    /「([^」]*)」/g, // 「」
    /（([^）]*)）/g, // （）
  ];

  for (const pattern of bracketPatterns) {
    normalized = normalized.replace(pattern, (match, inner) => {
      // 括弧内が色・サイズ表記のみなら除去
      const innerTrimmed = inner.trim();
      const isColorOrSize =
        COLOR_PATTERNS.some(
          (c) => c.toLowerCase() === innerTrimmed.toLowerCase()
        ) ||
        SIZE_PATTERNS.some(
          (s) => s.toLowerCase() === innerTrimmed.toLowerCase()
        ) ||
        /^[SML]$/i.test(innerTrimmed);

      return isColorOrSize ? "" : match;
    });
  }

  // 3. 「カラー:ブラック」「Color: White」形式を除去
  normalized = normalized.replace(
    /[カラーColor]+[\s]*[:：][\s]*\S+/gi,
    ""
  );

  // 4. 色表記を除去（単語境界を考慮）
  for (const color of COLOR_PATTERNS) {
    // 色名の前後に区切り文字がある場合のみ除去（誤検出防止）
    const escapedColor = color.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const colorRegex = new RegExp(
      `[\\s\\-\\/]${escapedColor}(?=[\\s\\-\\/]|$)|^${escapedColor}[\\s\\-\\/]`,
      "gi"
    );
    normalized = normalized.replace(colorRegex, " ");
  }

  // 5. サイズ表記を除去
  for (const size of SIZE_PATTERNS) {
    const escapedSize = size.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const sizeRegex = new RegExp(
      `[\\s\\-\\/]${escapedSize}(?=[\\s\\-\\/]|$)|^${escapedSize}[\\s\\-\\/]`,
      "gi"
    );
    normalized = normalized.replace(sizeRegex, " ");
  }

  // 6. 単独の S/M/L サフィックスを除去
  normalized = normalized.replace(SIZE_SUFFIX_PATTERN, " ");

  // 7. 連続するスペース・ハイフン・スラッシュを正規化
  normalized = normalized.replace(/[\s\-\/]+/g, " ");

  // 8. 前後の空白を除去
  normalized = normalized.trim();

  // 9. 末尾の区切り文字を除去
  normalized = normalized.replace(/[\s\-\/]+$/, "");

  return normalized;
}

/**
 * 型番を抽出
 * Amazon APIから取得した型番があれば優先、なければ商品名から抽出
 */
export function extractModelNumber(
  name: string,
  amazonModelNumber?: string
): string | null {
  // Amazon APIの型番があればそれを使用
  if (amazonModelNumber) {
    return amazonModelNumber;
  }

  // 商品名から型番パターンを抽出
  // 例: MX Master 3S → MX Master 3S
  //     HHKB Professional HYBRID Type-S → HHKB Professional HYBRID Type-S
  //     910-006567 → 910-006567

  // 型番パターン: 英数字とハイフンの組み合わせ（3文字以上）
  const modelPatterns = [
    /[A-Z]{2,}[-]?\d+[A-Z0-9\-]*/gi, // MX123, MX-123A
    /\d+[-][A-Z0-9\-]+/gi, // 910-006567
    /[A-Z]+\d+[A-Z]*/gi, // MX3S
  ];

  for (const pattern of modelPatterns) {
    const matches = name.match(pattern);
    if (matches && matches.length > 0) {
      // 最も長いマッチを返す
      return matches.reduce((a, b) => (a.length >= b.length ? a : b));
    }
  }

  return null;
}

/**
 * 2つの商品名が同一商品かどうかを判定
 */
export function isSameProduct(name1: string, name2: string): boolean {
  const normalized1 = normalizeProductName(name1);
  const normalized2 = normalizeProductName(name2);
  return normalized1.toLowerCase() === normalized2.toLowerCase();
}
