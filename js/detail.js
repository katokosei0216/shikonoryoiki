// detail.php の場所（detail.html からの相対パス）
const DETAIL_API = '../php/detail.php';
// review.php の場所（口コミ・評価）
const REVIEW_API = '../php/review.php';
// 商品のお気に入り状態をMySQLに保存するAPI
const FAVORITES_API = '../php/favorites.php';

const CATEGORY_NAMES = {
  whisky: 'ウイスキー',
  cocktail: 'カクテル',
  sake: '日本酒',
  wine: 'ワイン',
  paper: '紙タバコ',
  cigarette: '紙タバコ',
  vape: '電子タバコ'
};

const esc = s => String(s ?? '').replace(/[&<>"']/g, c =>
  ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

// 要素が無くてもエラーにならない textContent 設定
const setText = (id, text) => {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
  return el;
};

// 1〜5 を ●●●○○ 形式に
const dots = n => {
  const v = Number(n);
  if (!Number.isInteger(v) || v < 1 || v > 5) return null;
  return '●'.repeat(v) + '○'.repeat(5 - v);
};

const METHOD_LABELS = { shake: 'シェイク', build: 'ビルド', stir: 'ステア', blend: 'ブレンド' };
const GLASS_LABELS  = { short: 'ショート', long: 'ロング' };
const WINE_LABELS   = { '泡': 'スパークリング' };

// 電子タバコ48商品の商品名→画像番号。新しいIQOS画像.zipの1.png～48.pngを
// 登録SQLの48商品と既存の銘柄別画像に照合し、5001.webp～5048.webpへ差し替え。
// DB商品IDが自動採番で変わっても商品名からのみ確定し、不明な名前は画像なしにする。
// 全角・半角スペースや記号の違いを吸収して照合する。
const normalizeVapeName = name => String(name ?? '')
  .normalize('NFKC').replace(/[\s\u3000・･\-]/g, '').toLowerCase();
const VAPE_IMAGE_BY_NAME = new Map([
  ["テリア クリア レギュラー", 5001],
  ["センティア バランスド イエロー", 5002],
  ["センティア スムース ゴールド", 5003],
  ["センティア クリア シルバー", 5004],
  ["センティア ピュア ティーク", 5005],
  ["センティア フレッシュ エメラルド", 5006],
  ["テリア スムース レギュラー", 5007],
  ["テリア バランスド レギュラー", 5008],
  ["テリア ウォーム レギュラー", 5009],
  ["テリア ミント", 5010],
  ["センティア クール ジェイド", 5011],
  ["テリア ブライト メンソール", 5012],
  ["テリア ルビー レギュラー", 5013],
  ["センティア スムース バイオレット", 5014],
  ["テリア ブロッサム パール", 5015],
  ["テリア ステラー パール", 5016],
  ["テリア サン パール", 5017],
  ["テリア オアシス パール", 5018],
  ["テリア リビエラ パール", 5019],
  ["テリア シャイン パール", 5020],
  ["テリア ベルベット パール", 5021],
  ["センティア パープル カプセル", 5022],
  ["センティア パッション フルーツ カプセル", 5023],
  ["テリア メンソール", 5024],
  ["センティア フロスト グリーン", 5025],
  ["センティア シトラス グリーン", 5026],
  ["センティア フレッシュ コーラル", 5027],
  ["センティア フレッシュ パープル", 5028],
  ["センティア トロピカル イエロー", 5029],
  ["センティア ジューシー レッド", 5030],
  ["テリア レギュラー", 5031],
  ["テリア イエロー メンソール", 5032],
  ["テリア パープル メンソール", 5033],
  ["テリア トロピカル メンソール", 5034],
  ["テリア フュージョン メンソール", 5035],
  ["センティア アイシー ブラック", 5036],
  ["テリア ブラック メンソール", 5037],
  ["テリア ブラック イエロー メンソール", 5038],
  ["テリア ブラック サンシャイン メンソール", 5039],
  ["センティア アイシー レッド", 5040],
  ["センティア コバルト ブルー", 5041],
  ["センティア ディープ ブロンズ", 5042],
  ["テリア ブラック パープル メンソール", 5043],
  ["テリア ブラック ルビー メンソール", 5044],
  ["テリア ブラック フューシャ メンソール", 5045],
  ["センティア アイシー パープル", 5046],
  ["テリア リッチ レギュラー", 5047],
  ["テリア ブラック ミント パール", 5048],
].map(([name, id]) => [normalizeVapeName(name), id]));

function getVapeImageUrl(p) {
  if (p.category_code !== 'vape') return '';
  const imageId = VAPE_IMAGE_BY_NAME.get(normalizeVapeName(p.product_name));
  return imageId ? `../assets/products/${imageId}.webp` : '';
}

// 紙タバコ画像: 商品名と商品IDの二重チェックで取り違えを防ぐ。
// 更新画像では原本6042がソフトタイプ(ID=440)、原本6040がボックス(ID=442)。
// 保存時はDBの商品IDに対応する6001～6100に正しく配置し直した。
const normalizePaperName = name => String(name ?? '')
  .normalize('NFKC').replace(/[\s\u3000・･\-]/g, '').toLowerCase();
const PAPER_IMAGE_BY_NAME = new Map([
  ["メビウス・ワン・100's・ボックス", 6001],
  ["キャメル・クラフト・1・100's・ボックス", 6002],
  ["ウィンストン・キャスター・ホワイト・ワン・100's・ボックス", 6003],
  ['ケント・エス・シリーズ・1・100・ボックス', 6004],
  ['ラーク・ウルトラ・1・KS・ボックス', 6005],
  ['ラッキー・ストライク・エキスパートカット・1・100', 6006],
  ["パーラメント・ワン・100's・ボックス", 6007],
  ["メビウス・Eシリーズ・ワン・100's", 6008],
  ["ウィンストン・キャビン・レッド・ワン・100's・ボックス", 6009],
  ['ケント・1・100・ボックス', 6010],
  ["メビウス・Eシリーズ・ワン・100's・スリム", 6011],
  ['ケント・1・KS・ボックス', 6012],
  ['メビウス・ワン・ボックス', 6013],
  ["キャメル・クラフト・メンソール・1・100's・ボックス", 6014],
  ['ピアニッシモ・アリア・メンソール', 6015],
  ['ケント・エス・シリーズ・メンソール・1・100・ボックス', 6016],
  ['ピアニッシモ・プレシア・メンソール', 6017],
  ['ピアニッシモ・ペティル・メンソール', 6018],
  ["メビウス・Eシリーズ・アイスストーム・ワン・100's・スリム", 6019],
  ['ケント・エス・シリーズ・スパーク・1・100・ボックス', 6020],
  ['マールボロ・アイス・ブラスト・メガ・1・ボックス', 6021],
  ['ケント・アイ・ブースト・1・100・ボックス', 6022],
  ["メビウス・Eシリーズ・メンソール・オプション・パープル・ワン・100's", 6023],
  ["キャメル・クラフト・メンソール・ベリーカプセル・1・100's・ボックス", 6024],
  ["メビウス・Eシリーズ・3・100's", 6025],
  ['キャメル・クラフト・3・ボックス', 6026],
  ['ラーク・エクストラ・3・100・ボックス', 6027],
  ['ラッキー・ストライク・エキスパートカット・3', 6028],
  ['ラーク・エクストラ・3・KS・ボックス', 6029],
  ["メビウス・エクストラライト・100's・ボックス", 6030],
  ['ウィンストン・キャスター・ホワイト・3・ボックス', 6031],
  ['ケント・エス・シリーズ・3・100・ボックス', 6032],
  ['フィリップモリス・3・KS・ボックス', 6033],
  ["メビウス・Eシリーズ・3・100's・スリム", 6034],
  ['ケント・3・100・ボックス', 6035],
  ['メビウス・エクストラライト・ボックス', 6036],
  ['マールボロ・メンソール・4・ボックス', 6037],
  ['キャメル・クラフト・メンソール・ペアーカプセル・5・ボックス', 6038],
  ['キャメル・クラフト・メンソール・ベリーカプセル・5・ボックス', 6039],
  ['ウィンストン・キャスター・ホワイト・5', 6040],
  ['ラーク・スーパー・KS・ボックス', 6041],
  ['ウィンストン・キャスター・ホワイト・5・ボックス', 6042],
  ['ウィンストン・キャビン・レッド・5・ボックス', 6043],
  ['ピアニッシモ・アイシーン・メンソール・5', 6044],
  ['ラッキー・ストライク・ブラック・シリーズ・メンソール・5', 6045],
  ['クール・ブースト・フレッシュ・5・ボックス', 6046],
  ['メビウス・Eシリーズ・メンソール・オプション・パープル・5', 6047],
  ['ラッキー・ストライク・ブラック・シリーズ・チルベリー・5', 6048],
  ['フィリップモリス・パープル・5・KS・ボックス', 6049],
  ['ケント・エス・シリーズ・スパーク・5・100・ボックス', 6050],
  ["メビウス・Eシリーズ・メンソール・オプション・パープル・5・100's・スリム", 6051],
  ['メビウス・Eシリーズ・6', 6052],
  ['キャメル・クラフト・6・ボックス', 6053],
  ['ケント・6・100・ボックス', 6054],
  ['マールボロ・ゴールド・ボックス', 6055],
  ['ラーク・スーパー・マイルド・100・ボックス', 6056],
  ['ラッキー・ストライク・エキスパートカット・6', 6057],
  ['ホープ・スーパーライト', 6058],
  ['メビウス・スーパーライト', 6059],
  ['メビウス・スーパーライト・ボックス', 6060],
  ['ラーク・ハイブリッド・KS・ボックス', 6061],
  ["メビウス・Eシリーズ・6・100's・スリム", 6062],
  ['ピース・スーパーライト・ボックス', 6063],
  ['セブンスター・7・ボックス', 6064],
  ['キャメル・クラフト・メンソール・ベリーカプセル・8・ボックス', 6065],
  ['マールボロ・ブラック・メンソール・8・ボックス', 6066],
  ['ウィンストン・キャビン・レッド・8・ボックス', 6067],
  ['マールボロ・メンソール・8・ボックス', 6068],
  ['ラッキー・ストライク・ブラック・シリーズ・メンソール・8', 6069],
  ['フィリップモリス・メンソール・8・KS・ボックス', 6070],
  ['セブンスター・メンソール・8', 6071],
  ['メビウス・Eシリーズ・アイスストーム・8', 6072],
  ['メビウス・Eシリーズ・メンソール・オプション・パープル・8', 6073],
  ['ラッキー・ストライク・ブラック・シリーズ・チルベリー・8', 6074],
  ['メビウス・ライト', 6075],
  ['マールボロ・ミディアム・ボックス', 6076],
  ['ラッキー・ストライク・エキスパートカット・8', 6077],
  ['メビウス・ライト・ボックス', 6078],
  ["マールボロ・メンソール・8・100's・ボックス", 6079],
  ['ラーク・マイルド・100・ボックス', 6080],
  ['ラーク・マイルド・KS・ボックス', 6081],
  ['キャメル・クラフト・10・ボックス', 6082],
  ["メビウス・Eシリーズ・10・100's・スリム", 6083],
  ['メビウス', 6084],
  ['メビウス・ボックス', 6085],
  ['メビウス・Eシリーズ・10', 6086],
  ['ラッキー・ストライク・エキスパートカット・10', 6087],
  ['セブンスター・10・ボックス', 6088],
  ['キャメル・クラフト・12・ボックス', 6089],
  ['マールボロ・メンソール・12・ボックス', 6090],
  ['マールボロ・ソフト', 6091],
  ['ラーク・100・ボックス', 6092],
  ['ラーク・KS・ボックス', 6093],
  ['メビウス・Eシリーズ・12', 6094],
  ['セブンスター・メンソール・12', 6095],
  ['ホープ（10本入）', 6096],
  ['キャメル・クラフト・14・ボックス', 6097],
  ['ラッキー・ストライク・エキスパートカット・14', 6098],
  ['セブンスター', 6099],
  ['セブンスター・ボックス', 6100],
].map(([name, imageId]) => [normalizePaperName(name), imageId]));

function getVerifiedPaperImageUrl(p) {
  const productId = Number(p.product_id);
  const imageId = PAPER_IMAGE_BY_NAME.get(normalizePaperName(p.product_name));
  if (!Number.isInteger(productId) || !imageId) return '';
  // 入れ替わり・重複登録・商品名変更があれば、誤った画像を出す代わりに画像なしにする。
  if (productId + 5600 !== imageId) return '';
  return `../assets/products/${imageId}.webp`;
}

// 商品画像は assets/products/{画像番号}.webp に統一。
// 既存DBではウイスキー/日本酒は image_path に画像番号が入り、
// ワイン/カクテルは NULL のため商品IDとカテゴリから画像番号を補完する。
const IMAGE_ID_RANGES = {
  whisky:   { min: 1,   max: 100, offset: 1000 },
  sake:     { min: 101, max: 200, offset: 1900 },
  wine:     { min: 201, max: 300, offset: 2800 },
  cocktail: { min: 301, max: 400, offset: 3700 },
  // 紙タバコ: 既存の画像対応は維持
  cigarette: { min: 401, max: 500, offset: 5600 },
  paper:     { min: 401, max: 500, offset: 5600 },
  // 電子タバコは名前が一致しなければ画像なし（誤表示を避ける）
};

function getCategoryImageUrl(p) {
  const range = IMAGE_ID_RANGES[p.category_code];
  const productId = Number(p.product_id);
  if (!range || !Number.isInteger(productId) ||
      productId < range.min || productId > range.max) return '';
  return `../assets/products/${productId + range.offset}.webp`;
}

function resolveProductImageUrl(p) {
  // 電子タバコ: 商品名が一致するときだけ表示。DBのIDや古いimage_pathを誤用しない。
  if (p.category_code === 'vape') return getVapeImageUrl(p);
  // 紙タバコは番号だけではなくDBの商品名も照合する。画像不一致時の代替表示はしない。
  if (p.category_code === 'cigarette' || p.category_code === 'paper') {
    return getVerifiedPaperImageUrl(p);
  }
  const stored = String(p.image_path ?? '').trim();
  // DBに保存されている画像番号（例: 1001, 2099）
  if (/^\d{4}$/.test(stored)) {
    return `../assets/products/${stored}.webp`;
  }
  // 画像URLが明示されている場合は従来の動作も維持
  if (stored) return stored;

  // image_path が NULL のカテゴリは商品IDから画像番号を取得
  return getCategoryImageUrl(p);
}

// 商品情報から「基本スペック」の行を組み立てる
function buildSpecRows(p, d, code) {
  const rows = [];
  const add = (label, value) => {
    if (value !== null && value !== undefined && value !== '') rows.push([label, value]);
  };

  if (code !== 'cocktail') {
    add('価格', p.price != null && p.price !== '' ? Number(p.price).toLocaleString() + '円' : null);
    if (code === 'cigarette' || code === 'paper') {
      // tobacco_details の表示用に意味のある項目はすべて掲載する。
      // 数値 0、フラグ 0、未登録(NULL)を区別する。
      const mg = value => value === null || value === undefined || value === '' || !Number.isFinite(Number(value))
        ? '未登録' : `${Number(value)}mg`;
      const yesNo = value => value === null || value === undefined || value === ''
        ? null : (Number(value) === 1 ? 'あり' : 'なし');
      const selected = (flags) => {
        if (!flags.some(([key]) => d[key] !== null && d[key] !== undefined)) return null;
        const names = flags.filter(([key]) => Number(d[key]) === 1).map(([, label]) => label);
        return names.length ? names.join('・') : '指定なし';
      };
      add('ブランド', d.brand);
      add('メーカー', p.maker_name);
      add('製造国', p.country_name);
      add('香味タイプ', d.flavor_type);
      add('タール', mg(d.tar_mg));
      add('ニコチン', mg(d.nicotine_mg));
      if (d.pack_count !== null && d.pack_count !== undefined && d.pack_count !== '') {
        add('入数', `${Number(d.pack_count)}本入り`);
      }
      add('長さ・形状', selected([
        ['is_short', 'ショート'], ['is_king', 'キングサイズ（KS）'],
        ['is_long', 'ロング（100’s）'], ['is_slim', 'スリム']
      ]));
      add('包装タイプ', selected([['is_soft', 'ソフト'], ['is_box', 'ボックス']]));
      // フラグの真偽も詳細画面で確認可能にし、DBに登録済みの条件を取りこぼさない。
      add('ショート', yesNo(d.is_short));
      add('標準（KS）', yesNo(d.is_king));
      add('ロング（100’s）', yesNo(d.is_long));
      add('スリム', yesNo(d.is_slim));
      add('ソフト', yesNo(d.is_soft));
      add('ボックス', yesNo(d.is_box));
      add('レギュラー', yesNo(d.is_regular));
      add('メンソール', yesNo(d.is_menthol));
      add('香り付き', yesNo(d.is_flavor));
      add('カプセル', yesNo(d.is_capsule));
    } else if (code === 'vape') {
      add('製品シリーズ', d.product_line);
      add('種類', d.type_label);
      add('メーカー', p.maker_name);
      add('製造国', p.country_name);
      const vapeYesNo = v => v === null || v === undefined || v === ''
        ? '未登録' : (Number(v) === 1 ? 'あり' : 'なし');
      const vapeCompatible = v => v === null || v === undefined || v === ''
        ? '未登録' : (Number(v) === 1 ? '対応' : '非対応');
      add('吸いごたえ', dots(d.strength_score) || '未評価');
      add('IQOS ILUMA対応', vapeCompatible(d.is_iluma_compatible));
      add('旧型IQOS対応', vapeCompatible(d.is_legacy_compatible));
      add('レギュラー', vapeYesNo(d.is_regular));
      add('メンソール', vapeYesNo(d.is_menthol));
      add('フレーバー強め', vapeYesNo(d.is_strong_flavor));
      add('カプセル入り', vapeYesNo(d.is_capsule));
    } else {
      add('度数', p.abv ? p.abv + '%' : null);
      add('年代', p.vintage ? p.vintage : null);
    }
  }

  if (code === 'vape') {
    add('香り', dots(p.aroma_score) || '未評価');
    add('コク', dots(p.richness_score) || '未評価');
  } else if (code !== 'cigarette' && code !== 'paper') {
    add('香り', dots(p.aroma_score));
    add('味（甘↔苦）', dots(p.taste_score));
    add('酸味', dots(p.sour_score));
    add('濃厚さ', dots(p.richness_score));
  }

  if (code === 'whisky') {
    const t = [];
    if (+d.is_smoky)   t.push('スモーク');
    if (+d.is_grain)   t.push('グレーン');
    if (+d.is_malt)    t.push('モルト');
    if (+d.is_blended) t.push('ブレンデッド');
    add('タイプ', t.join('、'));
  } else if (code === 'sake') {
    const t = [];
    if (+d.is_easy_to_drink) t.push('呑みやすい');
    if (+d.is_dry)           t.push('辛口');
    if (+d.is_sweet)         t.push('甘口');
    add('タイプ', t.join('、'));
  } else if (code === 'wine') {
    add('種類', WINE_LABELS[d.wine_type] || d.wine_type);
    add('ぶどう品種', d.grape);
  } else if (code === 'cocktail') {
    add('ベース酒', d.base_liquor_name);
    add('製法', METHOD_LABELS[d.method] || d.method);
    add('スモーク', +d.is_smoke ? 'あり' : null);
    add('グラス', GLASS_LABELS[d.glass_size] || d.glass_size);
    add('フルーツ', d.fruit_name);
  }
  return rows;
}

function renderProduct(data) {
  const p = data.product;
  const d = data.details || {};
  const code = p.category_code;
  // URLにカテゴリがない直接アクセスでも、検索に戻る際のカテゴリを商品データから確定する。
  if (typeof updateDetailBackLink === 'function') updateDetailBackLink(code);

  // 上部メタ情報：カテゴリ | メーカー | 製造国(日本酒は都道府県)
  const origin = code === 'sake' ? d.prefecture : p.country_name;
  const meta = [CATEGORY_NAMES[code] || '商品', p.maker_name, origin].filter(Boolean).join(' | ');
  setText('detailMeta', meta);

  // タイトル
  setText('detailTitle', p.product_name);
  document.title = p.product_name + ' | 嗜好の領域';

  // 商品画像（紙タバコ・電子タバコを含む登録済み商品の画像を表示）
  const imgBox = document.getElementById('detailImage');
  if (imgBox) {
    const imageUrl = resolveProductImageUrl(p);
    if (imageUrl) {
      const img = document.createElement('img');
      img.alt = `${p.product_name}の商品画像`;
      img.decoding = 'async';
      img.loading = 'eager';
      img.onerror = () => {
        // 紙・電子タバコは失敗時のID推測フォールバック禁止（別商品の誤表示を防止）。
        const fallback = (code === 'cigarette' || code === 'paper' || code === 'vape')
          ? '' : getCategoryImageUrl(p);
        if (fallback && img.getAttribute('src') !== fallback) {
          img.src = fallback;
        } else {
          imgBox.textContent = '画像なし';
        }
      };
      imgBox.replaceChildren(img);
      img.src = imageUrl;
    } else {
      imgBox.textContent = '画像なし';
    }
  }

  // 口コミ入力欄は紙タバコにも使える表現に切り替える
  const reviewInput = document.getElementById('commentTextarea');
  if (reviewInput && (code === 'cigarette' || code === 'paper' || code === 'vape')) {
    reviewInput.placeholder = 'この商品の感想を入力...';
  }

  // スペック表 + おすすめの飲み方
  const rows = buildSpecRows(p, d, code);
  if ((data.drink_styles || []).length) {
    rows.push(['おすすめの飲み方', data.drink_styles.join('、')]);
  }
  const specEl = document.getElementById('specList');
  if (specEl) {
    specEl.innerHTML = rows.map(([k, v]) => `
      <div style="display:flex;gap:12px;padding:6px 0;border-bottom:1px solid #2d2618;font-size:13px;">
        <span style="width:130px;flex-shrink:0;color:var(--muted);">${esc(k)}</span>
        <span style="color:#ddd;">${esc(v)}</span>
      </div>`).join('') || '<p style="font-size:13px;color:var(--muted);">情報がありません。</p>';
  }

  // タグ
  const tagBox = document.getElementById('tagList');
  if (tagBox) {
    tagBox.innerHTML = (data.tags || [])
      .map(t => `<span class="tag-badge">#${esc(t)}</span>`).join('')
      || '<span style="font-size:13px;color:var(--muted);">タグはありません</span>';
  }

  // 説明文（右側 + 拡大モーダル）
  const desc = p.description || '説明文はまだ登録されていません。';
  ['descText', 'descModalText'].forEach(id => {
    const el = setText(id, desc);
    if (el) el.style.whiteSpace = 'pre-wrap';
  });
}

async function loadProduct() {
  const id = new URLSearchParams(window.location.search).get('id');

  if (!id || !/^\d+$/.test(id)) {
    setText('detailTitle', '商品が指定されていません');
    return;
  }

  try {
    const res = await fetch(DETAIL_API + '?id=' + encodeURIComponent(id));
    const data = await res.json();
    if (res.status === 404) {
      setText('detailTitle', '商品が見つかりませんでした');
      return;
    }
    if (!res.ok) throw new Error(data.error || 'error');
    renderProduct(data);
  } catch (e) {
    console.error(e);
    setText('detailTitle', '商品情報の取得に失敗しました');
  }
}

// ====================================================================
// 口コミ・評価
// ====================================================================
const MINI_REVIEW_COUNT = 5;   // 画面の小さい一覧に出す件数

const reviewState = {
  productId: null,   // 表示中の商品ID
  csrf: '',          // 保存・削除に必要な合言葉(review.php から受け取る)
  summary: { count: 0, average: null },
  mine: null,        // 自分の口コミ { review_id, rating, comment } / まだなら null
  reviews: [],       // この商品への口コミ一覧
  showAll: false     // 最新5件と、取得済み一覧の表示を切り替える
};

const starText = n => '★'.repeat(n) + '☆'.repeat(5 - n);
const formatDate = s => String(s || '').slice(0, 10).replace(/-/g, '/');

function mk(tag, className, text) {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text !== undefined) e.textContent = text;
  return e;
}

// ログインが必要なときの案内
function showLoginPrompt(text) {
  setText('loginPromptText', text || 'この機能を利用するにはログインが必要です。');
  openModal('loginPromptModal');
}

// review.php を呼ぶ。失敗しても { ok:false, message } を返す(401 はログイン案内を出して null)
async function callReviewApi(url, init) {
  try {
    const res = await fetch(url, init);
    if (res.status === 401) {
      // GET（一覧表示）はゲストにも公開。POST（投稿・編集・削除）だけ案内を出す。
      if (init && (init.method || 'GET').toUpperCase() !== 'GET') {
        showLoginPrompt('口コミの投稿・編集・削除にはログインが必要です。');
      }
      return null;
    }
    try {
      return await res.json();
    } catch (e) {
      return { ok: false, message: 'サーバーの応答が正しくありません。' };
    }
  } catch (e) {
    return { ok: false, message: 'サーバーに接続できませんでした。' };
  }
}

function postReview(payload) {
  return callReviewApi(REVIEW_API, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(Object.assign({ csrf: reviewState.csrf }, payload))
  });
}

