import { google } from "googleapis";

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

export function extractVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=)([^&\s]+)/,
    /(?:youtu\.be\/)([^?\s]+)/,
    /(?:youtube\.com\/embed\/)([^?\s]+)/,
    /(?:youtube\.com\/v\/)([^?\s]+)/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      return match[1];
    }
  }
  return null;
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

interface SupadataTranscriptItem {
  text: string;
  offset: number;
  duration: number;
}

interface SupadataResponse {
  content: SupadataTranscriptItem[];
  lang: string;
}

// 【最適化】字幕取得結果をキャッシュ（同じ動画の再解析時にAPI削減）
const transcriptCache = new Map<string, { transcript: string | null; cachedAt: number }>();
const TRANSCRIPT_CACHE_TTL = 60 * 60 * 1000; // 1時間

export async function getTranscript(videoId: string): Promise<string | null> {
  const apiKey = process.env.SUPADATA_API_KEY;

  if (!apiKey) {
    console.error("SUPADATA_API_KEY is not set");
    return null;
  }

  // 【最適化】キャッシュチェック
  const cached = transcriptCache.get(videoId);
  if (cached && Date.now() - cached.cachedAt < TRANSCRIPT_CACHE_TTL) {
    console.log(`[Supadata] Using cached transcript for ${videoId}`);
    return cached.transcript;
  }

  console.log("Fetching transcript via Supadata API...");

  try {
    // 【最適化】言語指定なしで1回だけリクエスト（サーバー側で最適な言語を選択）
    // これにより日本語がない場合のフォールバックリクエストが不要になる
    const response = await fetch(
      `https://api.supadata.ai/v1/youtube/transcript?videoId=${videoId}`,
      {
        headers: {
          "x-api-key": apiKey,
        },
      }
    );

    console.log(`Supadata response status: ${response.status}`);

    if (response.ok) {
      const data: SupadataResponse = await response.json();
      console.log(`Got ${data.content?.length || 0} transcript segments, lang: ${data.lang}`);

      if (data.content && data.content.length > 0) {
        const transcript = data.content.map((item) => item.text).join(" ");
        console.log(`Transcript length: ${transcript.length} chars`);

        // キャッシュに保存
        transcriptCache.set(videoId, { transcript, cachedAt: Date.now() });
        return transcript;
      }
    }

    // エラーレスポンスの詳細を出力
    if (!response.ok) {
      const errorText = await response.text();
      console.error("Supadata error:", errorText);
    }

    // 失敗結果もキャッシュ（同じ動画の再リクエストを防ぐ）
    transcriptCache.set(videoId, { transcript: null, cachedAt: Date.now() });
    return null;
  } catch (error) {
    console.error("Error fetching transcript via Supadata:", error);
    return null;
  }
}

export function isEligibleVideo(viewCount: number): boolean {
  return viewCount >= 5000;
}

// 後方互換性のため残す（非推奨）
export function isEligibleChannel(subscriberCount: number): boolean {
  return subscriberCount >= 10000;
}
