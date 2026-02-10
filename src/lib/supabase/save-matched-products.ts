/**
 * Shared utility for saving matched products to the database.
 *
 * Extracted from the duplicated logic in:
 *   - src/app/api/analyze/route.ts (video analysis)
 *   - src/app/api/analyze-article/route.ts (article analysis)
 *
 * Both routes follow the same pattern:
 *   1. Call saveProduct() for each matched product
 *   2. If the product is new (no ASIN) and has Amazon/Rakuten info,
 *      call updateProductWithAmazon() with detailed product data
 */

import { saveProduct, updateProductWithAmazon } from "./mutations";
import { getPriceRange } from "../gemini";
import { isLowQualityFeatures } from "../featureQuality";
import type { MatchedProduct, MatchCandidate } from "../product-matching";

/** Identifies the content source for product saving */
export interface ProductSourceRef {
  /** YouTube video ID (for video sources) */
  video_id?: string;
  /** Article URL (for article sources) */
  article_id?: string;
  /** Source type discriminator */
  source_type: "video" | "article";
}

/**
 * Save an array of matched products to the database, including their
 * Amazon/Rakuten detail info when available.
 *
 * @param matchedProducts - Products with optional Amazon/Rakuten match data
 * @param sourceRef       - Identifies the video or article these products came from
 * @param candidates      - The ASIN candidate list used during matching (needed
 *                          to look up the full ProductInfo for detailed fields)
 */
export async function saveMatchedProducts(
  matchedProducts: MatchedProduct[],
  sourceRef: ProductSourceRef,
  candidates: MatchCandidate[]
): Promise<void> {
  for (const product of matchedProducts) {
    console.log(
      `[SaveProduct] ${product.name} | tags: ${product.tags?.join(", ") || "none"}`
    );

    const result = await saveProduct({
      name: product.name,
      brand: product.brand || undefined,
      category: product.category,
      reason: product.reason,
      confidence: product.confidence,
      video_id: sourceRef.video_id,
      article_id: sourceRef.article_id,
      source_type: sourceRef.source_type,
    });
    const savedProduct = result.product;

    if (savedProduct && !savedProduct.asin && product.amazon) {
      const priceRange = getPriceRange(product.amazon.price);

      // Look up the full ProductInfo from candidates for detailed spec fields
      const originalProduct = candidates.find(
        (c) => c.asin === product.amazon?.asin
      )?.product;

      await updateProductWithAmazon(
        savedProduct.id!,
        {
          asin: product.amazon.asin,
          amazon_url: product.amazon.url,
          amazon_image_url: product.amazon.imageUrl,
          amazon_price: product.amazon.price,
          amazon_title: product.amazon.title,
          product_source: product.source,
          rakuten_shop_name: originalProduct?.shopName,
          amazon_manufacturer: originalProduct?.manufacturer,
          amazon_brand: originalProduct?.brand,
          amazon_model_number: originalProduct?.modelNumber,
          amazon_color: originalProduct?.color,
          amazon_size: originalProduct?.size,
          amazon_weight: originalProduct?.weight,
          amazon_release_date: originalProduct?.releaseDate,
          amazon_features:
            originalProduct?.features &&
            !isLowQualityFeatures(originalProduct.features)
              ? originalProduct.features
              : undefined,
          amazon_technical_info: originalProduct?.technicalInfo,
        },
        priceRange || undefined
      );
    }
  }
}
