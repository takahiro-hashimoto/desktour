import { Metadata } from "next";
import Link from "next/link";
import { getSiteStats, supabase } from "@/lib/supabase";
import { BRAND_TAGS, brandToSlug } from "@/lib/constants";
import { Breadcrumb } from "@/components/Breadcrumb";

export const revalidate = 3600; // 1時間キャッシュ

export const metadata: Metadata = {
  title: "ブランド別商品一覧 | デスクツアーDB",
  description: "FlexiSpot、Logicool、Keychron、HHKBなど人気ブランドの商品をデスクツアーから分析。各ブランドの人気商品やレビューが確認できます。",
};

// ブランドごとのアイコン
const BRAND_ICONS: Record<string, string> = {
  "FlexiSpot": "🪑",
  "COFO": "💺",
  "Logicool": "🖱️",
  "Keychron": "⌨️",
  "HHKB": "⌨️",
  "Herman Miller": "💺",
  "BenQ": "🖥️",
  "DELL": "🖥️",
  "Apple": "🍎",
  "Anker": "🔋",
  "REALFORCE": "⌨️",
  "Razer": "🎮",
  "Elgato": "🎙️",
  "SHURE": "🎤",
  "Audio-Technica": "🎧",
  "Sony": "🎧",
  "LG": "🖥️",
  "Samsung": "📱",
  "IKEA": "🏠",
  "ASUS": "💻",
};

// ブランドごとの説明文
const BRAND_DESCRIPTIONS: Record<string, string> = {
  "FlexiSpot": "電動昇降デスクの人気メーカー。コスパの良いスタンディングデスクが多くのデスクツアーで紹介されている。在宅ワーカーに特に人気。",
  "COFO": "人間工学に基づいたオフィスチェアやデスク周辺機器を展開するブランド。長時間作業でも疲れにくい設計が特徴。",
  "Logicool": "マウス、キーボード、ウェブカメラなど幅広い周辺機器を展開する定番ブランド。MXシリーズが特に人気。",
  "Keychron": "Mac対応のメカニカルキーボードで人気のブランド。ワイヤレスモデルが充実しており、打鍵感にこだわるユーザーに選ばれている。",
  "HHKB": "静電容量無接点方式の高級キーボード。独自のキー配列でプログラマーやライターに愛されている。",
  "Herman Miller": "アーロンチェアで有名な高級オフィス家具メーカー。人間工学に基づいた設計で長時間のデスクワークをサポート。",
  "BenQ": "モニターやモニターライト「ScreenBar」で人気のブランド。目に優しい製品設計が特徴。",
  "DELL": "モニターやPC本体で定番のブランド。ビジネス用途からクリエイター向けまで幅広いラインナップ。",
  "Apple": "MacやiPadなどデスクツアーの定番デバイス。洗練されたデザインでデスク環境を統一できる。",
  "Anker": "充電器やケーブルなどの周辺機器で人気のブランド。高品質でコスパに優れた製品が多い。",
  "REALFORCE": "静電容量無接点方式の高級キーボード。東プレ製の信頼性の高いタイピング体験を提供。",
  "Razer": "ゲーミングデバイスの代表的ブランド。キーボード、マウス、ヘッドセットなど幅広いラインナップ。",
  "Elgato": "配信者向け機材のリーディングブランド。Stream DeckやKey Lightなど配信環境を強化。",
  "SHURE": "プロ品質のマイクで知られる老舗オーディオメーカー。SM7Bは配信者の定番マイク。",
  "Audio-Technica": "ヘッドホンやマイクで人気の日本メーカー。高音質でコスパの良い製品が揃う。",
  "Sony": "ヘッドホンやカメラで人気。WH-1000XMシリーズはノイズキャンセリングの定番。",
  "LG": "モニターやディスプレイで人気のメーカー。ウルトラワイドモニターのラインナップが充実。",
  "Samsung": "モニターやSSDで人気のメーカー。高品質なディスプレイパネルが特徴。",
  "IKEA": "コスパの良いデスクや収納で人気。BEKANT、IDÅSENなど昇降デスクも展開。",
  "ASUS": "モニターやPC本体で人気のメーカー。ゲーミングからクリエイター向けまで幅広い製品。",
};

// ブランドごとのカテゴリタグ
const BRAND_CATEGORIES: Record<string, string[]> = {
  "FlexiSpot": ["デスク", "昇降デスク"],
  "COFO": ["チェア", "デスク"],
  "Logicool": ["マウス", "キーボード", "ウェブカメラ"],
  "Keychron": ["キーボード"],
  "HHKB": ["キーボード"],
  "Herman Miller": ["チェア"],
  "BenQ": ["ディスプレイ/モニター", "照明"],
  "DELL": ["ディスプレイ/モニター", "PC本体"],
  "Apple": ["PC本体", "タブレット"],
  "Anker": ["充電器/電源", "ケーブル"],
  "REALFORCE": ["キーボード"],
  "Razer": ["キーボード", "マウス"],
  "Elgato": ["マイク", "照明"],
  "SHURE": ["マイク"],
  "Audio-Technica": ["ヘッドホン", "マイク"],
  "Sony": ["ヘッドホン", "カメラ"],
  "LG": ["ディスプレイ/モニター"],
  "Samsung": ["ディスプレイ/モニター", "SSD"],
  "IKEA": ["デスク", "収納"],
  "ASUS": ["ディスプレイ/モニター", "PC本体"],
};

