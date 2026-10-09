document.addEventListener('DOMContentLoaded', () => {
  // カテゴリ別フィルターボタンの複数選択 & オレンジ枠（.active）切り替え
  const catBtns = document.querySelectorAll('.cat-btn');
  catBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      btn.classList.toggle('active');
    });
  });
});