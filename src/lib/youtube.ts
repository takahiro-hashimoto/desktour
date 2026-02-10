import { google } from "googleapis";
export { extractVideoId } from "./video-utils";

const youtube = google.youtube({
  version: "v3",
  auth: process.env.YOUTUBE_API_KEY,
});

export interface VideoInfo {
  videoId: string;
  title: string;
  description: string;
  channelTitle: string;
  channelId: string;
  channelDescription: string;
  channelThumbnailUrl: string;
  subscriberCount: number;
  viewCount: number;
  publishedAt: string;
  thumbnailUrl: string;
}

// チャンネル情報キャッシュ（同じチャンネルの複数動画解析時にAPI呼び出し削減）
const channelCache = new Map<string, {
  subscriberCount: number;
  channelDescription: string;
  channelThumbnailUrl: string;
  cachedAt: number;
}>();
const CHANNEL_CACHE_TTL = 24 * 60 * 60 * 1000; // 24時間

export async function getVideoInfo(videoId: string): Promise<VideoInfo | null> {
  try {
    const videoResponse = await youtube.videos.list({
      part: ["snippet", "statistics"],
      id: [videoId],
    });

    const video = videoResponse.data.items?.[0];
    if (!video || !video.snippet) {
      return null;
    }

    const viewCount = parseInt(
      video.statistics?.viewCount || "0",
      10
    );

    const channelId = video.snippet.channelId!;

    // 【最適化】チャンネル情報をキャッシュから取得（同一チャンネルの連続解析時にAPI削減）
    let subscriberCount = 0;
    let channelDescription = "";
    let channelThumbnailUrl = "";

    const cachedChannel = channelCache.get(channelId);
    if (cachedChannel && Date.now() - cachedChannel.cachedAt < CHANNEL_CACHE_TTL) {
      console.log(`[YouTube] Using cached channel info for ${channelId}`);
      subscriberCount = cachedChannel.subscriberCount;
      channelDescription = cachedChannel.channelDescription;
      channelThumbnailUrl = cachedChannel.channelThumbnailUrl;
    } else {
      // キャッシュがない場合はAPIで取得
      const channelResponse = await youtube.channels.list({
        part: ["statistics", "snippet"],
        id: [channelId],
      });

      const channel = channelResponse.data.items?.[0];
      subscriberCount = parseInt(
        channel?.statistics?.subscriberCount || "0",
        10
      );
      channelDescription = channel?.snippet?.description || "";
      channelThumbnailUrl =
        channel?.snippet?.thumbnails?.high?.url ||
        channel?.snippet?.thumbnails?.medium?.url ||
        channel?.snippet?.thumbnails?.default?.url ||
        "";

      // キャッシュに保存
      channelCache.set(channelId, {
        subscriberCount,
        channelDescription,
        channelThumbnailUrl,
        cachedAt: Date.now(),
      });
    }

    return {
      videoId,
      title: video.snippet.title || "",
      description: video.snippet.description || "",
      channelTitle: video.snippet.channelTitle || "",
      channelId,
      channelDescription,
      channelThumbnailUrl,
      subscriberCount,
      viewCount,
      publishedAt: video.snippet.publishedAt || "",
      thumbnailUrl:
        video.snippet.thumbnails?.high?.url ||
        video.snippet.thumbnails?.default?.url ||
        "",
    };
  } catch (error) {
    console.error("Error fetching video info:", error);
    return null;
  }
}

// 【最適化】字幕取得結果をキャッシュ（同じ動画の再解析時にAPI削減）
const transcriptCache = new Map<string, { transcript: string | null; cachedAt: number }>();
const TRANSCRIPT_CACHE_TTL = 60 * 60 * 1000; // 1時間

/**
 * YouTube動画の字幕を取得（youtube-transcript ライブラリ使用）
 * APIキー不要・無料・無制限
 */
export async function getTranscript(videoId: string): Promise<string | null> {
  // 【最適化】キャッシュチェック
  const cached = transcriptCache.get(videoId);
  if (cached && Date.now() - cached.cachedAt < TRANSCRIPT_CACHE_TTL) {
    console.log(`[Transcript] Using cached transcript for ${videoId}`);
    return cached.transcript;
  }

  console.log(`[Transcript] Fetching transcript for ${videoId}...`);

  try {
    // youtube-transcript ライブラリで字幕取得（@danielxceron fork版 - オリジナルは2024年以降動作不能）
    const { YoutubeTranscript } = await import("@danielxceron/youtube-transcript");

    let segments;
    try {
      // まず日本語字幕を試行
      segments = await YoutubeTranscript.fetchTranscript(videoId, { lang: "ja" });
    } catch {
      // 日本語がない場合はデフォルト（自動字幕含む）で取得
      console.log(`[Transcript] Japanese not available, trying default language...`);
      segments = await YoutubeTranscript.fetchTranscript(videoId);
    }

    if (segments && segments.length > 0) {
      const transcript = segments.map((item: { text: string }) => item.text).join(" ");
      console.log(`[Transcript] Got ${segments.length} segments, ${transcript.length} chars`);

      // キャッシュに保存
      transcriptCache.set(videoId, { transcript, cachedAt: Date.now() });
      return transcript;
    }

    // 字幕が空の場合
    console.log(`[Transcript] No transcript segments found for ${videoId}`);
    transcriptCache.set(videoId, { transcript: null, cachedAt: Date.now() });
    return null;
  } catch (error) {
    console.error(`[Transcript] Error fetching transcript for ${videoId}:`, error);
    // 失敗結果もキャッシュ（同じ動画の再リクエストを防ぐ）
    transcriptCache.set(videoId, { transcript: null, cachedAt: Date.now() });
    return null;
  }
}

export function isEligibleVideo(viewCount: number): boolean {
  return viewCount >= 5000;
}
