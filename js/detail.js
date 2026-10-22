document.addEventListener('DOMContentLoaded', () => {
  // 星評価付けインタラクション
  const stars = document.querySelectorAll('.star-rating-select .star');
  
  stars.forEach((star, index) => {
    star.addEventListener('click', () => {
      // 既にクリックされた星（自分自身）が、現在 active かどうかをチェック
      const isActive = star.classList.contains('active');
      const isLastActive = isActive && (index === stars.length - 1 || !stars[index + 1].classList.contains('active'));

      if (isLastActive) {
        // 【2回目のクリック】すでに選択されている最後の星をもう一度押した場合：すべて未選択にする
        stars.forEach(s => s.classList.remove('active'));
      } else {
        // 【1回目のクリック、または別の星への変更】
        stars.forEach((s, idx) => {
          if (idx <= index) {
            s.classList.add('active');
          } else {
            s.classList.remove('active');
          }
        });
      }
    });
  });

  // コメント欄をクリック/入力しようとした際のログイン制限処理
  const commentTextarea = document.querySelector('textarea.form-control');
  if (commentTextarea) {
    commentTextarea.addEventListener('focus', (e) => {
      commentTextarea.blur(); // キーボードや入力を防ぐためフォーカスを外す
      
      const loginPromptText = document.getElementById('loginPromptText');
      if (loginPromptText) {
        loginPromptText.textContent = '口コミを投稿するにはログインが必要です。';
      }
      openModal('loginPromptModal');
    });
  }
});

// 未ログイン状態でお気に入り登録ボタンを押した場合のポップアップ判定
function toggleFavorite() {
  if (typeof isLoggedIn !== 'undefined' && !isLoggedIn) {
    openModal('loginPromptModal');
  } else {
    openModal('loginPromptModal');
  }
}
