import { MetadataRoute } from "next";
import { supabase } from "@/lib/supabase/client";
import {
  categoryToSlug,
  occupationToSlug,
  styleTagToSlug,
  environmentTagToSlug,
  brandToSlug,
  PRODUCT_CATEGORIES,
  OCCUPATION_TAGS,
  STYLE_TAGS,
  ENVIRONMENT_TAGS,
  BRAND_TAGS,
} from "@/lib/constants";
import {
  cameraCategoryToSlug,
  cameraOccupationToSlug,
  cameraBrandToSlug,
  CAMERA_PRODUCT_CATEGORIES,
  CAMERA_OCCUPATION_TAGS,
  CAMERA_BRAND_TAGS,
} from "@/lib/camera/constants";

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

  // カテゴリページ
  const categoryPages: MetadataRoute.Sitemap = PRODUCT_CATEGORIES.map((category) => ({
    url: `${baseUrl}/desktour/category/${categoryToSlug(category)}`,
    lastModified: new Date(),
    changeFrequency: "daily" as const,
    priority: 0.8,
  }));

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

  // ブランドページ
  const brandPages: MetadataRoute.Sitemap = BRAND_TAGS.map((brand) => ({
    url: `${baseUrl}/desktour/brand/${brandToSlug(brand)}`,
    lastModified: new Date(),
    changeFrequency: "weekly" as const,
    priority: 0.7,
  }));

  // 商品詳細ページ（DBから動的取得）
  let productPages: MetadataRoute.Sitemap = [];
  try {
    const { data: products } = await supabase
      .from("products")
      .select("slug, updated_at")
      .not("slug", "is", null);

    if (products) {
      productPages = products.map((product) => ({
        url: `${baseUrl}/desktour/product/${product.slug}`,
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

  // カメラ - カテゴリページ
  const cameraCategoryPages: MetadataRoute.Sitemap = CAMERA_PRODUCT_CATEGORIES.map((category) => ({
    url: `${baseUrl}/camera/category/${cameraCategoryToSlug(category)}`,
    lastModified: new Date(),
    changeFrequency: "daily" as const,
    priority: 0.8,
  }));

  // カメラ - 職業タグページ
  const cameraOccupationPages: MetadataRoute.Sitemap = CAMERA_OCCUPATION_TAGS.map((tag) => ({
    url: `${baseUrl}/camera/occupation/${cameraOccupationToSlug(tag)}`,
    lastModified: new Date(),
    changeFrequency: "weekly" as const,
    priority: 0.7,
  }));

  // カメラ - ブランドページ
  const cameraBrandPages: MetadataRoute.Sitemap = CAMERA_BRAND_TAGS.map((brand) => ({
    url: `${baseUrl}/camera/brand/${cameraBrandToSlug(brand)}`,
    lastModified: new Date(),
    changeFrequency: "weekly" as const,
    priority: 0.7,
  }));

  // カメラ - 商品詳細ページ（DBから動的取得）
  let cameraProductPages: MetadataRoute.Sitemap = [];
  try {
    const { data: cameraProducts } = await supabase
      .from("products_camera")
      .select("slug, updated_at")
      .not("slug", "is", null);

    if (cameraProducts) {
      cameraProductPages = cameraProducts.map((product) => ({
        url: `${baseUrl}/camera/product/${product.slug}`,
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
    ...occupationPages,
    ...stylePages,
    ...environmentPages,
    ...brandPages,
    ...productPages,
    // 撮影機材DB
    ...cameraCategoryPages,
    ...cameraOccupationPages,
    ...cameraBrandPages,
    ...cameraProductPages,
  ];
}
