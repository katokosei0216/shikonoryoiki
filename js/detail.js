document.addEventListener('DOMContentLoaded', () => {
  // 星評価付けインタラクション
  const stars = document.querySelectorAll('.star-rating-select .star');
  stars.forEach((star, index) => {
    star.addEventListener('click', () => {
      stars.forEach((s, idx) => {
        if (idx <= index) s.classList.add('active');
        else s.classList.remove('active');
      });
    });
  });
});

// 未ログイン状態でお気に入り登録ボタンを押した場合のポップアップ判定
function toggleFavorite() {
  if (!isLoggedIn) {
    openModal('loginPromptModal');
  } else {
    alert('お気に入りに登録しました。');
  }
}