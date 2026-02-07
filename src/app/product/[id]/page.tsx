import { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Package } from "lucide-react";
import { cache } from "react";
import { getProductDetail, getCoOccurrenceProducts } from "@/lib/supabase";
import { categoryToSlug, occupationToSlug, styleTagToSlug, STYLE_TAGS } from "@/lib/constants";
import { CoUsedProduct } from "@/types";
import { Breadcrumb } from "@/components/Breadcrumb";
import { ProductCommentWithModal } from "@/components/ProductCommentWithModal";
import { resolveImageUrl } from "@/lib/imageUtils";
import { getProductLinks } from "@/lib/affiliateLinks";

// 単位変換ユーティリティ
function convertSize(sizeStr: string): string {
  // インチをcmに変換 (1インチ = 2.54cm)
  return sizeStr.replace(/(\d+\.?\d*)インチ/g, (_, num) => {
    const cm = parseFloat(num) * 2.54;
    return `${cm.toFixed(1)}cm`;
  });
}

function convertWeight(weightStr: string): string {
  // ポンドをgに変換 (1ポンド = 453.592g)
  return weightStr.replace(/(\d+\.?\d*)ポンド/g, (_, num) => {
    const g = parseFloat(num) * 453.592;
    return g >= 1000 ? `${(g / 1000).toFixed(1)}kg` : `${Math.round(g)}g`;
  });
}

function formatReleaseDate(dateStr: string): string {
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr; // パースできない場合はそのまま
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
}

interface PageProps {
  params: { id: string };
}

// 【最適化】React cacheでリクエスト内のデータ取得を重複排除
// generateMetadataとページ本体で同じIDの商品を取得する場合、1回のみDBアクセス
const getCachedProductDetail = cache(async (id: string) => {
  return getProductDetail(id);
});

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const product = await getCachedProductDetail(params.id);

  if (!product) {
    return { title: "商品が見つかりません | セットアップDB" };
  }

  // コメントが3つ未満の商品はnoindexに設定
  const commentsCount = product.all_comments?.length || 0;
  const shouldNoIndex = commentsCount < 3;

  return {
    title: `${product.name}のリアルな口コミ・製品情報まとめ`,
    description: `${product.name}を${product.mention_count}人のデスクツアーで確認。エンジニア・クリエイターの使用者コメントやデスク環境の傾向を紹介。`,
    robots: shouldNoIndex ? { index: false, follow: true } : undefined,
  };
}

