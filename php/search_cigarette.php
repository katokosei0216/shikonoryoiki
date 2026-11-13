<?php
declare(strict_types=1);
header('Content-Type: application/json; charset=UTF-8');

// ---- DB接続設定（search.php と同じ値にする）----
const DB_DSN  = 'mysql:host=localhost;dbname=shikodb;charset=utf8mb4';
const DB_USER = 'root';
const DB_PASS = 'password';

// 開発中のみ true。500エラー時に原因(DBのエラーメッセージ)をJSONに含める。公開前に false へ
const DEBUG = true;

const PER_PAGE = 20;
const CATEGORY_CODE = 'cigarette';

// ---- 入力ヘルパー ----
function in_str(string $key): string {
    $v = $_GET[$key] ?? '';
    return is_string($v) ? trim($v) : '';
}
function in_num(string $key): ?float {
    $v = in_str($key);
    return ($v !== '' && is_numeric($v)) ? (float)$v : null;
}
/** 複数選択（name="xxx[]"）。$allowed が null なら任意の文字列を許可 */
function in_list(string $key, ?array $allowed = null): array {
    $v = $_GET[$key] ?? [];
    if (!is_array($v)) $v = [$v];
    $v = array_values(array_unique(array_filter(
        array_map(fn($x) => is_string($x) ? trim($x) : '', $v),
        fn($x) => $x !== ''
    )));
    if ($allowed !== null) $v = array_values(array_intersect($v, $allowed));
    return array_slice($v, 0, 30);
}
function like(string $s): string {
    return '%' . addcslashes($s, '%_\\') . '%';
}
function fail(int $code, string $msg): never { // PHP 8.1+
    http_response_code($code);
    echo json_encode(['error' => $msg], JSON_UNESCAPED_UNICODE);
    exit;
}

try {
    $pdo = new PDO(DB_DSN, DB_USER, DB_PASS, [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES   => false,
    ]);

    // ---- カテゴリ（cigarette 固定）----
    $stmt = $pdo->prepare('SELECT category_id FROM categories WHERE category_code = ?');
    $stmt->execute([CATEGORY_CODE]);
    $categoryId = $stmt->fetchColumn();
    if ($categoryId === false) fail(400, 'category "' . CATEGORY_CODE . '" not found');
    $categoryId = (int)$categoryId;

    // ---- 絞り込み候補の取得（mode=options）----
    if (in_str('mode') === 'options') {
        $stmt = $pdo->prepare(
            'SELECT DISTINCT td.brand
             FROM products p
             JOIN tobacco_details td ON td.product_id = p.product_id
             WHERE p.category_id = ? AND td.brand <> \'\'
             ORDER BY td.brand'
        );
        $stmt->execute([$categoryId]);
        $brands = $stmt->fetchAll(PDO::FETCH_COLUMN);

        $stmt = $pdo->prepare(
            'SELECT DISTINCT m.maker_name
             FROM products p
             JOIN makers m ON m.maker_id = p.maker_id
             WHERE p.category_id = ? AND m.maker_name IS NOT NULL AND m.maker_name <> \'\'
             ORDER BY m.maker_name'
        );
        $stmt->execute([$categoryId]);
        $makers = $stmt->fetchAll(PDO::FETCH_COLUMN);

        echo json_encode(['brands' => $brands, 'makers' => $makers], JSON_UNESCAPED_UNICODE);
        exit;
    }

    // ---- 検索条件 ----
    $where  = ['p.category_id = ?'];
    $params = [$categoryId];

    if (($kw = in_str('keyword')) !== '') {
        $where[]  = 'p.product_name LIKE ?';
        $params[] = like($kw);
    }
    if (($b = in_str('brand')) !== '') {
        $where[]  = 'td.brand LIKE ?';
        $params[] = like($b);
    }
    if (($m = in_str('maker')) !== '') {
        $where[]  = 'm.maker_name LIKE ?';
        $params[] = like($m);
    }

    // 値段・タール・ニコチン（範囲）
    foreach ([
        ['price_min', 'price_max', 'p.price'],
        ['tar_min',   'tar_max',   'td.tar_mg'],
        ['nic_min',   'nic_max',   'td.nicotine_mg'],
    ] as [$minKey, $maxKey, $col]) {
        if (($v = in_num($minKey)) !== null) { $where[] = "$col >= ?"; $params[] = $v; }
        if (($v = in_num($maxKey)) !== null) { $where[] = "$col <= ?"; $params[] = $v; }
    }

    // 香味・サイズ・パッケージ（グループ内はOR、グループ同士はAND）
    $groups = [
        'flavor' => ['regular' => 'td.is_regular', 'menthol' => 'td.is_menthol',
                     'capsule' => 'td.is_capsule', 'flavor'  => 'td.is_flavor'],
        'size'   => ['short' => 'td.is_short', 'king' => 'td.is_king',
                     'long'  => 'td.is_long',  'slim' => 'td.is_slim'],
        'pack'   => ['soft' => 'td.is_soft', 'box' => 'td.is_box'],
    ];
    foreach ($groups as $key => $map) {
        $conds = [];
        foreach (in_list($key, array_keys($map)) as $t) $conds[] = "{$map[$t]} = 1";
        if ($conds) $where[] = '(' . implode(' OR ', $conds) . ')';
    }

    // ---- 並び順（ホワイトリスト）----
    $orders = [
        'rank'       => 'p.product_id ASC',                       // xlsxの比較順（401〜500）
        'tar_asc'    => 'td.tar_mg ASC, p.product_id ASC',
        'tar_desc'   => 'td.tar_mg DESC, p.product_id ASC',
        'nic_asc'    => 'td.nicotine_mg ASC, p.product_id ASC',
        'price_asc'  => 'p.price ASC, p.product_id ASC',
        'price_desc' => 'p.price DESC, p.product_id ASC',
    ];
    $orderSql = $orders[in_str('sort')] ?? $orders['rank'];

    // ---- 実行 ----
    $page    = max(1, (int)(in_str('page') ?: 1));
    $offset  = ($page - 1) * PER_PAGE;
    $fromSql = 'FROM products p
                JOIN tobacco_details td ON td.product_id = p.product_id
                LEFT JOIN makers m ON m.maker_id = p.maker_id
                WHERE ' . implode(' AND ', $where);

    $stmt = $pdo->prepare("SELECT COUNT(*) $fromSql");
    $stmt->execute($params);
    $total = (int)$stmt->fetchColumn();

    $sql = "SELECT p.product_id, p.product_name, p.price, p.image_path,
                   m.maker_name, td.brand, td.flavor_type, td.tar_mg, td.nicotine_mg
            $fromSql
            ORDER BY $orderSql
            LIMIT " . PER_PAGE . " OFFSET " . $offset;
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);

    echo json_encode([
        'category' => CATEGORY_CODE,
        'total'    => $total,
        'page'     => $page,
        'per_page' => PER_PAGE,
        'items'    => $stmt->fetchAll(PDO::FETCH_ASSOC),
    ], JSON_UNESCAPED_UNICODE);

} catch (PDOException $e) {
    error_log($e->getMessage());
    fail(500, DEBUG ? 'DB error: ' . $e->getMessage() : 'server error');
}
