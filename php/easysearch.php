<?php
// php/easysearch.php : 簡単検索(嗜好診断)のおすすめ商品を返すAPI
//   POST (JSON)  {"answers": {"q1":"A", "q2":"D", ..., "q8":"D", "q9":"A", "q10":"B"}}
//   → あなたの好みの目標値(香り・味・酸味・濃厚さ)を計算し、近い商品を10件返す
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

session_start();

// ===== データベース接続設定 =====
$host    = 'localhost';
$db      = 'shikodb';
$dbUser  = 'root';
$pass    = 'password';   // ★login.php と同じものにする
$charset = 'utf8mb4';

// ===== 判定マスター =====
// 簡単検索_数値まとめ.xlsx の「マスター」シートと同じ数値。 [香り, 味, 酸味, 濃厚さ]
//   Q1 = 基礎値(1〜5) / Q2〜Q8 = 調整量(足し引き)。合計したあと 1〜5 に収める。
//   評価の向き: 香り 1控えめ→5強い / 味 1甘い→5苦い / 酸味 1控えめ→5強い / 濃厚さ 1軽い→5濃い
//   ※Q9・Q10 はマスターに数値がないため、おすすめの計算には使わない。
$MASTER = [
    'Q1' => ['A' => [4, 2, 3, 2], 'B' => [3, 2, 4, 1], 'C' => [2, 2, 2, 1], 'D' => [3, 3, 2, 3], 'E' => [4, 4, 3, 3]],
    'Q2' => ['A' => [-1, -1, -1, -1], 'B' => [1, 0, 0, 0], 'C' => [0, 0, 0, 0], 'D' => [1, 1, 1, 0], 'E' => [1, -1, 0, 0]],
    'Q3' => ['A' => [1, -1, 1, -1], 'B' => [1, -1, -1, 0], 'C' => [1, 0, 1, -1], 'D' => [0, 0, -1, -1], 'E' => [-1, 0, -1, 0]],
    'Q4' => ['A' => [-1, -1, -1, -1], 'B' => [0, -1, -1, 0], 'C' => [1, -1, 1, -1], 'D' => [1, 1, 0, 0], 'E' => [1, 1, -1, 0]],
    'Q5' => ['A' => [0, 1, 0, 0], 'B' => [0, -1, -1, 0], 'C' => [0, 0, 1, -1], 'D' => [0, 0, 0, 0], 'E' => [0, 0, 0, -1]],
    'Q6' => ['A' => [0, 0, 0, -2], 'B' => [0, 0, 0, -1], 'C' => [0, 0, 0, 1], 'D' => [0, 0, 0, 3], 'E' => [0, 0, 0, -1]],
    'Q7' => ['A' => [1, -1, 1, -1], 'B' => [1, -1, 0, 0], 'C' => [-1, 0, -1, -1], 'D' => [0, 0, -1, 0], 'E' => [1, 1, -1, 0]],
    'Q8' => ['A' => [0, 0, 1, -1], 'B' => [-1, -1, -1, -1], 'C' => [0, 0, 0, 0], 'D' => [1, 0, 1, -1], 'E' => [1, -1, -1, 0]],
];

const RESULT_COUNT     = 10;   // 返す件数
const MAX_PER_CATEGORY = 4;    // 同じカテゴリは、まず4件まで(いろいろな種類を出すため)
const CANDIDATES       = 80;   // 近い順に、何件を候補にするか

// JSONを返して終了する
function out(array $arr, int $code = 200): void {
    http_response_code($code);
    echo json_encode($arr, JSON_UNESCAPED_UNICODE);
    exit;
}

// ===== ログイン確認 =====
if (empty($_SESSION['user_id'])) {
    out(['ok' => false, 'message' => 'ログインしてください。'], 401);
}
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    out(['ok' => false, 'message' => '許可されていないリクエストです。'], 405);
}

// ===== 回答の読み取りと、目標値の計算 =====
$input   = json_decode(file_get_contents('php://input'), true);
$answers = (is_array($input) && is_array($input['answers'] ?? null)) ? $input['answers'] : [];