// ----- 星の入力欄 -----
function getStarEls() {
  return document.querySelectorAll('.star-rating-select .star');
}
function currentStars() {
  return Array.from(getStarEls()).filter(s => s.classList.contains('active')).length;
}
function setStars(n) {
  getStarEls().forEach((s, idx) => {
    const active = idx < n;
    s.classList.toggle('active', active);
    s.setAttribute('aria-pressed', String(active));
  });
}

function setReviewFeedback(message, isError = false) {
  const box = document.getElementById('reviewFeedback');
  if (!box) return;
  box.textContent = message;
  box.classList.toggle('is-error', isError);
}

function updateCommentCounter() {
  const textarea = document.getElementById('commentTextarea');
  setText('commentCounter', `${textarea ? Array.from(textarea.value).length : 0} / 1000文字`);
}

// ----- 一覧の取得 -----
async function loadReviews() {
  const refresh = document.getElementById('refreshReviewsBtn');
  if (refresh) refresh.disabled = true;
  try {
    // 常に商品IDを指定し、キャッシュを使用せず最新の口コミを取得する。
    const data = await callReviewApi(
      REVIEW_API + '?product_id=' + encodeURIComponent(reviewState.productId),
      { credentials: 'same-origin', cache: 'no-store' }
    );
    if (!data) {
      setText('reviewListCount', '口コミを取得できませんでした。更新ボタンで再試行できます。');
      return;
    }

    if (!data.ok) {
      showReviewMessage(data.message || '口コミを取得できませんでした。');
      setText('reviewListCount', '口コミの取得に失敗しました。');
      return;
    }

    reviewState.csrf = data.csrf;
    reviewState.summary = data.summary;
    reviewState.mine = data.mine;
    reviewState.reviews = Array.isArray(data.reviews) ? data.reviews : [];

    renderReviewSummary();
    renderReviewLists();
    fillReviewForm();
  } finally {
    if (refresh) refresh.disabled = false;
  }
}

