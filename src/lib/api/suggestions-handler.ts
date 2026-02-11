/**
 * 動画サジェスト API 共通ハンドラ（デスクツアー・撮影機材DB共通）
 *
 * ドメインごとの差分（検索キーワード、DBテーブル名）は config で注入する。
 */
import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import type { SupabaseClient } from "@supabase/supabase-js";

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

export interface SuggestionsConfig {
  /** ランダム検索キーワードのプリセット */
  searchQueries: string[];
  /** Supabaseクライアント */
  supabase: SupabaseClient;
  /** 解析済み動画を格納するテーブル名 */
  videosTable: string;
}

// ISO 8601 duration を秒に変換
function parseDuration(duration: string): number {
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  return parseInt(match[1] || "0", 10) * 3600
    + parseInt(match[2] || "0", 10) * 60
    + parseInt(match[3] || "0", 10);
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

export function createSuggestionsHandler(config: SuggestionsConfig) {
  return async function GET(request: NextRequest) {
    try {
      const { searchParams } = new URL(request.url);
      const query = searchParams.get("q") ||
        config.searchQueries[Math.floor(Math.random() * config.searchQueries.length)];
      const maxResults = parseInt(searchParams.get("maxResults") || "30", 10);

      const publishedAfter = "2023-01-01T00:00:00Z";

      const searchResponse = await youtube.search.list({
        part: ["snippet"],
        q: query,
        type: ["video"],
        maxResults: 50,
        order: "date",
        regionCode: "JP",
        relevanceLanguage: "ja",
        publishedAfter,
        videoDuration: "medium",
      });

      if (!searchResponse.data.items?.length) {
        return NextResponse.json({ suggestions: [] });
      }

      const videoIds = searchResponse.data.items
        .map((item) => item.id?.videoId)
        .filter(Boolean) as string[];

      const videosResponse = await youtube.videos.list({
        part: ["snippet", "statistics", "contentDetails"],
        id: videoIds,
      });

      const { data: analyzedVideos } = await config.supabase
        .from(config.videosTable)
        .select("video_id")
        .in("video_id", videoIds);

      const analyzedSet = new Set(
        analyzedVideos?.map((v: { video_id: string }) => v.video_id) || []
      );

      const suggestions: SuggestedVideo[] = [];

      for (const video of videosResponse.data.items || []) {
        const videoId = video.id!;
        const viewCount = parseInt(video.statistics?.viewCount || "0", 10);
        const durationSeconds = parseDuration(video.contentDetails?.duration || "");
        const description = video.snippet?.description || "";
        const publishedAt = video.snippet?.publishedAt || "";

        if (analyzedSet.has(videoId)) continue;
        if (durationSeconds <= 60) continue;
        if (durationSeconds < 180) continue;
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
          isAnalyzed: false,
          description,
        });
      }

      // Fisher-Yates シャッフル
      for (let i = suggestions.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [suggestions[i], suggestions[j]] = [suggestions[j], suggestions[i]];
      }

      const limitedSuggestions = suggestions.slice(0, maxResults);

      return NextResponse.json({
        suggestions: limitedSuggestions,
        query,
        total: limitedSuggestions.length,
      });
    } catch (error) {
      console.error("Error fetching suggestions:", error);
      return NextResponse.json(
        { error: "候補の取得に失敗しました" },
        { status: 500 }
      );
    }
  };
}
