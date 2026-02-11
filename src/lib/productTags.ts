/**
 * 商品タグ自動抽出（後方互換ラッパー）
 *
 * 実体は tag-inference.ts に統合済み。
 * 既存コードからの import を維持するための re-export。
 */
export { extractProductTags } from "./tag-inference";

export interface ProductTagsResult {
  tags: string[];
}
