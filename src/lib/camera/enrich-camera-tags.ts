/**
 * Camera用タグ補強（後方互換ラッパー）
 *
 * 実体は camera-tag-inference.ts に統合済み。
 * 既存コードからの import を維持するための re-export。
 */
export {
  enrichCameraTags,
  type CameraEnrichmentInput,
  type CameraEnrichmentResult,
} from "./camera-tag-inference";