// 一覧の場所にメッセージを出す
function showReviewMessage(text) {
  ['reviewListMini', 'reviewListModal'].forEach(id => {
    const box = document.getElementById(id);
    if (!box) return;
    box.replaceChildren();
    const p = mk('p', '', text);
    p.style.fontSize = '13px';
    p.style.color = 'var(--muted)';
    box.appendChild(p);
  });
}

// 平均と件数
function renderReviewSummary() {
  const box = document.getElementById('reviewSummary');
  if (!box) return;
  const s = reviewState.summary;
  box.textContent = s.count > 0
    ? `★ ${Number(s.average).toFixed(1)}（${s.count}件）`
    : 'まだ評価はありません';
}

// 口コミ1件のカード
function buildReviewCard(r, truncated) {
  const card = mk('div', 'comment-card');

  const user = mk('div', 'comment-user');
  user.appendChild(mk('div', 'avatar-img'));
  user.appendChild(mk('span', 'comment-user-text',
    ' ' + r.user_name + (r.is_mine ? '（あなた）' : '') + '　' + starText(r.rating)
  ));
  card.appendChild(user);

  const text = mk('div', 'comment-text' + (truncated ? ' truncated' : ''), r.comment || '（コメントなし）');
  // 改行・長い連続文字の折り返しはCSSが担当する。
  // ここでインラインのwhite-spaceを指定すると通常一覧の省略表示を上書きしてしまう。
  card.appendChild(text);

  const meta = mk('div', '', formatDate(r.created_at));
  meta.style.fontSize = '11px';
  meta.style.color = 'var(--muted)';
  meta.style.marginTop = '4px';
  card.appendChild(meta);

  // 自分の口コミだけ、削除ボタンを出す
  if (r.is_mine) {
    const del = mk('button', 'icon-btn', '削除');
    del.type = 'button';
    del.style.marginTop = '6px';
    del.addEventListener('click', () => deleteReview(r.review_id));
    card.appendChild(del);
  }
  return card;
}

