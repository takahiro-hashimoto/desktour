-- ========================================
-- 008_create_brands.sql
-- ブランドマスターテーブル作成 + シードデータ投入
-- ========================================

-- ========================================
-- 1. テーブル作成
-- ========================================

CREATE TABLE IF NOT EXISTS brands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  name_aliases TEXT[] DEFAULT '{}',
  domains TEXT[] DEFAULT '{}',
  icon TEXT,
  description_desktour TEXT,
  description_camera TEXT,
  is_featured BOOLEAN DEFAULT false,
  display_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_brands_slug ON brands(slug);
CREATE INDEX IF NOT EXISTS idx_brands_domains ON brands USING GIN(domains);
CREATE INDEX IF NOT EXISTS idx_brands_name_aliases ON brands USING GIN(name_aliases);

-- updated_at 自動更新トリガー
CREATE OR REPLACE FUNCTION update_brands_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_brands_updated_at ON brands;
CREATE TRIGGER trigger_brands_updated_at
  BEFORE UPDATE ON brands
  FOR EACH ROW
  EXECUTE FUNCTION update_brands_updated_at();

-- ========================================
-- 2. シードデータ投入
-- ========================================
-- ルール:
--   - 両ドメインに存在するブランドは1行（domains = desktour,camera）
--   - is_featured = BRAND_TAGS / CAMERA_BRAND_TAGS に含まれるブランド
--   - 両ドメインのブランドは desktour 側のアイコンを使用
--   - display_order: featured ブランドを先に（desktour 1-20, camera 21-40）、非featured は 100+
-- ========================================

INSERT INTO brands (name, slug, name_aliases, domains, icon, description_desktour, description_camera, is_featured, display_order)
VALUES

-- ========================================
-- A. 両ドメイン共通ブランド (desktour + camera)
-- ========================================

-- Sony: desktour(ヘッドホン) + camera(カメラ) — featured in both
('Sony', 'sony',
 '{"ソニー","SONY","sony"}',
 '{"desktour","camera"}',
 'fa-solid fa-headphones',
 'ヘッドホンやカメラで人気。',
 'ミラーレスカメラのリーディングブランド。多くのクリエイターのカバンの中身に登場する愛用機材。',
 true, 1),

-- Anker: desktour(充電器) + camera(count=2)
('Anker', 'anker',
 '{"アンカー","anker"}',
 '{"desktour","camera"}',
 'fa-solid fa-charging-station',
 '充電器やケーブルなどの周辺機器で人気のブランド。',
 NULL,
 true, 2),

-- SmallRig: camera featured + desktour にも登場
('SmallRig', 'smallrig',
 '{"smallrig"}',
 '{"desktour","camera"}',
 'fa-solid fa-screwdriver-wrench',
 NULL,
 'カメラリグやアクセサリーで人気。撮影セットアップの周辺機器として定番。',
 true, 21),

-- Manfrotto: camera featured + desktour にも存在しうる
('Manfrotto', 'manfrotto',
 '{"manfrotto"}',
 '{"desktour","camera"}',
 'fa-solid fa-campground',
 NULL,
 '三脚や雲台で世界的に有名。撮影セットアップのアクセサリーとして定番。',
 true, 22),

-- ========================================
-- B. desktour featured ブランド（BRAND_TAGS）
-- ========================================

('FlexiSpot', 'flexispot',
 '{"フレキシスポット","flexispot"}',
 '{"desktour"}',
 'fa-solid fa-table',
 '電動昇降デスクの人気メーカー。コスパの良いスタンディングデスクが多くのデスクツアーで紹介されている。',
 NULL,
 true, 3),

('COFO', 'cofo',
 '{"cofo","Cofo"}',
 '{"desktour"}',
 'fa-solid fa-chair',
 '人間工学に基づいたオフィスチェアやデスク周辺機器を展開するブランド。',
 NULL,
 true, 4),

('Logicool', 'logicool',
 '{"ロジクール","logitech","logicool","Logicool G"}',
 '{"desktour"}',
 'fa-solid fa-computer-mouse',
 'マウス、キーボード、ウェブカメラなど幅広い周辺機器を展開する定番ブランド。',
 NULL,
 true, 5),

('Keychron', 'keychron',
 '{"キークロン","keychron"}',
 '{"desktour"}',
 'fa-solid fa-keyboard',
 'Mac対応のメカニカルキーボードで人気のブランド。',
 NULL,
 true, 6),

