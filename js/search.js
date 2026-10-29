// search.php の場所（search.html からの相対パス）。置き場所に合わせてここだけ変更する
const SEARCH_API = '../php/search.php';

document.addEventListener('DOMContentLoaded', () => {
  const params = new URLSearchParams(window.location.search);
  const category = params.get('category') || 'whisky';

  const categoryNames = {
    whisky: 'ウイスキー',
    cocktail: 'カクテル',
    sake: '日本酒',
    wine: 'ワイン',
    paper: '紙タバコ',
    vape: '電子タバコ'
  };

  // 1. カテゴリ表示更新
  const catBadge = document.getElementById('selectedCategoryBadge');
  if (catBadge) {
    catBadge.textContent = '◆ ' + (categoryNames[category] || 'お酒');
  }

  // 2. 製造国 vs 製造都道府県 の切り替え（カクテル以外の場合のみ処理）
  const countryLabel = document.getElementById('countryLabel');
  const countryInput = document.getElementById('countryInput');
  const countryList = document.getElementById('countryDatalist');
  
  if (category === 'sake') {
    if (countryLabel) countryLabel.textContent = '製造都道府県';
    if (countryInput) countryInput.placeholder = '例: 新潟県, 京都府...';
    if (countryList) {
      countryList.innerHTML = `
        <option value="新潟県">
        <option value="京都府">
        <option value="兵庫県">
        <option value="秋田県">
        <option value="山形県">
      `;
    }
  } else if (category !== 'cocktail') {
    if (countryLabel) countryLabel.textContent = '製造国';
    if (countryInput) countryInput.placeholder = '例: スコットランド, 日本...';
    if (countryList) {
      countryList.innerHTML = `
        <option value="日本">
        <option value="スコットランド">
        <option value="アイルランド">
        <option value="アメリカ">
        <option value="カナダ">
      `;
    }
  }

  // 3. カクテルのみ「基本情報」セクション全体を非表示にする
  const basicInfoSection = document.getElementById('basicInfoSection');
  if (basicInfoSection) {
    if (category === 'cocktail') {
      basicInfoSection.style.display = 'none';
    } else {
      basicInfoSection.style.display = 'block';
    }
  }

  // 4. 種別固有のチェックボックス切り替え
  const whiskyOpts = document.getElementById('whiskySpecific');
  const sakeOpts = document.getElementById('sakeSpecific');
  const wineOpts = document.getElementById('wineSpecific');
  const cocktailOpts = document.getElementById('cocktailSpecific');

  if (whiskyOpts) whiskyOpts.style.display = (category === 'whisky') ? 'block' : 'none';
  if (sakeOpts) sakeOpts.style.display = (category === 'sake') ? 'block' : 'none';
  if (wineOpts) wineOpts.style.display = (category === 'wine') ? 'block' : 'none';
  if (cocktailOpts) cocktailOpts.style.display = (category === 'cocktail') ? 'block' : 'none';

  // 5. 5段階評価ボタンの2回目クリックで選択解除する処理（確実動作版）
  const ratingInputs = document.querySelectorAll('.rating-options input[type="radio"]');

  ratingInputs.forEach(radio => {
    // マウスが押された瞬間の状態を記録しておく
    radio.addEventListener('mousedown', function() {
      this.dataset.wasChecked = this.checked ? "true" : "false";
    });

    // クリックされたときの処理
    radio.addEventListener('click', function() {
      // 「もともと選択されていた状態」でクリックされた場合はチェックを外す
      if (this.dataset.wasChecked === "true") {
        this.checked = false;
        this.dataset.wasChecked = "false";
        this.dispatchEvent(new Event('change', { bubbles: true }));
      } else {
        this.dataset.wasChecked = "true";
        // 同じグループの他のボタンの状態をリセット
        document.querySelectorAll(`input[type="radio"][name="${this.name}"]`).forEach(other => {
          if (other !== this) other.dataset.wasChecked = "false";
        });
      }
    });
  });

  // 6. 検索実行と結果描画
  const form = document.getElementById('searchForm');
  const grid = document.getElementById('resultGrid');
  const countEl = document.getElementById('resultCount');

  const esc = s => String(s ?? '').replace(/[&<>"']/g, c =>
    ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  async function runSearch(page = 1) {
    const q = new URLSearchParams(new FormData(form));
    q.set('category', category);
    q.set('page', page);
    try {
      const res = await fetch(SEARCH_API + '?' + q.toString());
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'error');

      countEl.textContent = `${data.total} 件見つかりました`;
      grid.innerHTML = data.items.map(p => {
        const sub = [
          p.prefecture || p.country_name || p.base_liquor_name,
          p.abv ? p.abv + '%' : null
        ].filter(Boolean).join(' / ');
        return `
          <a href="detail.html?id=${encodeURIComponent(p.product_id)}" class="answer-card">
            <span style="font-size:11px;color:var(--gold);">${esc(category.toUpperCase())}</span>
            <strong style="font-size:16px;color:var(--cream);">${esc(p.product_name)}</strong>
            <span style="font-size:12px;color:#aaa;">${esc(sub)}</span>
            <small style="color:var(--muted);">詳細を見る →</small>
          </a>`;
      }).join('') || '<p style="color:var(--muted)">該当する商品がありません。</p>';
    } catch (e) {
      console.error(e);
      countEl.textContent = '検索に失敗しました。';
      grid.innerHTML = '';
    }
  }

  window.runSearch = runSearch;
  form.addEventListener('submit', () => runSearch(1));
  runSearch(1); // 初期表示
});

function resetFilters() {
  const form = document.getElementById('searchForm');
  if (form) {
    form.reset();
    document.querySelectorAll('.rating-options input[type="radio"]').forEach(radio => {
      radio.dataset.wasChecked = "false";
    });
    if (window.runSearch) window.runSearch(1);
  }
}