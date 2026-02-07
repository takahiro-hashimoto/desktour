/**
 * influencersテーブルにデータを登録するスクリプト
 * videosテーブルから取得したchannel_idを使用
 *
 * 実行方法: node scripts/fix-influencer.mjs
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

// .env.local を手動で読み込む
const envFile = readFileSync(".env.local", "utf-8");
const env = {};
for (const line of envFile.split("\n")) {
  const [key, ...valueParts] = line.split("=");
  if (key && valueParts.length > 0) {
    env[key.trim()] = valueParts.join("=").trim();
  }
}

const supabaseUrl = env.SUPABASE_URL;
const supabaseKey = env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Error: SUPABASE_URL or SUPABASE_ANON_KEY not found in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log("=== influencers テーブル修正スクリプト ===\n");

  // 1. 現在のvideosからchannel_id一覧を取得
  const { data: videos, error: videoError } = await supabase
    .from("videos")
    .select("video_id, channel_id, channel_title");

  if (videoError) {
    console.error("Error fetching videos:", videoError);
    return;
  }

  console.log(`取得した動画数: ${videos?.length || 0}`);

  if (!videos || videos.length === 0) {
    console.log("動画が見つかりませんでした");
    return;
  }

  // 2. ユニークなchannel_idを抽出
  const channelMap = new Map();
  for (const video of videos) {
    if (video.channel_id && !channelMap.has(video.channel_id)) {
      channelMap.set(video.channel_id, {
        channel_id: video.channel_id,
        channel_title: video.channel_title,
      });
    }
  }

  console.log(`ユニークなチャンネル数: ${channelMap.size}`);

  // 3. 各チャンネルについてinfluencerを確認・登録
  for (const [channelId, channelInfo] of channelMap) {
    console.log(`\nチャンネル: ${channelInfo.channel_title} (${channelId})`);

    // 既存チェック
    const { data: existing, error: checkError } = await supabase
      .from("influencers")
      .select("*")
      .eq("channel_id", channelId)
      .single();

    if (checkError && checkError.code !== "PGRST116") {
      console.error(`  エラー: ${checkError.message}`);
      continue;
    }

    if (existing) {
      console.log(`  既存レコードあり: occupation_tags = ${JSON.stringify(existing.occupation_tags)}`);

      // occupation_tagsが空または存在しない場合は更新
      if (!existing.occupation_tags || existing.occupation_tags.length === 0) {
        console.log("  → occupation_tagsを更新します");

        const { error: updateError } = await supabase
          .from("influencers")
          .update({
            occupation_tags: ["クリエイター", "会社員"],
            updated_at: new Date().toISOString(),
          })
          .eq("channel_id", channelId);

        if (updateError) {
          console.error(`  更新エラー: ${updateError.message}`);
        } else {
          console.log("  更新完了");
        }
      }
    } else {
      console.log("  レコードなし → 新規作成");

      const { error: insertError } = await supabase
        .from("influencers")
        .insert({
          channel_id: channelId,
          channel_title: channelInfo.channel_title,
          source_type: "youtube",
          occupation_tags: ["クリエイター", "会社員"],
          video_count: 1,
        });

      if (insertError) {
        console.error(`  作成エラー: ${insertError.message}`);
      } else {
        console.log("  作成完了");
      }
    }
  }

  // 4. 最終確認
  console.log("\n=== 最終確認 ===");
  const { data: finalInfluencers } = await supabase
    .from("influencers")
    .select("channel_id, channel_title, occupation_tags");

  console.log("influencersテーブルの内容:");
  for (const inf of finalInfluencers || []) {
    console.log(`  ${inf.channel_title}: ${JSON.stringify(inf.occupation_tags)}`);
  }
}

main().catch(console.error);
