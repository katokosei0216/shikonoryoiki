document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('loginForm');
  if (form) {
    form.addEventListener('submit', handleLoginSubmit);
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

// 送信前のチェック。問題がなければそのまま login.php に送信される
function handleLoginSubmit(e) {
  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;

  if (email === '' || password === '') {
    e.preventDefault();
    showError('メールアドレスとパスワードを入力してください。');
    return;
  }

  // 二重送信の防止
  const btn = e.target.querySelector('button[type="submit"]');
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'ログイン中…';
  }
}