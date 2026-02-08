export function AboutSection() {
  return (
    <section className="home-about">
      <div className="home-about__inner">
        <div className="home-about__card">
          <h2 className="home-about__title">
            <i className="fa-solid fa-circle-info home-about__title-icon"></i>
            このサイトについて
          </h2>
          <div className="home-about__content">
            <div className="home-about__section">
              <h3 className="home-about__subtitle">
                デスクツアーDBとは
              </h3>
              <p className="home-about__text">
                デスクツアーDBは、YouTubeのデスクツアー動画やブログ記事から、
                実際に使用されている商品情報を収集・整理したデータベースサイトです。
                「この職業の人はどんなキーボードを使っているのか」
                「ミニマリストのデスクにはどんな商品があるのか」といった疑問に、
                データで答えます。
              </p>
            </div>

            <div className="home-about__section">
              <h3 className="home-about__subtitle">
                データソース
              </h3>
              <p className="home-about__text">
                商品情報は、以下のソースから収集しています：
              </p>
              <ul className="home-about__list">
                <li>YouTubeのデスクツアー動画（字幕・概要欄から抽出）</li>
                <li>ブログ記事（デスクツアー、使用機材紹介など）</li>
              </ul>
              <p className="home-about__text">
                価格情報はAmazon Product Advertising APIから取得しており、
                実際の販売価格と異なる場合があります。
              </p>
            </div>

            <div className="home-about__section">
              <h3 className="home-about__subtitle">
                免責事項
              </h3>
              <p className="home-about__text">
                本サイトは商品の評価やおすすめを行うものではありません。
                掲載情報は事実に基づいたデータの集計結果であり、
                購入を推奨するものではありません。
                商品の購入はご自身の判断でお願いいたします。
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
