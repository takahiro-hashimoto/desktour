"use client";

import { useState, useEffect, useCallback } from "react";
import { CAMERA_PRODUCT_CATEGORIES, CAMERA_TYPE_TAGS } from "@/lib/camera/constants";

interface AdminProduct {
  id: string;
  name: string;
  brand: string | null;
  category: string;
  tags: string[];
  asin: string | null;
  amazon_image_url: string | null;
  slug: string | null;
  mention_count: number;
}

interface EditForm {
  name: string;
  brand: string;
  category: string;
  tags: string[];
}

const DOMAIN = "camera";
const LIMIT = 30;

export default function CameraAdminProductsPage() {
  // 検索・フィルタ
  const [searchText, setSearchText] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [page, setPage] = useState(1);

  // データ
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  // 編集
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EditForm | null>(null);
  const [saving, setSaving] = useState(false);

  // メッセージ
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // --- Fetch ---
  const fetchProducts = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({
      domain: DOMAIN,
      page: String(page),
      limit: String(LIMIT),
    });
    if (searchText) params.set("search", searchText);
    if (categoryFilter) params.set("category", categoryFilter);

    try {
      const res = await fetch(`/api/admin/products?${params}`);
      const data = await res.json();
      setProducts(data.products || []);
      setTotal(data.total || 0);
    } catch {
      setMessage({ type: "error", text: "商品の取得に失敗しました" });
    } finally {
      setLoading(false);
    }
  }, [page, searchText, categoryFilter]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const totalPages = Math.ceil(total / LIMIT);

  // --- 検索実行 ---
  const handleSearch = () => {
    setSearchText(searchInput);
    setPage(1);
  };

  const handleCategoryChange = (cat: string) => {
    setCategoryFilter(cat);
    setPage(1);
  };

  // --- 編集開始 ---
  const startEdit = (product: AdminProduct) => {
    setEditingId(product.id);
    setEditForm({
      name: product.name,
      brand: product.brand || "",
      category: product.category,
      tags: [...(product.tags || [])],
    });
    setMessage(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm(null);
  };

  // --- タグトグル ---
  const toggleTag = (tag: string) => {
    if (!editForm) return;
    const newTags = editForm.tags.includes(tag)
      ? editForm.tags.filter((t) => t !== tag)
      : [...editForm.tags, tag];
    setEditForm({ ...editForm, tags: newTags });
  };

  // --- 保存 ---
  const handleSave = async () => {
    if (!editingId || !editForm) return;
    setSaving(true);
    setMessage(null);

    try {
      const res = await fetch("/api/admin/products", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          domain: DOMAIN,
          productId: editingId,
          data: {
            name: editForm.name,
            brand: editForm.brand || null,
            category: editForm.category,
            tags: editForm.tags,
          },
        }),
      });
      const result = await res.json();
      if (result.success) {
        setMessage({ type: "success", text: "保存しました" });
        setEditingId(null);
        setEditForm(null);
        await fetchProducts();
      } else {
        setMessage({ type: "error", text: result.error || "保存に失敗しました" });
      }
    } catch {
      setMessage({ type: "error", text: "通信エラーが発生しました" });
    } finally {
      setSaving(false);
    }
  };

  // --- タグ表示用ヘルパー ---
  const getTypeTags = (category: string): string[] => CAMERA_TYPE_TAGS[category] || [];

  return (
    <main className="max-w-[1080px] mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-1">撮影機材 商品管理</h1>
      <p className="text-sm text-gray-500 mb-6">登録済み商品の検索・編集</p>

      {/* メッセージ */}
      {message && (
        <div className={`rounded-lg p-3 mb-4 text-sm ${message.type === "success" ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"}`}>
          {message.text}
        </div>
      )}

      {/* 検索バー */}
      <div className="bg-white rounded-xl shadow-md p-4 mb-6">
        <div className="flex gap-3 items-center flex-wrap">
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            placeholder="商品名・ブランドで検索"
            className="flex-1 min-w-[200px] px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <select
            value={categoryFilter}
            onChange={(e) => handleCategoryChange(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">全カテゴリ</option>
            {CAMERA_PRODUCT_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
          <button
            onClick={handleSearch}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors"
          >
            検索
          </button>
        </div>
        <p className="text-xs text-gray-400 mt-2">
          全 {total} 件{searchText && ` (「${searchText}」で絞込)`}
          {categoryFilter && ` / ${categoryFilter}`}
        </p>
      </div>

      {/* 商品リスト */}
      <div className="bg-white rounded-xl shadow-md overflow-hidden mb-6">
        {/* ヘッダー */}
        <div className="grid grid-cols-[56px_1fr_100px_60px_70px] gap-3 px-4 py-2 bg-gray-50 text-xs text-gray-500 font-medium border-b">
          <span>画像</span>
          <span>商品名 / ブランド</span>
          <span>カテゴリ</span>
          <span className="text-center">紹介数</span>
          <span className="text-center">操作</span>
        </div>

        {loading ? (
          <div className="py-12 text-center text-gray-400 text-sm">読み込み中...</div>
        ) : products.length === 0 ? (
          <div className="py-12 text-center text-gray-400 text-sm">商品が見つかりません</div>
        ) : (
          products.map((product) => (
            <div key={product.id} className="border-b last:border-b-0">
              {editingId === product.id && editForm ? (
                /* === 編集モード === */
                <div className="p-4 bg-blue-50">
                  <div className="grid grid-cols-[1fr_1fr_auto] gap-3 mb-3">
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">商品名</label>
                      <input
                        type="text"
                        value={editForm.name}
                        onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                        className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">ブランド</label>
                      <input
                        type="text"
                        value={editForm.brand}
                        onChange={(e) => setEditForm({ ...editForm, brand: e.target.value })}
                        className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">カテゴリ</label>
                      <select
                        value={editForm.category}
                        onChange={(e) => setEditForm({ ...editForm, category: e.target.value, tags: [] })}
                        className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        {CAMERA_PRODUCT_CATEGORIES.map((cat) => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* 種類タグ */}
                  {getTypeTags(editForm.category).length > 0 && (
                    <div className="mb-3">
                      <label className="text-xs text-gray-500 mb-1 block">種類タグ</label>
                      <div className="flex flex-wrap gap-1">
                        {getTypeTags(editForm.category).map((tag) => (
                          <button
                            key={tag}
                            onClick={() => toggleTag(tag)}
                            className={`px-2.5 py-0.5 rounded-full text-xs transition-colors ${
                              editForm.tags.includes(tag)
                                ? "bg-blue-600 text-white"
                                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                            }`}
                          >
                            {tag}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 現在のタグ一覧 */}
                  {editForm.tags.length > 0 && (
                    <div className="mb-3">
                      <label className="text-xs text-gray-500 mb-1 block">設定済みタグ</label>
                      <div className="flex flex-wrap gap-1">
                        {editForm.tags.map((tag) => (
                          <span key={tag} className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-800 rounded-full text-xs">
                            {tag}
                            <button
                              onClick={() => setEditForm({ ...editForm, tags: editForm.tags.filter((t) => t !== tag) })}
                              className="text-blue-400 hover:text-blue-700"
                            >
                              ×
                            </button>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 操作ボタン */}
                  <div className="flex gap-2 justify-end">
                    <button
                      onClick={cancelEdit}
                      className="px-4 py-1.5 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                    >
                      キャンセル
                    </button>
                    <button
                      onClick={handleSave}
                      disabled={saving}
                      className="px-4 py-1.5 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:bg-gray-300 transition-colors"
                    >
                      {saving ? "保存中..." : "保存"}
                    </button>
                  </div>
                </div>
              ) : (
                /* === 通常表示 === */
                <div className="grid grid-cols-[56px_1fr_100px_60px_70px] gap-3 px-4 py-3 items-center hover:bg-gray-50 transition-colors">
                  {/* 画像 */}
                  <div className="w-14 h-14 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                    {product.amazon_image_url ? (
                      <img
                        src={product.amazon_image_url}
                        alt={product.name}
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-300 text-xs">No img</div>
                    )}
                  </div>
                  {/* 名前・ブランド・タグ */}
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{product.name}</p>
                    <p className="text-xs text-gray-400 truncate">{product.brand || "—"}</p>
                    {product.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {product.tags.slice(0, 5).map((tag) => (
                          <span key={tag} className="px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded text-[10px]">{tag}</span>
                        ))}
                        {product.tags.length > 5 && (
                          <span className="text-[10px] text-gray-400">+{product.tags.length - 5}</span>
                        )}
                      </div>
                    )}
                  </div>
                  {/* カテゴリ */}
                  <span className="text-xs text-gray-500">{product.category}</span>
                  {/* 紹介数 */}
                  <span className="text-sm font-medium text-center">{product.mention_count}</span>
                  {/* 操作 */}
                  <div className="text-center">
                    <button
                      onClick={() => startEdit(product)}
                      className="px-3 py-1 text-xs text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
                    >
                      編集
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* ページネーション */}
      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-3">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="px-3 py-1.5 text-sm bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            ← 前へ
          </button>
          <span className="text-sm text-gray-500">
            {page} / {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="px-3 py-1.5 text-sm bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            次へ →
          </button>
        </div>
      )}
    </main>
  );
}