// この商品の口コミを最大5件プレビュー。6件以上なら全件表示へ切り替え可能。
function renderReviewLists() {
  const all = reviewState.reviews;
  const total = Math.max(0, Number(reviewState.summary.count) || 0);
  const visible = reviewState.showAll ? all : all.slice(0, MINI_REVIEW_COUNT);
  const mini = document.getElementById('reviewListMini');
  const toggle = document.getElementById('toggleReviewListBtn');

  if (mini) {
    mini.replaceChildren();
    if (all.length === 0) {
      const p = mk('p', '', 'この商品への口コミはまだありません。最初の投稿者になりましょう。');
      p.style.fontSize = '13px';
      p.style.color = 'var(--muted)';
      mini.appendChild(p);
    } else {
      visible.forEach(r => mini.appendChild(buildReviewCard(r, !reviewState.showAll)));
    }
  }

  // 「最新5件」は必ず5件あるという意味ではなく、最大5件の意味。
  setText('reviewListHeading', reviewState.showAll
    ? 'みんなの口コミ（この商品の一覧）'
    : 'みんなの口コミ（この商品の最新5件）');
  const shownCount = visible.length;
  setText('reviewListCount', `この商品への口コミ：全${total}件／${shownCount}件表示` +
    (total > all.length && reviewState.showAll ? `（取得できるのは最新${all.length}件まで）` : ''));

  if (toggle) {
    toggle.hidden = all.length <= MINI_REVIEW_COUNT;
    toggle.textContent = reviewState.showAll
      ? '最新5件に戻す'
      : `もっと見る（残り${all.length - MINI_REVIEW_COUNT}件）`;
    toggle.setAttribute('aria-expanded', String(reviewState.showAll));
  }

  renderReviewModalList();
}