('HHKB', 'hhkb',
 '{"hhkb","happy hacking keyboard","pfu"}',
 '{"desktour"}',
 'fa-solid fa-keyboard',
 '静電容量無接点方式の高級キーボード。独自のキー配列でプログラマーに愛されている。',
 NULL,
 true, 7),

('Herman Miller', 'herman-miller',
 '{"ハーマンミラー","herman miller","hermanmiller"}',
 '{"desktour"}',
 'fa-solid fa-chair',
 'アーロンチェアで有名な高級オフィス家具メーカー。',
 NULL,
 true, 8),

('BenQ', 'benq',
 '{"ベンキュー","benq"}',
 '{"desktour"}',
 'fa-solid fa-desktop',
 'モニターやモニターライト「ScreenBar」で人気のブランド。',
 NULL,
 true, 9),

('DELL', 'dell',
 '{"デル","dell"}',
 '{"desktour"}',
 'fa-solid fa-desktop',
 'モニターやPC本体で定番のブランド。',
 NULL,
 true, 10),

('Apple', 'apple',
 '{"アップル","apple","Apple(アップル)","apple(アップル)"}',
 '{"desktour"}',
 'fa-brands fa-apple',
 'MacやiPadなどデスクツアーの定番デバイス。',
 NULL,
 true, 11),

('REALFORCE', 'realforce',
 '{"リアルフォース","realforce","topre"}',
 '{"desktour"}',
 'fa-solid fa-keyboard',
 '静電容量無接点方式の高級キーボード。',
 NULL,
 true, 12),

('Razer', 'razer',
 '{"レイザー","razer"}',
 '{"desktour"}',
 'fa-solid fa-gamepad',
 'ゲーミングデバイスの代表的ブランド。',
 NULL,
 true, 13),

('Elgato', 'elgato',
 '{"elgato"}',
 '{"desktour"}',
 'fa-solid fa-microphone',
 '配信者向け機材のリーディングブランド。',
 NULL,
 true, 14),

('SHURE', 'shure',
 '{"shure"}',
 '{"desktour"}',
 'fa-solid fa-microphone',
 'プロ品質のマイクで知られる老舗オーディオメーカー。',
 NULL,
 true, 15),

('Audio-Technica', 'audio-technica',
 '{"オーディオテクニカ","audio-technica","audio technica","オーディオ テクニカ"}',
 '{"desktour"}',
 'fa-solid fa-headphones',
 'ヘッドホンやマイクで人気の日本メーカー。',
 NULL,
 true, 16),

('LG', 'lg',
 '{"lg","エルジー"}',
 '{"desktour"}',
 'fa-solid fa-desktop',
 'モニターやディスプレイで人気のメーカー。',
 NULL,
 true, 17),

('Samsung', 'samsung',
 '{"samsung","サムスン"}',
 '{"desktour"}',
 'fa-solid fa-mobile-screen',
 'モニターやSSDで人気のメーカー。',
 NULL,
 true, 18),

('IKEA', 'ikea',
 '{"ikea","イケア"}',
 '{"desktour"}',
 'fa-solid fa-house',
 'コスパの良いデスクや収納で人気。',
 NULL,
 true, 19),

('ASUS', 'asus',
 '{"エイスース","asus"}',
 '{"desktour"}',
 'fa-solid fa-desktop',
 'モニターやPC本体で人気のメーカー。',
 NULL,
 true, 20),

-- ========================================
-- C. camera featured ブランド（CAMERA_BRAND_TAGS）
-- ========================================

('Canon', 'canon',
 '{"canon","キヤノン","キャノン"}',
 '{"camera"}',
 'fa-solid fa-camera',
 NULL,
 '一眼レフ・ミラーレスで長い歴史を持つカメラメーカー。映像制作セットアップの定番。',
 true, 23),

('Nikon', 'nikon',
 '{"nikon","ニコン"}',
 '{"camera"}',
 'fa-solid fa-camera',
 NULL,
 '高品質な光学技術で知られるカメラメーカー。愛用するフォトグラファー多数。',
 true, 24),

('FUJIFILM', 'fujifilm',
 '{"fujifilm","Fujifilm","富士フイルム","fuji"}',
 '{"camera"}',
 'fa-solid fa-camera',
 NULL,
 '独自のフィルムシミュレーションで人気。YouTubeの機材紹介でも愛用者多数。',
 true, 25),

