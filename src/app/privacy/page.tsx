import { PageHeaderSection } from "@/components/PageHeaderSection";
import "@/app/listing-styles.css";

import { Metadata } from "next";

export const metadata: Metadata = {
  title: "プライバシーポリシー",
  description: "Creator Clipsのプライバシーポリシーについてご案内します。",
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPage() {
  return (
    <>
      <PageHeaderSection
        label="Privacy Policy"
        title="プライバシーポリシー"
        description="Creator Clipsにおける個人情報の取り扱いについてご案内します。"
        breadcrumbCurrent="プライバシーポリシー"
        icon="fa-shield-halved"
        showPrNote={false}
      />
      <div className="detail-container" style={{ paddingTop: "48px", paddingBottom: "80px" }}>
        <div style={{ maxWidth: "800px", margin: "0 auto" }}>
          <section style={{ marginBottom: "48px" }}>
            <h2 style={{ fontSize: "20px", fontWeight: "600", marginBottom: "16px", color: "#1a202c" }}>
              個人情報の収集について
            </h2>
            <p style={{ color: "#4a5568", lineHeight: "1.8", marginBottom: "16px" }}>
              当サイトでは、お問い合わせフォームをご利用いただく際に、メールアドレス等の個人情報をご提供いただく場合があります。
            </p>
            <p style={{ color: "#4a5568", lineHeight: "1.8" }}>
              これらの情報は、お問い合わせへの対応のみに使用し、それ以外の目的で利用することはありません。
            </p>
          </section>

          <section style={{ marginBottom: "48px" }}>
            <h2 style={{ fontSize: "20px", fontWeight: "600", marginBottom: "16px", color: "#1a202c" }}>
              アクセス解析ツールについて
            </h2>
            <p style={{ color: "#4a5568", lineHeight: "1.8", marginBottom: "16px" }}>
              当サイトでは、サービス改善のためにアクセス解析ツールを使用する場合があります。
              これらのツールはCookieを使用してアクセス情報を収集しますが、個人を特定する情報は含まれません。
            </p>
            <p style={{ color: "#4a5568", lineHeight: "1.8" }}>
              Cookieの使用を望まない場合は、ブラウザの設定により無効にすることが可能です。
            </p>
          </section>

          <section style={{ marginBottom: "48px" }}>
            <h2 style={{ fontSize: "20px", fontWeight: "600", marginBottom: "16px", color: "#1a202c" }}>
              広告配信について
            </h2>
            <p style={{ color: "#4a5568", lineHeight: "1.8", marginBottom: "16px" }}>
              当サイトはAmazonアソシエイトプログラムに参加しています。
              Amazonアソシエイトプログラムは、Amazon.co.jpを宣伝しリンクすることによって
              サイトが紹介料を獲得できる仕組みです。
            </p>
            <p style={{ color: "#4a5568", lineHeight: "1.8" }}>
              第三者配信の広告サービスを利用する場合、ユーザーの興味に応じた広告を配信するために
              Cookieが使用されることがあります。
            </p>
          </section>

          <section style={{ marginBottom: "48px" }}>
            <h2 style={{ fontSize: "20px", fontWeight: "600", marginBottom: "16px", color: "#1a202c" }}>
              個人情報の第三者提供について
            </h2>
            <p style={{ color: "#4a5568", lineHeight: "1.8" }}>
              当サイトでは、法令に基づく場合を除き、ご提供いただいた個人情報を本人の同意なく第三者に提供することはありません。
            </p>
          </section>

          <section style={{ marginBottom: "48px" }}>
            <h2 style={{ fontSize: "20px", fontWeight: "600", marginBottom: "16px", color: "#1a202c" }}>
              免責事項
            </h2>
            <p style={{ color: "#4a5568", lineHeight: "1.8", marginBottom: "16px" }}>
              当サイトに掲載されている情報の正確性には万全を期していますが、
              その内容について保証するものではありません。
            </p>
            <p style={{ color: "#4a5568", lineHeight: "1.8" }}>
              当サイトの利用により生じた損害等について、一切の責任を負いかねますのでご了承ください。
            </p>
          </section>

          <section>
            <h2 style={{ fontSize: "20px", fontWeight: "600", marginBottom: "16px", color: "#1a202c" }}>
              プライバシーポリシーの変更
            </h2>
            <p style={{ color: "#4a5568", lineHeight: "1.8", marginBottom: "16px" }}>
              本ポリシーの内容は、必要に応じて変更することがあります。
              変更後のプライバシーポリシーは、当ページに掲載した時点から効力を生じるものとします。
            </p>
            <p style={{ color: "#4a5568", lineHeight: "1.8" }}>
              ご不明な点がございましたら、お問い合わせページよりご連絡ください。
            </p>
          </section>
        </div>
      </div>
    </>
  );
}
