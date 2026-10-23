document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('registerForm');
  if (form) {
    form.addEventListener('submit', handleRegisterSubmit);
  }

  // PHP からリダイレクトで渡されたエラーメッセージを表示する
  const errorMsg = new URLSearchParams(window.location.search).get('error');
  if (errorMsg) {
    showError(errorMsg);
  }
});

// エラーメッセージを表示する
function showError(message) {
  const errP = document.getElementById('errorMessage');
  if (!errP) return;
  errP.textContent = message;   // textContent なのでHTMLとして解釈されない
  errP.style.display = 'block';
}

// パスワードの伏字/表示切り替え
function togglePasswordVisibility(inputId, btn) {
  const input = document.getElementById(inputId);
  if (!input) return;

  if (input.type === 'password') {
    input.type = 'text';
    btn.textContent = '🙈'; // 表示中 → 隠すボタン
  } else {
    input.type = 'password';
    btn.textContent = '👁'; // 非表示中 → 表示するボタン
  }
}

// 送信前のチェック。問題がなければ何もせず、そのまま register.php に送信される
function handleRegisterSubmit(e) {
  const password = document.getElementById('regPassword').value;
  const confirmPassword = document.getElementById('regConfirmPassword').value;

  if (password.length < 8) {
    e.preventDefault();
    showError('パスワードは8文字以上で入力してください。');
    return;
  }

  if (password !== confirmPassword) {
    e.preventDefault();
    showError('パスワードが一致しません。');
    return;
  }
}