import { Metadata } from "next";
import { PageHeaderSection } from "@/components/PageHeaderSection";
import "../listing-styles.css";

export const metadata: Metadata = {
  title: "お問い合わせ",
  description: "Creator Clipへのお問い合わせページ。ご質問やご意見がございましたら、お気軽にお問い合わせください。",
  alternates: { canonical: "/contact" },
  robots: { index: false, follow: true },
};

export default function ContactPage() {
  return (
    <>
      <PageHeaderSection
        label="Contact"
        title="お問い合わせ"
        description="ご質問やご意見がございましたら、お気軽にお問い合わせください。"
        breadcrumbCurrent="お問い合わせ"
        icon="fa-envelope"
      />

      <div className="detail-container" style={{ paddingTop: "48px", paddingBottom: "80px" }}>
        {/* 今回は空の状態で作成 */}
        <div style={{ textAlign: "center", padding: "60px 20px" }}>
          <p style={{ color: "#6e7a8a", fontSize: "14px" }}>
            お問い合わせフォームは準備中です
          </p>
        </div>
      </div>
    </>
  );
}
