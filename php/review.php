// php/review.php : 口コミ・評価(一覧 / 投稿・更新 / 削除)
//   GET  ?product_id=N
//        … その商品の口コミ一覧・平均・自分の口コミ・合言葉(csrf)
//   POST {"csrf":"...", "action":"save", "product_id":N, "rating":1〜5, "comment":"..."}
//        … 投稿。自分が既に書いている商品なら、その口コミを更新する(1人1商品につき1件)
//   POST {"csrf":"...", "action":"delete", "review_id":N}
//        … 自分の口コミを削除する(他の人の口コミは消せない)
<?php

ini_set('display_errors', 1);
error_reporting(E_ALL);

header('Content-Type: application/json; charset=utf-8');
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

// session.php を共通化
require_once __DIR__ . '/session.php';

// ===== データベース接続設定 =====
$host    = 'localhost';
$db      = 'shikodb';
$dbUser  = 'root';
$pass    = 'password';   // ★login.php と同じものにする
$charset = 'utf8mb4';

const MAX_COMMENT = 1000;   // コメントの最大文字数
const LIST_LIMIT  = 200;    // 一覧に出す最大件数

// JSONを返して終了する
function out(array $arr, int $code = 200): void {
    http_response_code($code);
    echo json_encode($arr, JSON_UNESCAPED_UNICODE);
    exit;
}

// ===== ログイン確認(ユーザーIDは必ずセッションから取る) =====
if (empty($_SESSION['user_id'])) {
    out(['ok' => false, 'message' => 'ログインしてください。'], 401);
}
$uid = (int)$_SESSION['user_id'];

// 更新リクエストの正当性を確認するための合言葉(マイページと共通)
if (empty($_SESSION['csrf'])) {
    $_SESSION['csrf'] = bin2hex(random_bytes(32));
}

try {
    $pdo = new PDO("mysql:host=$host;dbname=$db;charset=$charset", $dbUser, $pass, [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES   => false,
    ]);
} catch (PDOException $e) {
    error_log('DB接続失敗: ' . $e->getMessage());
    out(['ok' => false, 'message' => 'サーバーエラーが発生しました。'], 500);
}

// 商品が存在するか
function product_exists(PDO $pdo, int $pid): bool {
    $stmt = $pdo->prepare('SELECT 1 FROM products WHERE product_id = ?');
    $stmt->execute([$pid]);
    return (bool)$stmt->fetchColumn();
}

