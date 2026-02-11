import { supabase } from "@/lib/supabase/client";
import { createSuggestionsHandler } from "@/lib/api/suggestions-handler";

export const GET = createSuggestionsHandler({
  searchQueries: [
    "撮影機材紹介",
    "撮影機材",
    "カメラ機材 紹介",
    "映像制作 機材",
    "私の撮影機材",
    "Vlog機材",
    "YouTube撮影機材",
    "動画撮影 おすすめ 機材",
  ],
  supabase,
  videosTable: "videos_camera",
});
