import * as cheerio from "cheerio";

export interface OGPData {
  title?: string;
  description?: string;
  image?: string;
  siteName?: string;
  url?: string;
  type?: string;
}

/**
 * URLからOGPメタタグを取得する
 * @param url 取得対象のURL
 * @param timeout タイムアウト（ミリ秒）デフォルト5000ms
 */
export async function fetchOGP(url: string, timeout = 5000): Promise<OGPData | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        // より本物のブラウザに見せるUser-Agent
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
        "Accept-Language": "ja,en-US;q=0.9,en;q=0.8",
        "Accept-Encoding": "gzip, deflate, br",
        "Cache-Control": "no-cache",
        "Pragma": "no-cache",
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "none",
        "Sec-Fetch-User": "?1",
        "Upgrade-Insecure-Requests": "1",
      },
      redirect: "follow",
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.warn(`OGP fetch failed for ${url}: ${response.status}`);
      return null;
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    const ogp: OGPData = {};

    // OGPメタタグを取得
    ogp.title = $('meta[property="og:title"]').attr("content") ||
      $('meta[name="og:title"]').attr("content") ||
      $("title").text() ||
      undefined;

    ogp.description = $('meta[property="og:description"]').attr("content") ||
      $('meta[name="description"]').attr("content") ||
      undefined;

    ogp.image = $('meta[property="og:image"]').attr("content") ||
      $('meta[name="og:image"]').attr("content") ||
      $('meta[name="twitter:image"]').attr("content") ||
      $('meta[property="twitter:image"]').attr("content") ||
      undefined;

    ogp.siteName = $('meta[property="og:site_name"]').attr("content") ||
      undefined;

    ogp.url = $('meta[property="og:url"]').attr("content") ||
      url;

    ogp.type = $('meta[property="og:type"]').attr("content") ||
      undefined;

    // 相対URLを絶対URLに変換
    if (ogp.image && !ogp.image.startsWith("http")) {
      try {
        const baseUrl = new URL(url);
        ogp.image = new URL(ogp.image, baseUrl.origin).href;
      } catch {
        // URL変換に失敗した場合はそのまま
      }
    }

    // 最低限titleかimageがあれば有効とみなす
    if (ogp.title || ogp.image) {
      return ogp;
    }

    return null;
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === "AbortError") {
        console.warn(`OGP fetch timeout for ${url}`);
      } else {
        console.warn(`OGP fetch error for ${url}: ${error.message}`);
      }
    }
    return null;
  }
}

/**
 * URLが商品ページらしいかどうかを判定する
 */
export function isProductPageUrl(url: string): boolean {
  const productPathPatterns = [
    /\/products?\//i,
    /\/items?\//i,
    /\/shop\//i,
    /\/store\//i,
    /\/goods\//i,
    /\/detail\//i,
    /\/catalog\//i,
    /\/(jp|ja)\//i,  // 日本語ページ
  ];

  try {
    const parsedUrl = new URL(url);
    const path = parsedUrl.pathname + parsedUrl.search;

    return productPathPatterns.some(pattern => pattern.test(path));
  } catch {
    return false;
  }
}

/**
 * 短縮URLサービスかどうかを判定する
 */
export function isShortUrlService(url: string): boolean {
  const shortUrlDomains = [
    "bit.ly",
    "t.co",
    "tinyurl.com",
    "goo.gl",
    "ow.ly",
    "is.gd",
    "buff.ly",
  ];

  try {
    const parsedUrl = new URL(url);
    const hostname = parsedUrl.hostname.replace(/^www\./, "");

    return shortUrlDomains.some(domain =>
      hostname === domain || hostname.endsWith(`.${domain}`)
    );
  } catch {
    return false;
  }
}

/**
 * 除外すべきドメインかどうかを判定する（SNS、動画サイト等）
 */
