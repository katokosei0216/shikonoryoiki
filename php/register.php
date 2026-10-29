<?php
<<<<<<< Updated upstream

ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);
=======
session_start();
header('Content-Type: application/json; charset=utf-8');
>>>>>>> Stashed changes

// ===== データベース接続設定 =====
$host    = 'localhost';
$db      = 'shikodb';
$dbUser  = 'root';
$pass    = 'password';
$charset = 'utf8mb4';

$dsn = "mysql:host=$host;dbname=$db;charset=$charset";
$options = [
    PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    PDO::ATTR_EMULATE_PREPARES   => false,
];

// JSONを返して終了する
function out(array $arr, int $code = 200): void {
    http_response_code($code);
    echo json_encode($arr, JSON_UNESCAPED_UNICODE);
    exit;
}

try {
    $pdo = new PDO($dsn, $dbUser, $pass, $options);
} catch (PDOException $e) {
    error_log('DB接続失敗: ' . $e->getMessage());
    out(['ok' => false, 'message' => 'データベース接続に失敗しました。'], 500);
}

// ===== ログイン確認 =====
if (empty($_SESSION['user_id'])) {
    out(['ok' => false, 'message' => 'ログインしてください。'], 401);
}
$uid = $_SESSION['user_id'];

// CSRFトークン
if (empty($_SESSION['csrf'])) {
    $_SESSION['csrf'] = bin2hex(random_bytes(32));
}

try {

    // ============================================================
    // POST: プロフィール保存
    // ============================================================
    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        $data = json_decode(file_get_contents('php://input'), true) ?? [];

        if (!hash_equals($_SESSION['csrf'], $data['csrf'] ?? '')) {
            out(['ok' => false, 'message' => '不正なリクエストです。'], 400);
        }

        $name    = trim($data['name'] ?? '');
        $email   = trim($data['email'] ?? '');
        $newPass = $data['newPassword'] ?? '';
        $current = $data['currentPassword'] ?? '';

        // ----- バリデーション -----
        if ($name === '' || $email === '') {
            out(['ok' => false, 'message' => 'ユーザー名とメールアドレスを入力してください。']);
        }
        if (mb_strlen($name) > 50) {
            out(['ok' => false, 'message' => 'ユーザー名は50文字以内で入力してください。']);
        }
        if (!filter_var($email, FILTER_VALIDATE_EMAIL) || strlen($email) > 255) {
            out(['ok' => false, 'message' => '有効なメールアドレスを入力してください。']);
        }
        if ($newPass !== '' && (mb_strlen($newPass) < 8 || strlen($newPass) > 72)) {
            out(['ok' => false, 'message' => 'パスワードは8文字以上72バイト以内で入力してください。']);
        }

        // 現在の登録内容を取得
        $stmt = $pdo->prepare('SELECT email, password_hash FROM users WHERE user_id = ?');
        $stmt->execute([$uid]);
        $cur = $stmt->fetch();
        if (!$cur) {
            out(['ok' => false, 'message' => 'ユーザーが見つかりません。'], 404);
        }

        $emailChanged = ($email !== $cur['email']);
        $passChanged  = ($newPass !== '');

        // メールまたはパスワードを変更する場合は、現在のパスワードを確認
        if ($emailChanged || $passChanged) {
            if ($current === '' || !password_verify($current, $cur['password_hash'])) {
                out(['ok' => false, 'message' => '現在のパスワードが正しくありません。']);
            }
        }

        // メールアドレスの重複チェック(自分以外)
        if ($emailChanged) {
            $stmt = $pdo->prepare('SELECT user_id FROM users WHERE email = ? AND user_id <> ?');
            $stmt->execute([$email, $uid]);
            if ($stmt->fetch()) {
                out(['ok' => false, 'message' => 'このメールアドレスは既に使用されています。']);
            }
        }

        // 更新
        if ($passChanged) {
            $stmt = $pdo->prepare(
                'UPDATE users SET user_name = ?, email = ?, password_hash = ? WHERE user_id = ?'
            );
            $stmt->execute([$name, $email, password_hash($newPass, PASSWORD_DEFAULT), $uid]);
        } else {
            $stmt = $pdo->prepare(
                'UPDATE users SET user_name = ?, email = ? WHERE user_id = ?'
            );
            $stmt->execute([$name, $email, $uid]);
        }

        out(['ok' => true, 'message' => '変更を保存しました。']);
    }

    // ============================================================
    // GET: マイページ表示用データ
    // ============================================================

    // ユーザー情報
    $stmt = $pdo->prepare('SELECT user_name, email FROM users WHERE user_id = ?');
    $stmt->execute([$uid]);
    $me = $stmt->fetch();
    if (!$me) {
        out(['ok' => false, 'message' => 'ユーザーが見つかりません。'], 404);
    }

    // カテゴリ(絞り込みボタン用)
    $categories = $pdo->query(
        'SELECT category_code, category_name FROM categories ORDER BY sort_order'
    )->fetchAll();

    // お気に入り
    $stmt = $pdo->prepare('
        SELECT p.product_id, p.product_name, p.image_path,
               c.category_code, c.category_name
        FROM favorites f
        JOIN products p   ON p.product_id = f.product_id
        JOIN categories c ON c.category_id = p.category_id
        WHERE f.user_id = ?
        ORDER BY f.created_at DESC
    ');
    $stmt->execute([$uid]);
    $favorites = $stmt->fetchAll();

    // 自分が書いた口コミ
    $stmt = $pdo->prepare('
        SELECT r.rating, r.comment, r.created_at,
               p.product_id, p.product_name
        FROM reviews r
        JOIN products p ON p.product_id = r.product_id
        WHERE r.user_id = ?
        ORDER BY r.created_at DESC
    ');
    $stmt->execute([$uid]);
    $reviews = $stmt->fetchAll();

    out([
        'ok'         => true,
        'csrf'       => $_SESSION['csrf'],
        'user'       => $me,
        'categories' => $categories,
        'favorites'  => $favorites,
        'reviews'    => $reviews,
    ]);

} catch (PDOException $e) {
    error_log('プロフィール処理エラー: ' . $e->getMessage());
    out(['ok' => false, 'message' => 'データベースエラーが発生しました。'], 500);
}