// 拡大モーダル: 星の数 と キーワード(コメント・ユーザー名)で絞り込む
function renderReviewModalList() {
  const box = document.getElementById('reviewListModal');
  if (!box) return;
  box.replaceChildren();

  const starEl = document.getElementById('reviewStarFilter');
  const kwEl = document.getElementById('reviewKeyword');
  const star = starEl ? starEl.value : '';
  const kw = kwEl ? kwEl.value.trim().toLowerCase() : '';

  const list = reviewState.reviews.filter(r => {
    if (star !== '' && String(r.rating) !== star) return false;
    if (kw !== '') {
      const target = ((r.comment || '') + ' ' + r.user_name).toLowerCase();
      if (!target.includes(kw)) return false;
    }
    return true;
  });

  if (list.length === 0) {
    const p = mk('p', '', '該当する口コミはありません。');
    p.style.fontSize = '13px';
    p.style.color = 'var(--muted)';
    box.appendChild(p);
    return;
  }
  list.forEach(r => box.appendChild(buildReviewCard(r, false)));
}

// 入力欄: 自分の口コミがあれば、その内容を入れて「更新する」にする
function fillReviewForm() {
  const textarea = document.getElementById('commentTextarea');
  const submit = document.getElementById('submitCommentBtn');
  const del = document.getElementById('deleteReviewBtn');
  const mine = reviewState.mine;

  setStars(mine ? mine.rating : 0);
  if (textarea) textarea.value = mine && mine.comment ? mine.comment : '';
  updateCommentCounter();
  if (submit) submit.textContent = mine ? '更新する' : '投稿する';
  if (del) del.style.display = mine ? '' : 'none';
}

