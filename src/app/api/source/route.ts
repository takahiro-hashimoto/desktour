import { NextRequest, NextResponse } from "next/server";
import { getSourceDetail } from "@/lib/supabase";
import { getCameraSourceDetail } from "@/lib/supabase/queries-camera";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const type = searchParams.get("type");
  const id = searchParams.get("id");
  const domain = searchParams.get("domain"); // "camera" or default (desktour)

  if (!type || !id) {
    return NextResponse.json({ error: "Missing type or id parameter" }, { status: 400 });
  }

  if (type !== "video" && type !== "article") {
    return NextResponse.json({ error: "Invalid source type" }, { status: 400 });
  }

  const detail = domain === "camera"
    ? await getCameraSourceDetail(type, id)
    : await getSourceDetail(type, id);

  if (!detail) {
    return NextResponse.json({ error: "Source not found" }, { status: 404 });
  }

  return NextResponse.json(detail);
}
