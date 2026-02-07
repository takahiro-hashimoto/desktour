/**
 * influencerの職業タグを正しいものに更新するスクリプト
 *
 * 実行方法: node scripts/update-tags.mjs
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
  console.log("=== TECH WORLD の職業タグを更新 ===\n");

  const channelId = "UCISDrqLMNq3w9AZ4otdoRuA";

  // 現在の状態を確認
  const { data: current, error: fetchError } = await supabase
    .from("influencers")
    .select("*")
    .eq("channel_id", channelId)
    .single();

  if (fetchError) {
    console.error("取得エラー:", fetchError);
    return;
  }

  console.log("現在の状態:");
  console.log(`  channel_title: ${current.channel_title}`);
  console.log(`  occupation_tags: ${JSON.stringify(current.occupation_tags)}`);

  // 正しいタグに更新（「エンジニア」「会社員」）
  const correctTags = ["エンジニア", "会社員"];

  console.log(`\n→ 更新: ${JSON.stringify(correctTags)}`);

  const { data: updated, error: updateError } = await supabase
    .from("influencers")
    .update({
      occupation_tags: correctTags,
      updated_at: new Date().toISOString(),
    })
    .eq("channel_id", channelId)
    .select()
    .single();

  if (updateError) {
    console.error("更新エラー:", updateError);
    return;
  }

  console.log("\n更新完了!");
  console.log(`  occupation_tags: ${JSON.stringify(updated.occupation_tags)}`);
}

main().catch(console.error);
