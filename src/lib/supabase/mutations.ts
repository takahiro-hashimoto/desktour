// 後方互換: mutations-unified.ts に委譲するthin wrapper
import * as unified from "./mutations-unified";
import type { Video, Article, Product, ProductMention, Influencer } from "./types";

export type { SaveProductResult } from "./mutations-unified";
export type FuzzyCategoryCache = unified.FuzzyCategoryCache;

export async function isVideoAnalyzed(videoId: string): Promise<boolean> {
  return unified.isVideoAnalyzed("desktour", videoId);
}

export async function isArticleAnalyzed(url: string): Promise<boolean> {
  return unified.isArticleAnalyzed("desktour", url);
}

export async function saveArticle(article: Article) {
  return unified.saveArticle("desktour", article);
}

export async function saveVideo(video: Video) {
  return unified.saveVideo("desktour", video);
}

export async function saveProduct(
  product: Omit<Product, "id">,
  fuzzyCategoryCache?: FuzzyCategoryCache
) {
  return unified.saveProduct("desktour", product, fuzzyCategoryCache);
}

export async function saveMention(mention: Omit<ProductMention, "id">) {
  return unified.saveMention("desktour", mention);
}

export async function updateProductWithAmazon(
  productId: string,
  productInfo: Parameters<typeof unified.updateProductWithAmazon>[2],
  priceRange?: string,
  skipIfHasAsin: boolean = false
): Promise<boolean> {
  return unified.updateProductWithAmazon("desktour", productId, productInfo, priceRange, skipIfHasAsin);
}

export async function saveInfluencer(influencer: Omit<Influencer, "id" | "created_at" | "updated_at">) {
  return unified.saveInfluencer("desktour", influencer);
}

export async function updateSourceMetadata(
  sourceType: "video" | "article",
  sourceId: string,
  data: { summary: string; tags: string[] }
): Promise<boolean> {
  return unified.updateSourceMetadata("desktour", sourceType, sourceId, data);
}

export async function updateInfluencerOccupationTags(
  sourceType: "video" | "article",
  sourceId: string,
  occupationTags: string[]
): Promise<boolean> {
  return unified.updateInfluencerOccupationTags("desktour", sourceType, sourceId, occupationTags);
}

export async function updateMentionReason(
  productId: string,
  sourceType: "video" | "article",
  sourceId: string,
  reason: string
): Promise<boolean> {
  return unified.updateMentionReason("desktour", productId, sourceType, sourceId, reason);
}

export async function deleteSource(
  sourceType: "video" | "article",
  sourceId: string
) {
  return unified.deleteSource("desktour", sourceType, sourceId);
}

export async function updateProductMetadata(
  productId: string,
  data: Parameters<typeof unified.updateProductMetadata>[2]
): Promise<boolean> {
  return unified.updateProductMetadata("desktour", productId, data);
}
