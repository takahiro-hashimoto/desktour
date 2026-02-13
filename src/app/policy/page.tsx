import { PageHeaderSection } from "@/components/PageHeaderSection";
import "@/app/listing-styles.css";

import { Metadata } from "next";

export const metadata: Metadata = {
  title: "コンテンツ制作ポリシー",
  description: "Creator Clipのコンテンツ制作ポリシーをご紹介します。",
  alternates: { canonical: "/policy" },
};

export default function PolicyPage() {
  return (
    <>
      <PageHeaderSection
        label="Policy"
        title="コンテンツ制作ポリシー"
        description="Creator Clipのコンテンツ制作における方針をご紹介します。"
        breadcrumbCurrent="コンテンツ制作ポリシー"
        icon="fa-file-alt"
        showPrNote={false}
      />
      <div className="detail-container" style={{ paddingTop: "48px", paddingBottom: "80px" }}>
        <div style={{ maxWidth: "800px", margin: "0 auto" }}>
          <section style={{ marginBottom: "48px" }}>
            <h2 style={{ fontSize: "20px", fontWeight: "600", marginBottom: "16px", color: "#1a202c" }}>
              情報の収集と掲載
            </h2>
            <p style={{ color: "#4a5568", lineHeight: "1.8", marginBottom: "16px" }}>
              当サイトでは、YouTubeやブログなど公開されているデスクツアーコンテンツから、
              紹介されているガジェットや家具の情報を収集しています。
            </p>
            <p style={{ color: "#4a5568", lineHeight: "1.8", marginBottom: "16px" }}>
              収集した情報は、AI技術を活用して整理・分類し、
              ユーザーの皆様が目的の製品を見つけやすい形で提供しています。
            </p>
            <p style={{ color: "#4a5568", lineHeight: "1.8" }}>
              掲載されている動画・記事は、各クリエイターの著作物です。
              当サイトはこれらのコンテンツへのリンクを提供し、
              オリジナルのクリエイターを尊重しています。
            </p>
          </section>

          <section style={{ marginBottom: "48px" }}>
            <h2 style={{ fontSize: "20px", fontWeight: "600", marginBottom: "16px", color: "#1a202c" }}>
              製品情報の正確性
            </h2>
            <p style={{ color: "#4a5568", lineHeight: "1.8", marginBottom: "16px" }}>
              製品情報は、Amazon Product Advertising APIを通じて取得した情報を基に掲載しています。
            </p>
            <p style={{ color: "#4a5568", lineHeight: "1.8", marginBottom: "16px" }}>
              価格や在庫状況などの情報は変動する可能性があるため、
              最新の情報は各販売サイトでご確認ください。
            </p>
            <p style={{ color: "#4a5568", lineHeight: "1.8" }}>
              製品のスペックや特徴については、できる限り正確な情報の提供に努めていますが、
              誤りがある場合はお問い合わせよりご連絡ください。
            </p>
          </section>

          <section style={{ marginBottom: "48px" }}>
            <h2 style={{ fontSize: "20px", fontWeight: "600", marginBottom: "16px", color: "#1a202c" }}>
              アフィリエイトプログラムについて
            </h2>
            <p style={{ color: "#4a5568", lineHeight: "1.8", marginBottom: "16px" }}>
              当サイトはAmazonアソシエイトプログラムに参加しています。
            </p>
            <p style={{ color: "#4a5568", lineHeight: "1.8", marginBottom: "16px" }}>
              ユーザーの皆様が当サイトを経由して商品を購入された場合、
              当サイトに紹介料が支払われることがあります。
            </p>
            <p style={{ color: "#4a5568", lineHeight: "1.8" }}>
              ただし、アフィリエイト収益の有無によって、
              掲載する製品の選定や評価が影響を受けることはありません。
            </p>
          </section>

          <section style={{ marginBottom: "48px" }}>
            <h2 style={{ fontSize: "20px", fontWeight: "600", marginBottom: "16px", color: "#1a202c" }}>
              著作権とクリエイターの尊重
            </h2>
            <p style={{ color: "#4a5568", lineHeight: "1.8", marginBottom: "16px" }}>
              当サイトに掲載されている動画・記事は、各クリエイターの著作物です。
            </p>
            <p style={{ color: "#4a5568", lineHeight: "1.8", marginBottom: "16px" }}>
              当サイトは、これらのコンテンツを再配信するものではなく、
              オリジナルのコンテンツへのリンクを提供するものです。
            </p>
            <p style={{ color: "#4a5568", lineHeight: "1.8" }}>
              著作権者の方で掲載に問題がある場合は、
              お問い合わせよりご連絡ください。速やかに対応いたします。
            </p>
          </section>

          <section>
            <h2 style={{ fontSize: "20px", fontWeight: "600", marginBottom: "16px", color: "#1a202c" }}>
              ユーザーの皆様へ
            </h2>
            <p style={{ color: "#4a5568", lineHeight: "1.8", marginBottom: "16px" }}>
              当サイトは、デスク環境を改善したいすべての方に役立つ情報を提供することを目的としています。
            </p>
            <p style={{ color: "#4a5568", lineHeight: "1.8" }}>
              ご意見やご要望がございましたら、お気軽にお問い合わせください。
              皆様のフィードバックをもとに、より良いサービスを提供してまいります。
            </p>
          </section>
        </div>
      </div>
    </>
  );
}
