/**
 * influencersテーブルのデバッグスクリプト
 *
 * 実行方法: node scripts/debug-influencer.mjs
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

console.log("=== Supabase接続情報 ===");
console.log(`URL: ${supabaseUrl}`);
console.log(`Key prefix: ${supabaseKey?.substring(0, 20)}...`);

if (!supabaseUrl || !supabaseKey) {
  console.error("Error: SUPABASE_URL or SUPABASE_ANON_KEY not found in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log("\n=== influencers テーブル デバッグ ===\n");

  // 1. テーブル内の全レコードを取得
  console.log("1. influencersテーブルの全レコード:");
  const { data: allInfluencers, error: allError } = await supabase
    .from("influencers")
    .select("*");

  if (allError) {
    console.error("  Error:", allError);
  } else {
    console.log(`  レコード数: ${allInfluencers?.length || 0}`);
    for (const inf of allInfluencers || []) {
      console.log(`  - ${inf.channel_title} (channel_id: ${inf.channel_id})`);
      console.log(`    occupation_tags: ${JSON.stringify(inf.occupation_tags)}`);
    }
  }

  // 2. 特定のchannel_idで検索
  const targetChannelId = "UCISDrqLMNq3w9AZ4otdoRuA";
  console.log(`\n2. 特定のchannel_id検索 (${targetChannelId}):`);

  // .single()なしで検索
  const { data: matchingInfluencers, error: matchError } = await supabase
    .from("influencers")
    .select("*")
    .eq("channel_id", targetChannelId);

  if (matchError) {
    console.error("  Error:", matchError);
  } else {
    console.log(`  マッチ数: ${matchingInfluencers?.length || 0}`);
    console.log(`  データ:`, JSON.stringify(matchingInfluencers, null, 2));
  }

  // 3. .single()で検索（アプリと同じ方法）
  console.log(`\n3. .single()で検索（アプリと同じ方法）:`);
  const { data: singleInfluencer, error: singleError } = await supabase
    .from("influencers")
    .select("*")
    .eq("channel_id", targetChannelId)
    .single();

  if (singleError) {
    console.error("  Error:", singleError);
    console.error("  Error code:", singleError.code);
    console.error("  Error message:", singleError.message);
  } else {
    console.log(`  データ:`, JSON.stringify(singleInfluencer, null, 2));
  }

  // 4. videosテーブルの確認
  console.log("\n4. videosテーブルのchannel_id一覧:");
  const { data: videos, error: vidError } = await supabase
    .from("videos")
    .select("video_id, channel_id, channel_title");

  if (vidError) {
    console.error("  Error:", vidError);
  } else {
    for (const v of videos || []) {
      console.log(`  - ${v.channel_title} (channel_id: ${v.channel_id}, video_id: ${v.video_id})`);
    }
  }

  // 5. テスト: 新しいレコードをinsertしてすぐselectできるか確認
  console.log("\n5. Insert/Select テスト:");
  const testChannelId = `test_${Date.now()}`;

  const { data: inserted, error: insertError } = await supabase
    .from("influencers")
    .insert({
      channel_id: testChannelId,
      channel_title: "Test Channel",
      source_type: "youtube",
      occupation_tags: ["テスト"],
      video_count: 1,
    })
    .select()
    .single();

  if (insertError) {
    console.log("  Insert Error:", insertError);
    console.log("  これはRLSポリシーによる制限の可能性があります");
  } else {
    console.log("  Insert成功:", inserted);

    // すぐにselectしてみる
    const { data: fetched, error: fetchError } = await supabase
      .from("influencers")
      .select("*")
      .eq("channel_id", testChannelId)
      .single();

    if (fetchError) {
      console.log("  Select Error:", fetchError);
    } else {
      console.log("  Select成功:", fetched);
    }

    // テストデータを削除
    const { error: deleteError } = await supabase
      .from("influencers")
      .delete()
      .eq("channel_id", testChannelId);

    if (deleteError) {
      console.log("  Delete Error:", deleteError);
    } else {
      console.log("  テストデータ削除完了");
    }
  }
}

main().catch(console.error);
