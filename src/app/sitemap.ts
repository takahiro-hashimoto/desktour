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

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://desktour-db.com";

  // 静的ページ
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.5,
    },
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

  return [
    ...staticPages,
    ...categoryPages,
    ...occupationPages,
    ...stylePages,
    ...environmentPages,
    ...brandPages,
    ...productPages,
  ];
}
