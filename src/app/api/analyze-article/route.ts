import { createAnalyzeArticleHandler } from "@/lib/api/analyze-article-handler";
import { extractProductTags } from "@/lib/tag-inference";

export const POST = createAnalyzeArticleHandler({
  domain: "desktour",
  extractTags: extractProductTags,
});