// ----- 投稿・更新 -----
// 投稿の成否は #reviewFeedback に表示する。ブラウザー上部の alert は出さない。
async function saveReview() {
  if (!isLoggedIn) {
    showLoginPrompt('口コミを投稿するにはログインが必要です。');
    return;
  }
  const rating = currentStars();
  if (rating < 1) {
    setReviewFeedback('星の数を1〜5から選んでください。', true);
    return;
  }
  const textarea = document.getElementById('commentTextarea');
  const comment = textarea ? textarea.value.trim() : '';
  if (!comment) {
    setReviewFeedback('コメントを入力してください。', true);
    if (textarea) textarea.focus();
    return;
  }
  if (Array.from(comment).length > 1000) {
    setReviewFeedback('コメントは1000文字以内で入力してください。', true);
    return;
  }

  const submit = document.getElementById('submitCommentBtn');
  if (submit && submit.disabled) return;
  if (submit) submit.disabled = true;
  setReviewFeedback('保存中...');

  try {
    const data = await postReview({
      action: 'save',
      product_id: Number(reviewState.productId),
      rating,
      comment
    });
    if (!data) {
      setReviewFeedback('ログイン後に投稿してください。', true);
      return;
    }
    if (!data.ok) {
      setReviewFeedback(data.message || '投稿に失敗しました。', true);
      return;
    }
    await loadReviews();
    setReviewFeedback((data.message || '口コミを保存しました。') + ' マイページでも確認できます。');
  } catch (error) {
    console.error('口コミの保存・再読み込みに失敗しました:', error);
    setReviewFeedback('口コミの処理中にエラーが発生しました。再読み込みして投稿履歴を確認してください。', true);
  } finally {
    if (submit) submit.disabled = false;
  }
}

