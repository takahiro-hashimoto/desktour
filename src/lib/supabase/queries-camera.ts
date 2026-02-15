// 後方互換: queries-unified.ts に委譲するthin wrapper
import * as unified from "./queries-unified";
import type { SearchParams, ProductDetail, SiteStats, CoUsedProduct, SimilarProduct } from "@/types";
import type { CameraVideoWithProductCount, CameraArticleWithProductCount } from "./types-camera";

export async function getCameraProductRanking(limit = 20, category?: string) {
  return unified.getProductRanking("camera", limit, category);
}

export async function getCameraInfluencers(limit = 50) {
  return unified.getInfluencers("camera", limit);
}

export async function getCameraSubcategories(category: string): Promise<string[]> {
  return unified.getSubcategories("camera", category);
}

export async function searchCameraProducts(params: SearchParams) {
  return unified.searchProducts("camera", params);
}

export async function getCameraProductCountByCategory(): Promise<Record<string, number>> {
  return unified.getProductCountByCategory("camera");
}

export async function getCameraProductDetailByAsin(asin: string): Promise<ProductDetail | null> {
  return unified.getProductDetailByAsin("camera", asin);
}

export async function getCameraProductDetailBySlug(slug: string): Promise<ProductDetail | null> {
  return unified.getProductDetailBySlug("camera", slug);
}

export async function getCameraProductDetail(productId: string): Promise<ProductDetail | null> {
  return unified.getProductDetail("camera", productId);
}

export async function getCameraCoOccurrenceProducts(
  productId: string,
  limit = 10,
  currentProductCategory?: string
): Promise<CoUsedProduct[]> {
  return unified.getCoOccurrenceProducts("camera", productId, limit, currentProductCategory);
}

export async function getCameraSimilarProducts(
  product: {
    id: string;
    category: string;
    subcategory?: string;
    tags?: string[];
    lens_tags?: string[];
    body_tags?: string[];
    brand?: string;
    price_range?: string;
  },
  limit = 4,
): Promise<SimilarProduct[]> {
  return unified.getSimilarProducts("camera", product, limit);
}

export async function getCameraSiteStats(): Promise<SiteStats> {
  return unified.getSiteStats("camera");
}

export async function getCameraTopProductImages(limit = 24): Promise<string[]> {
  return unified.getTopProductImages("camera", limit);
}

export async function getCameraTopProductByCategory() {
  return unified.getTopProductByCategory("camera");
}

export async function getCameraOccupationTagCounts(): Promise<Record<string, number>> {
  return unified.getOccupationTagCounts("camera");
}

export async function getCameraSetupTagCounts(): Promise<Record<string, number>> {
  return unified.getSetupTagCounts("camera");
}

export async function getCameraSourceDetail(
  sourceType: "video" | "article",
  sourceId: string
) {
  return unified.getSourceDetail("camera", sourceType, sourceId);
}

export async function getCameraVideos(params: {
  tags?: string[];
  year?: number;
  sortBy?: "published_at" | "subscriber_count";
  page?: number;
  limit?: number;
}): Promise<{ videos: CameraVideoWithProductCount[]; total: number }> {
  return unified.getVideos("camera", params);
}

export async function getCameraArticles(params: {
  tags?: string[];
  year?: number;
  sourceType?: "note" | "blog" | "official" | "other";
  sortBy?: "published_at";
  page?: number;
  limit?: number;
}): Promise<{ articles: CameraArticleWithProductCount[]; total: number }> {
  return unified.getArticles("camera", params);
}

export async function getCameraSourceTagCounts(): Promise<Record<string, number>> {
  return unified.getSourceTagCounts("camera");
}

export async function getCameraSourceBrands() {
  return unified.getSourceBrands("camera");
}

export async function getCameraBrandProductCounts(brands: string[]): Promise<Record<string, number>> {
  return unified.getBrandProductCounts("camera", brands);
}

export async function getCameraTopBrandsByProductCount(limit: number = 8) {
  return unified.getTopBrandsByProductCount("camera", limit);
}

export async function findCameraBrandInDatabase(brandName: string): Promise<string | null> {
  return unified.findBrandInDatabase("camera", brandName);
}

export async function getCameraLatestVideos(limit: number = 3): Promise<CameraVideoWithProductCount[]> {
  return unified.getLatestVideos("camera", limit);
}
