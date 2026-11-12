// 簡単検索の結果ページ: 回答をPHPへ送り、おすすめの商品を表示する
const LEVEL_WORDS = {
  aroma:    ['控えめ', 'やや控えめ', 'ふつう', 'やや強い', '強い'],
  taste:    ['甘い', 'やや甘い', 'ふつう', 'やや苦い', '苦い'],
  sour:     ['控えめ', 'やや控えめ', 'ふつう', 'やや強い', '強い'],
  richness: ['軽い', 'やや軽い', 'ふつう', 'やや濃い', '濃い']
};

document.addEventListener('DOMContentLoaded', loadResult);

// 1つのメッセージ(「診断中…」「見つかりません」など)を、結果の欄に表示する
function showMessage(text, withBackLink) {
  const grid = document.getElementById('answerGrid');
  grid.replaceChildren();

  const p = document.createElement('p');
  p.textContent = text;
  p.style.textAlign = 'center';
  p.style.color = 'var(--muted)';
  p.style.gridColumn = '1 / -1';
  grid.appendChild(p);

  if (withBackLink) {
    const a = document.createElement('a');
    a.href = 'easysearch.html';
    a.className = 'gold-button';
    a.textContent = '診断をやり直す';
    a.style.justifySelf = 'center';
    a.style.gridColumn = '1 / -1';
    grid.appendChild(a);
  }
}

async function loadResult() {
  const grid = document.getElementById('answerGrid');
  if (!grid) return;

  // 質問ページで保存した回答を取り出す
  let answers = null;
  try {
    answers = JSON.parse(sessionStorage.getItem('easyAnswers') || 'null');
  } catch (e) {
    answers = null;
  }
  if (!answers) {
    showMessage('診断の回答が見つかりません。もう一度、診断してください。', true);
    return;
  }

  showMessage('診断中…', false);

  let data;
  try {
    const res = await fetch('../php/easysearch.php', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ answers })
    });
    if (res.status === 401) {   // ログインが切れている
      window.location.href = 'login.html';
      return;
    }
    data = await res.json();
  } catch (e) {
    showMessage('サーバーに接続できませんでした。', true);
    return;
  }

  if (!data.ok) {
    showMessage(data.message || '診断に失敗しました。', true);
    return;
  }

  renderTarget(data.target);
  renderResults(data.results);
}

// 「あなたの好み」を、言葉で表示する
function renderTarget(t) {
  const line = document.getElementById('scoreLine');
  if (!line) return;

  const part = (label, key) => `${label}：${LEVEL_WORDS[key][t[key] - 1]}(${t[key]})`;
  line.textContent = 'あなたの好み ─ ' + [
    part('香り', 'aroma'), part('味', 'taste'), part('酸味', 'sour'), part('濃厚さ', 'richness')
  ].join(' ／ ');
}

// おすすめ商品のカードを並べる
function renderResults(results) {
  const grid = document.getElementById('answerGrid');
  grid.replaceChildren();

  if (!results || results.length === 0) {
    showMessage('おすすめできる商品が見つかりませんでした。', true);
    return;
  }

  results.forEach((r, i) => {
    const a = document.createElement('a');
    a.className = 'answer-card';
    a.href = 'detail.html?id=' + encodeURIComponent(r.product_id);

    const name = document.createElement('strong');
    name.textContent = `${i + 1}. ${r.product_name}`;
    name.style.color = 'var(--gold-light)';
    a.appendChild(name);

    const cat = document.createElement('small');
    cat.textContent = r.category_name;
    a.appendChild(cat);

    a.appendChild(document.createElement('br'));

    const match = document.createElement('small');
    match.textContent = `マッチ度 ${r.match}%`;
    a.appendChild(match);

    grid.appendChild(a);
  });
}