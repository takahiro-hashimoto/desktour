/**
 * Amazon/楽天APIでの自動取得を除外するブランド設定
 * これらのブランドの商品は手動でリンクと画像を入力する
 */

export interface ExcludedBrand {
  /** ブランド名（表示用） */
  name: string;
  /** 公式サイトのドメイン */
  domains: string[];
  /** 商品名に含まれるキーワード（部分一致） */
  keywords: string[];
  /** 除外理由（コメント用） */
  reason: string;
}

/**
 * 除外ブランドリスト
 * ここに追加されたブランドはAmazon/楽天APIでの検索対象から除外される
 */
export const EXCLUDED_BRANDS: ExcludedBrand[] = [
  {
    name: "Grovemade",
    domains: ["grovemade.com"],
    keywords: ["grovemade", "grove made"],
    reason: "公式サイト専売。ボット対策でOGP取得不可。手動でリンク・画像を設定。",
  },
  {
    name: "PREDUCTS",
    domains: ["preducts.jp"],
    keywords: ["preducts"],
    reason: "公式サイト専売。Amazon/楽天取り扱いなし。",
  },
  {
    name: "WAAK",
    domains: ["waak.space"],
    keywords: ["waak", "ワアク"],
    reason: "公式サイト専売。Amazon/楽天取り扱いなし。",
  },
];

/**
 * 商品名が除外ブランドに該当するかチェック
 */
export function isExcludedBrand(productName: string): ExcludedBrand | null {
  const lowerName = productName.toLowerCase();

  for (const brand of EXCLUDED_BRANDS) {
    for (const keyword of brand.keywords) {
      if (lowerName.includes(keyword.toLowerCase())) {
        return brand;
      }
    }
  }

  return null;
}

/**
 * URLが除外ブランドの公式サイトかチェック
 */
export function isExcludedBrandDomain(url: string): ExcludedBrand | null {
  try {
    const parsedUrl = new URL(url);
    const hostname = parsedUrl.hostname.replace(/^www\./, "");

    for (const brand of EXCLUDED_BRANDS) {
      for (const domain of brand.domains) {
        if (hostname === domain || hostname.endsWith(`.${domain}`)) {
          return brand;
        }
      }
    }
  } catch {
    // URLパースエラーは無視
  }

  return null;
}

/**
 * 除外ブランド名のリストを取得
 */
export function getExcludedBrandNames(): string[] {
  return EXCLUDED_BRANDS.map(brand => brand.name);
}