try {

    // ============================================================
    // GET: 口コミ一覧
    // ============================================================
    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        $pid = filter_var($_GET['product_id'] ?? '', FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
        if ($pid === false) {
            out(['ok' => false, 'message' => '商品が指定されていません。'], 400);
        }
        if (!product_exists($pdo, $pid)) {
            out(['ok' => false, 'message' => '商品が見つかりません。'], 404);
        }

        // 件数と平均
        $stmt = $pdo->prepare('SELECT COUNT(*) AS cnt, AVG(rating) AS avg_rating FROM reviews WHERE product_id = ?');
        $stmt->execute([$pid]);
        $sum = $stmt->fetch();

        // 口コミ一覧(新しい順)
        $stmt = $pdo->prepare('
            SELECT r.review_id, r.user_id, u.user_name, r.rating, r.comment, r.created_at
              FROM reviews r
              JOIN users u ON u.user_id = r.user_id
             WHERE r.product_id = ?
             ORDER BY r.created_at DESC, r.review_id DESC
             LIMIT ' . LIST_LIMIT
        );
        $stmt->execute([$pid]);
        $reviews = [];
        foreach ($stmt->fetchAll() as $row) {
            $reviews[] = [
                'review_id'  => (int)$row['review_id'],
                'user_name'  => $row['user_name'],
                'rating'     => (int)$row['rating'],
                'comment'    => $row['comment'],
                'created_at' => $row['created_at'],
                'is_mine'    => ((int)$row['user_id'] === $uid),   // 他のユーザーのIDは返さない
            ];
        }

        // 自分の口コミ(一覧の件数制限に関係なく、必ず取得する)
        $stmt = $pdo->prepare('
            SELECT review_id, rating, comment FROM reviews
             WHERE user_id = ? AND product_id = ?
             ORDER BY review_id DESC LIMIT 1
        ');
        $stmt->execute([$uid, $pid]);
        $mine = $stmt->fetch() ?: null;
        if ($mine) {
            $mine = ['review_id' => (int)$mine['review_id'], 'rating' => (int)$mine['rating'], 'comment' => $mine['comment']];
        }

        out([
            'ok'      => true,
            'csrf'    => $_SESSION['csrf'],
            'summary' => [
                'count'   => (int)$sum['cnt'],
                'average' => $sum['avg_rating'] === null ? null : round((float)$sum['avg_rating'], 1),
            ],
            'mine'    => $mine,
            'reviews' => $reviews,
        ]);
    }

    // ============================================================
    // POST: 投稿・更新 / 削除
    // ============================================================
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        out(['ok' => false, 'message' => '許可されていないリクエストです。'], 405);
    }

    // JSON以外は受け付けない(別サイトのフォームからの送信を防ぐ)
    if (stripos($_SERVER['CONTENT_TYPE'] ?? '', 'application/json') !== 0) {
        out(['ok' => false, 'message' => '不正なリクエストです。'], 415);
    }
    $data = json_decode(file_get_contents('php://input'), true);
    if (!is_array($data)) {
        out(['ok' => false, 'message' => '不正なリクエストです。'], 400);
    }

    // 合言葉の確認
    if (!hash_equals($_SESSION['csrf'], (string)($data['csrf'] ?? ''))) {
        out(['ok' => false, 'message' => '不正なリクエストです。ページを再読み込みしてください。'], 403);
    }

    $action = $data['action'] ?? '';

    // ---------- 投稿・更新 ----------
    if ($action === 'save') {
        $pid    = filter_var($data['product_id'] ?? null, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
        $rating = filter_var($data['rating'] ?? null, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1, 'max_range' => 5]]);
        $comment = $data['comment'] ?? '';

        if ($pid === false) {
            out(['ok' => false, 'message' => '商品が指定されていません。'], 400);
        }
        if ($rating === false) {
            out(['ok' => false, 'message' => '星の数は1〜5で選んでください。'], 400);
        }
        if (!is_string($comment)) {
            out(['ok' => false, 'message' => 'コメントが正しくありません。'], 400);
        }
        $comment = trim($comment);
        if (mb_strlen($comment) > MAX_COMMENT) {
            out(['ok' => false, 'message' => 'コメントは' . MAX_COMMENT . '文字以内で入力してください。'], 400);
        }
        if (!product_exists($pdo, $pid)) {
            out(['ok' => false, 'message' => '商品が見つかりません。'], 404);
        }
        $commentValue = ($comment === '') ? null : $comment;

        // 自分がこの商品に書いた口コミがあるか
        $stmt = $pdo->prepare('SELECT review_id FROM reviews WHERE user_id = ? AND product_id = ? ORDER BY review_id DESC LIMIT 1');
        $stmt->execute([$uid, $pid]);
        $existingId = $stmt->fetchColumn();

        if ($existingId !== false) {
            $stmt = $pdo->prepare('UPDATE reviews SET rating = ?, comment = ? WHERE review_id = ? AND user_id = ?');
            $stmt->execute([$rating, $commentValue, $existingId, $uid]);
            out(['ok' => true, 'message' => '口コミを更新しました。', 'review_id' => (int)$existingId]);
        }

        $stmt = $pdo->prepare('INSERT INTO reviews (user_id, product_id, rating, comment) VALUES (?, ?, ?, ?)');
        $stmt->execute([$uid, $pid, $rating, $commentValue]);
        out(['ok' => true, 'message' => '口コミを投稿しました。', 'review_id' => (int)$pdo->lastInsertId()]);
    }

    // ---------- 削除 ----------
    if ($action === 'delete') {
        $rid = filter_var($data['review_id'] ?? null, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
        if ($rid === false) {
            out(['ok' => false, 'message' => '口コミが指定されていません。'], 400);
        }

        // ★自分の口コミだけを消す(user_id を条件に入れているので、他の人の口コミは消せない)
        $stmt = $pdo->prepare('DELETE FROM reviews WHERE review_id = ? AND user_id = ?');
        $stmt->execute([$rid, $uid]);
        if ($stmt->rowCount() === 0) {
            out(['ok' => false, 'message' => '口コミが見つかりません。'], 404);
        }
        out(['ok' => true, 'message' => '口コミを削除しました。']);
    }

    out(['ok' => false, 'message' => '不正なリクエストです。'], 400);

} catch (PDOException $e) {
    // 同時に投稿されて、1人1商品1件の制限(UNIQUE)に当たった場合
    if ($e->getCode() === '23000') {
        out(['ok' => false, 'message' => '既に投稿済みです。ページを再読み込みしてください。'], 409);
    }
    error_log('review.php エラー: ' . $e->getMessage());
    out(['ok' => false, 'message' => 'サーバーエラーが発生しました。'], 500);
}