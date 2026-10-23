console.log('register.js 読み込み完了');

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('registerForm');
  if (form) {
    form.addEventListener('submit', handleRegisterSubmit);
  }
});

// パスワードの伏字/表示切り替え関数
function togglePasswordVisibility(inputId, btn) {
  const input = document.getElementById(inputId);
  if (!input) return;

  if (input.type === 'password') {
    input.type = 'text';
    btn.textContent = '👁'; // 非表示アイコン
  } else {
    input.type = 'password';
    btn.textContent = '👁'; // 表示アイコン
  }
}

// 登録フォーム送信時の処理
function handleRegisterSubmit(e) {
  e.preventDefault();

  const password = document.getElementById('regPassword').value;
  const confirmPassword = document.getElementById('regConfirmPassword').value;

  // パスワードの一致確認
  if (password !== confirmPassword) {
    alert('パスワードが違います');
    return;
  }

  // 一致している場合の処理（会員登録成功のシミュレーション）
  alert('新規会員登録が完了しました！');
  // 必要に応じてログイン画面等へリダイレクト
  window.location.href = 'login.html';
}