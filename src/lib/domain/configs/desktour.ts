import type { DomainConfig } from "../types";
import {
  PRODUCT_CATEGORIES,
  BRAND_TAGS,
  OCCUPATION_TAGS,
  categoryToSlug,
  slugToCategory,
  occupationToSlug,
  brandToSlug,
  productUrl,
  getCompatibleCategories,
  selectPrimaryOccupation,
} from "@/lib/constants";
import { DESKTOUR_PRICE_RANGE_ORDER } from "@/lib/similarity-scoring";

export const desktourConfig: DomainConfig = {
  id: "desktour",
  tables: {
    products: "products",
    videos: "videos",
    articles: "articles",
    product_mentions: "product_mentions",
    influencers: "influencers",
  },
  constants: {
    brandTags: BRAND_TAGS,
    productCategories: PRODUCT_CATEGORIES,
    occupationTags: OCCUPATION_TAGS,
    priceRangeOrder: DESKTOUR_PRICE_RANGE_ORDER,
    categoryToSlug,
    slugToCategory,
    occupationToSlug,
    brandToSlug,
    productUrl,
    getCompatibleCategories,
    selectPrimaryOccupation,
  },
  search: {
    hasSubcategory: false,
    hasLensTags: false,
    hasBodyTags: false,
  },
  basePath: "/desktour",
};
