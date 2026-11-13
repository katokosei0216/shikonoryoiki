<?php
// お気に入り登録・解除API
// GET  ?product_id=123  : 現在の登録状態・登録件数・CSRFトークン
// POST JSON: {csrf, product_id, action:"add"|"remove"}
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

session_start();

function send_json(int $status, array $data): void {
    http_response_code($status);
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

if (empty($_SESSION['user_id'])) {
    send_json(401, ['ok' => false, 'message' => 'ログインしてください。']);
}
$userId = (int)$_SESSION['user_id'];
if (empty($_SESSION['csrf'])) {
    $_SESSION['csrf'] = bin2hex(random_bytes(32));
}

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
if ($method !== 'GET' && $method !== 'POST') {
    header('Allow: GET, POST');
    send_json(405, ['ok' => false, 'message' => '許可されていないリクエストです。']);
}

if ($method === 'GET') {
    $input = $_GET;
} else {
    if (stripos($_SERVER['CONTENT_TYPE'] ?? '', 'application/json') !== 0) {
        send_json(415, ['ok' => false, 'message' => 'JSON形式で送信してください。']);
    }
    $input = json_decode(file_get_contents('php://input'), true);
    if (!is_array($input)) {
        send_json(400, ['ok' => false, 'message' => 'リクエストが正しくありません。']);
    }
    if (!hash_equals($_SESSION['csrf'], (string)($input['csrf'] ?? ''))) {
        send_json(403, ['ok' => false, 'message' => '認証情報が無効です。ページを再読み込みしてください。']);
    }
}

$productId = filter_var($input['product_id'] ?? null, FILTER_VALIDATE_INT, [
    'options' => ['min_range' => 1],
]);
if ($productId === false || $productId === null) {
    send_json(400, ['ok' => false, 'message' => '商品IDが正しくありません。']);
}
$action = $input['action'] ?? '';
if ($method === 'POST' && !in_array($action, ['add', 'remove'], true)) {
    send_json(400, ['ok' => false, 'message' => '操作が正しくありません。']);
}

// このプロジェクトの login.php / profile.php と同じDB設定
$host = 'localhost';
$dbname = 'shikodb';
$dbuser = 'root';
$dbpass = 'password';

try {
    $pdo = new PDO(
        "mysql:host=$host;dbname=$dbname;charset=utf8mb4",
        $dbuser, $dbpass,
        [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
        ]
    );

    $stmt = $pdo->prepare('SELECT 1 FROM products WHERE product_id = ?');
    $stmt->execute([$productId]);
    if (!$stmt->fetchColumn()) {
        send_json(404, ['ok' => false, 'message' => '商品が見つかりません。']);
    }

    if ($method === 'POST') {
        if ($action === 'add') {
            // favoritesの主キー(user_id,product_id)で同じ商品は重複登録されない
            $stmt = $pdo->prepare('INSERT IGNORE INTO favorites (user_id, product_id) VALUES (?, ?)');
            $stmt->execute([$userId, $productId]);
        } else {
            $stmt = $pdo->prepare('DELETE FROM favorites WHERE user_id = ? AND product_id = ?');
            $stmt->execute([$userId, $productId]);
        }
    }

    $stmt = $pdo->prepare('SELECT 1 FROM favorites WHERE user_id = ? AND product_id = ?');
    $stmt->execute([$userId, $productId]);
    $isFavorite = (bool)$stmt->fetchColumn();

    $stmt = $pdo->prepare('SELECT COUNT(*) FROM favorites WHERE product_id = ?');
    $stmt->execute([$productId]);
    $count = (int)$stmt->fetchColumn();

    send_json(200, [
        'ok' => true,
        'product_id' => (int)$productId,
        'is_favorite' => $isFavorite,
        'count' => $count,
        'csrf' => $_SESSION['csrf'],
        'message' => $method === 'POST'
            ? ($isFavorite ? 'お気に入りに登録しました。' : 'お気に入りを解除しました。')
            : '',
    ]);
} catch (PDOException $e) {
    error_log('favorites.php DB error: ' . $e->getMessage());
    send_json(500, ['ok' => false, 'message' => 'サーバーエラーが発生しました。']);
}
