"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import { PRODUCT_CATEGORIES, SUBCATEGORIES } from "@/lib/constants";

interface Product {
  name: string;
  brand?: string;
  category: string;
  subcategory?: string | null;
  reason: string;
  confidence: "high" | "medium" | "low";
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

  // 解析結果表示用（保存後）
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);

  // サジェスト動画
  const [suggestions, setSuggestions] = useState<SuggestedVideo[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [searchQuery, setSearchQuery] = useState("デスクツアー");

  // 利用可能なプリセットタグ（デスクセットアップ特徴）
  const AVAILABLE_TAGS = [
    "ミニマリスト", "ゲーミング", "おしゃれ", "ホワイト", "ブラック",
    "モノトーン", "ナチュラル", "北欧", "インダストリアル", "かわいい",
    "デュアルモニター", "トリプルモニター", "ウルトラワイド",
    "スタンディングデスク", "L字デスク", "Mac環境", "Windows環境",
    "リモートワーク", "在宅勤務", "DIY", "ケーブルレス", "配線整理",
    "RGBライティング", "コスパ重視", "ハイエンド",
  ];

  // 利用可能な職業タグ
  const AVAILABLE_OCCUPATION_TAGS = [
    "エンジニア", "Webエンジニア", "フロントエンドエンジニア", "バックエンドエンジニア",
    "デザイナー", "UIデザイナー", "UXデザイナー", "Webデザイナー", "グラフィックデザイナー",
    "クリエイター", "動画編集者", "映像クリエイター", "YouTuber", "ライター", "ブロガー",
    "イラストレーター", "配信者", "VTuber", "ゲーマー",
    "会社員", "フリーランス", "経営者", "学生", "研究者",
    "フォトグラファー", "カメラマン", "音楽クリエイター", "DTMer",
  ];

  // タグ追加
  const addTag = (tag: string) => {
    const trimmedTag = tag.trim();
    if (trimmedTag && !editableTags.includes(trimmedTag)) {
      setEditableTags([...editableTags, trimmedTag]);
    }
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
      const res = await fetch(`/api/suggestions?q=${encodeURIComponent(query)}&maxResults=20`);
      const data = await res.json();
      setSuggestions(data.suggestions || []);
    } catch {
      console.error("サジェストの取得に失敗しました");
    } finally {
      setLoadingSuggestions(false);
    }
  };

  // 初回読み込み時にサジェストを取得
  useEffect(() => {
    fetchSuggestions();
  }, []);

  // プレビュー結果が設定されたらタグを初期化
  useEffect(() => {
    if (previewResult) {
      setEditableTags(previewResult.tags);
      setEditableOccupationTags(previewResult.occupationTags);
    }
  }, [previewResult]);

  // サジェスト動画をクリックして自動解析開始
  const handleSuggestionClick = async (video: SuggestedVideo) => {
    const videoUrl = `https://www.youtube.com/watch?v=${video.videoId}`;
    setYoutubeUrl(videoUrl);

    // 自動的に解析を開始
    setAnalyzingVideo(true);
    setMessage(null);
    setAnalysisResult(null);
    setPreviewResult(null);

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
      subcategory: null, // カテゴリ変更時はサブカテゴリをリセット
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

  // 商品のサブカテゴリを変更
  const handleSubcategoryChange = (productIndex: number, newSubcategory: string) => {
    if (!previewResult) return;
    const updatedProducts = [...previewResult.products];
    updatedProducts[productIndex] = {
      ...updatedProducts[productIndex],
      subcategory: newSubcategory || null,
    };

    setPreviewResult({
      ...previewResult,
      products: updatedProducts,
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

  // YouTubeのURLからvideo_idを抽出
  const extractVideoId = (url: string): string | null => {
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
      /^([a-zA-Z0-9_-]{11})$/,
    ];
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) return match[1];
    }
    return null;
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

  // プレビューをキャンセル
  const handleCancelPreview = () => {
    setPreviewResult(null);
    setSelectedProducts(new Set());
    setEditableTags([]);
    setNewTagInput("");
    setEditableOccupationTags([]);
    setNewOccupationTagInput("");
    setMessage(null);
  };

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
    <main className="max-w-6xl mx-auto px-4 py-8">
      <header className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">管理画面</h1>
            <p className="text-gray-600 mt-1">
              解析候補の動画を検索・管理
            </p>
          </div>
          <Link
            href="/"
            className="text-blue-600 hover:underline text-sm"
          >
            ← トップページに戻る
          </Link>
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
            placeholder="note記事やブログのURLを入力（例：https://note.com/...）"
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
          note.com、Zenn、Qiita、はてなブログなどのデスクツアー記事を解析できます
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
        <div className="bg-white rounded-lg shadow-md p-6 mb-6 border-2 border-blue-300">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">
              {previewResult.source === "video" ? "📺" : "📄"} プレビュー: {previewResult.title}
            </h2>
            <button
              onClick={handleCancelPreview}
              className="text-gray-400 hover:text-gray-600"
            >
              ✕ キャンセル
            </button>
          </div>

          <div className="bg-blue-50 rounded-lg p-3 mb-4 text-sm text-blue-800">
            💡 登録する商品にチェックを入れて「登録する」ボタンをクリックしてください
          </div>

          {/* 要約 */}
          <div className="mb-4">
            <h3 className="text-sm font-medium text-gray-600 mb-1">要約</h3>
            <p className="text-gray-700">{previewResult.summary}</p>
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

            {/* プリセットから追加 */}
            <div className="mb-3">
              <p className="text-xs text-gray-500 mb-1">プリセットから追加:</p>
              <div className="flex flex-wrap gap-1">
                {AVAILABLE_TAGS.filter((t) => !editableTags.includes(t)).slice(0, 12).map((tag) => (
                  <button
                    key={tag}
                    onClick={() => addTag(tag)}
                    className="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded hover:bg-gray-200 transition-colors"
                    type="button"
                  >
                    + {tag}
                  </button>
                ))}
                {AVAILABLE_TAGS.filter((t) => !editableTags.includes(t)).length > 12 && (
                  <span className="text-xs text-gray-400 py-0.5">...</span>
                )}
              </div>
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
          <div className="mt-6 pt-4 border-t border-gray-200">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-gray-600">
                抽出された商品 ({previewResult.products.length}件中 {selectedProducts.size}件選択)
              </h3>
              <button
                onClick={toggleAllProducts}
                className="text-xs text-blue-600 hover:underline"
              >
                {selectedProducts.size === previewResult.products.length ? "全解除" : "全選択"}
              </button>
            </div>

            <div className="space-y-2">
              {previewResult.products.map((product, productIndex) => {
                const key = `${product.name}|${product.category}`;
                const isSelected = selectedProducts.has(key);
                return (
                  <div
                    key={productIndex}
                    onClick={() => toggleProductSelection(product)}
                    className={`border rounded-lg p-3 text-sm cursor-pointer transition-colors ${
                      isSelected
                        ? "border-blue-400 bg-blue-50"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleProductSelection(product)}
                        className="mt-1 w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                        onClick={(e) => e.stopPropagation()}
                      />
                      <div className="flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <span className="font-medium text-gray-900">
                              {product.name}
                            </span>
                            {product.brand && (
                              <span className="ml-2 text-xs text-gray-500">
                                ({product.brand})
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {/* カテゴリ選択 */}
                            <select
                              value={product.category}
                              onChange={(e) => {
                                e.stopPropagation();
                                handleCategoryChange(productIndex, e.target.value);
                              }}
                              onClick={(e) => e.stopPropagation()}
                              className="text-xs border border-gray-300 rounded px-2 py-1 bg-white focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                            >
                              {PRODUCT_CATEGORIES.map((cat) => (
                                <option key={cat} value={cat}>{cat}</option>
                              ))}
                            </select>
                            {/* サブカテゴリ選択 */}
                            {SUBCATEGORIES[product.category] && (
                              <select
                                value={product.subcategory || ""}
                                onChange={(e) => {
                                  e.stopPropagation();
                                  handleSubcategoryChange(productIndex, e.target.value);
                                }}
                                onClick={(e) => e.stopPropagation()}
                                className="text-xs border border-gray-300 rounded px-2 py-1 bg-white focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                              >
                                <option value="">サブカテゴリ...</option>
                                {SUBCATEGORIES[product.category].map((subcat) => (
                                  <option key={subcat} value={subcat}>{subcat}</option>
                                ))}
                              </select>
                            )}
                            <span
                              className={`text-xs px-2 py-0.5 rounded ${confidenceColors[product.confidence]}`}
                            >
                              {confidenceLabels[product.confidence]}
                            </span>
                          </div>
                        </div>
                        <p className="text-gray-600 mt-1 text-xs line-clamp-2">
                          {product.reason}
                        </p>

                              {/* Amazon/楽天マッチング情報 */}
                              {product.amazon ? (
                                <div className="mt-2 pt-2 border-t border-gray-100">
                                  <div className="flex gap-2 items-start">
                                    {/* 画像プレビュー */}
                                    <div className="flex flex-col gap-1">
                                      {product.amazon.imageUrl && (
                                        <img
                                          src={product.amazon.imageUrl}
                                          alt={product.amazon.title}
                                          className="w-12 h-12 object-contain bg-white rounded border border-gray-100"
                                          onClick={(e) => e.stopPropagation()}
                                        />
                                      )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      {/* 商品タイトル */}
                                      <p className="text-xs text-gray-700 line-clamp-2 mb-1">
                                        {product.amazon.title}
                                      </p>
                                      {/* 画像URL編集 */}
                                      <div className="mb-1">
                                        <label className="text-xs text-gray-400">画像URL:</label>
                                        <input
                                          type="text"
                                          value={product.amazon.imageUrl || ""}
                                          onChange={(e) => handleAmazonFieldChange(productIndex, "imageUrl", e.target.value)}
                                          placeholder="URLまたはファイル名 (例: keyboard.jpg)"
                                          className="mt-0.5 text-xs border border-gray-200 rounded px-2 py-1 w-full focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                                          onClick={(e) => e.stopPropagation()}
                                        />
                                        <p className="text-xs text-gray-400 mt-0.5">
                                          ファイル名のみ入力すると /images/products/ から読み込みます
                                        </p>
                                      </div>
                                      {/* アフィリエイトURL編集 */}
                                      <div className="mb-1">
                                        <label className="text-xs text-gray-400">アフィリエイトURL:</label>
                                        <input
                                          type="text"
                                          value={product.amazon.url || ""}
                                          onChange={(e) => handleAmazonFieldChange(productIndex, "url", e.target.value)}
                                          placeholder="アフィリエイトURL"
                                          className="mt-0.5 text-xs border border-gray-200 rounded px-2 py-1 w-full focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                                          onClick={(e) => e.stopPropagation()}
                                        />
                                      </div>
                                      {/* 価格・ソース表示 */}
                                      <div className="flex items-center gap-2 mt-1">
                                        {product.amazon.price && (
                                          <span className="text-xs font-medium text-orange-600">
                                            ¥{product.amazon.price.toLocaleString()}
                                          </span>
                                        )}
                                        {product.source && (
                                          <span className={`text-xs px-1.5 py-0.5 rounded ${
                                            product.source === "amazon"
                                              ? "bg-orange-100 text-orange-700"
                                              : "bg-red-100 text-red-700"
                                          }`}>
                                            {product.source === "amazon" ? "Amazon" : "楽天"}
                                          </span>
                                        )}
                                        {product.matchReason && (
                                          <span className="text-xs text-gray-400">
                                            ({product.matchReason})
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              ) : product.confidence !== "low" ? (
                                <div className="mt-2 pt-2 border-t border-gray-100">
                                  <span className="text-xs text-gray-400">
                                    ⚠️ Amazon/楽天で見つかりませんでした
                                  </span>
                                </div>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
          </div>

          {/* 登録ボタン */}
          <div className="mt-6 pt-4 border-t border-gray-200 flex items-center justify-between">
            <p className="text-sm text-gray-600">
              {selectedProducts.size}件の商品を登録します
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleCancelPreview}
                className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                キャンセル
              </button>
              <button
                onClick={handleSaveProducts}
                disabled={saving || selectedProducts.size === 0}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
              >
                {saving ? "登録中..." : `${selectedProducts.size}件を登録する`}
              </button>
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

      {/* サジェスト動画セクション */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-lg font-semibold mb-3">🔍 解析候補の動画を検索</h2>
        <div className="flex gap-3 mb-4">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="検索キーワード（例：デスクツアー）"
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            onKeyDown={(e) => e.key === "Enter" && fetchSuggestions()}
          />
          <button
            onClick={() => fetchSuggestions()}
            disabled={loadingSuggestions}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition-colors"
          >
            {loadingSuggestions ? "検索中..." : "検索"}
          </button>
        </div>

        {/* サジェスト動画リスト */}
        {suggestions.length > 0 && (
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
        )}

        {!loadingSuggestions && suggestions.length === 0 && (
          <p className="text-gray-500 text-center py-8">
            検索結果がありません。キーワードを変えて再検索してください。
          </p>
        )}
      </div>

    </main>
  );
}
