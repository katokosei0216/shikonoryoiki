<?php
// php/profile.php : マイページ用API
//   GET  … ログイン中のユーザー「自身」の情報・お気に入り・コメント履歴をJSONで返す
//   POST … ユーザー名 / メールアドレス / パスワードの更新
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

session_start();

function respond(int $status, array $body): void {
    http_response_code($status);
    echo json_encode($body, JSON_UNESCAPED_UNICODE);
    exit;
}

// ===== ログイン確認 =====
// ユーザーIDは必ずセッションから取る(画面から送られた値は使わない)
if (empty($_SESSION['user_id'])) {
    respond(401, ['ok' => false, 'message' => 'ログインしてください。']);
}
$userId = (int)$_SESSION['user_id'];

// 更新リクエストの正当性を確認するための合言葉(CSRF対策)
if (empty($_SESSION['csrf'])) {
    $_SESSION['csrf'] = bin2hex(random_bytes(32));
}

// ===== データベース接続設定 =====
$host   = 'localhost';
$dbname = 'shikodb';
$dbuser = 'root';
$dbpass = 'password';   // ★login.php と同じものにする

try {
    $pdo = new PDO("mysql:host=$host;dbname=$dbname;charset=utf8mb4", $dbuser, $dbpass, [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES   => false,
    ]);
} catch (PDOException $e) {
    error_log('DB接続失敗: ' . $e->getMessage());
    respond(500, ['ok' => false, 'message' => 'サーバーエラーが発生しました。']);
}

try {
    // ログイン中のユーザー本人の行を取得
    $stmt = $pdo->prepare('SELECT user_id, user_name, email, password_hash FROM users WHERE user_id = ?');
    $stmt->execute([$userId]);
    $account = $stmt->fetch();

    if (!$account) {
        // セッションは残っているのにユーザーが存在しない(削除された等)
        $_SESSION = [];
        session_destroy();
        respond(401, ['ok' => false, 'message' => 'ログインしてください。']);
    }

    // ==================== GET: マイページのデータ取得 ====================
    if ($_SERVER['REQUEST_METHOD'] === 'GET') {

        // お気に入り(自分の分だけ)
        $stmt = $pdo->prepare(
            'SELECT p.product_id, p.product_name, c.category_code, c.category_name
               FROM favorites f
               JOIN products   p ON p.product_id  = f.product_id
               JOIN categories c ON c.category_id = p.category_id
              WHERE f.user_id = ?
              ORDER BY f.created_at DESC
              LIMIT 500'
        );
        $stmt->execute([$userId]);
        $favorites = $stmt->fetchAll();

        // 投稿コメント(自分の分だけ)
        $stmt = $pdo->prepare(
            'SELECT r.review_id, p.product_id, p.product_name, c.category_code, c.category_name,
                    r.rating, r.comment, r.created_at
               FROM reviews r
               JOIN products   p ON p.product_id  = r.product_id
               JOIN categories c ON c.category_id = p.category_id
              WHERE r.user_id = ?
              ORDER BY r.created_at DESC, r.review_id DESC
              LIMIT 500'
        );
        $stmt->execute([$userId]);
        $reviews = $stmt->fetchAll();

        respond(200, [
            'ok'        => true,
            'csrf'      => $_SESSION['csrf'],
            'user'      => ['user_name' => $account['user_name'], 'email' => $account['email']],
            'favorites' => $favorites,
            'reviews'   => $reviews,
        ]);
    }

    // ==================== POST: 会員情報の更新 ====================
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        respond(405, ['ok' => false, 'message' => '許可されていないリクエストです。']);
    }

    // JSON以外は受け付けない(別サイトのフォームからの送信を防ぐ)
    if (stripos($_SERVER['CONTENT_TYPE'] ?? '', 'application/json') !== 0) {
        respond(415, ['ok' => false, 'message' => '不正なリクエストです。']);
    }
    $input = json_decode(file_get_contents('php://input'), true);
    if (!is_array($input)) {
        respond(400, ['ok' => false, 'message' => '不正なリクエストです。']);
    }

    // 合言葉の確認
    if (!hash_equals($_SESSION['csrf'], (string)($input['csrf'] ?? ''))) {
        respond(403, ['ok' => false, 'message' => '不正なリクエストです。ページを再読み込みしてください。']);
    }

    $name            = trim((string)($input['name'] ?? ''));
    $email           = trim((string)($input['email'] ?? ''));
    $newPassword     = (string)($input['newPassword'] ?? '');
    $currentPassword = (string)($input['currentPassword'] ?? '');

    // ----- 入力チェック -----
    if ($name === '' || mb_strlen($name) > 50) {
        respond(400, ['ok' => false, 'message' => 'ユーザー名は1〜50文字で入力してください。']);
    }
    if (!filter_var($email, FILTER_VALIDATE_EMAIL) || strlen($email) > 255) {
        respond(400, ['ok' => false, 'message' => '有効なメールアドレスを入力してください。']);
    }
    if ($newPassword !== '') {
        if (mb_strlen($newPassword) < 8) {
            respond(400, ['ok' => false, 'message' => 'パスワードは8文字以上で入力してください。']);
        }
        if (strlen($newPassword) > 72) {   // bcrypt は72バイトまで
            respond(400, ['ok' => false, 'message' => 'パスワードは72バイト以内(半角で72文字程度)で入力してください。']);
        }
    }

    $emailChanged    = (mb_strtolower($email) !== mb_strtolower($account['email']));
    $passwordChanged = ($newPassword !== '');

    // ----- メール・パスワードを変えるときは、現在のパスワードで本人確認 -----
    if ($emailChanged || $passwordChanged) {
        if ($currentPassword === '') {
            respond(400, ['ok' => false, 'message' => '現在のパスワードを入力してください。']);
        }
        if (strlen($currentPassword) > 1024 || !password_verify($currentPassword, $account['password_hash'])) {
            respond(403, ['ok' => false, 'message' => '現在のパスワードが正しくありません。']);
        }
    }

    // ----- 他のユーザーが使っているメールアドレスではないか -----
    if ($emailChanged) {
        $stmt = $pdo->prepare('SELECT user_id FROM users WHERE email = ? AND user_id <> ?');
        $stmt->execute([$email, $userId]);
        if ($stmt->fetch()) {
            respond(409, ['ok' => false, 'message' => 'このメールアドレスは既に使用されています。']);
        }
    }

    // ----- 更新(自分の行だけ) -----
    if ($passwordChanged) {
        $stmt = $pdo->prepare('UPDATE users SET user_name = ?, email = ?, password_hash = ? WHERE user_id = ?');
        $stmt->execute([$name, $email, password_hash($newPassword, PASSWORD_DEFAULT), $userId]);
        session_regenerate_id(true);   // パスワードを変えたので、セッションIDを新しくする
    } else {
        $stmt = $pdo->prepare('UPDATE users SET user_name = ?, email = ? WHERE user_id = ?');
        $stmt->execute([$name, $email, $userId]);
    }

    $_SESSION['user_name'] = $name;

    respond(200, ['ok' => true, 'message' => '変更を保存しました。']);

} catch (PDOException $e) {
    // 同時に登録されるなどで、メールの重複(UNIQUE制約違反)になった場合
    if ($e->getCode() === '23000') {
        respond(409, ['ok' => false, 'message' => 'このメールアドレスは既に使用されています。']);
    }
    error_log('profile.php エラー: ' . $e->getMessage());
    respond(500, ['ok' => false, 'message' => 'サーバーエラーが発生しました。']);
}