import { NextRequest, NextResponse } from "next/server";
import { POST as unifiedPOST } from "../../generate-chosen-reasons/route";

/**
 * POST /api/camera/generate-chosen-reasons
 * 後方互換: /api/generate-chosen-reasons?domain=camera に委譲
 */
export async function POST(request: NextRequest) {
  // URLにdomain=cameraパラメータを追加して統合版に委譲
  const url = new URL(request.nextUrl);
  url.searchParams.set("domain", "camera");
  const modifiedRequest = new NextRequest(url, {
    method: request.method,
    headers: request.headers,
    body: request.body,
  });
  return unifiedPOST(modifiedRequest);
}
