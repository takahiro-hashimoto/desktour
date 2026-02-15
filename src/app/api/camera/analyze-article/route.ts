import { createAnalyzeArticleHandler } from "@/lib/api/analyze-article-handler";
import { enrichCameraTags } from "@/lib/camera/camera-tag-inference";

export const POST = createAnalyzeArticleHandler({
  domain: "camera",
  enrichTags: enrichCameraTags,
});