export function isExcludedDomain(url: string): boolean {
  const excludedDomains = [
    // SNS
    "youtube.com",
    "youtu.be",
    "twitter.com",
    "x.com",
    "instagram.com",
    "facebook.com",
    "tiktok.com",
    "linkedin.com",
    "threads.net",
    // 動画・配信
    "twitch.tv",
    "nicovideo.jp",
    "bilibili.com",
    // ブログ・メディア
    "note.com",
    "medium.com",
    "qiita.com",
    "zenn.dev",
    // EC（既存の処理で対応）
    "amazon.co.jp",
    "amazon.com",
    "amzn.to",
    "amzn.asia",
    "rakuten.co.jp",
    "a.r10.to",
    // その他
    "google.com",
  ];

  try {
    const parsedUrl = new URL(url);
    const hostname = parsedUrl.hostname.replace(/^www\./, "");

    return excludedDomains.some(domain =>
      hostname === domain || hostname.endsWith(`.${domain}`)
    );
  } catch {
    return true; // パースに失敗したら除外
  }
}

/**
 * URLからドメイン名を抽出する
 */
export function extractDomain(url: string): string {
  try {
    const parsedUrl = new URL(url);
    return parsedUrl.hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

/**
 * 公式サイトリンクから商品情報を取得する
 */
export interface OfficialProductInfo {
  url: string;
  title?: string;
  image?: string;
  domain: string;
  siteName?: string;
}

/**
 * 有名ブランドのドメイン→ブランド名マッピング
 */
const BRAND_DOMAIN_MAP: Record<string, string> = {
  "grovemade.com": "Grovemade",
  "apple.com": "Apple",
  "vitra.com": "Vitra",
  "hermanmiller.com": "Herman Miller",
  "louispoulsen.com": "Louis Poulsen",
  "steelcase.com": "Steelcase",
  "sony.com": "Sony",
  "sony.jp": "Sony",
  "logitech.com": "Logitech",
  "logicool.co.jp": "Logicool",
  "razer.com": "Razer",
  "corsair.com": "Corsair",
  "keychron.com": "Keychron",
  "hhkeyboard.us": "HHKB",
  "happyhackingkb.com": "HHKB",
  "realforce.co.jp": "REALFORCE",
  "benq.com": "BenQ",
  "dell.com": "Dell",
  "lg.com": "LG",
  "samsung.com": "Samsung",
  "elgato.com": "Elgato",
  "rode.com": "RØDE",
  "shure.com": "Shure",
  "audio-technica.com": "Audio-Technica",
  "sennheiser.com": "Sennheiser",
  "bose.com": "Bose",
  "secretlab.co": "Secretlab",
  "hermanmiller.co.jp": "Herman Miller",
  "ergotron.com": "Ergotron",
  "autonomous.ai": "Autonomous",
  "flexispot.com": "FlexiSpot",
  "flexispot.jp": "FlexiSpot",
  "oakywood.shop": "Oakywood",
  "upliftdesk.com": "UPLIFT Desk",
  "branch.co": "Branch",
  "opalcamera.com": "Opal",
  "anker.com": "Anker",
  "belkin.com": "Belkin",
  "caldigit.com": "CalDigit",
  "twelve-south.com": "Twelve South",
};

/**
 * URLパスから商品名を抽出する
 * 例: /product/wood-standing-desk/ → "Wood Standing Desk"
 */
export function extractProductNameFromUrl(url: string): string | null {
  try {
    const parsedUrl = new URL(url);
    const path = parsedUrl.pathname;

    // 商品パス部分を抽出するパターン
    const productPathPatterns = [
      /\/products?\/([^/?#]+)/i,
      /\/items?\/([^/?#]+)/i,
      /\/shop\/([^/?#]+)/i,
      /\/store\/([^/?#]+)/i,
      /\/goods\/([^/?#]+)/i,
      /\/detail\/([^/?#]+)/i,
      /\/p\/([^/?#]+)/i,
    ];

    for (const pattern of productPathPatterns) {
      const match = path.match(pattern);
      if (match && match[1]) {
        // スラッグを人間が読める形式に変換
        // wood-standing-desk → Wood Standing Desk
        const slug = match[1];
        const productName = slug
          .replace(/-/g, " ")
          .replace(/_/g, " ")
          .replace(/\s+/g, " ")
          .trim()
          .split(" ")
          .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
          .join(" ");

        if (productName.length > 2) {
          return productName;
        }
      }
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * ドメインからブランド名を取得する
 */
export function getBrandFromDomain(domain: string): string | null {
  // 完全一致チェック
  if (BRAND_DOMAIN_MAP[domain]) {
    return BRAND_DOMAIN_MAP[domain];
  }

  // サブドメインを除去して再チェック
  const parts = domain.split(".");
  if (parts.length > 2) {
    const mainDomain = parts.slice(-2).join(".");
    if (BRAND_DOMAIN_MAP[mainDomain]) {
      return BRAND_DOMAIN_MAP[mainDomain];
    }
  }

  // ドメイン名からブランド名を推測（例: grovemade.com → Grovemade）
  const domainName = parts[parts.length - 2];
  if (domainName && domainName.length > 2) {
    return domainName.charAt(0).toUpperCase() + domainName.slice(1);
  }

  return null;
}

/**
 * URLから商品情報を抽出する（OGP取得失敗時のフォールバック）
 */
export function extractProductInfoFromUrl(url: string): OfficialProductInfo | null {
  try {
    const domain = extractDomain(url);
    if (!domain) return null;

    const productName = extractProductNameFromUrl(url);
    const brandName = getBrandFromDomain(domain);

    // 商品名またはブランド名が取得できた場合のみ有効
    if (productName || brandName) {
      // タイトルを構築：「商品名 | ブランド名」または「ブランド名」
      let title: string;
      if (productName && brandName) {
        title = `${productName} | ${brandName}`;
      } else if (productName) {
        title = productName;
      } else {
        title = brandName!;
      }

      return {
        url,
        title,
        domain,
        siteName: brandName || undefined,
        // 画像はOGPからしか取得できないのでundefined
        image: undefined,
      };
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * 短縮URLを展開する
 */
export async function expandShortUrl(shortUrl: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(shortUrl, {
      method: "HEAD",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; SetupDB/1.0)",
      },
    });

    clearTimeout(timeoutId);

    // 最終的なURLを返す
    return response.url;
  } catch (error) {
    console.log(`[OGP] Failed to expand URL: ${shortUrl}`);
    return null;
  }
}

export async function fetchOfficialProductInfo(url: string): Promise<OfficialProductInfo | null> {
  let targetUrl = url;
  let finalDomain = extractDomain(url);

  // 短縮URLの場合は展開する
  if (isShortUrlService(url)) {
    console.log(`[OGP] Expanding short URL: ${url}`);
    const expandedUrl = await expandShortUrl(url);
    if (expandedUrl) {
      targetUrl = expandedUrl;
      finalDomain = extractDomain(expandedUrl);
      console.log(`[OGP] Expanded to: ${targetUrl}`);
    } else {
      return null;
    }
  }

  // 除外ドメインチェック（展開後のURLで判定）
  if (isExcludedDomain(targetUrl)) {
    return null;
  }

  if (!finalDomain) {
    return null;
  }

  // まずOGP取得を試みる
  const ogp = await fetchOGP(targetUrl);

  if (ogp) {
    // OGP取得成功
    return {
      url: targetUrl,
      title: ogp.title,
      image: ogp.image,
      domain: finalDomain,
      siteName: ogp.siteName,
    };
  }

  // OGP取得失敗時はURLパターンから商品情報を抽出（フォールバック）
  console.log(`[OGP] Falling back to URL pattern extraction for: ${targetUrl}`);
  const fallbackInfo = extractProductInfoFromUrl(targetUrl);

  if (fallbackInfo) {
    console.log(`[OGP] Extracted from URL: ${fallbackInfo.title}`);
    return {
      ...fallbackInfo,
      url: targetUrl, // 展開後のURLを使用
    };
  }

  return null;
}
