import Link from "next/link";

export default function TopPage() {
  return (
    <div className="top-landing">
      <div className="top-landing__grid">
        {/* デスクツアーDB */}
        <div className="top-landing__card">
          <div className="top-landing__icon">
            <i className="fa-solid fa-chart-line"></i>
          </div>
          <h2 className="top-landing__title">デスクツアーDB</h2>
          <p className="top-landing__desc">
            デスクツアー動画・記事から
            <br />
            本当に選ばれているガジェットをデータで探す。
          </p>
          <Link href="/desktour" className="top-landing__link">
            <span>デスクツアーDBを見る</span>
            <i className="fa-solid fa-arrow-right"></i>
          </Link>
        </div>

        {/* 撮影機材DB */}
        <div className="top-landing__card">
          <div className="top-landing__icon">
            <i className="fa-solid fa-camera"></i>
          </div>
          <h2 className="top-landing__title">撮影機材DB</h2>
          <p className="top-landing__desc">
            映像クリエイターの撮影機材を
            <br />
            データベース化。準備中です。
          </p>
          <span className="top-landing__link top-landing__link--disabled">
            <span>準備中</span>
          </span>
        </div>
      </div>
    </div>
  );
}
