import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase/client";
import { generateChosenReasons } from "@/lib/gemini";

const MIN_COMMENTS = 10;

/**
 * POST /api/generate-chosen-reasons
 * コメント10件以上の商品に対して「選ばれている理由TOP3」を一括生成
 */
export async function POST() {
  try {
    // 1. 全商品のコメントを集計（product_mentions から reason を取得）
    const { data: products, error: productError } = await supabase
      .from("products")
      .select("id, name, brand");

    if (productError || !products) {
      return NextResponse.json({ error: "商品の取得に失敗しました" }, { status: 500 });
    }

    // 2. 全mentionsを取得（confidence low を除外）
    const { data: mentions, error: mentionError } = await supabase
      .from("product_mentions")
      .select("product_id, reason")
      .neq("confidence", "low");

    if (mentionError || !mentions) {
      return NextResponse.json({ error: "コメントの取得に失敗しました" }, { status: 500 });
    }

    // 3. 商品IDごとにコメントをグループ化
    const commentsByProduct = new Map<string, string[]>();
    for (const m of mentions) {
      if (!m.reason || m.reason.trim() === "") continue;
      const existing = commentsByProduct.get(m.product_id) || [];
      existing.push(m.reason);
      commentsByProduct.set(m.product_id, existing);
    }

    // 4. コメント10件以上の商品を抽出
    const targets = products.filter((p) => {
      const comments = commentsByProduct.get(p.id);
      return comments && comments.length >= MIN_COMMENTS;
    });

    if (targets.length === 0) {
      return NextResponse.json({
        message: `コメント${MIN_COMMENTS}件以上の商品がありません`,
        processed: 0,
        total: 0,
      });
    }

    // 5. 各商品に対してGeminiで要約を生成・保存
    let processed = 0;
    let errors = 0;
    const results: { name: string; reasons: string[]; commentCount: number }[] = [];

    for (const product of targets) {
      const comments = commentsByProduct.get(product.id)!;
      const productName = `${product.brand ? `${product.brand} ` : ""}${product.name}`;

      try {
        const reasons = await generateChosenReasons(productName, comments);

        if (reasons.length > 0) {
          const { error: updateError } = await supabase
            .from("products")
            .update({ chosen_reasons: reasons })
            .eq("id", product.id);

          if (updateError) {
            console.error(`[ChosenReasons] DB update failed for ${productName}:`, updateError);
            errors++;
          } else {
            processed++;
            results.push({ name: productName, reasons, commentCount: comments.length });
          }
        } else {
          errors++;
        }

        // Gemini APIのレート制限対策
        await new Promise((resolve) => setTimeout(resolve, 1000));
      } catch (err) {
        console.error(`[ChosenReasons] Error for ${productName}:`, err);
        errors++;
      }
    }

    return NextResponse.json({
      message: `${processed}件の商品に「選ばれている理由」を生成しました`,
      processed,
      errors,
      total: targets.length,
      results,
    });
  } catch (error) {
    console.error("[ChosenReasons] Unexpected error:", error);
    return NextResponse.json({ error: "予期しないエラーが発生しました" }, { status: 500 });
  }
}