('Panasonic', 'panasonic',
 '{"パナソニック","panasonic"}',
 '{"camera"}',
 'fa-solid fa-video',
 NULL,
 'LUMIX シリーズで動画撮影に強い。映像セットアップの定番カメラメーカー。',
 true, 26),

('OM SYSTEM', 'om-system',
 '{"om system","olympus","オリンパス"}',
 '{"camera"}',
 'fa-solid fa-camera',
 NULL,
 NULL,
 true, 27),

('Sigma', 'sigma',
 '{"sigma","SIGMA","シグマ"}',
 '{"camera"}',
 'fa-solid fa-circle-dot',
 NULL,
 '高品質なレンズで人気の日本メーカー。カバンの中身動画でも愛用者多数。',
 true, 28),

('Tamron', 'tamron',
 '{"tamron","TAMRON","タムロン"}',
 '{"camera"}',
 'fa-solid fa-circle-dot',
 NULL,
 'コスパの良いズームレンズで人気。撮影セットアップの定番レンズメーカー。',
 true, 29),

('DJI', 'dji',
 '{"dji","ディージェイアイ"}',
 '{"camera"}',
 'fa-solid fa-helicopter',
 NULL,
 'ドローンやジンバルなど周辺機器で有名。映像制作セットアップの定番ブランド。',
 true, 30),

('Blackmagic Design', 'blackmagic-design',
 '{"blackmagic design","blackmagic","ブラックマジック","ブラックマジックデザイン"}',
 '{"camera"}',
 'fa-solid fa-film',
 NULL,
 'シネマカメラや映像制作ソフトで知られるメーカー。愛用する映像クリエイター多数。',
 true, 31),

('RODE', 'rode',
 '{"rode","ロード"}',
 '{"camera"}',
 'fa-solid fa-microphone',
 NULL,
 '高品質なマイクで知られるオーディオメーカー。YouTube機材セットアップの定番。',
 true, 32),

('Sennheiser', 'sennheiser',
 '{"sennheiser","ゼンハイザー"}',
 '{"camera"}',
 'fa-solid fa-microphone',
 NULL,
 'プロ向けマイクやワイヤレスの老舗。撮影セットアップの愛用者多数。',
 true, 33),

('ZHIYUN', 'zhiyun',
 '{"zhiyun","ジーウン"}',
 '{"camera"}',
 'fa-solid fa-rotate',
 NULL,
 'カメラ用ジンバルの大手メーカー。撮影セットアップの周辺機器として人気。',
 true, 34),

('Godox', 'godox',
 '{"godox","ゴドックス"}',
 '{"camera"}',
 'fa-solid fa-lightbulb',
 NULL,
 'コスパの良い照明機材で人気。YouTube機材セットアップでも愛用者多数。',
 true, 35),

('Aputure', 'aputure',
 '{"aputure","アプチャー"}',
 '{"camera"}',
 'fa-solid fa-lightbulb',
 NULL,
 '映像制作向けLEDライトのトップブランド。撮影セットアップに欠かせない周辺機器。',
 true, 36),

('Gitzo', 'gitzo',
 '{"gitzo","ジッツオ","ジッツォ"}',
 '{"camera"}',
 'fa-solid fa-campground',
 NULL,
 NULL,
 true, 37),

('Tilta', 'tilta',
 '{"tilta","TILTA","ティルタ"}',
 '{"camera"}',
 'fa-solid fa-screwdriver-wrench',
 NULL,
 'シネマカメラ用アクセサリーの専門ブランド。映像制作セットアップに人気。',
 true, 38),

('Atomos', 'atomos',
 '{"atomos","アトモス"}',
 '{"camera"}',
 'fa-solid fa-tv',
 NULL,
 '外部レコーダーのリーディングブランド。',
 true, 39),

-- ========================================
-- D. desktour 非featured ブランド（count >= 2）
-- ========================================

('Grovemade', 'grovemade',
 '{"grovemade"}',
 '{"desktour"}',
 'fa-solid fa-tree',
 NULL, NULL,
 false, 100),

('Belkin', 'belkin',
 '{"ベルキン","belkin"}',
 '{"desktour"}',
 'fa-solid fa-plug',
 NULL, NULL,
 false, 101),

('エレコム', 'elecom',
 '{"elecom","エレコム"}',
 '{"desktour"}',
 'fa-solid fa-plug',
 NULL, NULL,
 false, 102),

