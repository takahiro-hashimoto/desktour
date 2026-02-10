import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { supabase } from "@/lib/supabase/client";

const youtube = google.youtube({
  version: "v3",
  auth: process.env.YOUTUBE_API_KEY,
});

export interface SuggestedVideo {
  videoId: string;
  title: string;
  channelId: string;
  channelTitle: string;
  thumbnailUrl: string;
  viewCount: number;
  duration: string;
  publishedAt: string;
  isAnalyzed: boolean;
  description?: string;
}

// ISO 8601 duration を秒に変換
function parseDuration(duration: string): number {
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;

  const hours = parseInt(match[1] || "0", 10);
  const minutes = parseInt(match[2] || "0", 10);
  const seconds = parseInt(match[3] || "0", 10);

  return hours * 3600 + minutes * 60 + seconds;
}

// 秒を読みやすい形式に変換
function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }
  return `${minutes}:${secs.toString().padStart(2, "0")}`;
}


export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q") || "撮影機材";
    const maxResults = parseInt(searchParams.get("maxResults") || "30", 10);

    // 2023年1月1日以降の動画のみ
    const publishedAfter = "2023-01-01T00:00:00Z";

    // YouTubeで検索（日付順で新しいものを優先的に取得）
    const searchResponse = await youtube.search.list({
      part: ["snippet"],
      q: query,
      type: ["video"],
      maxResults: 50, // より多く取得してフィルタリング
      order: "date", // 新しい動画を優先
      regionCode: "JP",
      relevanceLanguage: "ja",
      publishedAfter,
      videoDuration: "medium", // 4分〜20分の動画（ショート除外）
    });

    if (!searchResponse.data.items?.length) {
      return NextResponse.json({ suggestions: [] });
    }

    const videoIds = searchResponse.data.items
      .map((item) => item.id?.videoId)
      .filter(Boolean) as string[];

    // 各動画の詳細情報を取得（contentDetailsで動画の長さも取得）
    const videosResponse = await youtube.videos.list({
      part: ["snippet", "statistics", "contentDetails"],
      id: videoIds,
    });

    // 既に解析済みの動画IDを取得（videos_cameraテーブルを参照）
    const { data: analyzedVideos } = await supabase
      .from("videos_camera")
      .select("video_id")
      .in("video_id", videoIds);

    const analyzedSet = new Set(
      analyzedVideos?.map((v) => v.video_id) || []
    );

    const suggestions: SuggestedVideo[] = [];

    for (const video of videosResponse.data.items || []) {
      const videoId = video.id!;
      const viewCount = parseInt(video.statistics?.viewCount || "0", 10);
      const durationSeconds = parseDuration(video.contentDetails?.duration || "");
      const description = video.snippet?.description || "";
      const publishedAt = video.snippet?.publishedAt || "";

      // フィルター条件
      // 1. 既にDB登録済みの動画は除外
      if (analyzedSet.has(videoId)) continue;

      // 2. 視聴回数5000以上
      if (viewCount < 5000) continue;

      // 3. 60秒以下はショート動画として除外
      if (durationSeconds <= 60) continue;

      // 4. 3分未満の短い動画も除外（撮影機材紹介としては短すぎる）
      if (durationSeconds < 180) continue;

      // 5. 2023年以降の動画のみ（念のため再チェック）
      if (publishedAt && new Date(publishedAt) < new Date("2023-01-01")) continue;

      suggestions.push({
        videoId,
        title: video.snippet?.title || "",
        channelId: video.snippet?.channelId || "",
        channelTitle: video.snippet?.channelTitle || "",
        thumbnailUrl:
          video.snippet?.thumbnails?.medium?.url ||
          video.snippet?.thumbnails?.default?.url ||
          "",
        viewCount,
        duration: formatDuration(durationSeconds),
        publishedAt,
        isAnalyzed: false, // 未登録のみ表示
        description,
      });
    }

    // ランダムシャッフル（Fisher-Yates）で未登録動画をランダム表示
    for (let i = suggestions.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [suggestions[i], suggestions[j]] = [suggestions[j], suggestions[i]];
    }

    // 最大件数で切る
    const limitedSuggestions = suggestions.slice(0, maxResults);

    return NextResponse.json({
      suggestions: limitedSuggestions,
      query,
      total: limitedSuggestions.length,
    });
  } catch (error) {
    console.error("Error fetching camera suggestions:", error);
    return NextResponse.json(
      { error: "候補の取得に失敗しました" },
      { status: 500 }
    );
  }
}