// ----- 削除(自分の口コミだけ) -----
async function deleteReview(reviewId) {
  if (!isLoggedIn) {
    showLoginPrompt('口コミを削除するにはログインが必要です。');
    return;
  }
  if (!confirm('この口コミを削除しますか？')) return;

  const data = await postReview({ action: 'delete', review_id: Number(reviewId) });
  if (!data) return;

  if (data.ok) {
    await loadReviews();
    setReviewFeedback('口コミを削除しました。');
  } else {
    setReviewFeedback(data.message || '削除に失敗しました。', true);
  }
}

function initReviews() {
  const id = new URLSearchParams(window.location.search).get('id');
  if (!id || !/^\d+$/.test(id)) return;
  reviewState.productId = id;

  // サンプルの表示を消して、読み込み中にする
  showReviewMessage('読み込み中...');

  const submit = document.getElementById('submitCommentBtn');
  if (submit) {
    submit.addEventListener('click', e => {
      e.preventDefault();
      saveReview();
    });
  }
  const del = document.getElementById('deleteReviewBtn');
  if (del) {
    del.addEventListener('click', e => {
      e.preventDefault();
      if (reviewState.mine) deleteReview(reviewState.mine.review_id);
    });
  }
  const textarea = document.getElementById('commentTextarea');
  if (textarea) {
    textarea.addEventListener('focus', () => {
      if (!isLoggedIn) {
        textarea.blur();
        showLoginPrompt('口コミを投稿するにはログインが必要です。');
      }
    });
    textarea.addEventListener('input', updateCommentCounter);
  }
  updateCommentCounter();

  // 拡大モーダルの絞り込み
  const starFilter = document.getElementById('reviewStarFilter');
  if (starFilter) starFilter.addEventListener('change', renderReviewModalList);
  const keyword = document.getElementById('reviewKeyword');
  if (keyword) keyword.addEventListener('input', renderReviewModalList);

  // 別の利用者による新規投稿を手動で取得できるようにする。
  const refresh = document.getElementById('refreshReviewsBtn');
  if (refresh) refresh.addEventListener('click', loadReviews);
  const toggle = document.getElementById('toggleReviewListBtn');
  if (toggle) toggle.addEventListener('click', () => {
    reviewState.showAll = !reviewState.showAll;
    renderReviewLists();
  });

  loadReviews();
}

