<?php
/**
 * タバコ・電子タバコの8問簡単検索（POST JSON）。
 * リクエスト: { "category":"cigarette"|"vape", "answers": {"q1":"A", ..., "q8":"E"} }
 * 回答とDBの実値を照合し、商品上位9件を返す。嗜好との一致度であり、安全性の評価ではない。
 */
declare(strict_types=1);
header('Content-Type: application/json; charset=UTF-8');
header('Cache-Control: no-store');
session_start();

// 他のPHPと同じDB接続情報に合わせてください。別のPHPは変更しません。
const EASY_DB_DSN = 'mysql:host=localhost;dbname=shikodb;charset=utf8mb4';
const EASY_DB_USER = 'root';
const EASY_DB_PASS = 'password';
const EASY_RESULT_COUNT = 9;

function respond(array $data, int $status = 200): never {
    http_response_code($status);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);
    exit;
}

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') respond(['ok' => false, 'message' => 'POSTで送信してください。'], 405);
$input = json_decode((string)file_get_contents('php://input'), true);
if (!is_array($input)) respond(['ok' => false, 'message' => 'リクエストが不正です。'], 400);
$category = $input['category'] ?? null;
if (!in_array($category, ['cigarette', 'vape'], true)) respond(['ok' => false, 'message' => 'カテゴリが不正です。'], 400);
$answers = $input['answers'] ?? null;
if (!is_array($answers)) respond(['ok' => false, 'message' => '回答が不正です。'], 400);
$allowed = $category === 'cigarette' ? [5, 5, 5, 5, 3, 3, 5, 5] : [3, 5, 5, 5, 5, 3, 3, 5];
for ($i = 1; $i <= count($allowed); ++$i) {
    $choice = $answers['q' . $i] ?? null;
    if (!is_string($choice) || strlen($choice) !== 1 ||
        $choice < 'A' || $choice > chr(64 + $allowed[$i - 1])) {
        respond(['ok' => false, 'message' => "Q{$i}の回答を確認してください。"], 400);
    }
}

// 正規化した距離を 0〜1 の近さにする。NULLは「未評価」であり0点とは区別する。
function numericClose(?float $value, float $target, float $maxDistance): float {
    if ($value === null) return 0.0;
    return max(0.0, 1.0 - abs($value - $target) / $maxDistance);
}
function addScore(float &$sum, float &$weightSum, float $weight, float $closeness): void {
    $sum += $weight * max(0.0, min(1.0, $closeness));
    $weightSum += $weight;
}
function yesNo(float &$sum, float &$weightSum, float $weight, mixed $dbValue, bool $want): void {
    addScore($sum, $weightSum, $weight, (bool)$dbValue === $want ? 1.0 : 0.0);
}

function rateCigarette(array $p, array $a): float {
    $sum = 0.0; $max = 0.0;
    $flavor = ['A' => 'レギュラー', 'B' => 'メンソール', 'C' => '香り付きメンソール', 'D' => 'カプセル・メンソール'];
    $flavorWeight = $a['q8'] === 'D' ? 2.4 : 1.4;
    if (isset($flavor[$a['q1']])) {
        $actual = (string)($p['flavor_type'] ?? '');
        $desired = $flavor[$a['q1']];
        $closeness = $actual === $desired ? 1.0 :
            (($desired !== 'レギュラー' && $actual !== 'レギュラー') ? 0.3 : 0.0);
        addScore($sum, $max, $flavorWeight, $closeness);
    }
    $tarTargets = ['A' => 1, 'B' => 3, 'C' => 6, 'D' => 9, 'E' => 14];
    $nicTargets = ['A' => .15, 'B' => .35, 'C' => .55, 'D' => .8, 'E' => 1.1];
    addScore($sum, $max, $a['q8'] === 'A' ? 3.0 : 1.7,
        numericClose(isset($p['tar_mg']) ? (float)$p['tar_mg'] : null, $tarTargets[$a['q2']], 13.0));
    addScore($sum, $max, $a['q8'] === 'B' ? 3.0 : 1.7,
        numericClose(isset($p['nicotine_mg']) ? (float)$p['nicotine_mg'] : null, $nicTargets[$a['q3']], 1.1));

    $sizes = ['A' => 'is_short', 'B' => 'is_king', 'C' => 'is_long', 'D' => 'is_slim'];
    if (isset($sizes[$a['q4']])) yesNo($sum, $max, 1.2, $p[$sizes[$a['q4']]] ?? 0, true);
    if ($a['q5'] !== 'C') yesNo($sum, $max, 1.0, $p[$a['q5'] === 'A' ? 'is_soft' : 'is_box'] ?? 0, true);
    if ($a['q6'] !== 'C') yesNo($sum, $max, 1.0, $p['is_capsule'] ?? 0, $a['q6'] === 'A');

    $priceTargets = ['A' => 450, 'B' => 470, 'C' => 500, 'D' => 580, 'E' => 630];
    addScore($sum, $max, $a['q8'] === 'C' ? 3.0 : 1.0,
        numericClose(isset($p['price']) ? (float)$p['price'] : null, $priceTargets[$a['q7']], 190.0));
    return $max > 0 ? $sum / $max : 0;
}

