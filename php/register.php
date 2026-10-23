<?php
// データベース接続設定
$host = 'localhost';
$db   = 'shikodb'; // データベース名
$user = 'root';       // データベースのユーザー名
$pass = 'password';   // データベースのパスワード
$charset = 'utf8mb4';

$dsn = "mysql:host=$host;dbname=$db;charset=$charset";
$options = [
    PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    PDO::ATTR_EMULATE_PREPARES   => false,
];

try {
    $pdo = new PDO($dsn, $user, $pass, $options);
} catch (\PDOException $e) {
    exit('データベース接続失敗: ' . $e->getMessage());
}

// POST以外でアクセスされた場合は登録画面へ戻す
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    header('Location: register.html');
    exit;
}

$user_name = trim($_POST['user_name'] ?? '');
$email = trim($_POST['email'] ?? '');
$password = $_POST['password'] ?? '';
$confirm_password = $_POST['confirm_password'] ?? '';

// バリデーション
if ($user_name === '' || $email === '' || $password === '' || $confirm_password === '') {
    header('Location: register.html?error=' . urlencode('すべての項目を入力してください。'));
    exit;
} elseif (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    header('Location: register.html?error=' . urlencode('有効なメールアドレスを入力してください。'));
    exit;
} elseif (mb_strlen($password) < 8) {
    header('Location: register.html?error=' . urlencode('パスワードは8文字以上で入力してください。'));
    exit;
} elseif ($password !== $confirm_password) {
    header('Location: register.html?error=' . urlencode('パスワードが一致しません。'));
    exit;
}

try {
    // メールアドレスの重複チェック
    $stmt = $pdo->prepare('SELECT user_id FROM users WHERE email = ?');
    $stmt->execute([$email]);
    if ($stmt->fetch()) {
        header('Location: register.html?error=' . urlencode('このメールアドレスは既に使用されています。'));
        exit;
    }

    // パスワードのハッシュ化
    $password_hash = password_hash($password, PASSWORD_DEFAULT);

    // データベースへ登録
    $stmt = $pdo->prepare('INSERT INTO users (user_name, email, password_hash) VALUES (?, ?, ?)');
    $stmt->execute([$user_name, $email, $password_hash]);

    // 登録成功時はログイン画面へリダイレクト
    header('Location: login.html');
    exit;

} catch (\PDOException $e) {
    header('Location: register.html?error=' . urlencode('データベースエラーが発生しました。'));
    exit;
}