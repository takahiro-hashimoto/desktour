import { createSaveProductsHandler } from "@/lib/api/save-products-handler";
import { enrichCameraTags } from "@/lib/camera/camera-tag-inference";

export const POST = createSaveProductsHandler({
  domain: "camera",
  enrichTags: enrichCameraTags,
});
