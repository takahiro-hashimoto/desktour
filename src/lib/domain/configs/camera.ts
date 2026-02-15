import type { DomainConfig } from "../types";
import {
  CAMERA_PRODUCT_CATEGORIES,
  CAMERA_BRAND_TAGS,
  CAMERA_OCCUPATION_TAGS,
  cameraCategoryToSlug,
  slugToCameraCategory,
  cameraOccupationToSlug,
  cameraBrandToSlug,
  cameraProductUrl,
  getCameraCompatibleCategories,
  selectCameraPrimaryOccupation,
} from "@/lib/camera/constants";
import { CAMERA_PRICE_RANGE_ORDER } from "@/lib/similarity-scoring";

export const cameraConfig: DomainConfig = {
  id: "camera",
  tables: {
    products: "products_camera",
    videos: "videos_camera",
    articles: "articles_camera",
    product_mentions: "product_mentions_camera",
    influencers: "influencers_camera",
  },
  constants: {
    brandTags: CAMERA_BRAND_TAGS,
    productCategories: CAMERA_PRODUCT_CATEGORIES,
    occupationTags: CAMERA_OCCUPATION_TAGS,
    priceRangeOrder: CAMERA_PRICE_RANGE_ORDER,
    categoryToSlug: cameraCategoryToSlug,
    slugToCategory: slugToCameraCategory,
    occupationToSlug: cameraOccupationToSlug,
    brandToSlug: cameraBrandToSlug,
    productUrl: cameraProductUrl,
    getCompatibleCategories: getCameraCompatibleCategories,
    selectPrimaryOccupation: selectCameraPrimaryOccupation,
  },
  search: {
    hasSubcategory: true,
    hasLensTags: true,
    hasBodyTags: true,
  },
  basePath: "/camera",
};
