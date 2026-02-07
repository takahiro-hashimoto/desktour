/**
 * 既存商品データにnormalized_nameを付与するマイグレーションスクリプト
 *
 * 実行方法: node scripts/migrate-normalize-names.mjs
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
  console.error(
    "Error: SUPABASE_URL or SUPABASE_ANON_KEY not found in .env.local"
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// ========================================
// 正規化関数（product-normalize.tsと同一）
// ========================================
const COLOR_PATTERNS = [
  "ブラック",
  "ホワイト",
  "グレー",
  "グレイ",
  "シルバー",
  "ゴールド",
  "レッド",
  "ブルー",
  "グリーン",
  "イエロー",
  "オレンジ",
  "ピンク",
  "パープル",
  "ネイビー",
  "ベージュ",
  "ブラウン",
  "黒",
  "白",
  "灰",
  "銀",
  "金",
  "赤",
  "青",
  "緑",
  "黄",
  "墨",
  "スノー",
  "ミッドナイト",
  "チャコール",
  "アイボリー",
  "クリア",
  "透明",
  "Black",
  "White",
  "Gray",
  "Grey",
  "Silver",
  "Gold",
  "Red",
  "Blue",
  "Green",
  "Yellow",
  "Orange",
  "Pink",
  "Purple",
  "Navy",
  "Beige",
  "Brown",
  "Midnight",
  "Snow",
  "Space Gray",
  "Space Grey",
  "Graphite",
  "Charcoal",
  "Ivory",
  "Clear",
  "Rose Gold",
  "Starlight",
];

const SIZE_PATTERNS = [
  "XXS",
  "XS",
  "XXL",
  "XL",
  "Small",
  "Medium",
  "Large",
  "ミニ",
  "レギュラー",
  "コンパクト",
  "ラージ",
  "スモール",
];

const SIZE_SUFFIX_PATTERN = /[\s\-\/]([SML])(?:\s|$|[\)\]】」])/gi;

function normalizeProductName(name) {
  let normalized = name;

  normalized = normalized.replace(/　/g, " ");

  const bracketPatterns = [
    /\(([^)]*)\)/g,
    /\[([^\]]*)\]/g,
    /【([^】]*)】/g,
    /「([^」]*)」/g,
    /（([^）]*)）/g,
  ];

  for (const pattern of bracketPatterns) {
    normalized = normalized.replace(pattern, (match, inner) => {
      const innerTrimmed = inner.trim();
      const isColorOrSize =
        COLOR_PATTERNS.some(
          (c) => c.toLowerCase() === innerTrimmed.toLowerCase()
        ) ||
        SIZE_PATTERNS.some(
          (s) => s.toLowerCase() === innerTrimmed.toLowerCase()
        ) ||
        /^[SML]$/i.test(innerTrimmed);

      return isColorOrSize ? "" : match;
    });
  }

  normalized = normalized.replace(/[カラーColor]+[\s]*[:：][\s]*\S+/gi, "");

  for (const color of COLOR_PATTERNS) {
    const escapedColor = color.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const colorRegex = new RegExp(
      `[\\s\\-\\/]${escapedColor}(?=[\\s\\-\\/]|$)|^${escapedColor}[\\s\\-\\/]`,
      "gi"
    );
    normalized = normalized.replace(colorRegex, " ");
  }

  for (const size of SIZE_PATTERNS) {
    const escapedSize = size.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const sizeRegex = new RegExp(
      `[\\s\\-\\/]${escapedSize}(?=[\\s\\-\\/]|$)|^${escapedSize}[\\s\\-\\/]`,
      "gi"
    );
    normalized = normalized.replace(sizeRegex, " ");
  }

  normalized = normalized.replace(SIZE_SUFFIX_PATTERN, " ");
  normalized = normalized.replace(/[\s\-\/]+/g, " ");
  normalized = normalized.trim();
  normalized = normalized.replace(/[\s\-\/]+$/, "");

  return normalized;
}

// ========================================
// マイグレーション処理
// ========================================
async function main() {
  console.log("=== 商品名正規化マイグレーション ===\n");

  // 全商品を取得
  const { data: products, error: fetchError } = await supabase
    .from("products")
    .select("id, name, normalized_name")
    .order("created_at", { ascending: true });

  if (fetchError) {
    console.error("取得エラー:", fetchError);
    return;
  }

  console.log(`対象商品数: ${products.length}\n`);

  // 正規化名がnullの商品のみ更新
  const toUpdate = products.filter((p) => !p.normalized_name);
  console.log(`更新対象: ${toUpdate.length} 件\n`);

  if (toUpdate.length === 0) {
    console.log("更新対象がありません。");
    return;
  }

  // 正規化名の重複をチェック（統合候補の確認）
  const normalizedMap = new Map();
  for (const product of products) {
    const normalized = normalizeProductName(product.name);
    if (!normalizedMap.has(normalized)) {
      normalizedMap.set(normalized, []);
    }
    normalizedMap.get(normalized).push(product.name);
  }

  // 統合候補を表示
  console.log("=== 統合候補（同じ正規化名の商品） ===\n");
  let mergeCount = 0;
  for (const [normalized, names] of normalizedMap.entries()) {
    if (names.length > 1) {
      mergeCount++;
      console.log(`[${normalized}]`);
      for (const name of names) {
        console.log(`  - ${name}`);
      }
      console.log();
    }
  }

  if (mergeCount === 0) {
    console.log("統合候補はありません。\n");
  } else {
    console.log(`統合候補: ${mergeCount} グループ\n`);
  }

  // 更新実行
  console.log("=== 正規化名を更新中... ===\n");
  let updated = 0;
  let errors = 0;

  for (const product of toUpdate) {
    const normalized = normalizeProductName(product.name);

    const { error: updateError } = await supabase
      .from("products")
      .update({ normalized_name: normalized })
      .eq("id", product.id);

    if (updateError) {
      console.error(`エラー [${product.name}]:`, updateError);
      errors++;
    } else {
      if (normalized !== product.name) {
        console.log(`✓ "${product.name}" → "${normalized}"`);
      }
      updated++;
    }
  }

  console.log(`\n=== 完了 ===`);
  console.log(`更新成功: ${updated} 件`);
  console.log(`エラー: ${errors} 件`);
}

main().catch(console.error);
