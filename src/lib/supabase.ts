// バレルファイル: 後方互換性のため全てを再エクスポート
// 実際の実装は supabase/ ディレクトリ内のモジュールに分割済み

export { supabase } from "./supabase/client";
export type {
  Video,
  Article,
  Product,
  ProductMention,
  Influencer,
  VideoWithProductCount,
  ArticleWithProductCount,
} from "./supabase/types";
export {
  isVideoAnalyzed,
  isArticleAnalyzed,
  saveArticle,
  saveVideo,
  saveProduct,
  saveMention,
  updateProductWithAmazon,
  saveInfluencer,
  updateSourceMetadata,
  updateInfluencerOccupationTags,
  updateProductMetadata,
  updateMentionReason,
  deleteSource,
  type FuzzyCategoryCache,
} from "./supabase/mutations";
export { saveMatchedProducts } from "./supabase/save-matched-products";
export type { ProductSourceRef } from "./supabase/save-matched-products";
export {
  getProductRanking,
  getInfluencers,
  searchProducts,
  getProductCountByCategory,
  getProductDetailByAsin,
  getProductDetailBySlug,
  getProductDetail,
  getCoOccurrenceProducts,
  getSimilarProducts,
  getBrandPopularProducts,
  getSiteStats,
  getTopProductImages,
  getTopProductByCategory,
  getOccupationTagCounts,
  getSetupTagCounts,
  getSourceDetail,
  getVideos,
  getArticles,
  getSourceTagCounts,
  getBrandProductCounts,
  getTopBrandsByProductCount,
  findBrandInDatabase,
  getLatestVideos,
  getBrandBySlug,
  getBrandSlugMap,
  getBrands,
  findBrandByName,
} from "./supabase/queries";
export type { Brand } from "./supabase/queries";