('無印良品', 'muji',
 '{"muji","無印良品","無印"}',
 '{"desktour"}',
 'fa-solid fa-box',
 NULL, NULL,
 false, 103),

('CIO', 'cio',
 '{"cio","シーアイオー"}',
 '{"desktour"}',
 'fa-solid fa-charging-station',
 NULL, NULL,
 false, 104),

('PREDUCTS', 'preducts',
 '{"preducts"}',
 '{"desktour"}',
 'fa-solid fa-table',
 NULL, NULL,
 false, 105),

('山崎実業', 'yamazaki',
 '{"yamazaki","山崎実業","tower"}',
 '{"desktour"}',
 'fa-solid fa-box',
 NULL, NULL,
 false, 106),

('サンワサプライ', 'sanwa-supply',
 '{"sanwa supply","sanwa","サンワサプライ","サンワサプライ(Sanwa Supply)"}',
 '{"desktour"}',
 'fa-solid fa-plug',
 NULL, NULL,
 false, 107),

('ERGOTRON', 'ergotron',
 '{"ergotron","エルゴトロン"}',
 '{"desktour"}',
 'fa-solid fa-desktop',
 NULL, NULL,
 false, 108),

('Amazonベーシック', 'amazon-basics',
 '{"amazon basics","amazonベーシック","amazon basic","amazonbasics"}',
 '{"desktour"}',
 'fa-brands fa-amazon',
 NULL, NULL,
 false, 109),

('Amazon', 'amazon',
 '{"amazon","アマゾン"}',
 '{"desktour"}',
 'fa-brands fa-amazon',
 NULL, NULL,
 false, 110),

('コクヨ', 'kokuyo',
 '{"kokuyo","コクヨ"}',
 '{"desktour"}',
 'fa-solid fa-pen',
 NULL, NULL,
 false, 111),

('Kanto', 'kanto',
 '{"kanto"}',
 '{"desktour"}',
 'fa-solid fa-desktop',
 NULL, NULL,
 false, 112),

('CalDigit', 'caldigit',
 '{"caldigit","カルデジット"}',
 '{"desktour"}',
 'fa-solid fa-hard-drive',
 NULL, NULL,
 false, 113),

('TP-Link', 'tp-link',
 '{"tp-link","tplink","ティーピーリンク"}',
 '{"desktour"}',
 'fa-solid fa-wifi',
 NULL, NULL,
 false, 114),

('SwitchBot', 'switchbot',
 '{"switchbot","スイッチボット"}',
 '{"desktour"}',
 'fa-solid fa-robot',
 NULL, NULL,
 false, 115),

('長尾製作所', 'nagao',
 '{"nagao","長尾製作所"}',
 '{"desktour"}',
 'fa-solid fa-screwdriver-wrench',
 NULL, NULL,
 false, 116),

('WAAK', 'waak',
 '{"waak","ワアク"}',
 '{"desktour"}',
 'fa-solid fa-table',
 NULL, NULL,
 false, 117),

('Chubbycable', 'chubbycable',
 '{"chubbycable"}',
 '{"desktour"}',
 'fa-solid fa-plug',
 NULL, NULL,
 false, 118),

('Bambu Lab', 'bambu-lab',
 '{"bambu lab","bambulab","バンブーラボ"}',
 '{"desktour"}',
 'fa-solid fa-cube',
 NULL, NULL,
 false, 119),

('NuPhy', 'nuphy',
 '{"nuphy"}',
 '{"desktour"}',
 'fa-solid fa-keyboard',
 NULL, NULL,
 false, 120),

('SATECHI', 'satechi',
 '{"satechi","サテチ"}',
 '{"desktour"}',
 'fa-solid fa-plug',
 NULL, NULL,
 false, 121),

('Mcdodo', 'mcdodo',
 '{"mcdodo","マクドド"}',
 '{"desktour"}',
 'fa-solid fa-plug',
 NULL, NULL,
 false, 122),

('ミワックス', 'miwax',
 '{"miwax","ミワックス"}',
 '{"desktour"}',
 'fa-solid fa-layer-group',
 NULL, NULL,
 false, 123),

('WORLD GADGETS', 'world-gadgets',
 '{"world gadgets","worldgadgets","ワールドガジェッツ"}',
 '{"desktour"}',
 'fa-solid fa-globe',
 NULL, NULL,
 false, 124),

('MOFT', 'moft',
 '{"moft","モフト"}',
 '{"desktour"}',
 'fa-solid fa-laptop',
 NULL, NULL,
 false, 125),