// 強メンソールを示す独立カラムがないため、既存の登録商品名・説明の明記情報を使う。
function isStrongMenthol(array $p): bool {
    if (!(bool)($p['is_menthol'] ?? false)) return false;
    $name = (string)($p['product_name'] ?? '');
    $description = (string)($p['description'] ?? '');
    return preg_match('/ブラック|アイシー/u', $name) === 1 ||
           preg_match('/強冷|強い冷涼感|強いメンソール|強めのメンソール|冷涼感が強く|刺激の強さ/u', $description) === 1;
}

function rateVape(array $p, array $a): float {
    $sum = 0.0; $max = 0.0;
    if ($a['q1'] !== 'C') {
        addScore($sum, $max, 1.3, ($p['product_line'] ?? '') === ($a['q1'] === 'A' ? 'TEREA' : 'SENTIA') ? 1 : 0);
    }
    foreach (['q2' => ['aroma_score','A'], 'q3' => ['richness_score','B'], 'q4' => ['strength_score','C']] as $q => [$column, $focus]) {
        $value = $p[$column] === null ? null : (float)$p[$column];
        $target = ord($a[$q]) - 64;
        addScore($sum, $max, $a['q8'] === $focus ? 3.0 : 1.6,
            numericClose($value, $target, 4.0));
    }
    $types = ['A' => 'レギュラー', 'B' => 'メンソール', 'C' => 'フレーバー・メンソール'];
    if ($a['q5'] === 'D') {
        // 強メンソールは旧Dの「カプセル入りメンソール」と別条件で判定する。
        $similar = isStrongMenthol($p) ? 1.0 : ((bool)($p['is_menthol'] ?? false) ? 0.3 : 0.0);
        addScore($sum, $max, $a['q8'] === 'D' ? 3.0 : 1.5, $similar);
    } elseif (isset($types[$a['q5']])) {
        $actual = (string)($p['type_label'] ?? '');
        $desired = $types[$a['q5']];
        $similar = $actual === $desired ? 1.0 :
            ($desired !== 'レギュラー' && $actual !== 'レギュラー' ? 0.3 : 0.0);
        addScore($sum, $max, $a['q8'] === 'D' ? 3.0 : 1.5, $similar);
    }
    if ($a['q6'] !== 'C') yesNo($sum, $max, 1.0, $p['is_strong_flavor'] ?? 0, $a['q6'] === 'A');
    if ($a['q7'] !== 'C') yesNo($sum, $max, 1.0, $p['is_menthol'] ?? 0, $a['q7'] === 'A');
    return $max > 0 ? $sum / $max : 0;
}

try {
    $pdo = new PDO(EASY_DB_DSN, EASY_DB_USER, EASY_DB_PASS, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ]);
    if ($category === 'cigarette') {
        $sql = 'SELECT p.product_id, p.product_name, p.price, c.category_name,
                       td.brand, td.flavor_type, td.tar_mg, td.nicotine_mg,
                       td.pack_count, td.is_short, td.is_king, td.is_long,
                       td.is_slim, td.is_soft, td.is_box, td.is_capsule
                FROM products p
                JOIN categories c ON c.category_id = p.category_id
                JOIN tobacco_details td ON td.product_id = p.product_id
                WHERE c.category_code = ?';
        $params = ['cigarette'];
    } else {
        $sql = 'SELECT p.product_id, p.product_name, p.description, p.aroma_score, p.richness_score,
                       c.category_name, vd.product_line, vd.strength_score, vd.type_label,
                       vd.is_regular, vd.is_menthol, vd.is_strong_flavor, vd.is_capsule,
                       vd.is_iluma_compatible, vd.is_legacy_compatible
                FROM products p
                JOIN categories c ON c.category_id = p.category_id
                JOIN vape_details vd ON vd.product_id = p.product_id
                WHERE c.category_code = ?';
        $params = ['vape'];
    }
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $products = $stmt->fetchAll();
} catch (PDOException $e) {
    error_log('easysearch_tobacco.php: ' . $e->getMessage());
    respond(['ok' => false, 'message' => 'データベースに接続できないか、商品テーブルを読み込めませんでした。'], 500);
}

// 同点の商品の順番を、回答セットとIDから安定して決める。
$seed = implode('', array_map(fn($i) => $answers['q' . $i], range(1, count($allowed))));
foreach ($products as &$p) {
    $p['_similarity'] = $category === 'cigarette' ? rateCigarette($p, $answers) : rateVape($p, $answers);
    $p['_tie'] = sprintf('%u', crc32($seed . ':' . $p['product_id']));
}
unset($p);
usort($products, function (array $a, array $b): int {
    return ($b['_similarity'] <=> $a['_similarity']) ?: strcmp($a['_tie'], $b['_tie']);
});

$results = [];
foreach (array_slice($products, 0, EASY_RESULT_COUNT) as $p) {
    $summary = $category === 'cigarette'
      ? $p['flavor_type'] . ' ／ タール' . (float)$p['tar_mg'] . 'mg・ニコチン' . (float)$p['nicotine_mg'] . 'mg'
      : $p['product_line'] . ' ／ 香り' . ($p['aroma_score'] ?? '未評価') . '・コク' . ($p['richness_score'] ?? '未評価')
        . '・吸いごたえ' . ($p['strength_score'] ?? '未評価');
    $results[] = [
        'product_id' => (int)$p['product_id'],
        'product_name' => $p['product_name'],
        'category_code' => $category,
        'category_name' => $p['category_name'],
        'match' => max(0, min(100, (int)round($p['_similarity'] * 100))),
        'spec_summary' => $summary,
    ];
}
respond(['ok' => true, 'category' => $category, 'total' => count($products), 'results' => $results]);
