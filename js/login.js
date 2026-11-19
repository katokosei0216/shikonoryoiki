function sanitizeRedirect(val) {
  if (typeof val !== 'string' || !val) return 'index.html';
  if (/^(?:[a-z][a-z0-9+.-]*:|\/\/|\\)/i.test(val) || /[\r\n]/.test(val)) {
    return 'index.html';
  }
  const cleanPath = val.split(/[?#]/)[0];
  if (!/^[A-Za-z0-9_-]+\.html$/.test(cleanPath)) {
    return 'index.html';
  }
  if (cleanPath === 'login.html' || cleanPath === 'register.html') {
    return 'index.html';
  }
  return val;
}

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('loginForm');
  if (form) {
    form.addEventListener('submit', handleLoginSubmit);
  }

  const params = new URLSearchParams(window.location.search);
  const rawRedirect = params.get('redirect') || '';
  const safeRedirect = sanitizeRedirect(rawRedirect);

  const redirectInput = document.getElementById('loginRedirect');
  if (redirectInput) {
    redirectInput.value = safeRedirect;
  }

  const registerLink = document.getElementById('registerLink') || document.querySelector('a[href="register.html"]');
  if (registerLink && safeRedirect !== 'index.html') {
    registerLink.href = 'register.html?redirect=' + encodeURIComponent(safeRedirect);
  }

  // PHP からリダイレクトで渡されたエラーメッセージを表示する
  const errorMsg = params.get('error');
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
    btn.textContent = '👁'; // 表示中 → 隠すボタン
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