('NITEIZE', 'niteize',
 '{"niteize","ナイトアイズ"}',
 '{"desktour"}',
 'fa-solid fa-lightbulb',
 NULL, NULL,
 false, 126),

('イトーキ', 'itoki',
 '{"itoki","イトーキ"}',
 '{"desktour"}',
 'fa-solid fa-chair',
 NULL, NULL,
 false, 127),

('GENELEC', 'genelec',
 '{"genelec","ジェネレック"}',
 '{"desktour"}',
 'fa-solid fa-volume-high',
 NULL, NULL,
 false, 128),

('Audioengine', 'audioengine',
 '{"audioengine","オーディオエンジン"}',
 '{"desktour"}',
 'fa-solid fa-volume-high',
 NULL, NULL,
 false, 129),

('Ergohuman', 'ergohuman',
 '{"ergohuman","エルゴヒューマン"}',
 '{"desktour"}',
 'fa-solid fa-chair',
 NULL, NULL,
 false, 130),

('KINTO', 'kinto',
 '{"kinto","キントー"}',
 '{"desktour"}',
 'fa-solid fa-mug-hot',
 NULL, NULL,
 false, 131),

-- ========================================
-- E. camera 非featured ブランド（count >= 2）
-- ========================================

('Lumix', 'lumix',
 '{"lumix","panasonic lumix","パナソニック lumix","ルミックス"}',
 '{"camera"}',
 'fa-solid fa-camera',
 NULL, NULL,
 false, 200),

('Leofoto', 'leofoto',
 '{"leofoto","レオフォト"}',
 '{"camera"}',
 'fa-solid fa-campground',
 NULL, NULL,
 false, 201),

('RRS', 'rrs',
 '{"rrs","really right stuff"}',
 '{"camera"}',
 'fa-solid fa-campground',
 NULL, NULL,
 false, 202),

('ULANZI', 'ulanzi',
 '{"ulanzi","ウランジ"}',
 '{"camera"}',
 'fa-solid fa-screwdriver-wrench',
 NULL, NULL,
 false, 203),

('Carl Zeiss', 'carl-zeiss',
 '{"carl zeiss","zeiss","カールツァイス","ツァイス"}',
 '{"camera"}',
 'fa-solid fa-circle-dot',
 NULL, NULL,
 false, 204),

('NiSi', 'nisi',
 '{"nisi","NISI","ニシ"}',
 '{"camera"}',
 'fa-solid fa-circle-dot',
 NULL, NULL,
 false, 205),

('PGYTECH', 'pgytech',
 '{"pgytech","ピージーワイテック"}',
 '{"camera"}',
 'fa-solid fa-bag-shopping',
 NULL, NULL,
 false, 206),

('Velbon', 'velbon',
 '{"velbon","ベルボン"}',
 '{"camera"}',
 'fa-solid fa-campground',
 NULL, NULL,
 false, 207),

('HAKUBA', 'hakuba',
 '{"hakuba","ハクバ"}',
 '{"camera"}',
 'fa-solid fa-bag-shopping',
 NULL, NULL,
 false, 208),

('K&F Concept', 'kf-concept',
 '{"k&f","k&f concept","kf concept","ケーアンドエフ"}',
 '{"camera"}',
 'fa-solid fa-campground',
 NULL, NULL,
 false, 209),

-- ========================================
-- F. camera 追加ブランド（well-known, featured ソースブランド等）
-- ========================================

('GoPro', 'gopro',
 '{"gopro","ゴープロ"}',
 '{"camera"}',
 'fa-solid fa-video',
 NULL,
 'アクションカメラの代名詞。Vloggerのカバンの中身にも頻繁に登場。',
 false, 210),

('Hollyland', 'hollyland',
 '{"hollyland","ホーリーランド"}',
 '{"camera"}',
 'fa-solid fa-microphone',
 NULL,
 'ワイヤレスマイクやビデオトランスミッターを展開。撮影セットアップの周辺機器。',
 false, 211),

('Peak Design', 'peak-design',
 '{"peak design","peakdesign","ピークデザイン"}',
 '{"camera"}',
 'fa-solid fa-bag-shopping',
 NULL,
 'カメラストラップやバッグで人気。カバンの中身動画でも頻繁に登場するアクセサリー。',
 false, 212)

ON CONFLICT (name) DO NOTHING;
