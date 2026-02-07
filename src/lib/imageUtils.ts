/**
 * 画像URLを解決するユーティリティ
 * ファイル名のみの場合は /images/products/ パスに変換
 */
export function resolveImageUrl(input: string | undefined | null): string | null {
  if (!input) return null;

  // 既にURL形式またはパス形式ならそのまま返す
  if (
    input.startsWith("http://") ||
    input.startsWith("https://") ||
    input.startsWith("/")
  ) {
    return input;
  }

  // ファイル名のみの場合、ローカルパスに変換
  return `/images/products/${input}`;
}