document.addEventListener('DOMContentLoaded', () => {
  loadProduct();

  // 星評価：選択済みの最後の星をもう一度押すと解除
  const stars = document.querySelectorAll('.star-rating-select .star');
  stars.forEach((star, index) => {
    star.addEventListener('click', () => {
      if (!isLoggedIn) {
        showLoginPrompt('口コミを投稿するにはログインが必要です。');
        return;
      }
      const isLastActive = star.classList.contains('active') &&
        (index === stars.length - 1 || !stars[index + 1].classList.contains('active'));
      setStars(isLastActive ? 0 : index + 1);
      setReviewFeedback('');
    });
  });

  // 口コミ・評価(一覧の表示、投稿、更新、削除)
  initReviews();

  // 商品のお気に入り状態の読み込み
  initFavorite();
});

// ====================================================================
// お気に入り: favorites.php に保存し、マイページの一覧へ反映する
// ====================================================================
const favoriteState = {
  productId: null,
  csrf: '',
  isFavorite: false,
  ready: false,
  busy: false
};

function renderFavorite() {
  const button = document.getElementById('favoriteBtn');
  if (!button) return;
  button.disabled = !favoriteState.ready || favoriteState.busy;
  button.classList.toggle('is-favorite', favoriteState.isFavorite);
  button.setAttribute('aria-pressed', String(favoriteState.isFavorite));
  button.textContent = favoriteState.isFavorite
    ? '♥ お気に入り解除'
    : '♡ お気に入り';
}

function updateFavoriteCount(count) {
  const label = document.getElementById('favoriteCount');
  if (label && Number.isFinite(Number(count))) {
    label.textContent = Number(count).toLocaleString('ja-JP');
  }
}

async function fetchFavoriteState() {
  if (!favoriteState.productId) return;
  try {
    const res = await fetch(
      FAVORITES_API + '?product_id=' + encodeURIComponent(favoriteState.productId),
      { credentials: 'same-origin', cache: 'no-store' }
    );
    if (res.status === 401) {
      // 旧版APIが401を返しても、閲覧だけでモーダルを開かない。
      favoriteState.ready = true;
      favoriteState.isFavorite = false;
      return;
    }
    const data = await res.json();
    if (!res.ok || !data.ok) throw new Error(data.message || 'お気に入り情報の取得に失敗しました。');
    favoriteState.csrf = data.csrf;
    favoriteState.isFavorite = data.is_favorite === true;
    favoriteState.ready = true;
    updateFavoriteCount(data.count);
  } catch (e) {
    console.error('お気に入り取得エラー:', e);
    setText('favoriteCount', '取得失敗');
  } finally {
    renderFavorite();
  }
}

// HTMLの「お気に入り」ボタンから呼ばれる
async function toggleFavorite() {
  if (!favoriteState.productId || favoriteState.busy) return;
  if (!isLoggedIn) {
    showLoginPrompt('お気に入り機能を利用するにはログインが必要です。');
    return;
  }
  if (!favoriteState.ready) {
    await fetchFavoriteState();
    if (!favoriteState.ready) {
      alert('お気に入り情報の取得に失敗しました。再読み込みしてお試しください。');
    }
    return;
  }

  favoriteState.busy = true;
  renderFavorite();
  try {
    const res = await fetch(FAVORITES_API, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        csrf: favoriteState.csrf,
        product_id: favoriteState.productId,
        action: favoriteState.isFavorite ? 'remove' : 'add'
      })
    });
    if (res.status === 401) {
      showLoginPrompt('お気に入り機能を利用するにはログインが必要です。');
      return;
    }
    const data = await res.json();
    if (!res.ok || !data.ok) throw new Error(data.message || 'お気に入りの保存に失敗しました。');
    favoriteState.isFavorite = data.is_favorite === true;
    favoriteState.csrf = data.csrf;
    updateFavoriteCount(data.count);
  } catch (e) {
    console.error('お気に入り保存エラー:', e);
    alert(e.message || 'お気に入りの更新に失敗しました。');
  } finally {
    favoriteState.busy = false;
    renderFavorite();
  }
}

function initFavorite() {
  const id = new URLSearchParams(window.location.search).get('id');
  if (!id || !/^\d+$/.test(id) || Number(id) < 1) return;
  favoriteState.productId = Number(id);
  renderFavorite();
  fetchFavoriteState();
}