export default async function ProductDetailPage({ params }: PageProps) {
  const product = await getCachedProductDetail(params.id);

  if (!product) {
    notFound();
  }

  const coUsedProducts = await getCoOccurrenceProducts(params.id, 4);

  // パーセント計算用の合計
  const totalOccupation = product.occupation_breakdown?.reduce((sum, s) => sum + s.count, 0) || 1;
  const totalSetup = product.desk_setup_stats?.reduce((sum, s) => sum + s.count, 0) || 1;

  // 商品情報があるかチェック
  const hasProductInfo = product.amazon_model_number ||
    product.amazon_manufacturer ||
    product.amazon_brand ||
    product.amazon_color ||
    product.amazon_size ||
    product.amazon_weight ||
    product.amazon_release_date ||
    product.asin;

  // 商品の特徴があるかチェック
  const hasFeatures = product.amazon_features && product.amazon_features.length > 0;

  // セクション番号を動的に計算
  let sectionNumber = 0;
  const hasEnvironmentStats = (product.occupation_breakdown && product.occupation_breakdown.length > 0) ||
    (product.desk_setup_stats && product.desk_setup_stats.length > 0);
  const hasComments = product.all_comments && product.all_comments.length > 0;
  const hasCoUsedProducts = coUsedProducts.length > 0;

  // アフィリエイトリンク生成
  const { amazonUrl, rakutenUrl } = getProductLinks({
    amazon_url: product.amazon_url,
    amazon_model_number: product.amazon_model_number,
    name: product.name,
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-[1080px] mx-auto px-4 py-8">
        <Breadcrumb
          items={[
            { label: product.category, href: `/category/${categoryToSlug(product.category)}` },
            { label: product.name },
          ]}
        />

        {/* Hero Section */}
        <div className="bg-white rounded-xl overflow-hidden mb-12">
          <div className="md:flex">
            {/* Image Section */}
            <div className="md:w-2/5 bg-white p-8 flex items-center justify-center border-r border-gray-100">
              <div className="w-full max-w-xs aspect-square relative">
                {resolveImageUrl(product.amazon_image_url) ? (
                  <a
                    href={amazonUrl}
                    target="_blank"
                    rel="noopener noreferrer sponsored"
                  >
                    <img
                      src={resolveImageUrl(product.amazon_image_url)!}
                      alt={product.name}
                      className="w-full h-full object-contain"
                      loading="eager"
                    />
                  </a>
                ) : (
                  <div className="flex items-center justify-center h-full text-gray-400">
                    <Package className="w-24 h-24" />
                  </div>
                )}
              </div>
            </div>

            {/* Info Section */}
            <div className="md:w-3/5 p-8">
              {/* Page Title (SEO) */}
              <h1 className="text-gray-500 text-sm mb-2">
                {product.name}のリアルな口コミ・製品情報まとめ
              </h1>

              {/* Product Name */}
              <p className="text-2xl lg:text-3xl font-bold text-gray-900 mb-6">
                {product.name}
              </p>

              {/* Stats Row */}
              <div className="border-t border-gray-200 pt-6">
                <div className="flex items-start gap-8 flex-wrap">
                  <div>
                    <p className="text-xs text-gray-500 tracking-wide mb-1">使用人数</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {product.mention_count}<span className="text-sm font-normal text-gray-500">人</span>
                    </p>
                  </div>

                  {product.category_rank && (
                    <div className="border-l border-gray-200 pl-8">
                      <p className="text-xs text-gray-500 tracking-wide mb-1">ランキング</p>
                      <p className="text-2xl font-bold text-gray-900">
                        #{product.category_rank} <span className="text-sm font-normal text-gray-500">{product.category}内</span>
                      </p>
                      <Link
                        href={`/category/${categoryToSlug(product.category)}`}
                        className="text-xs text-blue-500 hover:underline"
                      >
                        {product.category}のおすすめを見る →
                      </Link>
                    </div>
                  )}

                  {product.amazon_price && (
                    <div className="border-l border-gray-200 pl-8">
                      <p className="text-xs text-gray-500 tracking-wide mb-1">参考価格</p>
                      <p className="text-2xl font-bold text-orange-600">
                        ¥{product.amazon_price.toLocaleString()}
                      </p>
                      {product.updated_at && (
                        <time dateTime={product.updated_at} className="text-xs text-gray-400">
                          {new Date(product.updated_at).toLocaleString("ja-JP", {
                            year: "numeric",
                            month: "2-digit",
                            day: "2-digit",
                            hour: "2-digit",
                            minute: "2-digit"
                          }).replace(/\//g, ".")}取得
                        </time>
                      )}
                    </div>
                  )}

                  {product.updated_at && (
                    <div className="border-l border-gray-200 pl-8">
                      <p className="text-xs text-gray-500 tracking-wide mb-1">最終更新</p>
                      <time dateTime={product.updated_at} className="text-lg font-medium text-gray-900">
                        {new Date(product.updated_at).toLocaleDateString("ja-JP", {
                          year: "numeric",
                          month: "2-digit",
                          day: "2-digit"
                        }).replace(/\//g, ".")}
                      </time>
                    </div>
                  )}
                </div>

                {/* Hero CTA Buttons */}
                <div className="flex flex-wrap gap-3 mt-6">
                  <a
                    href={amazonUrl}
                    target="_blank"
                    rel="noopener noreferrer sponsored"
                    className="inline-flex items-center gap-2 bg-white border border-gray-200 hover:border-gray-300 text-gray-700 py-2 px-4 rounded-lg text-sm font-medium transition-colors"
                  >
                    <span className="text-orange-500 font-bold">a</span>
                    Amazonで見る
                  </a>
                  <a
                    href={rakutenUrl}
                    target="_blank"
                    rel="noopener noreferrer sponsored"
                    className="inline-flex items-center gap-2 bg-white border border-gray-200 hover:border-gray-300 text-gray-700 py-2 px-4 rounded-lg text-sm font-medium transition-colors"
                  >
                    <span className="text-red-500 font-bold">R</span>
                    楽天で見る
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="space-y-12">
          {/* Section 01: Product Features - 特徴がある場合のみ表示（最初に配置） */}
          {hasFeatures && (
            <section>
              {/* Section Header */}
              <div className="flex items-center gap-3 mb-6">
                <span className="text-blue-600 font-bold">01</span>
                <h2 className="text-lg font-bold text-gray-900">
                  {product.name}の特徴
                </h2>
              </div>

              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <ul className="space-y-3">
                  {product.amazon_features!.map((feature, index) => (
                    <li key={index} className="flex gap-3 text-sm text-gray-700">
                      <span className="text-blue-500 flex-shrink-0">•</span>
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          )}

          {/* Section: User Environment */}
          {((product.occupation_breakdown && product.occupation_breakdown.length > 0) ||
            (product.desk_setup_stats && product.desk_setup_stats.length > 0)) && (
            <section>
              {/* Section Header */}
              <div className="flex items-center gap-3 mb-6">
                <span className="text-blue-600 font-bold">
                  {String(1 + (hasFeatures ? 1 : 0)).padStart(2, '0')}
                </span>
                <h2 className="text-lg font-bold text-gray-900">
                  {product.name}が登場しているデスク環境の傾向
                </h2>
              </div>

              {/* Stats Cards */}
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <div className="grid md:grid-cols-3 gap-8">
                  {/* Occupation Stats - リンク付き */}
                  {product.occupation_breakdown && product.occupation_breakdown.length > 0 && (
                    <div>
                      <p className="text-sm text-gray-500 mb-4 text-center">職種分布 (Occupation)</p>
                      <div className="space-y-3">
                        {product.occupation_breakdown.slice(0, 3).map((stat) => {
                          const percentage = Math.round((stat.count / totalOccupation) * 100);
                          return (
                            <Link
                              key={stat.occupation_tag}
                              href={`/occupation/${occupationToSlug(stat.occupation_tag)}`}
                              className="flex items-center gap-3 hover:bg-gray-50 rounded -mx-2 px-2 py-1 transition-colors"
                            >
                              <span className="text-sm text-gray-700 w-20 truncate hover:text-blue-600">{stat.occupation_tag}</span>
                              <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-blue-500 rounded-full"
                                  style={{ width: `${percentage}%` }}
                                />
                              </div>
                              <span className="text-sm text-gray-500 w-10 text-right">{percentage}%</span>
                            </Link>
                          );
                        })}
                      </div>
                      <p className="text-xs text-gray-400 mt-3 text-center">
                        {totalOccupation}人が使用
                      </p>
                    </div>
                  )}

                  {/* Work Style Stats - スタイルタグのみリンク、他はプレーンテキスト */}
                  {product.desk_setup_stats && product.desk_setup_stats.length > 0 && (
                    <div>
                      <p className="text-sm text-gray-500 mb-4 text-center">作業スタイル (Work Style)</p>
                      <div className="space-y-3">
                        {product.desk_setup_stats.slice(0, 3).map((stat) => {
                          const percentage = Math.round((stat.count / totalSetup) * 100);
                          const isStyleTag = STYLE_TAGS.includes(stat.setup_tag as typeof STYLE_TAGS[number]);
                          const content = (
                            <>
                              <span className={`text-sm text-gray-700 w-20 truncate ${isStyleTag ? 'hover:text-blue-600' : ''}`}>{stat.setup_tag}</span>
                              <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-blue-500 rounded-full"
                                  style={{ width: `${percentage}%` }}
                                />
                              </div>
                              <span className="text-sm text-gray-500 w-10 text-right">{percentage}%</span>
                            </>
                          );
                          return isStyleTag ? (
                            <Link
                              key={stat.setup_tag}
                              href={`/style/${styleTagToSlug(stat.setup_tag)}`}
                              className="flex items-center gap-3 hover:bg-gray-50 rounded -mx-2 px-2 py-1 transition-colors"
                            >
                              {content}
                            </Link>
                          ) : (
                            <div
                              key={stat.setup_tag}
                              className="flex items-center gap-3 rounded -mx-2 px-2 py-1"
                            >
                              {content}
                            </div>
                          );
                        })}
                      </div>
                      <p className="text-xs text-gray-400 mt-3 text-center">
                        {totalSetup}人が使用
                      </p>
                    </div>
                  )}

                  {/* Features Tags - スタイルタグのみリンク */}
                  {product.desk_setup_stats && product.desk_setup_stats.length > 0 && (
                    <div>
                      <p className="text-sm text-gray-500 mb-4 text-center">デスク全体の特徴 (Features)</p>
                      <div className="flex flex-wrap gap-2 justify-center">
                        {product.desk_setup_stats.slice(0, 6).map((stat) => {
                          const isStyleTag = STYLE_TAGS.includes(stat.setup_tag as typeof STYLE_TAGS[number]);
                          return isStyleTag ? (
                            <Link
                              key={stat.setup_tag}
                              href={`/style/${styleTagToSlug(stat.setup_tag)}`}
                              className="px-3 py-1 text-sm text-gray-600 border border-gray-200 rounded-full hover:border-blue-300 hover:text-blue-600 transition-colors"
                            >
                              #{stat.setup_tag}
                            </Link>
                          ) : (
                            <span
                              key={stat.setup_tag}
                              className="px-3 py-1 text-sm text-gray-600 border border-gray-200 rounded-full"
                            >
                              #{stat.setup_tag}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </section>
          )}

          {/* Section: User Comments */}
          {product.all_comments && product.all_comments.length > 0 && (
            <section>
              {/* Section Header */}
              <div className="flex items-center gap-3 mb-6">
                <span className="text-blue-600 font-bold">
                  {String(1 + (hasFeatures ? 1 : 0) + (hasEnvironmentStats ? 1 : 0)).padStart(2, '0')}
                </span>
                <h2 className="text-lg font-bold text-gray-900">
                  {product.name}を使用しているユーザーのコメント
                </h2>
              </div>

              <ProductCommentWithModal comments={product.all_comments} productId={product.id} />
            </section>
          )}

          {/* Section: Co-used Products */}
          {coUsedProducts.length > 0 && (
            <section>
              {/* Section Header */}
              <div className="flex items-center gap-3 mb-6">
                <span className="text-blue-600 font-bold">
                  {String(1 + (hasFeatures ? 1 : 0) + (hasEnvironmentStats ? 1 : 0) + (hasComments ? 1 : 0)).padStart(2, '0')}
                </span>
                <h2 className="text-lg font-bold text-gray-900">
                  {product.name}と一緒に使われている周辺機器
                </h2>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                {coUsedProducts.map((coProduct) => (
                  <CoUsedProductCard key={coProduct.id} product={coProduct} />
                ))}
              </div>
            </section>
          )}

          {/* Section: Product Info - 情報がある場合のみ表示 */}
          {hasProductInfo && (
            <section>
              {/* Section Header */}
              <div className="flex items-center gap-3 mb-6">
                <span className="text-blue-600 font-bold">
                  {String(1 + (hasFeatures ? 1 : 0) + (hasEnvironmentStats ? 1 : 0) + (hasComments ? 1 : 0) + (hasCoUsedProducts ? 1 : 0)).padStart(2, '0')}
                </span>
                <h2 className="text-lg font-bold text-gray-900">
                  {product.name}の基本情報
                </h2>
              </div>

              <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <tbody>
                    {product.amazon_model_number && (
                      <tr className="border-b border-gray-100">
                        <td className="py-4 px-6 text-gray-500 bg-gray-50 w-1/4">型番</td>
                        <td className="py-4 px-6 text-gray-900">{product.amazon_model_number}</td>
                      </tr>
                    )}
                    {product.amazon_manufacturer && (
                      <tr className="border-b border-gray-100">
                        <td className="py-4 px-6 text-gray-500 bg-gray-50">メーカー</td>
                        <td className="py-4 px-6 text-gray-900">{product.amazon_manufacturer}</td>
                      </tr>
                    )}
                    {product.amazon_brand && (
                      <tr className="border-b border-gray-100">
                        <td className="py-4 px-6 text-gray-500 bg-gray-50">ブランド</td>
                        <td className="py-4 px-6 text-gray-900">{product.amazon_brand}</td>
                      </tr>
                    )}
                    {product.amazon_color && (
                      <tr className="border-b border-gray-100">
                        <td className="py-4 px-6 text-gray-500 bg-gray-50">カラー</td>
                        <td className="py-4 px-6 text-gray-900">{product.amazon_color}</td>
                      </tr>
                    )}
                    {product.amazon_size && (
                      <tr className="border-b border-gray-100">
                        <td className="py-4 px-6 text-gray-500 bg-gray-50">サイズ</td>
                        <td className="py-4 px-6 text-gray-900">{convertSize(product.amazon_size)}</td>
                      </tr>
                    )}
                    {product.amazon_weight && (
                      <tr className="border-b border-gray-100">
                        <td className="py-4 px-6 text-gray-500 bg-gray-50">重量</td>
                        <td className="py-4 px-6 text-gray-900">{convertWeight(product.amazon_weight)}</td>
                      </tr>
                    )}
                    {product.amazon_release_date && (
                      <tr className="border-b border-gray-100">
                        <td className="py-4 px-6 text-gray-500 bg-gray-50">発売日</td>
                        <td className="py-4 px-6 text-gray-900">{formatReleaseDate(product.amazon_release_date)}</td>
                      </tr>
                    )}
                    {product.asin && (
                      <tr>
                        <td className="py-4 px-6 text-gray-500 bg-gray-50">ASIN</td>
                        <td className="py-4 px-6 text-gray-900 font-mono text-xs">{product.asin}</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* CTA Section */}
          <section className="bg-gray-100 rounded-xl p-8">
            <div className="text-center">
              <h3 className="font-bold text-gray-900 mb-6">販売・在庫状況</h3>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <a
                  href={amazonUrl}
                  target="_blank"
                  rel="noopener noreferrer sponsored"
                  className="inline-flex items-center justify-center gap-2 bg-white border border-gray-200 hover:border-gray-300 text-gray-700 py-3 px-6 rounded-lg font-medium transition-colors min-w-[240px]"
                >
                  <span className="text-orange-500 font-bold">a</span>
                  Amazonで現在の価格を見る
                </a>
                <a
                  href={rakutenUrl}
                  target="_blank"
                  rel="noopener noreferrer sponsored"
                  className="inline-flex items-center justify-center gap-2 bg-white border border-gray-200 hover:border-gray-300 text-gray-700 py-3 px-6 rounded-lg font-medium transition-colors min-w-[240px]"
                >
                  <span className="text-red-500 font-bold">R</span>
                  楽天で在庫を確認する
                </a>
              </div>
            </div>
          </section>
        </div>

        {/* Footer */}
        <footer className="mt-16 pt-8 border-t border-gray-200 text-center">
          <p className="text-sm text-gray-400">
            © 2026 DIGISTA. Desk Setup Database.
          </p>
        </footer>
      </div>
    </div>
  );
}

function CoUsedProductCard({ product }: { product: CoUsedProduct & { amazon_url?: string; category?: string } }) {
  return (
    <Link
      href={`/product/${product.id}`}
      className="flex gap-4 p-4 bg-white border border-gray-200 rounded-lg hover:border-blue-300 transition-colors"
    >
      {/* Image */}
      <div className="flex-shrink-0 w-12 h-12 bg-gray-100 rounded overflow-hidden">
        {resolveImageUrl(product.amazon_image_url) ? (
          <img
            src={resolveImageUrl(product.amazon_image_url)!}
            alt={product.name}
            className="w-full h-full object-contain"
            loading="lazy"
          />
        ) : (
          <div className="flex items-center justify-center h-full text-gray-400">
            <Package className="w-6 h-6" />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-xs text-gray-500 uppercase tracking-wide mb-0.5">
          {product.category || "PERIPHERAL"}
        </p>
        <h4 className="text-sm font-medium text-gray-900 truncate">
          {product.name}
        </h4>
        <p className="text-xs text-blue-600 mt-1">
          {product.co_occurrence_count}人が使用
        </p>
      </div>
    </Link>
  );
}
