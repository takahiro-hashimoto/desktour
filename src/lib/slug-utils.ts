/**
 * スラッグ変換ユーティリティ
 *
 * desktour / camera 両ドメインで同一パターンの slug ↔ 表示名変換を
 * 共通化するファクトリ関数を提供する。
 */

/** slug ↔ 表示名の双方向コンバーター */
export interface SlugConverter {
  toSlug: (value: string) => string;
  fromSlug: (slug: string) => string | undefined;
}

/**
 * マッピングオブジェクトとフォールバック変換関数から SlugConverter を生成する。
 *
 * @param map  表示名 → slug のマッピング
 * @param fallback  マップに未登録の場合のフォールバック変換
 */
export function createSlugConverter(
  map: Record<string, string>,
  fallback: (value: string) => string = defaultFallback,
): SlugConverter {
  // fromSlug 用に逆引きマップを事前構築
  const reverseMap = new Map<string, string>();
  for (const [key, slug] of Object.entries(map)) {
    reverseMap.set(slug, key);
  }

  return {
    toSlug(value: string): string {
      return map[value] || fallback(value);
    },
    fromSlug(slug: string): string | undefined {
      return reverseMap.get(slug);
    },
  };
}

/** デフォルトのフォールバック: 全角記号・スペースをハイフンに変換し小文字化 */
function defaultFallback(value: string): string {
  return value.replace(/[/・]/g, "-").replace(/\s+/g, "-").toLowerCase();
}

/** ブランド用フォールバック: スペースのみハイフン化 */
export function brandFallback(value: string): string {
  return value.toLowerCase().replace(/\s+/g, "-");
}

/**
 * スラッグからブランド名を推測する（登録外ブランドにも対応）。
 * まずマップで完全一致を試み、なければハイフンを復元して先頭大文字化する。
 */
export function inferBrandFromSlug(
  converter: SlugConverter,
  slug: string,
): string {
  const exact = converter.fromSlug(slug);
  if (exact) return exact;

  return slug
    .split("-")
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/**
 * 優先度付きタグの選択ユーティリティ。
 * タグ配列とその優先度リストから、最も優先度の高い1つを返す。
 */
export function selectPrimaryTag(
  tags: string[],
  priorityList: readonly string[],
): string | null {
  if (!tags || tags.length === 0) return null;
  const valid = tags.filter(t => (priorityList as readonly string[]).includes(t));
  if (valid.length === 0) return null;
  valid.sort((a, b) => {
    const ai = priorityList.indexOf(a);
    const bi = priorityList.indexOf(b);
    return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
  });
  return valid[0];
}

/**
 * タグの優先度インデックスを返す（小さいほど高優先度）。
 * 未登録タグは 999 を返す。
 */
export function getTagPriority(
  tag: string,
  priorityList: readonly string[],
): number {
  const index = priorityList.indexOf(tag);
  return index === -1 ? 999 : index;
}
