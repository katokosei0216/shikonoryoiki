<?php
declare(strict_types=1);
header('Content-Type: application/json; charset=UTF-8');

// ---- DB接続設定（YOUR_DB / USER / PASS を実環境の値に変更）----
const DB_DSN  = 'mysql:host=localhost;dbname=shikodb;charset=utf8mb4';
const DB_USER = 'root';
const DB_PASS = 'password';

// 開発中のみ true。500エラー時に原因(DBのエラーメッセージ)をJSONに含める。公開前に false へ
const DEBUG = true;

const PER_PAGE = 20;

// ---- 入力ヘルパー ----
function in_str(string $key): string {
    $v = $_GET[$key] ?? '';
    return is_string($v) ? trim($v) : '';
}
function in_num(string $key): ?float {
    $v = in_str($key);
    return ($v !== '' && is_numeric($v)) ? (float)$v : null;
}
function in_score(string $key): ?int {
    $v = in_str($key);
    return (ctype_digit($v) && (int)$v >= 1 && (int)$v <= 5) ? (int)$v : null;
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
    return array_slice($v, 0, 30); // 上限
}
function like(string $s): string {
    return '%' . addcslashes($s, '%_\\') . '%';
}
function placeholders(array $a): string {
    return implode(',', array_fill(0, count($a), '?'));
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

    // ---- カテゴリ（categories.category_code から解決）----
    $category = in_str('category') ?: 'whisky';
    $stmt = $pdo->prepare('SELECT category_id FROM categories WHERE category_code = ?');
    $stmt->execute([$category]);
    $categoryId = $stmt->fetchColumn();
    if ($categoryId === false) fail(400, 'invalid category');

        // ---- 絞り込み候補の取得（mode=options）----
    if (in_str('mode') === 'options') {
        if ($category === 'sake') {
            // 日本酒: 製造都道府県
            $stmt = $pdo->prepare(
                'SELECT DISTINCT sd.prefecture AS name
                 FROM products p
                 JOIN sake_details sd ON sd.product_id = p.product_id
                 WHERE p.category_id = ? AND sd.prefecture IS NOT NULL AND sd.prefecture <> \'\'
                 ORDER BY sd.prefecture'
            );
            $stmt->execute([(int)$categoryId]);
            $countries = $stmt->fetchAll(PDO::FETCH_COLUMN);
        } else {
            $stmt = $pdo->prepare(
                'SELECT DISTINCT c.country_name AS name
                 FROM products p
                 JOIN countries c ON c.country_id = p.country_id
                 WHERE p.category_id = ?
                 ORDER BY c.country_name'
            );
            $stmt->execute([(int)$categoryId]);
            $countries = $stmt->fetchAll(PDO::FETCH_COLUMN);
        }

        $stmt = $pdo->prepare(
            'SELECT DISTINCT m.maker_name AS name
             FROM products p
             JOIN makers m ON m.maker_id = p.maker_id
             WHERE p.category_id = ? AND m.maker_name IS NOT NULL AND m.maker_name <> \'\'
             ORDER BY m.maker_name'
        );
        $stmt->execute([(int)$categoryId]);
        $makers = $stmt->fetchAll(PDO::FETCH_COLUMN);

        echo json_encode([
            'countries' => $countries,
            'makers'    => $makers,
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    $joins = [
        'LEFT JOIN countries c ON c.country_id = p.country_id',
        'LEFT JOIN makers m ON m.maker_id = p.maker_id',
    ];
    $where       = ['p.category_id = ?'];
    $params      = [(int)$categoryId];
    $extraSelect = '';

    // ---- 共通条件 ----
    if (($kw = in_str('keyword')) !== '') {
        $where[]  = 'p.product_name LIKE ?';
        $params[] = like($kw);
    }

    // 基本情報（カクテルでは非表示なので無視）
    if ($category !== 'cocktail') {
        if (($country = in_str('country')) !== '') {
            if ($category === 'sake') {
                $where[] = 'sd.prefecture LIKE ?';      // 日本酒は都道府県
            } else {
                $where[] = 'c.country_name LIKE ?';
            }
            $params[] = like($country);
        }
        if (($maker = in_str('maker')) !== '') {
            $where[]  = 'm.maker_name LIKE ?';
            $params[] = like($maker);
        }
        foreach ([
            ['price_min', 'price_max', 'p.price'],
            ['age_min',   'age_max',   'p.vintage'],
            ['abv_min',   'abv_max',   'p.abv'],
        ] as [$minKey, $maxKey, $col]) {
            if (($v = in_num($minKey)) !== null) { $where[] = "$col >= ?"; $params[] = $v; }
            if (($v = in_num($maxKey)) !== null) { $where[] = "$col <= ?"; $params[] = $v; }
        }
    }

    // ---- 5段階評価（完全一致）----
    foreach ([
        'aroma'    => 'p.aroma_score',
        'taste'    => 'p.taste_score',
        'acidity'  => 'p.sour_score',
        'richness' => 'p.richness_score',
    ] as $key => $col) {
        if (($s = in_score($key)) !== null) { $where[] = "$col = ?"; $params[] = $s; }
    }

    // ---- おすすめの飲み方（whisky / sake / wine）----
    if (in_array($category, ['whisky', 'sake', 'wine'], true)) {
        $ways = in_list($category . '_way');
        if ($ways) {
            $where[] = 'EXISTS (
                SELECT 1 FROM product_drink_styles pds
                JOIN drink_styles ds ON ds.drink_style_id = pds.drink_style_id
                WHERE pds.product_id = p.product_id
                  AND ds.style_name IN (' . placeholders($ways) . '))';
            array_push($params, ...$ways);
        }
    }

    // ---- カテゴリ固有 ----
    switch ($category) {
        case 'whisky':
            $joins[] = 'LEFT JOIN whisky_details wd ON wd.product_id = p.product_id';
            $map = ['smoke' => 'wd.is_smoky', 'grain' => 'wd.is_grain',
                    'malt'  => 'wd.is_malt',  'blended' => 'wd.is_blended'];
            $conds = [];
            foreach (in_list('whisky_type', array_keys($map)) as $t) $conds[] = "{$map[$t]} = 1";
            if ($conds) $where[] = '(' . implode(' OR ', $conds) . ')';
            break;

        case 'sake':
            $joins[] = 'LEFT JOIN sake_details sd ON sd.product_id = p.product_id';
            $extraSelect = ', sd.prefecture';
            $map = ['easy' => 'sd.is_easy_to_drink', 'dry' => 'sd.is_dry', 'sweet' => 'sd.is_sweet'];
            $conds = [];
            foreach (in_list('sake_type', array_keys($map)) as $t) $conds[] = "{$map[$t]} = 1";
            if ($conds) $where[] = '(' . implode(' OR ', $conds) . ')';
            break;

        case 'wine':
            $joins[] = 'LEFT JOIN wine_details wid ON wid.product_id = p.product_id';
            $extraSelect = ', wid.wine_type';
            $types = in_list('wine_type', ['赤', '白', '泡', 'ロゼ']);
            if ($types) {
                $where[] = 'wid.wine_type IN (' . placeholders($types) . ')';
                array_push($params, ...$types);
            }
            break;

        case 'cocktail':
            $joins[] = 'LEFT JOIN cocktail_details cd ON cd.product_id = p.product_id';
            $joins[] = 'LEFT JOIN fruits f ON f.fruit_id = cd.fruit_id';
            $joins[] = 'LEFT JOIN base_liquors bl ON bl.base_liquor_id = cd.base_liquor_id';
            $extraSelect = ', cd.method, cd.glass_size, f.fruit_name, bl.base_liquor_name';

            // 製法（OR）
            $methodCond = [
                'shake'     => "cd.method = 'shake'",
                'build'     => "cd.method = 'build'",
                'long_stir' => "cd.method = 'stir'",
                'blend'     => "cd.method = 'blend'",
                'muddle'    => "cd.method = 'muddle'",   // enum に無ければ常に不一致
                'layer'     => "cd.method = 'layer'",
                'float'     => "cd.method = 'float'",
                'smoke'     => 'cd.is_smoke = 1',
                'short'     => "cd.glass_size = 'short'",
            ];
            $conds = [];
            foreach (in_list('cocktail_method', array_keys($methodCond)) as $t) {
                $conds[] = $methodCond[$t];
            }
            if ($conds) $where[] = '(' . implode(' OR ', $conds) . ')';

            // 素材（フルーツ名 または タグ名）
            if ($mats = in_list('material')) {
                $ph = placeholders($mats);
                $where[] = "(f.fruit_name IN ($ph) OR EXISTS (
                    SELECT 1 FROM product_tags pt
                    JOIN tags t ON t.tag_id = pt.tag_id
                    WHERE pt.product_id = p.product_id AND t.tag_name IN ($ph)))";
                array_push($params, ...$mats, ...$mats);
            }

            // ベース酒
            if ($bases = in_list('base')) {
                $where[] = 'bl.base_liquor_name IN (' . placeholders($bases) . ')';
                array_push($params, ...$bases);
            }
            break;
    }

    // ---- 実行 ----
    $page    = max(1, (int)(in_str('page') ?: 1));
    $offset  = ($page - 1) * PER_PAGE;
    $fromSql = 'FROM products p ' . implode(' ', $joins) . ' WHERE ' . implode(' AND ', $where);

    $stmt = $pdo->prepare("SELECT COUNT(*) $fromSql");
    $stmt->execute($params);
    $total = (int)$stmt->fetchColumn();

    $sql = "SELECT p.product_id, p.product_name, p.price, p.abv, p.vintage, p.image_path,
                   c.country_name, m.maker_name $extraSelect
            $fromSql
            ORDER BY p.created_at DESC, p.product_id DESC
            LIMIT " . PER_PAGE . " OFFSET " . $offset;
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);

    echo json_encode([
        'category' => $category,
        'total'    => $total,
        'page'     => $page,
        'per_page' => PER_PAGE,
        'items'    => $stmt->fetchAll(PDO::FETCH_ASSOC),
    ], JSON_UNESCAPED_UNICODE);

} catch (PDOException $e) {
    error_log($e->getMessage());
    fail(500, DEBUG ? 'DB error: ' . $e->getMessage() : 'server error');
}