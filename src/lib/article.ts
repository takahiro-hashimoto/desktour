import * as cheerio from "cheerio";
import { getBrandFromDomain } from "./ogp";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyNode = any;

export type ArticleSourceType = "note" | "blog" | "official" | "other";

export interface ArticleInfo {
  url: string;
  title: string;
  author: string | null;
  authorUrl: string | null;
  publishedAt: string | null;
  thumbnailUrl: string | null;
  content: string;
  sourceType: ArticleSourceType;
  siteName: string | null;
  productLinks: string[];  // 記事内のEC系リンク（Amazon、楽天など）
}

// URLからソースタイプを判定
function detectSourceType(url: string): ArticleSourceType {
  const urlLower = url.toLowerCase();
  if (urlLower.includes("note.com") || urlLower.includes("note.mu")) {
    return "note";
  }
  // 一般的なブログサービス
  if (
    urlLower.includes("zenn.dev") ||
    urlLower.includes("qiita.com") ||
    urlLower.includes("hatena") ||
    urlLower.includes("ameblo.jp") ||
    urlLower.includes("livedoor") ||
    urlLower.includes("fc2.com") ||
    urlLower.includes("medium.com") ||
    urlLower.includes("substack.com")
  ) {
    return "blog";
  }
  // メーカー公式サイト（BRAND_DOMAIN_MAPに登録されているドメイン）
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, "");
    if (getBrandFromDomain(hostname)) {
      return "official";
    }
  } catch {
    // URL解析失敗時はスキップ
  }
  return "other";
}

// HTML要素をマークダウン風テキストに変換（リンク情報を保持）
function htmlToMarkdown($: cheerio.CheerioAPI, element: cheerio.Cheerio<AnyNode>): string {
  const lines: string[] = [];

  function processNode(node: AnyNode): string {
    if (node.type === "text") {
      return node.data || "";
    }

    if (node.type !== "tag") return "";

    const el = $(node);
    const tag = node.tagName?.toLowerCase();

    // 見出し
    if (tag && /^h[1-6]$/.test(tag)) {
      const level = parseInt(tag[1]);
      const text = el.text().trim();
      if (text) return `\n${"#".repeat(level)} ${text}\n`;
      return "";
    }

    // リンク — 商品名特定に重要
    if (tag === "a") {
      const href = el.attr("href") || "";
      const text = el.text().trim();
      if (text && href) {
        // EC系リンクの場合はURLも残す
        const isEcLink =
          href.includes("amazon") || href.includes("amzn") ||
          href.includes("rakuten") || href.includes("a.r10.to");
        return isEcLink ? `[${text}](${href})` : text;
      }
      return text;
    }

    // 画像 — alt属性に商品名が入っていることがある
    if (tag === "img") {
      const alt = el.attr("alt")?.trim();
      return alt ? `[画像: ${alt}]` : "";
    }

    // リスト
    if (tag === "li") {
      const inner = el.contents().toArray().map(processNode).join("").trim();
      return inner ? `- ${inner}\n` : "";
    }

    // 段落・div
    if (tag === "p" || tag === "div") {
      const inner = el.contents().toArray().map(processNode).join("").trim();
      return inner ? `${inner}\n` : "";
    }

    // strong/b — 商品名の強調に使われることが多い
    if (tag === "strong" || tag === "b") {
      const text = el.text().trim();
      return text ? `**${text}**` : "";
    }

    // br
    if (tag === "br") return "\n";

    // その他: 子要素を再帰処理
    return el.contents().toArray().map(processNode).join("");
  }

  const result = element.contents().toArray().map(processNode).join("");

  // 連続する空行を整理
  return result.replace(/\n{3,}/g, "\n\n").trim();
}

// note記事から本文を抽出
function extractNoteContent($: cheerio.CheerioAPI): string {
  // note.comの記事本文セレクター
  const selectors = [
    ".note-common-styles__textnote-body",
    ".p-article__content",
    'article[class*="article"]',
    ".note-body",
    "article",
  ];

  for (const selector of selectors) {
    const element = $(selector);
    if (element.length > 0) {
      // 不要な要素を削除
      element.find("script, style, nav, header, footer").remove();
      const text = htmlToMarkdown($, element);
      if (text.length > 100) {
        return text;
      }
    }
  }

  return "";
}

