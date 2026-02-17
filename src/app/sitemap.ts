import { MetadataRoute } from "next";
import { supabase } from "@/lib/supabase/client";
import {
  categoryToSlug,
  occupationToSlug,
  styleTagToSlug,
  environmentTagToSlug,
  desktourSubcategoryToSlug,
  PRODUCT_CATEGORIES,
  OCCUPATION_TAGS,
  STYLE_TAGS,
  ENVIRONMENT_TAGS,
} from "@/lib/constants";
import { TYPE_TAGS } from "@/lib/tag-definitions";
import {
  cameraCategoryToSlug,
  cameraOccupationToSlug,
  cameraSubcategoryToSlug,
  CAMERA_PRODUCT_CATEGORIES,
  CAMERA_OCCUPATION_TAGS,
} from "@/lib/camera/constants";
import { CAMERA_TYPE_TAGS } from "@/lib/camera/camera-tag-definitions";
import { getBrands } from "@/lib/supabase/queries-brands";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://desktour-db.com";

  // ========================================
  // 静的ページ
  // ========================================
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.5,
    },
    // デスクツアーDB
    {
      url: `${baseUrl}/desktour`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1.0,
    },
    {
      url: `${baseUrl}/desktour/category`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${baseUrl}/desktour/brand`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/desktour/occupation`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/desktour/style`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/desktour/sources`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.6,
    },
    // 撮影機材DB
    {
      url: `${baseUrl}/camera`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1.0,
    },
    {
      url: `${baseUrl}/camera/category`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${baseUrl}/camera/brand`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/camera/occupation`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/camera/sources`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.6,
    },
    // その他
    {
      url: `${baseUrl}/about`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.4,
    },
    {
      url: `${baseUrl}/contact`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.3,
    },
    {
      url: `${baseUrl}/policy`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.3,
    },
  ];

  // ========================================
  // デスクツアーDB ページ
  // ========================================

  // カテゴリページ（/desktour/${catSlug}）
  const categoryPages: MetadataRoute.Sitemap = PRODUCT_CATEGORIES.map((category) => ({
    url: `${baseUrl}/desktour/${categoryToSlug(category)}`,
    lastModified: new Date(),
    changeFrequency: "daily" as const,
    priority: 0.8,
  }));

  // サブカテゴリページ（/desktour/${catSlug}/${subSlug}）
  const desktourSubcategoryPages: MetadataRoute.Sitemap = PRODUCT_CATEGORIES.flatMap((category) => {
    const subcategories = TYPE_TAGS[category] || [];
    const catSlug = categoryToSlug(category);
    return subcategories.map((sub) => ({
      url: `${baseUrl}/desktour/${catSlug}/${desktourSubcategoryToSlug(sub)}`,
      lastModified: new Date(),
      changeFrequency: "weekly" as const,
      priority: 0.7,
    }));
  });

  // 職業タグページ
  const occupationPages: MetadataRoute.Sitemap = OCCUPATION_TAGS.map((tag) => ({
    url: `${baseUrl}/desktour/occupation/${occupationToSlug(tag)}`,
    lastModified: new Date(),
    changeFrequency: "weekly" as const,
    priority: 0.7,
  }));

  // スタイルタグページ
  const stylePages: MetadataRoute.Sitemap = STYLE_TAGS.map((tag) => ({
    url: `${baseUrl}/desktour/style/${styleTagToSlug(tag)}`,
    lastModified: new Date(),
    changeFrequency: "weekly" as const,
    priority: 0.7,
  }));

  // 環境タグページ
  const environmentPages: MetadataRoute.Sitemap = ENVIRONMENT_TAGS.map((tag) => ({
    url: `${baseUrl}/desktour/style/${environmentTagToSlug(tag)}`,
    lastModified: new Date(),
    changeFrequency: "weekly" as const,
    priority: 0.7,
  }));

  // ブランドページ（brands テーブルから動的取得）
  const desktourBrands = await getBrands("desktour");
  const brandPages: MetadataRoute.Sitemap = desktourBrands.map((b) => ({
    url: `${baseUrl}/desktour/brand/${b.slug}`,
    lastModified: new Date(),
    changeFrequency: "weekly" as const,
    priority: 0.7,
  }));

  // 商品詳細ページ（/desktour/${slug}）
  let productPages: MetadataRoute.Sitemap = [];
  try {
    const { data: products } = await supabase
      .from("products")
      .select("slug, updated_at")
      .not("slug", "is", null);

    if (products) {
      productPages = products.map((product) => ({
        url: `${baseUrl}/desktour/${product.slug}`,
        lastModified: product.updated_at ? new Date(product.updated_at) : new Date(),
        changeFrequency: "weekly" as const,
        priority: 0.6,
      }));
    }
  } catch (error) {
    console.error("Error fetching products for sitemap:", error);
  }

  // ========================================
  // 撮影機材DB ページ
  // ========================================

  // カメラ - カテゴリページ（/camera/${catSlug}）
  const cameraCategoryPages: MetadataRoute.Sitemap = CAMERA_PRODUCT_CATEGORIES.map((category) => ({
    url: `${baseUrl}/camera/${cameraCategoryToSlug(category)}`,
    lastModified: new Date(),
    changeFrequency: "daily" as const,
    priority: 0.8,
  }));

  // カメラ - サブカテゴリページ（/camera/${catSlug}/${subSlug}）
  const cameraSubcategoryPages: MetadataRoute.Sitemap = CAMERA_PRODUCT_CATEGORIES.flatMap((category) => {
    const subcategories = CAMERA_TYPE_TAGS[category] || [];
    const catSlug = cameraCategoryToSlug(category);
    return subcategories.map((sub) => ({
      url: `${baseUrl}/camera/${catSlug}/${cameraSubcategoryToSlug(sub)}`,
      lastModified: new Date(),
      changeFrequency: "weekly" as const,
      priority: 0.7,
    }));
  });

  // カメラ - 職業タグページ
  const cameraOccupationPages: MetadataRoute.Sitemap = CAMERA_OCCUPATION_TAGS.map((tag) => ({
    url: `${baseUrl}/camera/occupation/${cameraOccupationToSlug(tag)}`,
    lastModified: new Date(),
    changeFrequency: "weekly" as const,
    priority: 0.7,
  }));

  // カメラ - ブランドページ（brands テーブルから動的取得）
  const cameraBrands = await getBrands("camera");
  const cameraBrandPages: MetadataRoute.Sitemap = cameraBrands.map((b) => ({
    url: `${baseUrl}/camera/brand/${b.slug}`,
    lastModified: new Date(),
    changeFrequency: "weekly" as const,
    priority: 0.7,
  }));

  // カメラ - 商品詳細ページ（/camera/${slug}）
  let cameraProductPages: MetadataRoute.Sitemap = [];
  try {
    const { data: cameraProducts } = await supabase
      .from("products_camera")
      .select("slug, updated_at")
      .not("slug", "is", null);

    if (cameraProducts) {
      cameraProductPages = cameraProducts.map((product) => ({
        url: `${baseUrl}/camera/${product.slug}`,
        lastModified: product.updated_at ? new Date(product.updated_at) : new Date(),
        changeFrequency: "weekly" as const,
        priority: 0.6,
      }));
    }
  } catch (error) {
    console.error("Error fetching camera products for sitemap:", error);
  }

  return [
    ...staticPages,
    // デスクツアーDB
    ...categoryPages,
    ...desktourSubcategoryPages,
    ...occupationPages,
    ...stylePages,
    ...environmentPages,
    ...brandPages,
    ...productPages,
    // 撮影機材DB
    ...cameraCategoryPages,
    ...cameraSubcategoryPages,
    ...cameraOccupationPages,
    ...cameraBrandPages,
    ...cameraProductPages,
  ];
}
