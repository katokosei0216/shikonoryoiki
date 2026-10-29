<?php

ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

// ===== データベース接続設定 =====
$host    = 'localhost';
$db      = 'shikodb';
$user    = 'root';
$pass    = 'password';
$charset = 'utf8mb4';

$dsn = "mysql:host=$host;dbname=$db;charset=$charset";
$options = [
    PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    PDO::ATTR_EMULATE_PREPARES   => false,
];

// 登録画面へエラー付きで戻す（このPHPは php/ フォルダ、HTMLは html/ フォルダにある）
function redirect_error(string $message): void {
    header('Location: ../html/register.html?error=' . urlencode($message));
    exit;
}

try {
    $pdo = new PDO($dsn, $user, $pass, $options);
} catch (PDOException $e) {
    // 開発中は画面にも原因を出す。公開時は下の exit のメッセージを固定文にすること
    error_log('DB接続失敗: ' . $e->getMessage());
    exit('データベース接続失敗: ' . $e->getMessage());
}

// POST以外でアクセスされた場合は登録画面へ戻す
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    header('Location: ../html/register.html');
    exit;
}

$user_name        = trim($_POST['user_name'] ?? '');
$email            = trim($_POST['email'] ?? '');
$password         = $_POST['password'] ?? '';
$confirm_password = $_POST['confirm_password'] ?? '';

// ===== バリデーション =====
if ($user_name === '' || $email === '' || $password === '' || $confirm_password === '') {
    redirect_error('すべての項目を入力してください。');
}
if (mb_strlen($user_name) > 50) {
    redirect_error('ユーザー名は50文字以内で入力してください。');
}
if (!filter_var($email, FILTER_VALIDATE_EMAIL) || strlen($email) > 255) {
    redirect_error('有効なメールアドレスを入力してください。');
}
if (mb_strlen($password) < 8) {
    redirect_error('パスワードは8文字以上で入力してください。');
}
if (strlen($password) > 72) {   // bcrypt は72バイトまで
    redirect_error('パスワードは72バイト以内（半角で72文字程度）で入力してください。');
}
if ($password !== $confirm_password) {
    redirect_error('パスワードが一致しません。');
}

try {
    // メールアドレスの重複チェック（★ users ではなく user_id を取得する）
    $stmt = $pdo->prepare('SELECT user_id FROM users WHERE email = ?');
    $stmt->execute([$email]);
    if ($stmt->fetch()) {
        redirect_error('このメールアドレスは既に使用されています。');
    }

    // パスワードのハッシュ化
    $password_hash = password_hash($password, PASSWORD_DEFAULT);

    // データベースへ登録
    $stmt = $pdo->prepare('INSERT INTO users (user_name, email, password_hash) VALUES (?, ?, ?)');
    $stmt->execute([$user_name, $email, $password_hash]);

    // 登録成功時はログイン画面へ
    header('Location: ../html/login.html');
    exit;

} catch (PDOException $e) {
    // 同時登録などでメールが重複した場合（UNIQUE制約違反）
    if ($e->getCode() === '23000') {
        redirect_error('このメールアドレスは既に使用されています。');
    }
    error_log('会員登録エラー: ' . $e->getMessage());
    redirect_error('データベースエラーが発生しました。');
}