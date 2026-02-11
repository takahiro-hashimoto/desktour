import { supabase } from "@/lib/supabase";
import { createSuggestionsHandler } from "@/lib/api/suggestions-handler";

export const GET = createSuggestionsHandler({
  searchQueries: [
    "デスクツアー",
    "デスク環境",
    "デスク周り 紹介",
    "デスクセットアップ",
    "desk setup",
    "作業環境 紹介",
    "ガジェット紹介 デスク",
    "在宅ワーク デスク",
    "PC環境 紹介",
  ],
  supabase,
  videosTable: "videos",
});
