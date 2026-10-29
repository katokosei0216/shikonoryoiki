<?php
// php/auth.php : ログイン状態の確認(GET)とログアウト(POST)
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

session_start();

// ログアウト
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    // JSON以外は受け付けない(別サイトからの勝手なログアウトを防ぐ)
    if (stripos($_SERVER['CONTENT_TYPE'] ?? '', 'application/json') !== 0) {
        http_response_code(415);
        echo json_encode(['ok' => false]);
        exit;
    }

    $_SESSION = [];
    if (ini_get('session.use_cookies')) {
        $p = session_get_cookie_params();
        setcookie(session_name(), '', time() - 42000, $p['path'], $p['domain'], $p['secure'], $p['httponly']);
    }
    session_destroy();

    echo json_encode(['ok' => true]);
    exit;
}

// ログイン状態の確認
echo json_encode([
    'loggedIn'  => !empty($_SESSION['user_id']),
    'user_name' => $_SESSION['user_name'] ?? '',
], JSON_UNESCAPED_UNICODE);