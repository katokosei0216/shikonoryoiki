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

// ログイン画面へエラー付きで戻す
function redirect_error(string $message): void {
    header('Location: ../html/login.html?error=' . urlencode($message));
    exit;
}

// POST以外でアクセスされた場合はログイン画面へ戻す
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    header('Location: ../html/login.html');
    exit;
}

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
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);          // ★ATT_ → ATTR_ に修正
    $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
    $pdo->setAttribute(PDO::ATTR_EMULATE_PREPARES, false);
} catch (PDOException $e) {
    error_log('DB接続失敗: ' . $e->getMessage());
    die("接続失敗：" . $e->getMessage());   // 公開するときは、詳細を画面に出さない固定の文にする
}

$email    = trim($_POST['email'] ?? '');
$password = $_POST['password'] ?? '';

// ===== 入力チェック =====
if ($email === '' || $password === '') {
    redirect_error('メールアドレスとパスワードを入力してください。');
}
if (strlen($email) > 255 || strlen($password) > 1024) {
    redirect_error('メールアドレスまたはパスワードが違います。');
}

try {
    // ★テーブル名は login ではなく users
    $sql  = "SELECT user_id, user_name, password_hash FROM users WHERE email = :email";
    $stmt = $pdo->prepare($sql);
    $stmt->bindParam(':email', $email);
    $stmt->execute();

    // ★結果は $account に入れる($user はDB接続用のユーザー名なので上書きしない)
    $account = $stmt->fetch();

    if ($account) {
        $ok = password_verify($password, $account['password_hash']);
    } else {
        // ユーザーがいなくても同じ時間をかける(メールの登録有無を時間から推測されないため)
        password_hash($password, PASSWORD_DEFAULT);
        $ok = false;
    }

    if (!$ok) {
        // メールが違うのかパスワードが違うのかは、あえて教えない
        redirect_error('メールアドレスまたはパスワードが違います。');
    }

    // ハッシュの強度が古くなっていたら、ログインのついでに更新する
    if (password_needs_rehash($account['password_hash'], PASSWORD_DEFAULT)) {
        $upd = $pdo->prepare('UPDATE users SET password_hash = ? WHERE user_id = ?');
        $upd->execute([password_hash($password, PASSWORD_DEFAULT), $account['user_id']]);
    }

    // ログイン成功: セッションIDを新しくしてから、ユーザー情報を保存する
    session_regenerate_id(true);
    $_SESSION['user_id']   = (int)$account['user_id'];
    $_SESSION['user_name'] = $account['user_name'];   // ★$user_name['user_name'] → $account['user_name']

    header('Location: ../html/index.html');
    exit;

} catch (PDOException $e) {
    error_log('ログインエラー: ' . $e->getMessage());
    redirect_error('エラーが発生しました。しばらくしてからもう一度お試しください。');
}