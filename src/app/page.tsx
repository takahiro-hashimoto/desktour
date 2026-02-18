import Link from "next/link";

export default function TopPage() {
  return (
    <div className="top-landing">
      <div className="top-landing__grid">
        {/* Creator Clip - デスクツアー */}
        <div className="top-landing__card">
          <div className="top-landing__icon">
            <i className="fa-solid fa-chart-line"></i>
          </div>
          <h2 className="top-landing__title">デスク環境</h2>
          <p className="top-landing__desc">
            デスクツアー動画・記事から
            <br />
            本当に選ばれているガジェットをデータで探す。
          </p>
          <Link href="/desktour" className="top-landing__link">
            <span>デスクツアーを見る</span>
            <i className="fa-solid fa-arrow-right"></i>
          </Link>
        </div>

        {/* Creator Clip - 撮影機材（準備中） */}
        <div className="top-landing__card top-landing__card--coming-soon">
          <div className="top-landing__icon">
            <i className="fa-solid fa-camera"></i>
          </div>
          <h2 className="top-landing__title">カメラ機材</h2>
          <p className="top-landing__desc">
            愛用撮影機材の紹介動画・記事から
            <br />
            本当に使われている機材をデータで探す。
          </p>
          <span className="top-landing__link top-landing__link--disabled">
            <span>準備中</span>
          </span>
        </div>
      </div>
    </div>
  );
}
