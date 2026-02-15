"use client";

import { useState, useEffect } from "react";
import { X } from "lucide-react";
import {
  PRODUCT_CATEGORIES, OCCUPATION_TAGS,
  TAG_GROUP_STYLE, TAG_GROUP_MONITOR, TAG_GROUP_DESK, TAG_GROUP_OS, TAG_GROUP_FEATURES,
  EXCLUSIVE_TAG_GROUPS, DESK_SETUP_TAGS,
  TYPE_TAGS_MULTI_AXIS, CATEGORY_FEATURE_TAGS,
} from "@/lib/constants";
import { extractVideoId } from "@/lib/video-utils";

interface Product {
  id?: string; // DB product ID（保存済みデータ読み込み時に設定）
  name: string;
  brand?: string;
  category: string;
  reason: string;
  confidence: "high" | "medium" | "low";
  tags?: string[]; // 自動抽出されたタグ
  // プレビュー時のAmazon情報
  amazon?: {
    asin: string;
    title: string;
    url: string;
    imageUrl: string;
    price?: number;
  } | null;
  source?: "amazon" | "rakuten";
  matchScore?: number;
  matchReason?: string;
  isExisting?: boolean;
}

interface SuggestedVideo {
  videoId: string;
  title: string;
  channelId: string;
  channelTitle: string;
  thumbnailUrl: string;
  viewCount: number;
  duration: string;
  publishedAt: string;
  isAnalyzed: boolean;
  description?: string;
}

interface ArticleInfo {
  url: string;
  title: string;
  author?: string | null;
  authorUrl?: string | null;
  siteName?: string | null;
  sourceType: string;
  thumbnailUrl?: string | null;
  publishedAt?: string | null;
  productLinks?: string[];
}

interface VideoInfo {
  videoId: string;
  title: string;
  channelId: string;
  channelTitle: string;
  thumbnailUrl?: string | null;
  publishedAt?: string | null;
  description?: string;
}

// プレビュー用の解析結果（DB保存前）
interface PreviewResult {
  title: string;
  source: "video" | "article";
  summary: string;
  tags: string[];
  occupation: string | null;
  occupationTags: string[];
  products: Product[];
  articleInfo?: ArticleInfo;
  videoInfo?: VideoInfo;
}

// 保存後の結果
interface AnalysisResult {
  title: string;
  source: "video" | "article";
  summary: string;
  tags: string[];
  occupation: string | null;
  occupationTags: string[];
  products: Product[];
  savedProducts: Array<{
    name: string;
    brand?: string;
    amazon?: {
      asin: string;
      title: string;
      url: string;
      imageUrl: string;
      price?: number;
    } | null;
  }>;
}

interface SourceListItem {
  type: "video" | "article";
  title: string;
  sourceId: string; // video_id or url
  channelTitle?: string | null;
  author?: string | null;
  publishedAt?: string | null;
  thumbnailUrl?: string | null;
  productCount?: number;
}

const confidenceColors = {
  high: "bg-green-100 text-green-800",
  medium: "bg-yellow-100 text-yellow-800",
  low: "bg-gray-100 text-gray-800",
};

const confidenceLabels = {
  high: "高",
  medium: "中",
  low: "低",
};

