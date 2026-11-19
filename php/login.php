<?php

ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

// セッションの Cookie 設定(JavaScriptから読めない・別サイトからの送信では送らない)
session_set_cookie_params([
    'lifetime' => 0,
    'path'     => '/',
    'secure'   => !empty($_SERVER['HTTPS']),   // https のときだけ secure を付ける
    'httponly' => true,
    'samesite' => 'Lax',
]);
session_start();

// 戻り先を安全な同一フォルダ内のHTMLパスに限定する
function resolve_login_redirect(?string $raw): string {
    if (!is_string($raw) || $raw === '') {
        return '../html/index.html';
    }
    if (preg_match('/^(?:[a-z][a-z0-9+.-]*:|\/\/|\\\\)/i', $raw) || preg_match('/[\r\n]/', $raw)) {
        return '../html/index.html';
    }
    $pathOnly = parse_url($raw, PHP_URL_PATH);
    if (!is_string($pathOnly) || !preg_match('/^[A-Za-z0-9_-]+\.html$/', $pathOnly)) {
        return '../html/index.html';
    }
    if ($pathOnly === 'login.html' || $pathOnly === 'register.html') {
        return '../html/index.html';
    }
    return '../html/' . $raw;
}

// ログイン画面へエラー付きで戻す
function redirect_error(string $message, ?string $rawRedirect = null): void {
    $query = 'error=' . urlencode($message);
    if (is_string($rawRedirect) && $rawRedirect !== '') {
        $query .= '&redirect=' . urlencode($rawRedirect);
    }
    header('Location: ../html/login.html?' . $query);
    exit;
}

// POST以外でアクセスされた場合はログイン画面へ戻す
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    header('Location: ../html/login.html');
    exit;
}

$rawRedirect = $_POST['redirect'] ?? null;

// ===== データベース接続設定 =====
$host   = "localhost";
$dbname = "shikodb";
$user   = "root";
$pass   = "password";   // ★register.php に書いたものと同じにする

try {
    $pdo = new PDO(
        "mysql:host=$host;dbname=$dbname;charset=utf8mb4",
        $user,
        $pass
    );
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
    $pdo->setAttribute(PDO::ATTR_EMULATE_PREPARES, false);
} catch (PDOException $e) {
    error_log('DB接続失敗: ' . $e->getMessage());
    die("接続失敗：" . $e->getMessage());
}

$email    = trim($_POST['email'] ?? '');
$password = $_POST['password'] ?? '';

// ===== 入力チェック =====
if ($email === '' || $password === '') {
    redirect_error('メールアドレスとパスワードを入力してください。', $rawRedirect);
}
if (strlen($email) > 255 || strlen($password) > 1024) {
    redirect_error('メールアドレスまたはパスワードが違います。', $rawRedirect);
}

try {
    $sql  = "SELECT user_id, user_name, password_hash FROM users WHERE email = :email";
    $stmt = $pdo->prepare($sql);
    $stmt->bindParam(':email', $email);
    $stmt->execute();

    $account = $stmt->fetch();

    if ($account) {
        $ok = password_verify($password, $account['password_hash']);
    } else {
        password_hash($password, PASSWORD_DEFAULT);
        $ok = false;
    }

    if (!$ok) {
        redirect_error('メールアドレスまたはパスワードが違います。', $rawRedirect);
    }

    if (password_needs_rehash($account['password_hash'], PASSWORD_DEFAULT)) {
        $upd = $pdo->prepare('UPDATE users SET password_hash = ? WHERE user_id = ?');
        $upd->execute([password_hash($password, PASSWORD_DEFAULT), $account['user_id']]);
    }

    // ログイン成功: セッションIDを新しくしてから、ユーザー情報を保存する
    session_regenerate_id(true);
    $_SESSION['user_id']   = (int)$account['user_id'];
    $_SESSION['user_name'] = $account['user_name'];

    $redirectTo = resolve_login_redirect($rawRedirect);
    header('Location: ' . $redirectTo);
    exit;

} catch (PDOException $e) {
    error_log('ログインエラー: ' . $e->getMessage());
    redirect_error('エラーが発生しました。しばらくしてからもう一度お試しください。', $rawRedirect);
}