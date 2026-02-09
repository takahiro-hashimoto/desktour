/**
 * 価格・日付フォーマット共通ユーティリティ
 */

/** 価格をカンマ区切りでフォーマット（¥プレフィックスなし） */
export function formatPrice(price?: number): string | null {
  if (!price) return null;
  return price.toLocaleString("ja-JP");
}

/** 価格を¥付きでフォーマット（価格なしの場合はフォールバックテキスト） */
export function formatPriceWithSymbol(price?: number, fallback = "価格情報なし"): string {
  if (!price) return fallback;
  return `¥${price.toLocaleString("ja-JP")}`;
}

/** 日付を「YYYY/MM/DD時点」形式にフォーマット */
export function formatPriceDate(dateString?: string): string | null {
  if (!dateString) return null;
  const date = new Date(dateString);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}/${month}/${day}時点`;
}
