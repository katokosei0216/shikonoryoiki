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
});

function resetFilters() {
  const form = document.getElementById('searchForm');
  if (form) form.reset();
}