export default function AdminPage() {
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // YouTube URL入力用
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [analyzingVideo, setAnalyzingVideo] = useState(false);

  // 記事URL入力用
  const [articleUrl, setArticleUrl] = useState("");
  const [analyzingArticle, setAnalyzingArticle] = useState(false);

  // プレビュー表示用（DB保存前）
  const [previewResult, setPreviewResult] = useState<PreviewResult | null>(null);
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  // タグ編集用
  const [editableTags, setEditableTags] = useState<string[]>([]);
  const [newTagInput, setNewTagInput] = useState("");

  // 職業タグ編集用
  const [editableOccupationTags, setEditableOccupationTags] = useState<string[]>([]);
  const [newOccupationTagInput, setNewOccupationTagInput] = useState("");

  // 商品検索モーダル（Amazon / 楽天）
  const [amazonSearchModal, setAmazonSearchModal] = useState<{
    productIndex: number;
    query: string;
    source: "amazon" | "rakuten";
    candidates: Array<{ id: string; title: string; url: string; imageUrl: string; price?: number; brand?: string; shopName?: string }>;
    dbCandidates: Array<{ id: string; title: string; url: string; imageUrl: string; price?: number; brand?: string; isExisting: true; mentionCount: number }>;
    loading: boolean;
    selecting: boolean;
  } | null>(null);

  // 公式サイトモーダル
  const [officialSiteModal, setOfficialSiteModal] = useState<{
    productIndex: number;
    url: string;
    loading: boolean;
    fetched: boolean;
    title: string;
    imageUrl: string;
    price: string;
    brand: string;
  } | null>(null);

  // 解析結果表示用（保存後）
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);

  // 過去の解析結果（再表示）
  const [sourceType, setSourceType] = useState<"video" | "article">("video");
  const [sourceList, setSourceList] = useState<SourceListItem[]>([]);
  const [loadingSourceList, setLoadingSourceList] = useState(false);
  const [sourcePage, setSourcePage] = useState(1);
  const [sourceTotal, setSourceTotal] = useState(0);
  const [selectedSource, setSelectedSource] = useState<{ type: "video" | "article"; id: string } | null>(null);
  const [loadingSourceDetail, setLoadingSourceDetail] = useState(false);

  // サジェスト動画
  const [suggestions, setSuggestions] = useState<SuggestedVideo[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [usedQuery, setUsedQuery] = useState("");

  // ソース削除
  const [deletingSourceId, setDeletingSourceId] = useState<string | null>(null);
  // ソース再解析
  const [reanalyzingSourceId, setReanalyzingSourceId] = useState<string | null>(null);

  // 選ばれている理由の一括生成
  const [generatingReasons, setGeneratingReasons] = useState(false);
  const [reasonsResult, setReasonsResult] = useState<{ message: string; processed: number; errors: number; total: number } | null>(null);

  // タググループ定義（admin UI表示用）
  const TAG_GROUPS = [
    { name: "スタイル", tags: TAG_GROUP_STYLE as readonly string[], exclusive: true },
    { name: "モニター構成", tags: TAG_GROUP_MONITOR as readonly string[], exclusive: true },
    { name: "デスク種類", tags: TAG_GROUP_DESK as readonly string[], exclusive: true },
    { name: "メインOS", tags: TAG_GROUP_OS as readonly string[], exclusive: true },
    { name: "特徴", tags: TAG_GROUP_FEATURES as readonly string[], exclusive: false },
  ];

  // 利用可能なプリセットタグ（互換用）
  const AVAILABLE_TAGS: string[] = [...DESK_SETUP_TAGS];

  // 利用可能な職業タグ（constants.ts のマスターデータを使用）
  const AVAILABLE_OCCUPATION_TAGS: string[] = [...OCCUPATION_TAGS];

  // タグ追加（排他グループの場合、同グループの既存タグを自動削除）
  const addTag = (tag: string) => {
    const trimmedTag = tag.trim();
    if (!trimmedTag || editableTags.includes(trimmedTag)) return;

    let newTags = [...editableTags];

    // 排他グループに属するタグの場合、同グループの既存タグを削除
    for (const group of EXCLUSIVE_TAG_GROUPS) {
      const groupTags = group.tags as readonly string[];
      if (groupTags.includes(trimmedTag)) {
        newTags = newTags.filter(t => !groupTags.includes(t));
        break;
      }
    }

    newTags.push(trimmedTag);
    setEditableTags(newTags);
  };

  // タグ削除
  const removeTag = (tag: string) => {
    setEditableTags(editableTags.filter((t) => t !== tag));
  };

  // 職業タグ追加
  const addOccupationTag = (tag: string) => {
    const trimmedTag = tag.trim();
    if (trimmedTag && !editableOccupationTags.includes(trimmedTag)) {
      setEditableOccupationTags([...editableOccupationTags, trimmedTag]);
    }
  };

  // 職業タグ削除
  const removeOccupationTag = (tag: string) => {
    setEditableOccupationTags(editableOccupationTags.filter((t) => t !== tag));
  };

  // サジェスト動画を取得
  const fetchSuggestions = async (query: string = searchQuery) => {
    setLoadingSuggestions(true);
    try {
      const params = new URLSearchParams({ maxResults: "20" });
      if (query.trim()) params.set("q", query.trim());
      const res = await fetch(`/api/suggestions?${params}`);
      const data = await res.json();
      setSuggestions(data.suggestions || []);
      setUsedQuery(data.query || query);
    } catch {
      console.error("サジェストの取得に失敗しました");
    } finally {
      setLoadingSuggestions(false);
    }
  };

  // サジェストは「DB登録リストを表示」ボタンで手動取得（自動取得しない）

  // プレビュー結果が設定されたらタグを初期化
  useEffect(() => {
    if (previewResult) {
      setEditableTags(previewResult.tags);
      setEditableOccupationTags(previewResult.occupationTags);
    }
  }, [previewResult]);

  const fetchSourceList = async (page: number = 1) => {
    setLoadingSourceList(true);
    try {
      const params = new URLSearchParams({
        type: sourceType,
        page: String(page),
        limit: "20",
      });
      const res = await fetch(`/api/admin/sources?${params.toString()}`);
      const data = await res.json();
      setSourceList(data.items || []);
      setSourceTotal(data.total || 0);
      setSourcePage(page);
    } catch {
      setMessage({ type: "error", text: "過去データの取得に失敗しました" });
    } finally {
      setLoadingSourceList(false);
    }
  };

  const loadSourceDetail = async (type: "video" | "article", id: string) => {
    setLoadingSourceDetail(true);
    setMessage(null);
    setPreviewResult(null);
    setAnalysisResult(null);
    try {
      const params = new URLSearchParams({ type, id });
      const res = await fetch(`/api/source?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || "取得に失敗しました");
      }

      const products: Product[] = (data.products || []).map((p: any) => ({
        id: p.id,
        name: p.name,
        brand: p.brand || undefined,
        category: p.category || "その他デスクアクセサリー",
        reason: p.reason || "",
        confidence: "medium",
        tags: p.tags || undefined,
        source: p.product_source || undefined,
        amazon: p.asin || p.amazon_url || p.amazon_image_url ? {
          asin: p.asin || "",
          title: p.name,
          url: p.amazon_url || "",
          imageUrl: p.amazon_image_url || "",
          price: p.amazon_price || undefined,
        } : null,
      }));

      setPreviewResult({
        title: data.title || (type === "video" ? "動画" : "記事"),
        source: type,
        summary: data.summary || "",
        tags: data.tags || [],
        occupation: null,
        occupationTags: data.occupation_tags || [],
        products,
        articleInfo: type === "article" ? {
          url: data.url || id,
          title: data.title || "記事",
          author: data.author,
          siteName: null,
          sourceType: "article",
          thumbnailUrl: data.thumbnail_url || null,
          publishedAt: data.published_at || null,
        } : undefined,
        videoInfo: type === "video" ? {
          videoId: data.video_id || id,
          title: data.title || "動画",
          channelId: "",
          channelTitle: data.channel_title || "",
          thumbnailUrl: data.thumbnail_url || null,
          publishedAt: data.published_at || null,
          description: "",
        } : undefined,
      });
      setEditableTags(data.tags || []);
      setEditableOccupationTags(data.occupation_tags || []);
      setSelectedProducts(new Set(products.map((p) => `${p.name}|${p.category}`)));
      setSelectedSource({ type, id });
    } catch {
      setMessage({ type: "error", text: "解析結果の取得に失敗しました" });
    } finally {
      setLoadingSourceDetail(false);
    }
  };

  const refreshSelectedSource = async () => {
    if (!selectedSource) return;
    await loadSourceDetail(selectedSource.type, selectedSource.id);
  };

  // ソースを削除
  const handleDeleteSource = async (type: "video" | "article", sourceId: string, title: string) => {
    if (!confirm(`「${title}」を削除しますか？\n関連する商品データも削除されます。この操作は取り消せません。`)) {
      return;
    }

    setDeletingSourceId(sourceId);
    setMessage(null);

    try {
      const res = await fetch("/api/admin/sources", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceType: type, sourceId, domain: "desktour" }),
      });
      const data = await res.json();

      if (data.success) {
        setMessage({ type: "success", text: `「${title}」を削除しました` });
        // リストから除去
        setSourceList(prev => prev.filter(item => item.sourceId !== sourceId));
        setSourceTotal(prev => prev - 1);
        // 編集中のソースが削除された場合はクリア
        if (selectedSource?.id === sourceId) {
          handleCancelPreview();
        }
      } else {
        setMessage({ type: "error", text: data.error || "削除に失敗しました" });
      }
    } catch {
      setMessage({ type: "error", text: "通信エラーが発生しました" });
    } finally {
      setDeletingSourceId(null);
    }
  };

  // ソースを再解析（削除→再追加方式）
  const handleReanalyzeSource = async (type: "video" | "article", sourceId: string, title: string) => {
    if (!confirm(`「${title}」を再解析しますか？\n既存データは削除され、新しく解析し直します。`)) return;

    setReanalyzingSourceId(sourceId);
    setMessage(null);
    setAnalysisResult(null);
    setPreviewResult(null);
    setSelectedSource(null);

    try {
      // 1. 既存データ削除
      const delRes = await fetch("/api/admin/sources", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceType: type, sourceId, domain: "desktour" }),
      });
      const delData = await delRes.json();
      if (!delData.success) {
        setMessage({ type: "error", text: delData.error || "削除に失敗しました" });
        return;
      }

      // リストから除去
      setSourceList(prev => prev.filter(item => item.sourceId !== sourceId));
      setSourceTotal(prev => prev - 1);

      // 2. 再解析
      const url = type === "video"
        ? `https://www.youtube.com/watch?v=${sourceId}`
        : sourceId;
      const analyzeEndpoint = type === "video" ? "/api/analyze" : "/api/analyze-article";

      const res = await fetch(analyzeEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, saveToDb: false }),
      });
      const data = await res.json();

      if (data.success) {
        const products: Product[] = data.analysis?.products || [];
        if (type === "video") {
          setPreviewResult({
            title: data.videoInfo?.title || "動画",
            source: "video",
            summary: data.analysis?.summary || "",
            tags: data.analysis?.tags || [],
            occupation: data.analysis?.influencerOccupation || null,
            occupationTags: data.analysis?.influencerOccupationTags || [],
            products,
            videoInfo: {
              videoId: sourceId,
              title: data.videoInfo?.title || "動画",
              channelId: data.videoInfo?.channelId || "",
              channelTitle: data.videoInfo?.channelTitle || "",
              thumbnailUrl: data.videoInfo?.thumbnailUrl,
              publishedAt: data.videoInfo?.publishedAt,
              description: data.videoInfo?.description,
            },
          });
        } else {
          setPreviewResult({
            title: data.articleInfo?.title || "記事",
            source: "article",
            summary: data.analysis?.summary || "",
            tags: data.analysis?.tags || [],
            occupation: data.analysis?.influencerOccupation || null,
            occupationTags: data.analysis?.influencerOccupationTags || [],
            products,
            articleInfo: {
              url: data.articleInfo?.url || sourceId,
              title: data.articleInfo?.title || "記事",
              author: data.articleInfo?.author,
              authorUrl: data.articleInfo?.authorUrl,
              siteName: data.articleInfo?.siteName,
              sourceType: data.articleInfo?.sourceType || "article",
              thumbnailUrl: data.articleInfo?.thumbnailUrl,
              publishedAt: data.articleInfo?.publishedAt,
              productLinks: data.articleInfo?.productLinks,
            },
          });
        }
        setSelectedProducts(new Set(products.map((p) => `${p.name}|${p.category}`)));
        setMessage({
          type: "success",
          text: `「${title}」の再解析が完了しました（${products.length}件の商品を抽出）。登録する商品を選択してください。`,
        });
      } else {
        setMessage({ type: "error", text: data.error || "再解析に失敗しました" });
      }
    } catch {
      setMessage({ type: "error", text: "通信エラーが発生しました" });
    } finally {
      setReanalyzingSourceId(null);
    }
  };

  // サジェスト動画をクリックして自動解析開始
  const handleSuggestionClick = async (video: SuggestedVideo) => {
    const videoUrl = `https://www.youtube.com/watch?v=${video.videoId}`;
    setYoutubeUrl(videoUrl);

    // 自動的に解析を開始
    setAnalyzingVideo(true);
    setMessage(null);
    setAnalysisResult(null);
    setPreviewResult(null);
    setSelectedSource(null);

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: videoUrl,
          saveToDb: false, // プレビューモード
        }),
      });

      const data = await response.json();

      if (data.success) {
        const products: Product[] = data.analysis?.products || [];
        setPreviewResult({
          title: data.videoInfo?.title || "動画",
          source: "video",
          summary: data.analysis?.summary || "",
          tags: data.analysis?.tags || [],
          occupation: data.analysis?.influencerOccupation || null,
          occupationTags: data.analysis?.influencerOccupationTags || [],
          products,
          videoInfo: {
            videoId: video.videoId,
            title: data.videoInfo?.title || "動画",
            channelId: data.videoInfo?.channelId || "",
            channelTitle: data.videoInfo?.channelTitle || "",
            thumbnailUrl: data.videoInfo?.thumbnailUrl,
            publishedAt: data.videoInfo?.publishedAt,
            description: data.videoInfo?.description,
          },
        });
        setSelectedProducts(new Set(products.map((p) => `${p.name}|${p.category}`)));
        setMessage({
          type: "success",
          text: `「${data.videoInfo?.title || "動画"}」の解析が完了しました（${products.length}件の商品を抽出）。登録する商品を選択してください。`,
        });
        setYoutubeUrl("");
      } else {
        setMessage({
          type: "error",
          text: data.error || "解析に失敗しました",
        });
      }
    } catch {
      setMessage({ type: "error", text: "通信エラーが発生しました" });
    } finally {
      setAnalyzingVideo(false);
    }
  };

  // 商品のカテゴリを変更
  const handleCategoryChange = (productIndex: number, newCategory: string) => {
    if (!previewResult) return;
    const updatedProducts = [...previewResult.products];
    const oldKey = `${updatedProducts[productIndex].name}|${updatedProducts[productIndex].category}`;
    updatedProducts[productIndex] = {
      ...updatedProducts[productIndex],
      category: newCategory,
    };
    const newKey = `${updatedProducts[productIndex].name}|${newCategory}`;

    // selectedProductsも更新
    setSelectedProducts((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(oldKey)) {
        newSet.delete(oldKey);
        newSet.add(newKey);
      }
      return newSet;
    });

    setPreviewResult({
      ...previewResult,
      products: updatedProducts,
    });
  };

  // 商品名を変更
  const handleProductNameChange = (productIndex: number, newName: string) => {
    if (!previewResult) return;
    const updatedProducts = [...previewResult.products];
    const oldKey = `${updatedProducts[productIndex].name}|${updatedProducts[productIndex].category}`;
    updatedProducts[productIndex] = { ...updatedProducts[productIndex], name: newName };
    const newKey = `${newName}|${updatedProducts[productIndex].category}`;
    setSelectedProducts((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(oldKey)) {
        newSet.delete(oldKey);
        newSet.add(newKey);
      }
      return newSet;
    });
    setPreviewResult({ ...previewResult, products: updatedProducts });
  };

  // ブランド名を変更
  const handleProductBrandChange = (productIndex: number, newBrand: string) => {
    if (!previewResult) return;
    const updatedProducts = [...previewResult.products];
    updatedProducts[productIndex] = { ...updatedProducts[productIndex], brand: newBrand };
    setPreviewResult({ ...previewResult, products: updatedProducts });
  };

  // コメント文（reason）を変更
  const handleProductReasonChange = (productIndex: number, newReason: string) => {
    if (!previewResult) return;
    const updatedProducts = [...previewResult.products];
    updatedProducts[productIndex] = { ...updatedProducts[productIndex], reason: newReason };
    setPreviewResult({ ...previewResult, products: updatedProducts });
  };

  // 商品検索モーダルを開く
  const openAmazonSearch = (productIndex: number, source: "amazon" | "rakuten" = "amazon") => {
    if (!previewResult) return;
    const product = previewResult.products[productIndex];
    const query = product.brand
      ? `${product.brand} ${product.name}`
      : product.name;
    setAmazonSearchModal({ productIndex, query, source, candidates: [], dbCandidates: [], loading: false, selecting: false });
  };

  // 商品検索を実行（Amazon / 楽天）
  const executeAmazonSearch = async () => {
    if (!amazonSearchModal || !amazonSearchModal.query.trim()) return;
    setAmazonSearchModal({ ...amazonSearchModal, loading: true, candidates: [], dbCandidates: [] });
    try {
      const params = new URLSearchParams({ name: amazonSearchModal.query, source: amazonSearchModal.source, domain: "desktour" });
      const res = await fetch(`/api/search-amazon?${params.toString()}`);
      const data = await res.json();
      setAmazonSearchModal((prev) =>
        prev ? { ...prev, loading: false, candidates: data.candidates || [], dbCandidates: data.dbCandidates || [] } : null
      );
    } catch {
      setMessage({ type: "error", text: `${amazonSearchModal.source === "rakuten" ? "楽天" : "Amazon"}検索に失敗しました` });
      setAmazonSearchModal((prev) => prev ? { ...prev, loading: false } : null);
    }
  };

  // 候補を選択 → フルデータ取得 + タグ再生成 → カード入れ替え
  const selectAmazonCandidate = async (candidate: { id: string; title: string; url: string; imageUrl: string; price?: number; brand?: string; shopName?: string }) => {
    if (!previewResult || !amazonSearchModal) return;
    const productIndex = amazonSearchModal.productIndex;
    const currentCategory = previewResult.products[productIndex].category;
    const isRakuten = amazonSearchModal.source === "rakuten";

    setAmazonSearchModal((prev) => prev ? { ...prev, selecting: true } : null);

    try {
      const postBody = isRakuten
        ? { source: "rakuten", currentCategory, candidateData: { title: candidate.title, url: candidate.url, imageUrl: candidate.imageUrl, price: candidate.price, shopName: candidate.shopName } }
        : { asin: candidate.id, currentCategory };

      const res = await fetch("/api/search-amazon", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(postBody),
      });
      const data = await res.json();

      const updatedProducts = [...previewResult.products];
      const oldKey = `${updatedProducts[productIndex].name}|${updatedProducts[productIndex].category}`;

      if (data.product) {
        const newName = isRakuten
          ? candidate.title.split(/[,（(【]/)[0]?.trim() || updatedProducts[productIndex].name
          : data.product.title?.replace(/^.*?]\s*/, "").split(/[,（(]/)[0]?.trim()
            || candidate.title.split(/[,（(]/)[0]?.trim()
            || updatedProducts[productIndex].name;
        const newBrand = data.product.brand || candidate.brand || updatedProducts[productIndex].brand;

        updatedProducts[productIndex] = {
          ...updatedProducts[productIndex],
          name: newName,
          brand: newBrand,
          amazon: {
            asin: isRakuten ? candidate.id : candidate.id,
            title: data.product.title || candidate.title,
            url: data.product.url || candidate.url,
            imageUrl: data.product.imageUrl || candidate.imageUrl,
            price: data.product.price || candidate.price,
          },
          source: isRakuten ? "rakuten" : "amazon",
          matchReason: "手動選択",
          tags: data.tags && data.tags.length > 0 ? data.tags : updatedProducts[productIndex].tags,
        };
      } else {
        updatedProducts[productIndex] = {
          ...updatedProducts[productIndex],
          amazon: {
            asin: candidate.id,
            title: candidate.title,
            url: candidate.url,
            imageUrl: candidate.imageUrl,
            price: candidate.price,
          },
          source: isRakuten ? "rakuten" : "amazon",
          matchReason: "手動選択",
        };
      }

      const newKey = `${updatedProducts[productIndex].name}|${updatedProducts[productIndex].category}`;
      setSelectedProducts((prev) => {
        const newSet = new Set(prev);
        if (newSet.has(oldKey)) { newSet.delete(oldKey); newSet.add(newKey); }
        return newSet;
      });
      setPreviewResult({ ...previewResult, products: updatedProducts });
    } catch {
      setMessage({ type: "error", text: "商品情報の取得に失敗しました" });
    }
    setAmazonSearchModal(null);
  };

  // 公式サイトモーダルを開く
  const openOfficialSiteModal = (productIndex: number) => {
    setOfficialSiteModal({
      productIndex,
      url: "",
      loading: false,
      fetched: false,
      title: "",
      imageUrl: "",
      price: "",
      brand: "",
    });
  };

  // 公式サイトOGP取得
  const fetchOfficialSiteOGP = async () => {
    if (!officialSiteModal || !officialSiteModal.url.trim()) return;
    setOfficialSiteModal({ ...officialSiteModal, loading: true });
    try {
      const res = await fetch("/api/fetch-ogp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: officialSiteModal.url }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ type: "error", text: data.error || "OGP取得に失敗しました" });
        setOfficialSiteModal((prev) => prev ? { ...prev, loading: false } : null);
        return;
      }
      setOfficialSiteModal((prev) =>
        prev
          ? {
              ...prev,
              loading: false,
              fetched: true,
              title: data.title || "",
              imageUrl: data.imageUrl || "",
              brand: data.brand || "",
            }
          : null
      );
    } catch {
      setMessage({ type: "error", text: "OGP情報の取得に失敗しました" });
      setOfficialSiteModal((prev) => prev ? { ...prev, loading: false } : null);
    }
  };

  // 公式サイト情報を確定 → 商品データに反映
  const confirmOfficialSite = () => {
    if (!officialSiteModal || !previewResult) return;
    const { productIndex, title, imageUrl, price, brand, url } = officialSiteModal;

    let domain = "";
    try {
      domain = new URL(url).hostname.replace(/^www\./, "");
    } catch { /* ignore */ }

    const updatedProducts = [...previewResult.products];
    const oldKey = `${updatedProducts[productIndex].name}|${updatedProducts[productIndex].category}`;
    const parsedPrice = price ? parseInt(price.replace(/[^0-9]/g, ""), 10) : undefined;

    updatedProducts[productIndex] = {
      ...updatedProducts[productIndex],
      brand: brand || updatedProducts[productIndex].brand,
      amazon: {
        asin: `official-${domain}`,
        title: title || updatedProducts[productIndex].name,
        url,
        imageUrl,
        price: parsedPrice || undefined,
      },
      source: "amazon",
      matchReason: "公式サイト（手動）",
    };

    const newKey = `${updatedProducts[productIndex].name}|${updatedProducts[productIndex].category}`;
    setSelectedProducts((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(oldKey)) { newSet.delete(oldKey); newSet.add(newKey); }
      return newSet;
    });
    setPreviewResult({ ...previewResult, products: updatedProducts });
    setOfficialSiteModal(null);
  };

  // 商品タグを追加
  const handleAddProductTag = (productIndex: number, tag: string) => {
    if (!previewResult) return;
    const updatedProducts = [...previewResult.products];
    const currentTags = updatedProducts[productIndex].tags || [];
    if (!currentTags.includes(tag)) {
      updatedProducts[productIndex] = {
        ...updatedProducts[productIndex],
        tags: [...currentTags, tag],
      };
      setPreviewResult({
        ...previewResult,
        products: updatedProducts,
      });
    }
  };

  // 商品タグを削除
  const handleRemoveProductTag = (productIndex: number, tag: string) => {
    if (!previewResult) return;
    const updatedProducts = [...previewResult.products];
    const currentTags = updatedProducts[productIndex].tags || [];
    updatedProducts[productIndex] = {
      ...updatedProducts[productIndex],
      tags: currentTags.filter(t => t !== tag),
    };
    setPreviewResult({
      ...previewResult,
      products: updatedProducts,
    });
  };

  // 商品を手動追加
  const handleAddManualProduct = () => {
    if (!previewResult) return;
    const newProduct: Product = {
      name: "",
      brand: "",
      category: PRODUCT_CATEGORIES[0],
      reason: "",
      confidence: "medium",
    };
    const updatedProducts = [...previewResult.products, newProduct];
    setPreviewResult({ ...previewResult, products: updatedProducts });
    // 新しい商品を選択状態にする
    const key = `${newProduct.name}|${newProduct.category}`;
    setSelectedProducts(prev => new Set([...prev, key]));
  };

  // 商品を削除
  const handleRemoveProduct = (productIndex: number) => {
    if (!previewResult) return;
    const product = previewResult.products[productIndex];
    const key = `${product.name}|${product.category}`;
    const updatedProducts = previewResult.products.filter((_, i) => i !== productIndex);
    setPreviewResult({ ...previewResult, products: updatedProducts });
    setSelectedProducts(prev => {
      const newSet = new Set(prev);
      newSet.delete(key);
      return newSet;
    });
  };

  // Amazon情報のフィールド変更
  const handleAmazonFieldChange = (
    productIndex: number,
    field: "url" | "imageUrl",
    value: string
  ) => {
    if (!previewResult) return;
    const updatedProducts = [...previewResult.products];
    if (updatedProducts[productIndex].amazon) {
      updatedProducts[productIndex] = {
        ...updatedProducts[productIndex],
        amazon: {
          ...updatedProducts[productIndex].amazon!,
          [field]: value,
        },
      };
      setPreviewResult({
        ...previewResult,
        products: updatedProducts,
      });
    }
  };

  // YouTube動画解析
  const handleAnalyzeVideo = async () => {
    const videoId = extractVideoId(youtubeUrl.trim());
    if (!videoId) {
      setMessage({ type: "error", text: "有効なYouTube URLを入力してください" });
      return;
    }

    setAnalyzingVideo(true);
    setMessage(null);
    setAnalysisResult(null);
    setPreviewResult(null);
    setSelectedSource(null);

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: `https://www.youtube.com/watch?v=${videoId}`,
          saveToDb: false, // プレビューモード
        }),
      });

      const data = await response.json();

      if (data.success) {
        const products: Product[] = data.analysis?.products || [];
        // プレビュー結果を設定
        setPreviewResult({
          title: data.videoInfo?.title || "動画",
          source: "video",
          summary: data.analysis?.summary || "",
          tags: data.analysis?.tags || [],
          occupation: data.analysis?.influencerOccupation || null,
          occupationTags: data.analysis?.influencerOccupationTags || [],
          products,
          videoInfo: {
            videoId: videoId,
            title: data.videoInfo?.title || "動画",
            channelId: data.videoInfo?.channelId || "",
            channelTitle: data.videoInfo?.channelTitle || "",
            thumbnailUrl: data.videoInfo?.thumbnailUrl,
            publishedAt: data.videoInfo?.publishedAt,
            description: data.videoInfo?.description,
          },
        });
        // 全商品を初期選択状態に
        setSelectedProducts(new Set(products.map((p) => `${p.name}|${p.category}`)));
        setMessage({
          type: "success",
          text: `「${data.videoInfo?.title || "動画"}」の解析が完了しました（${products.length}件の商品を抽出）。登録する商品を選択してください。`,
        });
        setYoutubeUrl("");
      } else {
        setMessage({
          type: "error",
          text: data.error || "解析に失敗しました",
        });
      }
    } catch {
      setMessage({ type: "error", text: "通信エラーが発生しました" });
    } finally {
      setAnalyzingVideo(false);
    }
  };

  // 記事解析
  const handleAnalyzeArticle = async () => {
    if (!articleUrl.trim()) return;

    setAnalyzingArticle(true);
    setMessage(null);
    setAnalysisResult(null);
    setPreviewResult(null);
    setSelectedSource(null);

    try {
      const response = await fetch("/api/analyze-article", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: articleUrl,
          saveToDb: false, // プレビューモード
        }),
      });

      const data = await response.json();

      if (data.success) {
        const products: Product[] = data.analysis?.products || [];
        // プレビュー結果を設定
        setPreviewResult({
          title: data.articleInfo?.title || "記事",
          source: "article",
          summary: data.analysis?.summary || "",
          tags: data.analysis?.tags || [],
          occupation: data.analysis?.influencerOccupation || null,
          occupationTags: data.analysis?.influencerOccupationTags || [],
          products,
          articleInfo: {
            url: data.articleInfo?.url || articleUrl,
            title: data.articleInfo?.title || "記事",
            author: data.articleInfo?.author,
            authorUrl: data.articleInfo?.authorUrl,
            siteName: data.articleInfo?.siteName,
            sourceType: data.articleInfo?.sourceType || "article",
            thumbnailUrl: data.articleInfo?.thumbnailUrl,
            publishedAt: data.articleInfo?.publishedAt,
            productLinks: data.articleInfo?.productLinks,
          },
        });
        // 全商品を初期選択状態に
        setSelectedProducts(new Set(products.map((p) => `${p.name}|${p.category}`)));
        setMessage({
          type: "success",
          text: `「${data.articleInfo?.title || "記事"}」の解析が完了しました（${products.length}件の商品を抽出）。登録する商品を選択してください。`,
        });
        setArticleUrl("");
      } else {
        setMessage({
          type: "error",
          text: data.error || "解析に失敗しました",
        });
      }
    } catch {
      setMessage({ type: "error", text: "通信エラーが発生しました" });
    } finally {
      setAnalyzingArticle(false);
    }
  };

  // 商品の選択/解除
  const toggleProductSelection = (product: Product) => {
    const key = `${product.name}|${product.category}`;
    setSelectedProducts((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(key)) {
        newSet.delete(key);
      } else {
        newSet.add(key);
      }
      return newSet;
    });
  };

  // 全選択/全解除
  const toggleAllProducts = () => {
    if (!previewResult) return;
    if (selectedProducts.size === previewResult.products.length) {
      setSelectedProducts(new Set());
    } else {
      setSelectedProducts(new Set(previewResult.products.map((p) => `${p.name}|${p.category}`)));
    }
  };

  // 選択した商品をDBに保存
  const handleSaveProducts = async () => {
    if (!previewResult || selectedProducts.size === 0) return;

    setSaving(true);
    setMessage(null);

    const productsToSave = previewResult.products.filter(
      (p) => selectedProducts.has(`${p.name}|${p.category}`)
    );

    try {
      const response = await fetch("/api/save-products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceType: previewResult.source,
          articleInfo: previewResult.articleInfo,
          videoInfo: previewResult.videoInfo,
          analysisData: {
            summary: previewResult.summary,
            tags: editableTags, // 編集可能なタグを使用
            influencerOccupation: previewResult.occupation,
            influencerOccupationTags: editableOccupationTags, // 編集可能な職業タグを使用
          },
          selectedProducts: productsToSave,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setMessage({
          type: "success",
          text: `${data.savedCount}件の商品を登録しました！`,
        });
        // 保存後の結果に切り替え
        setAnalysisResult({
          title: previewResult.title,
          source: previewResult.source,
          summary: previewResult.summary,
          tags: editableTags, // 編集後のタグを使用
          occupation: previewResult.occupation,
          occupationTags: editableOccupationTags, // 編集後の職業タグを使用
          products: productsToSave,
          savedProducts: data.savedProducts || [],
        });
        setPreviewResult(null);
        setSelectedProducts(new Set());
        setEditableTags([]); // タグをリセット
        setEditableOccupationTags([]); // 職業タグをリセット

      } else {
        setMessage({
          type: "error",
          text: data.error || "保存に失敗しました",
        });
      }
    } catch {
      setMessage({ type: "error", text: "通信エラーが発生しました" });
    } finally {
      setSaving(false);
    }
  };

  // 保存済みソースの変更を保存
  const handleUpdateSource = async () => {
    if (!previewResult || !selectedSource) return;

    setSaving(true);
    setMessage(null);

    try {
      const productsPayload = previewResult.products.map(p => ({
          ...(p.id ? { id: p.id } : {}),
          name: p.name,
          brand: p.brand || null,
          category: p.category,
          tags: p.tags || [],
          reason: p.reason || "",
          ...(p.amazon ? {
            asin: p.amazon.asin,
            amazon_url: p.amazon.url,
            amazon_image_url: p.amazon.imageUrl,
            amazon_price: p.amazon.price,
            product_source: p.source || "amazon",
          } : {}),
        }));

      const response = await fetch("/api/admin/sources", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceType: selectedSource.type,
          sourceId: selectedSource.id,
          domain: "desktour",
          summary: previewResult.summary,
          tags: editableTags,
          occupationTags: editableOccupationTags,
          products: productsPayload,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setMessage({ type: "success", text: "変更を保存しました" });
        // 再読み込みで最新データを反映
        await loadSourceDetail(selectedSource.type, selectedSource.id);
      } else {
        setMessage({ type: "error", text: data.error || "更新に失敗しました" });
      }
    } catch {
      setMessage({ type: "error", text: "通信エラーが発生しました" });
    } finally {
      setSaving(false);
    }
  };

  // プレビューをキャンセル
  const handleCancelPreview = () => {
    setPreviewResult(null);
    setSelectedProducts(new Set());
    setEditableTags([]);
    setNewTagInput("");
    setEditableOccupationTags([]);
    setNewOccupationTagInput("");
    setSelectedSource(null);
    setMessage(null);
  };

  // 編集モード判定（過去データから読み込んだ場合）
  const isEditMode = !!(selectedSource && previewResult);

  // Amazon情報をマップ化（保存後の結果用）
  const amazonInfoMap = new Map<string, AnalysisResult["savedProducts"][0]["amazon"]>();
  if (analysisResult?.savedProducts) {
    for (const sp of analysisResult.savedProducts) {
      amazonInfoMap.set(sp.name, sp.amazon);
    }
  }

  // 商品をカテゴリでグループ化（保存後の結果用）
  const groupedProducts = analysisResult?.products.reduce(
    (acc, product) => {
      if (!acc[product.category]) {
        acc[product.category] = [];
      }
      acc[product.category].push(product);
      return acc;
    },
    {} as Record<string, Product[]>
  );

  // プレビュー用の商品グループ化
  const previewGroupedProducts = previewResult?.products.reduce(
    (acc, product) => {
      if (!acc[product.category]) {
        acc[product.category] = [];
      }
      acc[product.category].push(product);
      return acc;
    },
    {} as Record<string, Product[]>
  );

  return (
    <main className="max-w-[1080px] mx-auto px-4 py-8">
      <header className="mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Creator Clip - デスクツアー 管理画面</h1>
          <p className="text-gray-600 mt-1">
            解析候補の動画を検索・管理
          </p>
        </div>
      </header>

      {/* YouTube URL入力 */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-lg font-semibold mb-3">📺 YouTube動画を解析</h2>
        <div className="flex gap-3">
          <input
            type="text"
            value={youtubeUrl}
            onChange={(e) => setYoutubeUrl(e.target.value)}
            placeholder="YouTube動画のURLを入力（例：https://www.youtube.com/watch?v=...）"
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            disabled={analyzingVideo}
          />
          <button
            onClick={handleAnalyzeVideo}
            disabled={analyzingVideo || !youtubeUrl.trim()}
            className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            {analyzingVideo ? "解析中..." : "動画を解析"}
          </button>
        </div>
        <p className="text-xs text-gray-500 mt-2">
          デスクツアー動画のURLを入力して解析します。字幕と概要欄から商品情報を抽出します。
        </p>
      </div>

      {/* 記事URL入力 */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-lg font-semibold mb-3">📄 記事を解析</h2>
        <div className="flex gap-3">
          <input
            type="text"
            value={articleUrl}
            onChange={(e) => setArticleUrl(e.target.value)}
            placeholder="記事や公式サイトのURLを入力（例：https://note.com/... や https://sony.jp/...）"
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            disabled={analyzingArticle}
          />
          <button
            onClick={handleAnalyzeArticle}
            disabled={analyzingArticle || !articleUrl.trim()}
            className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            {analyzingArticle ? "解析中..." : "記事を解析"}
          </button>
        </div>
        <p className="text-xs text-gray-500 mt-2">
          note.com、Zenn、はてなブログ等の記事や、メーカー公式サイトの商品ページを解析できます
        </p>
      </div>

      {/* メッセージ */}
      {message && (
        <div
          className={`rounded-lg p-4 mb-6 ${
            message.type === "success"
              ? "bg-green-50 border border-green-200 text-green-800"
              : "bg-red-50 border border-red-200 text-red-800"
          }`}
        >
          {message.text}
        </div>
      )}

      {/* プレビュー結果（DB保存前） */}
      {previewResult && (
        <div className={`bg-white rounded-lg shadow-md p-6 mb-6 border-2 ${isEditMode ? "border-green-300" : "border-blue-300"}`}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">
              {previewResult.source === "video" ? "📺" : "📄"} {isEditMode ? "編集:" : "プレビュー:"} {previewResult.title}
            </h2>
            <button
              onClick={handleCancelPreview}
              className="text-gray-400 hover:text-gray-600"
            >
              ✕ キャンセル
            </button>
          </div>

          {/* ソースURL・サムネイル */}
          <div className="mb-4 flex gap-4 items-start">
            {previewResult.source === "video" && previewResult.videoInfo?.thumbnailUrl && (
              <a
                href={`https://www.youtube.com/watch?v=${previewResult.videoInfo.videoId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-shrink-0"
              >
                <img
                  src={previewResult.videoInfo.thumbnailUrl}
                  alt={previewResult.title}
                  className="w-40 aspect-video object-cover rounded-lg border border-gray-200 hover:opacity-80 transition-opacity"
                />
              </a>
            )}
            {previewResult.source === "article" && previewResult.articleInfo?.thumbnailUrl && (
              <a
                href={previewResult.articleInfo.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-shrink-0"
              >
                <img
                  src={previewResult.articleInfo.thumbnailUrl}
                  alt={previewResult.title}
                  className="w-40 aspect-video object-cover rounded-lg border border-gray-200 hover:opacity-80 transition-opacity"
                />
              </a>
            )}
            <div className="flex-1 min-w-0">
              {previewResult.source === "video" && previewResult.videoInfo && (
                <div className="mb-2">
                  <p className="text-xs text-gray-500 mb-0.5">動画URL</p>
                  <a
                    href={`https://www.youtube.com/watch?v=${previewResult.videoInfo.videoId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-600 hover:underline break-all"
                  >
                    https://www.youtube.com/watch?v={previewResult.videoInfo.videoId}
                  </a>
                  <p className="text-xs text-gray-400 mt-1">{previewResult.videoInfo.channelTitle}</p>
                </div>
              )}
              {previewResult.source === "article" && previewResult.articleInfo && (
                <div className="mb-2">
                  <p className="text-xs text-gray-500 mb-0.5">記事URL</p>
                  <a
                    href={previewResult.articleInfo.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-600 hover:underline break-all"
                  >
                    {previewResult.articleInfo.url}
                  </a>
                  {previewResult.articleInfo.author && (
                    <p className="text-xs text-gray-400 mt-1">
                      {previewResult.articleInfo.siteName && `${previewResult.articleInfo.siteName} / `}
                      {previewResult.articleInfo.author}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className={`rounded-lg p-3 mb-4 text-sm ${isEditMode ? "bg-green-50 text-green-800" : "bg-blue-50 text-blue-800"}`}>
            {isEditMode
              ? "✏️ 保存済みデータを編集中です。変更後「変更を保存」ボタンをクリックしてください"
              : "💡 登録する商品にチェックを入れて「登録する」ボタンをクリックしてください"}
          </div>

          {/* 要約 */}
          <div className="mb-4">
            <h3 className="text-sm font-medium text-gray-600 mb-1">要約</h3>
            <textarea
              value={previewResult.summary}
              onChange={(e) => setPreviewResult({ ...previewResult, summary: e.target.value })}
              rows={4}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-y"
            />
          </div>

          {/* 職業タグ編集 */}
          <div className="mb-4">
            <h3 className="text-sm font-medium text-gray-600 mb-2">発信者の職業タグ</h3>
            {previewResult.occupation && (
              <p className="text-gray-500 text-xs mb-2">AI推定: {previewResult.occupation}</p>
            )}

            {/* 現在の職業タグ（削除可能） */}
            <div className="flex flex-wrap gap-2 mb-3">
              {editableOccupationTags.map((tag, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-purple-50 text-purple-700 rounded-full"
                >
                  {tag}
                  <button
                    onClick={() => removeOccupationTag(tag)}
                    className="hover:text-purple-900 ml-1"
                    type="button"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
              {editableOccupationTags.length === 0 && (
                <span className="text-xs text-gray-400">職業タグがありません</span>
              )}
            </div>

            {/* プリセットから追加 */}
            <div className="mb-3">
              <p className="text-xs text-gray-500 mb-1">プリセットから追加:</p>
              <div className="flex flex-wrap gap-1">
                {AVAILABLE_OCCUPATION_TAGS.filter((t) => !editableOccupationTags.includes(t)).slice(0, 10).map((tag) => (
                  <button
                    key={tag}
                    onClick={() => addOccupationTag(tag)}
                    className="px-2 py-0.5 text-xs bg-purple-100 text-purple-600 rounded hover:bg-purple-200 transition-colors"
                    type="button"
                  >
                    + {tag}
                  </button>
                ))}
                {AVAILABLE_OCCUPATION_TAGS.filter((t) => !editableOccupationTags.includes(t)).length > 10 && (
                  <span className="text-xs text-gray-400 py-0.5">...</span>
                )}
              </div>
            </div>

            {/* カスタム職業タグ入力 */}
            <div className="flex gap-2">
              <input
                type="text"
                value={newOccupationTagInput}
                onChange={(e) => setNewOccupationTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addOccupationTag(newOccupationTagInput);
                    setNewOccupationTagInput("");
                  }
                }}
                placeholder="カスタム職業タグを追加..."
                className="flex-1 px-3 py-1 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
              <button
                onClick={() => {
                  addOccupationTag(newOccupationTagInput);
                  setNewOccupationTagInput("");
                }}
                className="px-3 py-1 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                type="button"
              >
                追加
              </button>
            </div>
          </div>

          {/* タグ編集 */}
          <div className="mb-4">
            <h3 className="text-sm font-medium text-gray-600 mb-2">デスクセットアップの特徴</h3>

            {/* 現在のタグ（削除可能） */}
            <div className="flex flex-wrap gap-2 mb-3">
              {editableTags.map((tag, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-blue-50 text-blue-700 rounded-full"
                >
                  {tag}
                  <button
                    onClick={() => removeTag(tag)}
                    className="hover:text-blue-900 ml-1"
                    type="button"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
              {editableTags.length === 0 && (
                <span className="text-xs text-gray-400">タグがありません</span>
              )}
            </div>

            {/* グループ別タグ選択 */}
            <div className="mb-3 space-y-2">
              {TAG_GROUPS.map((group) => {
                const selectedInGroup = editableTags.filter(t => (group.tags as readonly string[]).includes(t));
                return (
                  <div key={group.name}>
                    <p className="text-xs text-gray-500 mb-1">
                      {group.name}
                      {group.exclusive ? "（1つのみ）" : "（複数可）"}
                      {selectedInGroup.length > 0 && (
                        <span className="ml-1 text-blue-600">✓ {selectedInGroup.join(", ")}</span>
                      )}
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {group.tags.filter((t) => !editableTags.includes(t)).map((tag) => (
                        <button
                          key={tag}
                          onClick={() => addTag(tag)}
                          className="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded hover:bg-gray-200 transition-colors"
                          type="button"
                        >
                          + {tag}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* カスタムタグ入力 */}
            <div className="flex gap-2">
              <input
                type="text"
                value={newTagInput}
                onChange={(e) => setNewTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addTag(newTagInput);
                    setNewTagInput("");
                  }
                }}
                placeholder="カスタムタグを入力"
                className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              />
              <button
                onClick={() => {
                  addTag(newTagInput);
                  setNewTagInput("");
                }}
                disabled={!newTagInput.trim()}
                className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                type="button"
              >
                追加
              </button>
            </div>
          </div>

          {/* 商品リスト（チェックボックス付き） */}
          <div className="mt-6 pt-5 border-t border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <h3 className="text-sm font-semibold text-gray-800">
                  {isEditMode ? "登録済みの商品" : "抽出された商品"}
                </h3>
                {!isEditMode && (
                  <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                    {selectedProducts.size} / {previewResult.products.length} 選択
                  </span>
                )}
              </div>
              {!isEditMode && (
                <button
                  onClick={toggleAllProducts}
                  className="text-xs text-blue-600 hover:text-blue-800 font-medium transition-colors"
                >
                  {selectedProducts.size === previewResult.products.length ? "全解除" : "全選択"}
                </button>
              )}
            </div>

            <div className="space-y-2">
              {previewResult.products.map((product, productIndex) => {
                const key = `${product.name}|${product.category}`;
                const isSelected = selectedProducts.has(key);
                return (
                  <div
                    key={productIndex}
                    onClick={() => !isEditMode && toggleProductSelection(product)}
                    className={`rounded-xl text-sm transition-all border ${
                      isEditMode
                        ? "bg-white border-gray-200"
                        : isSelected
                          ? "bg-white border-blue-300 shadow-sm cursor-pointer"
                          : "bg-white border-gray-200 hover:border-gray-300 cursor-pointer"
                    }`}
                  >
                    {/* ヘッダー: チェック + 商品名 + 確信度 */}
                    <div className={`flex items-center gap-3 px-4 py-3 border-b ${isEditMode ? "border-gray-100 bg-gray-50/60" : isSelected ? "border-blue-100 bg-blue-50/40" : "border-gray-100 bg-gray-50/60"} rounded-t-xl`}>
                      {!isEditMode && (
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleProductSelection(product)}
                          onClick={(e) => e.stopPropagation()}
                          className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500 flex-shrink-0"
                        />
                      )}
                      <span className="font-semibold text-gray-900 truncate">{product.name}</span>
                      {product.brand && <span className="text-xs text-gray-400 flex-shrink-0">{product.brand}</span>}
                      {product.isExisting && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 border border-blue-300 font-medium flex-shrink-0">
                          既存商品
                        </span>
                      )}
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 ml-auto ${confidenceColors[product.confidence]}`}
                      >
                        {confidenceLabels[product.confidence]}
                      </span>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleRemoveProduct(productIndex); }}
                        className="text-gray-300 hover:text-red-500 transition-colors flex-shrink-0 ml-1"
                        type="button"
                        title="この商品を削除"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="px-4 py-3 space-y-3" onClick={(e) => e.stopPropagation()}>
                      {/* 編集フィールド */}
                      <div className="grid grid-cols-[1fr_140px_150px] gap-2">
                        <div>
                          <label className="block text-[11px] font-medium text-gray-400 mb-0.5 uppercase tracking-wider">商品名</label>
                          <input
                            type="text"
                            value={product.name}
                            onChange={(e) => handleProductNameChange(productIndex, e.target.value)}
                            className="w-full text-sm text-gray-900 px-2.5 py-1.5 border border-gray-200 rounded-lg bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-medium text-gray-400 mb-0.5 uppercase tracking-wider">ブランド</label>
                          <input
                            type="text"
                            value={product.brand || ""}
                            onChange={(e) => handleProductBrandChange(productIndex, e.target.value)}
                            placeholder="--"
                            className="w-full text-sm text-gray-700 px-2.5 py-1.5 border border-gray-200 rounded-lg bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-medium text-gray-400 mb-0.5 uppercase tracking-wider">カテゴリ</label>
                          <select
                            value={product.category}
                            onChange={(e) => handleCategoryChange(productIndex, e.target.value)}
                            className="w-full text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                          >
                            {PRODUCT_CATEGORIES.map((cat) => (
                              <option key={cat} value={cat}>{cat}</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {/* 理由（コメント文） */}
                      <textarea
                        value={product.reason || ""}
                        onChange={(e) => handleProductReasonChange(productIndex, e.target.value)}
                        placeholder="投稿者のコメント文"
                        rows={2}
                        className="w-full text-xs text-gray-600 border border-gray-200 rounded-lg px-2.5 py-1.5 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all resize-y leading-relaxed"
                      />

                      {/* タグ（種類タグ + 特徴タグ） */}
                      {(() => {
                        const currentTags = product.tags || [];
                        const axes = TYPE_TAGS_MULTI_AXIS[product.category] || [];
                        const categoryFeatures = CATEGORY_FEATURE_TAGS[product.category] || [];
                        return (
                          <div className="space-y-2">
                            {/* 付与済みタグ */}
                            {currentTags.length > 0 && (
                              <div className="flex flex-wrap gap-1.5">
                                {currentTags.map((tag, tagIdx) => (
                                  <span
                                    key={tagIdx}
                                    className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-emerald-50 text-emerald-700 rounded-md border border-emerald-200"
                                  >
                                    {tag}
                                    <button
                                      onClick={() => handleRemoveProductTag(productIndex, tag)}
                                      className="text-emerald-400 hover:text-emerald-700 transition-colors"
                                      type="button"
                                    >
                                      <X className="w-3 h-3" />
                                    </button>
                                  </span>
                                ))}
                              </div>
                            )}
                            {/* 種類タグ選択（軸ごとに排他） */}
                            {axes.length > 0 && (
                              <div className="space-y-1">
                                {axes.map(({ axis, tags: axisTags }) => (
                                  <div key={axis} className="flex items-center gap-1.5 flex-wrap">
                                    <span className="text-[10px] text-gray-400 font-medium w-16 flex-shrink-0">{axis}</span>
                                    {axisTags.map((tag) => {
                                      const isSelected = currentTags.includes(tag);
                                      return (
                                        <button
                                          key={tag}
                                          type="button"
                                          onClick={() => {
                                            if (isSelected) {
                                              handleRemoveProductTag(productIndex, tag);
                                            } else {
                                              // 同じ軸の既存タグを除去してから追加（排他）
                                              const otherAxisTags = axisTags.filter(t => t !== tag);
                                              const cleaned = currentTags.filter(t => !otherAxisTags.includes(t));
                                              const updatedProducts = [...previewResult!.products];
                                              updatedProducts[productIndex] = { ...updatedProducts[productIndex], tags: [...cleaned.filter(t => t !== tag), tag] };
                                              setPreviewResult({ ...previewResult!, products: updatedProducts });
                                            }
                                          }}
                                          className={`px-1.5 py-0.5 text-[11px] rounded border transition-colors ${
                                            isSelected
                                              ? "bg-blue-600 text-white border-blue-600"
                                              : "bg-white text-gray-500 border-gray-200 hover:border-blue-300 hover:text-blue-600"
                                          }`}
                                        >
                                          {isSelected ? "✓ " : ""}{tag}
                                        </button>
                                      );
                                    })}
                                  </div>
                                ))}
                              </div>
                            )}
                            {/* 特徴タグ選択（カテゴリ固有のみ・複数選択可） */}
                            {categoryFeatures.length > 0 && (
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-[10px] text-gray-400 font-medium w-16 flex-shrink-0">特徴</span>
                                {categoryFeatures.map((tag) => {
                                  const isSelected = currentTags.includes(tag);
                                  return (
                                    <button
                                      key={tag}
                                      type="button"
                                      onClick={() => {
                                        if (isSelected) {
                                          handleRemoveProductTag(productIndex, tag);
                                        } else {
                                          handleAddProductTag(productIndex, tag);
                                        }
                                      }}
                                      className={`px-1.5 py-0.5 text-[11px] rounded border transition-colors ${
                                        isSelected
                                          ? "bg-amber-500 text-white border-amber-500"
                                          : "bg-white text-gray-400 border-gray-200 hover:border-amber-300 hover:text-amber-600"
                                      }`}
                                    >
                                      {isSelected ? "✓ " : ""}{tag}
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })()}

                      {/* マッチ情報 + 再検索 */}
                      <div className={`flex items-center gap-3 rounded-lg px-3 py-2 ${product.amazon ? "bg-gray-50" : "bg-amber-50/60"}`}>
                        {product.amazon ? (
                          <>
                            {product.amazon.imageUrl && (
                              <img src={product.amazon.imageUrl} alt={`${product.name}の商品画像`} className="w-10 h-10 object-contain rounded-md bg-white border border-gray-100 flex-shrink-0" />
                            )}
                            <div className="flex-1 min-w-0">
                              <a
                                href={product.amazon.url?.replace(/&tag=[^&]*/g, "").replace(/\?tag=[^&]*&?/, "?")}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-gray-700 hover:text-blue-600 hover:underline line-clamp-1 block"
                              >
                                {product.amazon.title}
                              </a>
                              <div className="flex items-center gap-2 mt-0.5">
                                {product.amazon.price && (
                                  <span className="text-xs font-semibold text-gray-900">¥{product.amazon.price.toLocaleString()}</span>
                                )}
                                {product.source && (
                                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${product.source === "amazon" ? "bg-orange-100 text-orange-700" : "bg-red-100 text-red-700"}`}>
                                    {product.source === "amazon" ? "Amazon" : "楽天"}
                                  </span>
                                )}
                                <a
                                  href={`https://search.rakuten.co.jp/search/mall/${encodeURIComponent(product.name)}/`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-[10px] text-red-400 hover:text-red-600 hover:underline"
                                >
                                  楽天で見る
                                </a>
                              </div>
                            </div>
                          </>
                        ) : (
                          <span className="text-xs text-amber-600 flex-1">未マッチ — 再検索してください</span>
                        )}
                        <div className="flex gap-1 flex-shrink-0">
                          <button
                            onClick={() => openAmazonSearch(productIndex, "amazon")}
                            className="text-[11px] px-2 py-1 rounded-md bg-orange-50 text-orange-600 hover:bg-orange-100 font-medium transition-colors border border-orange-200"
                            type="button"
                          >
                            Amazon
                          </button>
                          <button
                            onClick={() => openAmazonSearch(productIndex, "rakuten")}
                            className="text-[11px] px-2 py-1 rounded-md bg-red-50 text-red-600 hover:bg-red-100 font-medium transition-colors border border-red-200"
                            type="button"
                          >
                            楽天
                          </button>
                          <button
                            onClick={() => openOfficialSiteModal(productIndex)}
                            className="text-[11px] px-2 py-1 rounded-md bg-blue-50 text-blue-600 hover:bg-blue-100 font-medium transition-colors border border-blue-200"
                            type="button"
                          >
                            公式サイト
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* 商品を手動追加ボタン */}
            <button
              onClick={handleAddManualProduct}
              className="mt-3 w-full py-2.5 text-sm text-gray-500 border-2 border-dashed border-gray-300 rounded-xl hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50/30 transition-all font-medium"
              type="button"
            >
              ＋ 商品を手動追加
            </button>
          </div>

          {/* 登録/更新ボタン */}
          <div className="mt-6 pt-5 border-t border-gray-200 flex items-center justify-between">
            <p className="text-sm text-gray-500">
              {isEditMode
                ? "保存済みソースの内容を更新します"
                : <><span className="font-semibold text-gray-800">{selectedProducts.size}件</span>の商品を登録します</>}
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleCancelPreview}
                className="px-5 py-2.5 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium"
              >
                キャンセル
              </button>
              {isEditMode ? (
                <button
                  onClick={handleUpdateSource}
                  disabled={saving}
                  className="px-6 py-2.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors font-medium shadow-sm"
                >
                  {saving ? "保存中..." : "変更を保存"}
                </button>
              ) : (
                <button
                  onClick={handleSaveProducts}
                  disabled={saving || selectedProducts.size === 0}
                  className="px-6 py-2.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors font-medium shadow-sm"
                >
                  {saving ? "登録中..." : `${selectedProducts.size}件を登録する`}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 解析結果（保存後） */}
      {analysisResult && (
        <div className="bg-white rounded-lg shadow-md p-6 mb-6 border-2 border-green-300">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">
              {analysisResult.source === "video" ? "📺" : "📄"} 登録完了: {analysisResult.title}
            </h2>
            <button
              onClick={() => setAnalysisResult(null)}
              className="text-gray-400 hover:text-gray-600"
            >
              ✕ 閉じる
            </button>
          </div>

          <div className="bg-green-50 rounded-lg p-3 mb-4 text-sm text-green-800">
            ✅ {analysisResult.products.length}件の商品が登録されました
          </div>

          {/* 要約 */}
          <div className="mb-4">
            <h3 className="text-sm font-medium text-gray-600 mb-1">要約</h3>
            <p className="text-gray-700">{analysisResult.summary}</p>
          </div>

          {/* 職業 */}
          {analysisResult.occupation && (
            <div className="mb-4">
              <h3 className="text-sm font-medium text-gray-600 mb-1">発信者の職業</h3>
              <p className="text-gray-700">{analysisResult.occupation}</p>
              {analysisResult.occupationTags.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {analysisResult.occupationTags.map((tag, idx) => (
                    <span
                      key={idx}
                      className="inline-block px-2 py-1 text-xs bg-purple-50 text-purple-700 rounded-full"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* タグ */}
          {analysisResult.tags.length > 0 && (
            <div className="mb-4">
              <h3 className="text-sm font-medium text-gray-600 mb-1">デスクセットアップの特徴</h3>
              <div className="flex flex-wrap gap-2">
                {analysisResult.tags.map((tag, idx) => (
                  <span
                    key={idx}
                    className="inline-block px-2 py-1 text-xs bg-blue-50 text-blue-700 rounded-full"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* 商品リスト */}
          <div className="mt-6 pt-4 border-t border-gray-200">
            <h3 className="text-sm font-medium text-gray-600 mb-3">
              登録された商品 ({analysisResult.products.length}件)
            </h3>

            {groupedProducts &&
              Object.entries(groupedProducts).map(([category, products]) => (
                <div key={category} className="mb-4 last:mb-0">
                  <h4 className="text-sm font-medium text-gray-800 mb-2 pb-1 border-b border-gray-100">
                    {category} ({products.length})
                  </h4>
                  <div className="space-y-2">
                    {products.map((product, idx) => {
                      const amazonInfo = amazonInfoMap.get(product.name);
                      return (
                        <div
                          key={idx}
                          className="border border-gray-200 rounded-lg p-3 text-sm"
                        >
                          <div className="flex items-start justify-between">
                            <div>
                              <span className="font-medium text-gray-900">
                                {product.name}
                              </span>
                              {product.brand && (
                                <span className="ml-2 text-xs text-gray-500">
                                  ({product.brand})
                                </span>
                              )}
                            </div>
                            <span
                              className={`text-xs px-2 py-0.5 rounded ${confidenceColors[product.confidence]}`}
                            >
                              {confidenceLabels[product.confidence]}
                            </span>
                          </div>
                          <p className="text-gray-600 mt-1 text-xs line-clamp-2">
                            {product.reason}
                          </p>

                          {/* Amazon情報 */}
                          {amazonInfo && (
                            <div className="mt-2 pt-2 border-t border-gray-100 flex gap-2 items-center">
                              {amazonInfo.imageUrl && (
                                <img
                                  src={amazonInfo.imageUrl}
                                  alt={amazonInfo.title}
                                  className="w-10 h-10 object-contain"
                                />
                              )}
                              <div className="flex-1 min-w-0">
                                <a
                                  href={amazonInfo.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs text-blue-600 hover:underline line-clamp-1"
                                >
                                  {amazonInfo.title}
                                </a>
                                {amazonInfo.price && (
                                  <span className="text-xs font-medium text-orange-600 ml-2">
                                    ¥{amazonInfo.price.toLocaleString()}
                                  </span>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* 過去の解析結果を再表示 */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-lg font-semibold mb-3">🗂 過去の解析結果を再表示</h2>
        <div className="flex items-center gap-3 mb-4">
          <select
            value={sourceType}
            onChange={(e) => setSourceType(e.target.value as "video" | "article")}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
          >
            <option value="video">動画</option>
            <option value="article">記事</option>
          </select>
          <button
            onClick={() => fetchSourceList(1)}
            disabled={loadingSourceList}
            className="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm hover:bg-gray-800 disabled:bg-gray-400"
          >
            {loadingSourceList ? "取得中..." : "一覧を取得"}
          </button>
          <button
            onClick={refreshSelectedSource}
            disabled={!selectedSource || loadingSourceDetail}
            className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 disabled:bg-gray-400"
          >
            {loadingSourceDetail ? "更新中..." : "表示中の結果を更新"}
          </button>
          {selectedSource && (
            <span className="text-xs text-gray-500">
              選択中: {selectedSource.type === "video" ? "動画" : "記事"}
            </span>
          )}
        </div>

        {sourceList.length > 0 && (
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <div className="grid grid-cols-[260px_1fr_180px_90px_200px] gap-3 px-4 py-2 bg-gray-50 text-xs text-gray-500">
              <span>サムネイル</span>
              <span>タイトル</span>
              <span>{sourceType === "video" ? "チャンネル" : "著者"}</span>
              <span>公開日</span>
              <span>操作</span>
            </div>
            {sourceList.map((item, idx) => (
              <div
                key={`${item.sourceId}-${idx}`}
                className="grid grid-cols-[260px_1fr_180px_90px_200px] gap-3 px-4 py-3 border-t text-sm items-center"
              >
                <div className="flex items-center gap-3">
                  {item.thumbnailUrl ? (
                    <img
                      src={item.thumbnailUrl}
                      alt={item.title}
                      className="w-24 h-14 object-cover rounded border border-gray-200"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-24 h-14 rounded bg-gray-100 border border-gray-200 text-[10px] text-gray-400 flex items-center justify-center">
                      no image
                    </div>
                  )}
                  {typeof item.productCount === "number" && (
                    <div className="text-xs text-gray-400">商品数: {item.productCount}</div>
                  )}
                </div>
                <div className="min-w-0">
                  <div className="font-medium text-gray-900 line-clamp-1">{item.title}</div>
                </div>
                <div className="text-gray-600 line-clamp-1">
                  {sourceType === "video" ? item.channelTitle : item.author}
                </div>
                <div className="text-gray-500 text-xs">
                  {item.publishedAt ? new Date(item.publishedAt).toLocaleDateString("ja-JP") : "-"}
                </div>
                <div className="flex gap-1.5 whitespace-nowrap">
                  <button
                    onClick={() => loadSourceDetail(item.type, item.sourceId)}
                    className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    表示
                  </button>
                  <button
                    onClick={() => handleReanalyzeSource(item.type, item.sourceId, item.title)}
                    disabled={reanalyzingSourceId === item.sourceId || deletingSourceId === item.sourceId}
                    className="px-3 py-1.5 text-xs bg-amber-500 text-white rounded hover:bg-amber-600 disabled:bg-gray-400 disabled:cursor-not-allowed"
                  >
                    {reanalyzingSourceId === item.sourceId ? "解析中..." : "再解析"}
                  </button>
                  <button
                    onClick={() => handleDeleteSource(item.type, item.sourceId, item.title)}
                    disabled={deletingSourceId === item.sourceId || reanalyzingSourceId === item.sourceId}
                    className="px-3 py-1.5 text-xs bg-red-500 text-white rounded hover:bg-red-600 disabled:bg-gray-400 disabled:cursor-not-allowed"
                  >
                    {deletingSourceId === item.sourceId ? "..." : "削除"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {!loadingSourceList && sourceList.length === 0 && (
          <p className="text-sm text-gray-500">「一覧を取得」を押すと過去データが表示されます。</p>
        )}
      </div>

      {/* サジェスト動画セクション */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-lg font-semibold mb-3">🔍 解析候補の動画を検索</h2>
        <div className="flex gap-3 mb-4">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="空欄ならランダムキーワードで検索"
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            onKeyDown={(e) => e.key === "Enter" && fetchSuggestions()}
          />
          <button
            onClick={() => fetchSuggestions()}
            disabled={loadingSuggestions}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition-colors whitespace-nowrap"
          >
            {loadingSuggestions ? "検索中..." : "検索"}
          </button>
          <button
            onClick={() => fetchSuggestions()}
            disabled={loadingSuggestions}
            className="px-5 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-gray-400 transition-colors text-sm font-medium whitespace-nowrap"
          >
            {loadingSuggestions ? "取得中..." : "DB未登録リストを表示"}
          </button>
        </div>

        {/* サジェスト動画リスト */}
        {suggestions.length > 0 && (
          <div>
            {usedQuery && (
              <p className="text-xs text-gray-400 mb-3">検索ワード: 「{usedQuery}」 — {suggestions.length}件</p>
            )}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {suggestions.map((video) => (
              <div
                key={video.videoId}
                onClick={() => !video.isAnalyzed && handleSuggestionClick(video)}
                className={`border rounded-lg overflow-hidden transition-all ${
                  video.isAnalyzed
                    ? "border-gray-200 bg-gray-50 opacity-60"
                    : "border-gray-200 hover:border-blue-400 hover:shadow-md cursor-pointer"
                }`}
              >
                <div className="relative">
                  <img
                    src={video.thumbnailUrl}
                    alt={video.title}
                    className="w-full aspect-video object-cover"
                  />
                  <div className="absolute bottom-2 right-2 bg-black/80 text-white text-xs px-1.5 py-0.5 rounded">
                    {video.duration}
                  </div>
                  {video.isAnalyzed && (
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                      <span className="bg-green-500 text-white text-xs px-2 py-1 rounded">
                        解析済み
                      </span>
                    </div>
                  )}
                </div>
                <div className="p-3">
                  <h3 className="text-sm font-medium line-clamp-2 mb-1">
                    {video.title}
                  </h3>
                  <p className="text-xs text-gray-500">{video.channelTitle}</p>
                  <div className="flex items-center gap-2 mt-2 text-xs text-gray-400">
                    <span>{video.viewCount.toLocaleString()}回視聴</span>
                    <span>•</span>
                    <span>{new Date(video.publishedAt).toLocaleDateString("ja-JP")}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
          </div>
        )}

        {!loadingSuggestions && suggestions.length === 0 && (
          <p className="text-gray-500 text-center py-8">
            「DB未登録リストを表示」ボタンを押すと、ランダムなキーワードで未登録動画を検索します。
          </p>
        )}
      </div>

      {/* 一括処理セクション */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-lg font-semibold mb-3">⚡ 一括処理</h2>
        <div className="flex items-center gap-3">
          <button
            onClick={async () => {
              setGeneratingReasons(true);
              setReasonsResult(null);
              try {
                const res = await fetch("/api/generate-chosen-reasons", { method: "POST" });
                const data = await res.json();
                setReasonsResult(data);
              } catch {
                setReasonsResult({ message: "エラーが発生しました", processed: 0, errors: 1, total: 0 });
              } finally {
                setGeneratingReasons(false);
              }
            }}
            disabled={generatingReasons}
            className="px-5 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-400 transition-colors text-sm font-medium whitespace-nowrap"
          >
            {generatingReasons ? "生成中..." : "選ばれている理由を一括生成"}
          </button>
          <span className="text-xs text-gray-500">コメント10件以上の商品に対してGeminiで「選ばれている理由TOP3」を生成します</span>
        </div>
        {generatingReasons && (
          <div className="mt-3 text-sm text-purple-600 animate-pulse">
            Gemini APIで順次生成中です。商品数によっては数分かかります...
          </div>
        )}
        {reasonsResult && (
          <div className={`mt-3 p-3 rounded-lg text-sm ${reasonsResult.errors > 0 ? "bg-yellow-50 text-yellow-800" : "bg-green-50 text-green-800"}`}>
            <p className="font-medium">{reasonsResult.message}</p>
            {reasonsResult.total > 0 && (
              <p className="mt-1 text-xs">
                対象: {reasonsResult.total}件 / 成功: {reasonsResult.processed}件 / エラー: {reasonsResult.errors}件
              </p>
            )}
          </div>
        )}
      </div>

      {/* 商品検索モーダル（Amazon / 楽天） */}
      {amazonSearchModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setAmazonSearchModal(null)} />
          <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col">
            {/* ヘッダー */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
              <h3 className="text-base font-semibold text-gray-900">
                <span className={amazonSearchModal.source === "rakuten" ? "text-red-600" : "text-orange-600"}>
                  {amazonSearchModal.source === "rakuten" ? "楽天" : "Amazon"}
                </span>
                {" "}商品検索
              </h3>
              <button onClick={() => setAmazonSearchModal(null)} className="text-gray-400 hover:text-gray-600" type="button">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* 検索フォーム */}
            <div className="px-5 py-3 border-b border-gray-100">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={amazonSearchModal.query}
                  onChange={(e) => setAmazonSearchModal({ ...amazonSearchModal, query: e.target.value })}
                  onKeyDown={(e) => e.key === "Enter" && executeAmazonSearch()}
                  placeholder="商品名・キーワードで検索"
                  className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  autoFocus
                />
                <button
                  onClick={executeAmazonSearch}
                  disabled={amazonSearchModal.loading}
                  className={`px-4 py-2 text-sm text-white rounded-lg disabled:bg-gray-300 transition-colors whitespace-nowrap ${amazonSearchModal.source === "rakuten" ? "bg-red-500 hover:bg-red-600" : "bg-orange-500 hover:bg-orange-600"}`}
                  type="button"
                >
                  {amazonSearchModal.loading ? "検索中..." : "検索"}
                </button>
              </div>
            </div>

            {/* 検索結果 */}
            <div className="flex-1 overflow-y-auto px-5 py-3 relative">
              {amazonSearchModal.selecting && (
                <div className="absolute inset-0 bg-white/80 z-10 flex items-center justify-center">
                  <div className="flex items-center gap-3 text-sm text-gray-600">
                    <div className="w-5 h-5 border-2 border-gray-200 border-t-blue-500 rounded-full animate-spin" />
                    商品データを取得中...
                  </div>
                </div>
              )}
              {amazonSearchModal.loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="w-6 h-6 border-2 border-gray-200 border-t-blue-500 rounded-full animate-spin" />
                </div>
              ) : (amazonSearchModal.dbCandidates.length > 0 || amazonSearchModal.candidates.length > 0) ? (
                <div className="space-y-3">
                  {/* DB登録済み商品（優先表示） */}
                  {amazonSearchModal.dbCandidates.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-green-700 mb-1.5 flex items-center gap-1">
                        <span className="w-2 h-2 bg-green-500 rounded-full" />
                        DB登録済み（{amazonSearchModal.dbCandidates.length}件）
                      </p>
                      <div className="space-y-2">
                        {amazonSearchModal.dbCandidates.map((candidate) => (
                          <button
                            key={candidate.id}
                            onClick={() => selectAmazonCandidate(candidate)}
                            disabled={amazonSearchModal.selecting}
                            className="w-full flex gap-3 items-center p-3 rounded-lg border-2 border-green-300 bg-green-50 hover:border-green-500 hover:bg-green-100 disabled:opacity-50 disabled:pointer-events-none transition-colors text-left"
                            type="button"
                          >
                            {candidate.imageUrl ? (
                              <img src={candidate.imageUrl} alt={candidate.title} className="w-14 h-14 object-contain bg-white rounded border border-gray-100 flex-shrink-0" />
                            ) : (
                              <div className="w-14 h-14 bg-gray-100 rounded flex items-center justify-center text-gray-400 flex-shrink-0 text-xs">No img</div>
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-gray-900 line-clamp-2">{candidate.title}</p>
                              <div className="flex items-center gap-2 mt-1">
                                {candidate.price && (
                                  <span className="text-sm font-medium text-green-700">¥{candidate.price.toLocaleString()}</span>
                                )}
                                {candidate.brand && (
                                  <span className="text-xs text-gray-500">{candidate.brand}</span>
                                )}
                                <span className="text-xs text-green-600 font-medium">{candidate.mentionCount}件の紹介</span>
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {/* API検索結果 */}
                  {amazonSearchModal.candidates.length > 0 && (
                    <div>
                      {amazonSearchModal.dbCandidates.length > 0 && (
                        <p className="text-xs font-medium text-gray-500 mb-1.5">
                          {amazonSearchModal.source === "rakuten" ? "楽天" : "Amazon"}検索結果（{amazonSearchModal.candidates.length}件）
                        </p>
                      )}
                      <div className="space-y-2">
                        {amazonSearchModal.candidates.map((candidate) => (
                          <button
                            key={candidate.id}
                            onClick={() => selectAmazonCandidate(candidate)}
                            disabled={amazonSearchModal.selecting}
                            className="w-full flex gap-3 items-center p-3 rounded-lg border border-gray-200 hover:border-blue-400 hover:bg-blue-50 disabled:opacity-50 disabled:pointer-events-none transition-colors text-left"
                            type="button"
                          >
                            {candidate.imageUrl ? (
                              <img src={candidate.imageUrl} alt={candidate.title} className="w-14 h-14 object-contain bg-white rounded border border-gray-100 flex-shrink-0" />
                            ) : (
                              <div className="w-14 h-14 bg-gray-100 rounded flex items-center justify-center text-gray-400 flex-shrink-0 text-xs">No img</div>
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-gray-900 line-clamp-2">{candidate.title}</p>
                              <div className="flex items-center gap-2 mt-1">
                                {candidate.price && (
                                  <span className={`text-sm font-medium ${amazonSearchModal.source === "rakuten" ? "text-red-600" : "text-orange-600"}`}>¥{candidate.price.toLocaleString()}</span>
                                )}
                                {candidate.brand && (
                                  <span className="text-xs text-gray-500">{candidate.brand}</span>
                                )}
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-center text-gray-400 py-12 text-sm">
                  キーワードを入力して検索してください
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 公式サイトモーダル */}
      {officialSiteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setOfficialSiteModal(null)} />
          <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-lg flex flex-col">
            {/* ヘッダー */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
              <h3 className="text-base font-semibold text-gray-900">
                <span className="text-blue-600">公式サイト</span> 商品情報取得
              </h3>
              <button onClick={() => setOfficialSiteModal(null)} className="text-gray-400 hover:text-gray-600" type="button">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* URL入力 */}
            <div className="px-5 py-3 border-b border-gray-100">
              <div className="flex gap-2">
                <input
                  type="url"
                  value={officialSiteModal.url}
                  onChange={(e) => setOfficialSiteModal({ ...officialSiteModal, url: e.target.value })}
                  onKeyDown={(e) => e.key === "Enter" && fetchOfficialSiteOGP()}
                  placeholder="https://www.sony.jp/... などの公式サイトURL"
                  className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  autoFocus
                />
                <button
                  onClick={fetchOfficialSiteOGP}
                  disabled={officialSiteModal.loading || !officialSiteModal.url.trim()}
                  className="px-4 py-2 text-sm text-white rounded-lg bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 transition-colors whitespace-nowrap"
                  type="button"
                >
                  {officialSiteModal.loading ? "取得中..." : "取得"}
                </button>
              </div>
            </div>

            {/* OGPプレビュー & 価格入力 */}
            <div className="px-5 py-4 space-y-4">
              {officialSiteModal.fetched ? (
                <>
                  <div className="flex gap-3 p-3 rounded-lg border border-blue-200 bg-blue-50">
                    {officialSiteModal.imageUrl ? (
                      <img
                        src={officialSiteModal.imageUrl}
                        alt={officialSiteModal.title}
                        className="w-20 h-20 object-contain bg-white rounded border border-gray-100 flex-shrink-0"
                      />
                    ) : (
                      <div className="w-20 h-20 bg-gray-100 rounded flex items-center justify-center text-gray-400 flex-shrink-0 text-xs">
                        No img
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 line-clamp-2">
                        {officialSiteModal.title || "タイトル未取得"}
                      </p>
                      {officialSiteModal.brand && (
                        <p className="text-xs text-blue-600 mt-1">{officialSiteModal.brand}</p>
                      )}
                      <p className="text-xs text-gray-400 mt-1 truncate">{officialSiteModal.url}</p>
                    </div>
                  </div>

                  {/* 価格入力 */}
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      価格（税込・任意）
                    </label>
                    <div className="flex items-center gap-1">
                      <span className="text-sm text-gray-500">¥</span>
                      <input
                        type="text"
                        value={officialSiteModal.price}
                        onChange={(e) =>
                          setOfficialSiteModal({ ...officialSiteModal, price: e.target.value.replace(/[^0-9]/g, "") })
                        }
                        placeholder="例: 49800"
                        className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  </div>

                  {/* 確定ボタン */}
                  <button
                    onClick={confirmOfficialSite}
                    className="w-full py-2.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
                    type="button"
                  >
                    この商品情報を使用
                  </button>
                </>
              ) : !officialSiteModal.loading ? (
                <p className="text-center text-gray-400 py-8 text-sm">
                  公式サイトのURLを入力して「取得」を押してください
                </p>
              ) : (
                <div className="flex items-center justify-center py-8">
                  <div className="w-6 h-6 border-2 border-gray-200 border-t-blue-500 rounded-full animate-spin" />
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </main>
  );
}
