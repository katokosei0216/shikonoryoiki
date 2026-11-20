// お酒の従来診断結果と、紙・電子タバコの診断結果を同じカードUIで表示する。
const LEVEL_WORDS = {
  aroma: ['控えめ', 'やや控えめ', 'ふつう', 'やや強い', '強い'],
  taste: ['甘い', 'やや甘い', 'ふつう', 'やや苦い', '苦い'],
  sour: ['控えめ', 'やや控えめ', 'ふつう', 'やや強い', '強い'],
  richness: ['軽い', 'やや軽い', 'ふつう', 'やや濃い', '濃い']
};

function getResultType() {
  let type = new URLSearchParams(location.search).get('type');
  if (!type) {
    try { type = sessionStorage.getItem('easyLastType'); } catch (_) { /* no storage */ }
  }
  if (type === 'paper' || type === 'tobacco') type = 'cigarette';
  return ['alcohol','cigarette','vape'].includes(type) ? type : 'alcohol';
}
const activeResultType = getResultType();

document.addEventListener('DOMContentLoaded', loadResult);

function showMessage(message, withBackLink) {
  const grid = document.getElementById('answerGrid');
  if (!grid) return;
  grid.replaceChildren();
  const p = document.createElement('p');
  p.textContent = message;
  p.style.cssText = 'text-align:center;color:var(--muted);grid-column:1/-1;';
  grid.appendChild(p);
  if (withBackLink) {
    const a = document.createElement('a');
    a.href = 'easysearch.html?type=' + encodeURIComponent(activeResultType);
    a.className = 'gold-button';
    a.textContent = '診断をやり直す';
    a.style.cssText = 'justify-self:center;grid-column:1/-1;';
    grid.append(a);
  }
}

async function loadResult() {
  const grid = document.getElementById('answerGrid');
  if (!grid) return;
  const tobacco = activeResultType !== 'alcohol';
  // ヘッダーの「簡単検索へ」も診断の種別を保持する。
  const fixBackLink = () => {
    document.querySelectorAll('#siteHeader a.back-button').forEach(a => {
      if (a.getAttribute('href') === 'easysearch.html') a.href = 'easysearch.html?type=' + encodeURIComponent(activeResultType);
    });
  };
  fixBackLink();
  // common.js はログイン照会後にヘッダーを追加するので、完了後にもリンクを直す。
  const header = document.getElementById('siteHeader');
  if (header) {
    const observer = new MutationObserver(() => { fixBackLink(); if (header.querySelector('a[href^="easysearch.html"]')) observer.disconnect(); });
    if (!header.querySelector('a[href^="easysearch.html"]')) observer.observe(header, {childList: true, subtree: true});
  }

  const heading = document.getElementById('easyAnswerTitle');
  if (heading) heading.textContent = tobacco ? (activeResultType === 'vape' ? '電子タバコ' : '紙タバコ') + 'のおすすめ9選' : 'おすすめの9選';
  const desc = document.getElementById('easyAnswerDescription');
  if (desc) desc.textContent = tobacco
    ? '回答とデータベースに登録された商品仕様の近さで並べた9件です。適合率は条件の一致度の目安であり、安全性を示すものではありません。'
    : 'あなたの回答と登録商品の評価に近い候補です。クリックで詳細へ移動します。';

  let answers = null;
  try {
    const key = tobacco ? 'easyAnswers_v2_' + activeResultType : 'easyAnswers';
    answers = JSON.parse(sessionStorage.getItem(key) || 'null');
  } catch (_) { /* no storage */ }
  if (!answers) {
    showMessage('診断の回答が見つかりません。もう一度診断してください。', true);
    return;
  }
  showMessage('診断結果を計算しています…', false);
  let data;
  try {
    const url = tobacco ? '../php/easysearch_tobacco.php' : '../php/easysearch.php';
    const res = await fetch(url, {
      method: 'POST', credentials: 'same-origin',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(tobacco ? {category:activeResultType, answers} : {answers})
    });
    if (res.status === 401) throw new Error('診断結果はログインなしで閲覧できます。サーバー上の簡単検索APIを更新してください。');
    data = await res.json();
    if (!res.ok || !data.ok) throw new Error(data.message || '診断に失敗しました。');
  } catch (e) {
    showMessage(e.message === 'Failed to fetch' ? 'サーバーに接続できませんでした。' : (e.message || '通信に失敗しました。'), true);
    return;
  }
  const scoreLine = document.getElementById('scoreLine');
  if (scoreLine) {
    if (tobacco) {
      const target = activeResultType === 'vape' ? 'シリーズ・香り・コク・吸いごたえ・種類・フレーバー・メンソール' : '香味・タール・ニコチン・サイズ・パッケージ・カプセル・価格';
      scoreLine.textContent = '診断に使用した条件：' + target;
    } else {
      const t = data.target;
      const part = (label, key) => `${label}：${LEVEL_WORDS[key][t[key] - 1]}(${t[key]})`;
      scoreLine.textContent = 'あなたの好み ─ ' + [
        part('香り','aroma'), part('味','taste'),part('酸味','sour'),part('濃厚さ','richness')
      ].join(' ／ ');
    }
  }
  renderResults(data.results, tobacco, data.notice);
}

function renderResults(results, tobacco, notice) {
  const grid = document.getElementById('answerGrid');
  grid.replaceChildren();
  if (!results || !results.length) {
    showMessage(notice || '条件に近い商品が見つかりませんでした。', true);
    return;
  }
  results.forEach((r, i) => {
    const a = document.createElement('a');
    a.className = 'answer-card';
    a.href = 'detail.html?id=' + encodeURIComponent(r.product_id) + '&from=easyanswer' +
      (tobacco ? '&category=' + encodeURIComponent(activeResultType) : '');
    const name = document.createElement('strong');
    name.textContent = `${i + 1}. ${r.product_name}`;
    name.style.color = 'var(--gold-light)';
    a.append(name);
    const cat = document.createElement('small');
    cat.textContent = r.category_name || (tobacco ? (activeResultType === 'vape' ? '電子タバコ' : '紙タバコ') : '');
    a.append(cat);
    const match = document.createElement('small');
    match.textContent = `一致度 ${r.match}%`;
    a.append(match);
    if (tobacco && r.spec_summary) {
      const note = document.createElement('small');
      note.textContent = r.spec_summary;
      a.append(note);
    }
    grid.append(a);
  });
}
