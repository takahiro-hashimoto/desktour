// 後方互換: mutations-unified.ts に委譲するthin wrapper
import * as unified from "./mutations-unified";
import type { CameraVideo, CameraArticle, CameraProduct, CameraProductMention, CameraInfluencer } from "./types-camera";

export type { SaveProductResult } from "./mutations-unified";
export type CameraFuzzyCategoryCache = unified.FuzzyCategoryCache;

export async function isCameraVideoAnalyzed(videoId: string): Promise<boolean> {
  return unified.isVideoAnalyzed("camera", videoId);
}

export async function isCameraArticleAnalyzed(url: string): Promise<boolean> {
  return unified.isArticleAnalyzed("camera", url);
}

export async function saveCameraArticle(article: CameraArticle) {
  return unified.saveArticle("camera", article);
}

export async function saveCameraVideo(video: CameraVideo) {
  return unified.saveVideo("camera", video);
}

export async function saveCameraProduct(
  product: Omit<CameraProduct, "id">,
  fuzzyCategoryCache?: CameraFuzzyCategoryCache
) {
  return unified.saveProduct("camera", product, fuzzyCategoryCache);
}

export async function saveCameraMention(mention: Omit<CameraProductMention, "id">) {
  return unified.saveMention("camera", mention);
}

export async function updateCameraProductWithAmazon(
  productId: string,
  productInfo: Parameters<typeof unified.updateProductWithAmazon>[2],
  priceRange?: string,
  skipIfHasAsin: boolean = false
): Promise<boolean> {
  return unified.updateProductWithAmazon("camera", productId, productInfo, priceRange, skipIfHasAsin);
}

export async function updateCameraProductEnrichedTags(
  productId: string,
  updates: Record<string, unknown>
): Promise<boolean> {
  return unified.updateProductEnrichedTags("camera", productId, updates);
}

export async function saveCameraInfluencer(influencer: Omit<CameraInfluencer, "id" | "created_at" | "updated_at">) {
  return unified.saveInfluencer("camera", influencer);
}

export async function updateCameraSourceMetadata(
  sourceType: "video" | "article",
  sourceId: string,
  data: { summary: string; tags: string[] }
): Promise<boolean> {
  return unified.updateSourceMetadata("camera", sourceType, sourceId, data);
}

export async function updateCameraInfluencerOccupationTags(
  sourceType: "video" | "article",
  sourceId: string,
  occupationTags: string[]
): Promise<boolean> {
  return unified.updateInfluencerOccupationTags("camera", sourceType, sourceId, occupationTags);
}

export async function updateCameraMentionReason(
  productId: string,
  sourceType: "video" | "article",
  sourceId: string,
  reason: string
): Promise<boolean> {
  return unified.updateMentionReason("camera", productId, sourceType, sourceId, reason);
}

export async function deleteCameraSource(
  sourceType: "video" | "article",
  sourceId: string
) {
  return unified.deleteSource("camera", sourceType, sourceId);
}

export async function updateCameraProductMetadata(
  productId: string,
  data: Parameters<typeof unified.updateProductMetadata>[2]
): Promise<boolean> {
  return unified.updateProductMetadata("camera", productId, data);
}
