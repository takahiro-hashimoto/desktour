import { redirect, notFound } from "next/navigation";
import {
  PRODUCT_CATEGORIES,
  slugToCategory,
  slugToDesktourSubcategory,
} from "@/lib/constants";

// 旧URL /desktour/[slug]/[sub] → /desktour/category/[slug]/[sub] にリダイレクト

interface PageProps {
  params: { slug: string; sub: string };
}

export default function SubcategoryRedirect({ params }: PageProps) {
  const category = slugToCategory(params.slug);
  if (category && PRODUCT_CATEGORIES.includes(category)) {
    const subcategory = slugToDesktourSubcategory(params.sub);
    if (subcategory) {
      redirect(`/desktour/category/${params.slug}/${params.sub}`);
    }
  }
  notFound();
}