$total = [0, 0, 0, 0];
$seed  = '';
foreach (array_keys($MASTER) as $q) {            // Q1〜Q8
    $choice = $answers[strtolower($q)] ?? null;  // q1〜q8
    if (!is_string($choice) || !isset($MASTER[$q][$choice])) {
        out(['ok' => false, 'message' => '質問' . substr($q, 1) . 'の回答が正しくありません。'], 400);
    }
    foreach ($MASTER[$q][$choice] as $i => $v) {
        $total[$i] += $v;
    }
    $seed .= $choice;
}
$target = array_map(fn($v) => max(1, min(5, $v)), $total);   // 1〜5 に収める

// ===== おすすめ商品を探す =====
try {
    $pdo = new PDO("mysql:host=$host;dbname=$db;charset=$charset", $dbUser, $pass, [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES   => false,
    ]);

    // 4つの評価の「ずれ」を二乗して足した値(dist2)が小さい順 = 好みに近い順。
    // 同じ近さのときは、商品IDと回答から決まる並び(回答が同じなら結果も同じ。特定の商品に偏らない)。
    $stmt = $pdo->prepare('
        SELECT p.product_id, p.product_name, c.category_code, c.category_name,
               p.aroma_score, p.taste_score, p.sour_score, p.richness_score,
               ( POW(p.aroma_score    - ?, 2) + POW(p.taste_score    - ?, 2)
               + POW(p.sour_score     - ?, 2) + POW(p.richness_score - ?, 2) ) AS dist2
          FROM products p
          JOIN categories c ON c.category_id = p.category_id
         WHERE c.group_name = \'alcohol\'
           AND p.aroma_score IS NOT NULL AND p.taste_score IS NOT NULL
           AND p.sour_score  IS NOT NULL AND p.richness_score IS NOT NULL
         ORDER BY dist2 ASC, CRC32(CONCAT(p.product_id, ?)) ASC
         LIMIT ' . CANDIDATES
    );
    $stmt->execute([$target[0], $target[1], $target[2], $target[3], $seed]);
    $candidates = $stmt->fetchAll();
} catch (PDOException $e) {
    error_log('easysearch.php エラー: ' . $e->getMessage());
    out(['ok' => false, 'message' => 'サーバーエラーが発生しました。'], 500);
}

// ===== 近い順に、同じカテゴリが偏りすぎないように選ぶ =====
$picked  = [];
$skipped = [];
$count   = [];
foreach ($candidates as $row) {
    if (count($picked) >= RESULT_COUNT) break;
    $cat = $row['category_code'];
    if (($count[$cat] ?? 0) < MAX_PER_CATEGORY) {
        $picked[] = $row;
        $count[$cat] = ($count[$cat] ?? 0) + 1;
    } else {
        $skipped[] = $row;
    }
}
// 件数が足りないときは、上限で見送った商品を近い順に補う
foreach ($skipped as $row) {
    if (count($picked) >= RESULT_COUNT) break;
    $picked[] = $row;
}

$results = [];
foreach ($picked as $row) {
    // 最も遠い場合(各評価が4ずつずれる)の距離は8。0〜100%に直す
    $match = (int)round((1 - sqrt((float)$row['dist2']) / 8) * 100);
    $results[] = [
        'product_id'    => (int)$row['product_id'],
        'product_name'  => $row['product_name'],
        'category_code' => $row['category_code'],
        'category_name' => $row['category_name'],
        'match'         => max(0, min(100, $match)),
        'scores'        => [
            'aroma'    => (int)$row['aroma_score'],
            'taste'    => (int)$row['taste_score'],
            'sour'     => (int)$row['sour_score'],
            'richness' => (int)$row['richness_score'],
        ],
    ];
}

out([
    'ok'      => true,
    'target'  => ['aroma' => $target[0], 'taste' => $target[1], 'sour' => $target[2], 'richness' => $target[3]],
    'results' => $results,
]);