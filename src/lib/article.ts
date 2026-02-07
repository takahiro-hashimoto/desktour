import * as cheerio from "cheerio";

export interface ArticleInfo {
  url: string;
  title: string;
  author: string | null;
  authorUrl: string | null;
  publishedAt: string | null;
  thumbnailUrl: string | null;
  content: string;
  sourceType: "note" | "blog" | "other";
  siteName: string | null;
  productLinks: string[];  // 記事内のEC系リンク（Amazon、楽天など）
}

// URLからソースタイプを判定
function detectSourceType(url: string): "note" | "blog" | "other" {
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
  return "other";
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
      const text = element.text().trim();
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
      const text = element.text().trim();
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
  return body.text().trim();
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
    } else {
      content = extractBlogContent($);
    }

    if (!content || content.length < 100) {
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