// 一般的なブログ記事から本文を抽出
function extractBlogContent($: cheerio.CheerioAPI): string {
  // 一般的な記事本文セレクター
  const selectors = [
    // Zenn
    ".znc",
    // Qiita
    ".it-MdContent",
    // はてなブログ
    ".entry-content",
    // 一般的なセレクター
    "article",
    ".post-content",
    ".article-content",
    ".content",
    "main",
    "#main",
    ".main-content",
  ];

  for (const selector of selectors) {
    const element = $(selector);
    if (element.length > 0) {
      // 不要な要素を削除
      element
        .find(
          "script, style, nav, header, footer, .sidebar, .comments, .related"
        )
        .remove();
      const text = htmlToMarkdown($, element);
      if (text.length > 100) {
        return text;
      }
    }
  }

  // フォールバック: body全体
  const body = $("body");
  body
    .find(
      "script, style, nav, header, footer, .sidebar, .comments, .related"
    )
    .remove();
  return htmlToMarkdown($, body);
}

// メーカー公式サイトの商品ページからコンテンツを抽出
function extractOfficialContent($: cheerio.CheerioAPI): string {
  const parts: string[] = [];

  // 1. JSON-LD構造化データからProduct情報を抽出
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const raw = $(el).html();
      if (!raw) return;
      const jsonData = JSON.parse(raw);
      const items = Array.isArray(jsonData) ? jsonData : [jsonData];
      for (const item of items) {
        if (item["@type"] === "Product" || item["@type"] === "ProductGroup") {
          if (item.name) parts.push(`# 商品名: ${item.name}`);
          if (item.brand?.name) parts.push(`ブランド: ${item.brand.name}`);
          if (item.description) parts.push(`説明: ${item.description}`);
          if (item.category) parts.push(`カテゴリ: ${item.category}`);
          if (item.sku) parts.push(`SKU: ${item.sku}`);
          if (item.offers) {
            const offers = Array.isArray(item.offers) ? item.offers : [item.offers];
            for (const offer of offers) {
              if (offer.price) parts.push(`価格: ${offer.priceCurrency || ""}${offer.price}`);
            }
          }
        }
      }
    } catch {
      // JSON解析失敗はスキップ
    }
  });

  // 2. OGメタデータ
  const ogTitle = $('meta[property="og:title"]').attr("content");
  const ogDesc = $('meta[property="og:description"]').attr("content");
  if (ogTitle && parts.length === 0) parts.push(`# ${ogTitle}`);
  if (ogDesc) parts.push(ogDesc);

  // product:* メタタグ
  $('meta[property^="product:"]').each((_, el) => {
    const prop = $(el).attr("property")?.replace("product:", "");
    const content = $(el).attr("content");
    if (prop && content) parts.push(`${prop}: ${content}`);
  });

  // 3. 製品ページ用CSSセレクターでコンテンツ抽出
  const productSelectors = [
    ".product-detail",
    ".product-info",
    "#product",
    "[data-product]",
    ".pdp-main",
    ".product-page",
    ".product-description",
    ".product-spec",
    ".spec-table",
    ".product-features",
    // 一般的なセレクター（フォールバック）
    "article",
    "main",
    "#main",
    ".main-content",
  ];

  // ノイズ除去用（公式サイトではより強力に除去）
  const noiseSelectors = [
    "script", "style", "nav", "header", "footer",
    ".sidebar", ".comments", ".related",
    ".breadcrumb", ".related-products", ".recommendations",
    ".cart", ".add-to-cart", "[class*='cart']",
    ".reviews", ".social-share", ".cookie",
    "#cookie-banner", ".newsletter",
  ].join(", ");

  for (const selector of productSelectors) {
    const element = $(selector);
    if (element.length > 0) {
      element.find(noiseSelectors).remove();
      const text = htmlToMarkdown($, element);
      if (text.length > 50) {
        parts.push(text);
        break;
      }
    }
  }

  // 4. スペック表を key-value 形式で抽出
  $("table").each((_, table) => {
    const rows: string[] = [];
    $(table).find("tr").each((_, tr) => {
      const cells = $(tr).find("th, td");
      if (cells.length >= 2) {
        const key = $(cells[0]).text().trim();
        const val = $(cells[1]).text().trim();
        if (key && val) rows.push(`${key}: ${val}`);
      }
    });
    if (rows.length > 0) {
      parts.push("【スペック】\n" + rows.join("\n"));
    }
  });

  if (parts.length > 0) {
    return parts.join("\n\n");
  }

  // フォールバック: body全体（強力なノイズ除去付き）
  const body = $("body");
  body.find(noiseSelectors).remove();
  return htmlToMarkdown($, body);
}