interface BrandWithCount {
  brand: string;
  count: number;
}

export default async function BrandIndexPage() {
  const stats = await getSiteStats();

  // DBから人気ブランドと商品数を取得
  const { data: brandCounts } = await supabase
    .from("products")
    .select("brand")
    .not("brand", "is", null);

  // ブランドごとの商品数をカウント
  const brandCountMap = new Map<string, number>();
  for (const item of brandCounts || []) {
    if (item.brand) {
      const normalizedBrand = item.brand.trim();
      brandCountMap.set(normalizedBrand, (brandCountMap.get(normalizedBrand) || 0) + 1);
    }
  }

  // BRAND_TAGSに登録されているブランドの情報を取得
  const registeredBrands: BrandWithCount[] = BRAND_TAGS.map((brand) => ({
    brand,
    count: brandCountMap.get(brand) || 0,
  })).filter((b) => b.count > 0);

  // 商品数でソート（多い順）
  registeredBrands.sort((a, b) => b.count - a.count);

  return (
    <div className="max-w-[1080px] mx-auto px-4 py-12">
      <Breadcrumb items={[{ label: "ブランド別" }]} />

      {/* Hero Section */}
      <div className="text-center mb-16">
        <p className="text-sm text-blue-600 font-medium tracking-wider mb-2">
          DATABASE REPORT
        </p>
        <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
          ブランド別商品一覧
        </h1>
        <p className="text-gray-600 max-w-2xl mx-auto">
          {stats.total_videos}件のデスクツアー動画で紹介されたブランド別の商品一覧。
          各ブランドの人気商品やユーザーレビューを確認できます。
        </p>
      </div>

      {/* Brand Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {registeredBrands.map(({ brand, count }) => (
          <Link
            key={brand}
            href={`/brand/${brandToSlug(brand)}`}
            className="group bg-white border border-gray-200 rounded-xl p-5 hover:border-blue-300 hover:shadow-lg transition-all"
          >
            <div className="flex items-start gap-3">
              <span className="text-2xl">
                {BRAND_ICONS[brand] || "🏷️"}
              </span>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-gray-900 group-hover:text-blue-600 transition-colors">
                  {brand}
                </h3>
                <p className="text-sm text-gray-500 mt-1">
                  {count}件の商品
                </p>
              </div>
            </div>
            {BRAND_CATEGORIES[brand] && (
              <div className="flex flex-wrap gap-1 mt-3">
                {BRAND_CATEGORIES[brand].slice(0, 2).map((cat) => (
                  <span
                    key={cat}
                    className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded"
                  >
                    {cat}
                  </span>
                ))}
              </div>
            )}
            <p className="text-xs text-gray-600 mt-3 line-clamp-2">
              {BRAND_DESCRIPTIONS[brand] || "デスクツアーで紹介された商品一覧"}
            </p>
            <div className="mt-3 flex items-center text-sm text-blue-600 group-hover:text-blue-700">
              詳細を見る
              <svg
                className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </div>
          </Link>
        ))}
      </div>

      {/* FAQ Section */}
      <section className="mt-20 bg-white rounded-lg shadow-sm p-8">
        <h2 className="text-xl font-bold text-gray-900 mb-6">
          よくある質問
        </h2>
        <div className="space-y-6">
          <div>
            <h3 className="font-medium text-gray-900 mb-2">
              ブランド情報はどこから取得していますか？
            </h3>
            <p className="text-gray-600 text-sm">
              デスクツアー動画やブログで紹介された商品の情報を元に、ブランド別に分類しています。
              Amazonの商品情報も参考にしています。
            </p>
          </div>
          <div>
            <h3 className="font-medium text-gray-900 mb-2">
              探しているブランドがない場合はどうすればいいですか？
            </h3>
            <p className="text-gray-600 text-sm">
              商品数が少ないブランドは一覧に表示されていない場合があります。
              カテゴリ別ページから商品を探すことをおすすめします。
            </p>
          </div>
          <div>
            <h3 className="font-medium text-gray-900 mb-2">
              商品数はどのように計算されていますか？
            </h3>
            <p className="text-gray-600 text-sm">
              デスクツアーで紹介された同一ブランドの商品をカウントしています。
              同じ商品が複数の動画で紹介されている場合は1件としてカウントしています。
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
