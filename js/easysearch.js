// 簡単検索(嗜好診断)の質問ページ: 回答を集めて、結果ページへ渡す
document.addEventListener('DOMContentLoaded', () => {
  restoreAnswers();

  const btn = document.getElementById('showResult');
  if (!btn) return;

  btn.addEventListener('click', (e) => {
    e.preventDefault();

    const answers = collectAnswers();
    if (!answers) return;   // 未回答の質問があった

    try {
      sessionStorage.setItem('easyAnswers', JSON.stringify(answers));
    } catch (err) {
      alert('回答を保存できませんでした。ブラウザの設定を確認してください。');
      return;
    }
    window.location.href = 'easyanswer.html';
  });
});

// Q1〜Q10 の回答を集める。 { q1: 'A', q2: 'D', ... }
function collectAnswers() {
  const answers = {};
  for (let i = 1; i <= 10; i++) {
    const checked = document.querySelector(`input[name="q${i}"]:checked`);
    if (!checked) {
      alert(`Q${i} に回答してください。`);
      return null;
    }
    answers['q' + i] = checked.value;
  }
  return answers;
}

// 結果ページから戻ってきたとき、前回の回答を選んだ状態に戻す
function restoreAnswers() {
  let saved = null;
  try {
    saved = JSON.parse(sessionStorage.getItem('easyAnswers') || 'null');
  } catch (e) {
    return;
  }
  if (!saved) return;

  Object.keys(saved).forEach((name) => {
    const radio = document.querySelector(`input[name="${name}"][value="${saved[name]}"]`);
    if (radio) radio.checked = true;
  });
}