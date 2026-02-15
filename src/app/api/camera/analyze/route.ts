import { createAnalyzeHandler } from "@/lib/api/analyze-handler";
import { enrichCameraTags } from "@/lib/camera/camera-tag-inference";

export const POST = createAnalyzeHandler({
  domain: "camera",
  enrichTags: enrichCameraTags,
});