// 記事情報を取得
export async function getArticleInfo(url: string): Promise<ArticleInfo | null> {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "ja,en-US;q=0.7,en;q=0.3",
      },
    });

    if (!response.ok) {
      console.error(`Failed to fetch article: ${response.status}`);
      return null;
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    const sourceType = detectSourceType(url);

    // タイトル取得
    const title =
      $('meta[property="og:title"]').attr("content") ||
      $("title").text().trim() ||
      $("h1").first().text().trim() ||
      "";

    // 著者取得
    let author: string | null = null;
    let authorUrl: string | null = null;

    if (sourceType === "note") {
      // note.comの著者情報
      author =
        $('meta[name="author"]').attr("content") ||
        $(".o-noteCreatorInfo__name").text().trim() ||
        $('a[class*="creator"]').first().text().trim() ||
        null;
      authorUrl =
        $('a[class*="creator"]').first().attr("href") ||
        null;
      if (authorUrl && !authorUrl.startsWith("http")) {
        authorUrl = `https://note.com${authorUrl}`;
      }
    } else if (sourceType === "official") {
      // 公式サイト: ブランド名を著者として設定
      const hostname = new URL(url).hostname.replace(/^www\./, "");
      author = getBrandFromDomain(hostname) || null;
      authorUrl = `${new URL(url).origin}/`;
    } else {
      // 一般的なブログの著者情報
      author =
        $('meta[name="author"]').attr("content") ||
        $(".author").first().text().trim() ||
        $('[rel="author"]').first().text().trim() ||
        null;
      authorUrl = $('[rel="author"]').first().attr("href") || null;
    }

    // 公開日取得
    const publishedAt =
      $('meta[property="article:published_time"]').attr("content") ||
      $('time[datetime]').first().attr("datetime") ||
      $(".published, .date, .post-date").first().text().trim() ||
      null;

    // サムネイル取得
    const thumbnailUrl =
      $('meta[property="og:image"]').attr("content") ||
      $('meta[name="twitter:image"]').attr("content") ||
      null;

    // サイト名取得
    const siteName =
      $('meta[property="og:site_name"]').attr("content") ||
      null;

    // 本文取得
    let content = "";
    if (sourceType === "note") {
      content = extractNoteContent($);
    } else if (sourceType === "official") {
      content = extractOfficialContent($);
    } else {
      content = extractBlogContent($);
    }

    // 公式サイトはJSON-LD等から短いが高品質なコンテンツが得られることがある
    const minContentLength = sourceType === "official" ? 30 : 100;
    if (!content || content.length < minContentLength) {
      console.error("Failed to extract article content");
      return null;
    }

    // EC系リンクを抽出
    const productLinks = extractProductLinks($);
    console.log(`[Article] Found ${productLinks.length} product links in article`);

    return {
      url,
      title,
      author,
      authorUrl,
      publishedAt,
      thumbnailUrl,
      content,
      sourceType,
      siteName,
      productLinks,
    };
  } catch (error) {
    console.error("Error fetching article:", error);
    return null;
  }
}

// 記事内からEC系リンクを抽出
function extractProductLinks($: cheerio.CheerioAPI): string[] {
  const links: string[] = [];
  const seen = new Set<string>();

  // すべてのaタグからhrefを取得
  $("a[href]").each((_, element) => {
    const href = $(element).attr("href");
    if (!href) return;

    // EC系リンクかチェック
    const isEcLink =
      href.includes("amazon.co.jp") ||
      href.includes("amazon.com") ||
      href.includes("amzn.to") ||
      href.includes("amzn.asia") ||
      href.includes("rakuten.co.jp") ||
      href.includes("a.r10.to") ||
      href.includes("hb.afl.rakuten.co.jp");

    if (isEcLink && !seen.has(href)) {
      seen.add(href);
      links.push(href);
      console.log(`[Article] Found EC link: ${href}`);
    }
  });

  // リンクが0件の場合、HTMLソース内のURL文字列も検索
  if (links.length === 0) {
    const html = $.html();
    const urlPatterns = [
      /https?:\/\/(?:www\.)?amazon\.co\.jp\/[^\s"'<>]+/g,
      /https?:\/\/amzn\.to\/[^\s"'<>]+/g,
      /https?:\/\/amzn\.asia\/[^\s"'<>]+/g,
    ];

    for (const pattern of urlPatterns) {
      const matches = html.match(pattern) || [];
      for (const match of matches) {
        if (!seen.has(match)) {
          seen.add(match);
          links.push(match);
          console.log(`[Article] Found EC link (from HTML): ${match}`);
        }
      }
    }
  }

  return links;
}

// 記事がデスクツアー関連か判定
export function isDeskTourArticle(title: string, content: string): boolean {
  const keywords = [
    "デスクツアー",
    "デスク環境",
    "デスク周り",
    "作業環境",
    "ワークスペース",
    "在宅環境",
    "リモートワーク環境",
    "仕事部屋",
    "書斎",
    "ガジェット",
    "デスクセットアップ",
    "desk tour",
    "desk setup",
    "workspace",
  ];

  const textToCheck = `${title} ${content}`.toLowerCase();

  return keywords.some((keyword) =>
    textToCheck.includes(keyword.toLowerCase())
  );
}
