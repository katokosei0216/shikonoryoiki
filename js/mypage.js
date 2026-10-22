document.addEventListener('DOMContentLoaded', () => {
  // カテゴリ別フィルターボタンの複数選択 & オレンジ枠（.active）切り替え
  const catBtns = document.querySelectorAll('.cat-btn');
  catBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      btn.classList.toggle('active');
    });
  });
});
// 初期登録データ（シミュレーション用）
let initialData = {
  email: "user@example.com",
  currentPassword: "password123" // デフォルトの既存パスワード例
};

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('profileForm');
  if (form) {
    form.addEventListener('submit', handleProfileSubmit);
  }
});

// パスワードの伏字/表示切り替え関数
function togglePasswordVisibility(inputId, btn) {
  const input = document.getElementById(inputId);
  if (!input) return;

  if (input.type === 'password') {
    input.type = 'text';
    btn.textContent = '👁'; // 非表示アイコンに切り替え
  } else {
    input.type = 'password';
    btn.textContent = '👁'; // 表示アイコンに切り替え
  }
}

// モーダルの開閉関数
function openModal(id) {
  const modal = document.getElementById(id);
  if (modal) modal.style.display = 'flex';
}

function closeModal(id) {
  const modal = document.getElementById(id);
  if (modal) modal.style.display = 'none';
}

// 保存ボタン押下時の処理
function handleProfileSubmit(e) {
  e.preventDefault();

  const emailVal = document.getElementById('emailInput').value.trim();
  const newPassVal = document.getElementById('newPasswordInput').value;
  const confirmPassVal = document.getElementById('confirmPasswordInput').value;

  // 1. 新しいパスワードが入力されている場合、一致チェック
  if (newPassVal !== '') {
    if (newPassVal !== confirmPassVal) {
      alert('パスワードが違います'); // 不一致時のエラー表示
      return;
    }
  }

  // 2. メールアドレス または パスワードの変更があるか判定
  const isEmailChanged = (emailVal !== initialData.email);
  const isPasswordChanged = (newPassVal !== '');

  if (isEmailChanged || isPasswordChanged) {
    // 既存パスワード入力ポップアップ（モーダル）を開く
    document.getElementById('currentPasswordInput').value = '';
    openModal('currentPasswordModal');
  } else {
    // ユーザー名等、重要な情報以外のみ変更された場合
    alert('変更を保存しました。');
  }
}

// 既存パスワード確認モーダルの「確認して保存」ボタン押下時
function verifyAndSubmit() {
  const currentPassVal = document.getElementById('currentPasswordInput').value;

  if (!currentPassVal) {
    alert('現在のパスワードを入力してください。');
    return;
  }

  // 既存パスワードの正誤判定（※ここでは initialData.currentPassword と照合）
  if (currentPassVal === initialData.currentPassword) {
    // 成功時：初期データを更新
    const newPassVal = document.getElementById('newPasswordInput').value;
    const emailVal = document.getElementById('emailInput').value.trim();

    initialData.email = emailVal;
    if (newPassVal) {
      initialData.currentPassword = newPassVal;
    }

    closeModal('currentPasswordModal');
    
    // 入力欄をクリーンアップ
    document.getElementById('newPasswordInput').value = '';
    document.getElementById('confirmPasswordInput').value = '';

    alert('変更を保存しました。');
  } else {
    alert('現在のパスワードが正しくありません。');
  }
}