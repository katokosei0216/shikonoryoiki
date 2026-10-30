<?php
declare(strict_types=1);
header('Content-Type: application/json; charset=UTF-8');

// ---- DB接続設定（search.php と同じ値）----
const DB_DSN  = 'mysql:host=localhost;dbname=shikodb;charset=utf8mb4';
const DB_USER = 'root';
const DB_PASS = 'password';

// 開発中のみ true。公開前に false へ
const DEBUG = true;

function fail(int $code, string $msg): never {
    http_response_code($code);
    echo json_encode(['error' => $msg], JSON_UNESCAPED_UNICODE);
    exit;
}

$id = $_GET['id'] ?? '';
if (!is_string($id) || !ctype_digit($id)) fail(400, 'invalid id');
$id = (int)$id;

try {
    $pdo = new PDO(DB_DSN, DB_USER, DB_PASS, [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES   => false,
    ]);

    // ---- 商品本体 ----
    $stmt = $pdo->prepare(
        'SELECT p.*, cat.category_code, c.country_name, m.maker_name
         FROM products p
         JOIN categories cat ON cat.category_id = p.category_id
         LEFT JOIN countries c ON c.country_id = p.country_id
         LEFT JOIN makers m ON m.maker_id = p.maker_id
         WHERE p.product_id = ?'
    );
    $stmt->execute([$id]);
    $product = $stmt->fetch();
    if (!$product) fail(404, 'not found');

    // ---- カテゴリ固有情報 ----
    $details = [];
    switch ($product['category_code']) {
        case 'whisky':
            $stmt = $pdo->prepare('SELECT is_smoky, is_grain, is_malt, is_blended FROM whisky_details WHERE product_id = ?');
            break;
        case 'sake':
            $stmt = $pdo->prepare('SELECT prefecture, is_easy_to_drink, is_dry, is_sweet FROM sake_details WHERE product_id = ?');
            break;
        case 'wine':
            $stmt = $pdo->prepare('SELECT wine_type, grape FROM wine_details WHERE product_id = ?');
            break;
        case 'cocktail':
            $stmt = $pdo->prepare(
                'SELECT cd.method, cd.is_smoke, cd.glass_size, f.fruit_name, bl.base_liquor_name
                 FROM cocktail_details cd
                 LEFT JOIN fruits f ON f.fruit_id = cd.fruit_id
                 LEFT JOIN base_liquors bl ON bl.base_liquor_id = cd.base_liquor_id
                 WHERE cd.product_id = ?'
            );
            break;
        default:
            $stmt = null;
    }
    if ($stmt) {
        $stmt->execute([$id]);
        $details = $stmt->fetch() ?: [];
    }

    // ---- タグ ----
    $stmt = $pdo->prepare(
        'SELECT t.tag_name FROM product_tags pt
         JOIN tags t ON t.tag_id = pt.tag_id
         WHERE pt.product_id = ? ORDER BY t.tag_id'
    );
    $stmt->execute([$id]);
    $tags = $stmt->fetchAll(PDO::FETCH_COLUMN);

    // ---- おすすめの飲み方 ----
    $stmt = $pdo->prepare(
        'SELECT ds.style_name FROM product_drink_styles pds
         JOIN drink_styles ds ON ds.drink_style_id = pds.drink_style_id
         WHERE pds.product_id = ? ORDER BY ds.drink_style_id'
    );
    $stmt->execute([$id]);
    $styles = $stmt->fetchAll(PDO::FETCH_COLUMN);

    echo json_encode([
        'product'      => $product,
        'details'      => $details,
        'tags'         => $tags,
        'drink_styles' => $styles,
    ], JSON_UNESCAPED_UNICODE);

} catch (PDOException $e) {
    error_log($e->getMessage());
    fail(500, DEBUG ? 'DB error: ' . $e->getMessage() : 'server error');
}