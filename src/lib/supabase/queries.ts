// 後方互換: queries-unified.ts に委譲するthin wrapper
import * as unified from "./queries-unified";
import type { SearchParams, ProductDetail, SiteStats, CoUsedProduct, SimilarProduct } from "@/types";
import type { VideoWithProductCount, ArticleWithProductCount } from "./types";

export async function getProductRanking(limit = 20, category?: string) {
  return unified.getProductRanking("desktour", limit, category);
}

export async function getInfluencers(limit = 50) {
  return unified.getInfluencers("desktour", limit);
}

export async function searchProducts(params: SearchParams) {
  return unified.searchProducts("desktour", params);
}

export async function getProductCountByCategory(): Promise<Record<string, number>> {
  return unified.getProductCountByCategory("desktour");
}

export async function getProductDetailByAsin(asin: string): Promise<ProductDetail | null> {
  return unified.getProductDetailByAsin("desktour", asin);
}

export async function getProductDetailBySlug(slug: string): Promise<ProductDetail | null> {
  return unified.getProductDetailBySlug("desktour", slug);
}

export async function getProductDetail(productId: string): Promise<ProductDetail | null> {
  return unified.getProductDetail("desktour", productId);
}

export async function getCoOccurrenceProducts(
  productId: string,
  limit = 10,
  currentProductCategory?: string
): Promise<CoUsedProduct[]> {
  return unified.getCoOccurrenceProducts("desktour", productId, limit, currentProductCategory);
}

export async function getSimilarProducts(
  product: {
    id: string;
    category: string;
    tags?: string[];
    brand?: string;
    price_range?: string;
  },
  limit = 4,
): Promise<SimilarProduct[]> {
  return unified.getSimilarProducts("desktour", product, limit);
}

export async function getSiteStats(): Promise<SiteStats> {
  return unified.getSiteStats("desktour");
}

export async function getTopProductImages(limit = 24): Promise<string[]> {
  return unified.getTopProductImages("desktour", limit);
}

export async function getTopProductByCategory() {
  return unified.getTopProductByCategory("desktour");
}

export async function getOccupationTagCounts(): Promise<Record<string, number>> {
  return unified.getOccupationTagCounts("desktour");
}

export async function getSetupTagCounts(): Promise<Record<string, number>> {
  return unified.getSetupTagCounts("desktour");
}

export async function getSourceDetail(
  sourceType: "video" | "article",
  sourceId: string
) {
  return unified.getSourceDetail("desktour", sourceType, sourceId);
}

export async function getVideos(params: {
  tags?: string[];
  year?: number;
  sortBy?: "published_at" | "subscriber_count";
  page?: number;
  limit?: number;
}): Promise<{ videos: VideoWithProductCount[]; total: number }> {
  return unified.getVideos("desktour", params);
}

export async function getArticles(params: {
  tags?: string[];
  year?: number;
  sourceType?: "note" | "blog" | "official" | "other";
  sortBy?: "published_at";
  page?: number;
  limit?: number;
}): Promise<{ articles: ArticleWithProductCount[]; total: number }> {
  return unified.getArticles("desktour", params);
}

export async function getSourceTagCounts(): Promise<Record<string, number>> {
  return unified.getSourceTagCounts("desktour");
}

export async function getBrandProductCounts(brands: string[]): Promise<Record<string, number>> {
  return unified.getBrandProductCounts("desktour", brands);
}

export async function getTopBrandsByProductCount(limit: number = 8) {
  return unified.getTopBrandsByProductCount("desktour", limit);
}

export async function findBrandInDatabase(brandName: string): Promise<string | null> {
  return unified.findBrandInDatabase("desktour", brandName);
}

export async function getLatestVideos(limit: number = 3): Promise<VideoWithProductCount[]> {
  return unified.getLatestVideos("desktour", limit);
}
