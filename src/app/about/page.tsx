import { PageHeaderSection } from "@/components/PageHeaderSection";
import "@/app/listing-styles.css";

export const metadata = {
  title: "運営者情報 | デスクツアーDB",
  description: "デスクツアーDBの運営者情報をご紹介します。",
};

export default function AboutPage() {
  return (
    <>
      <PageHeaderSection
        label="About"
        title="運営者情報"
        description="デスクツアーDBの運営者情報をご紹介します。"
        breadcrumbCurrent="運営者情報"
        icon="fa-info-circle"
      />
      <div className="detail-container" style={{ paddingTop: "48px", paddingBottom: "80px" }}>
        <div style={{ maxWidth: "800px", margin: "0 auto" }}>
          <section style={{ marginBottom: "48px" }}>
            <h2 style={{ fontSize: "20px", fontWeight: "600", marginBottom: "16px", color: "#1a202c" }}>
              サイト概要
            </h2>
            <p style={{ color: "#4a5568", lineHeight: "1.8", marginBottom: "16px" }}>
              デスクツアーDBは、YouTubeやブログで公開されているデスクツアー動画・記事を収集し、
              そこで紹介されているデスク周りのガジェットや家具を検索・比較できるデータベースサイトです。
            </p>
            <p style={{ color: "#4a5568", lineHeight: "1.8" }}>
              理想のデスク環境を作りたい方、新しいガジェットを探している方、
              職業やスタイル別のデスクセットアップを参考にしたい方に役立つ情報を提供しています。
            </p>
          </section>

          <section style={{ marginBottom: "48px" }}>
            <h2 style={{ fontSize: "20px", fontWeight: "600", marginBottom: "16px", color: "#1a202c" }}>
              運営者
            </h2>
            <p style={{ color: "#4a5568", lineHeight: "1.8" }}>
              デスクツアーDB運営チーム
            </p>
          </section>

          <section style={{ marginBottom: "48px" }}>
            <h2 style={{ fontSize: "20px", fontWeight: "600", marginBottom: "16px", color: "#1a202c" }}>
              お問い合わせ
            </h2>
            <p style={{ color: "#4a5568", lineHeight: "1.8" }}>
              ご質問やご意見がございましたら、
              <a href="/contact" style={{ color: "#3b82f6", textDecoration: "underline", marginLeft: "4px" }}>
                お問い合わせページ
              </a>
              よりご連絡ください。
            </p>
          </section>

          <section>
            <h2 style={{ fontSize: "20px", fontWeight: "600", marginBottom: "16px", color: "#1a202c" }}>
              免責事項
            </h2>
            <p style={{ color: "#4a5568", lineHeight: "1.8", marginBottom: "16px" }}>
              当サイトに掲載されている情報は、できる限り正確な情報を提供するよう努めておりますが、
              情報の正確性や完全性を保証するものではありません。
            </p>
            <p style={{ color: "#4a5568", lineHeight: "1.8", marginBottom: "16px" }}>
              当サイトの情報を利用したことにより生じたいかなる損害についても、
              当サイトは一切の責任を負いかねます。
            </p>
            <p style={{ color: "#4a5568", lineHeight: "1.8" }}>
              本サイトはAmazonアソシエイトプログラムに参加しており、
              商品の購入によって収益を得る場合があります。
            </p>
          </section>
        </div>
      </div>
    </>
  );
}
