<?php
// データベース接続設定
$host = 'localhost';
$db   = 'shikodb'; // あなたのデータベース名
$user = 'root';       // データベースのユーザー名
$pass = 'password';   // データベースのパスワード
$charset = 'utf8mb4';

$dsn = "mysql:host=$host;dbname=$db;charset=$charset";
$options = [
    PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    PDO::ATTR_EMULATE_PREPARES   => false,
];

try {
    $pdo = new PDO($dsn, $user, $pass, $options);
} catch (\PDOException $e) {
    exit('データベース接続失敗: ' . $e->getMessage());
}

// 変数の初期化
$user_name = '';
$email = '';
$error = '';

// フォームが送信された場合
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $user_name = trim($_POST['user_name'] ?? '');
    $email = trim($_POST['email'] ?? '');
    $password = $_POST['password'] ?? '';

    // バリデーション
    if ($user_name === '' || $email === '' || $password === '') {
        $error = 'すべての項目を入力してください。';
    } elseif (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        $error = '有効なメールアドレスを入力してください。';
    } elseif (mb_strlen($password) < 8) {
        $error = 'パスワードは8文字以上で入力してください。';
    } else {
        try {
            // 2. メールアドレスの重複チェック
            $stmt = $pdo->prepare('SELECT user_id FROM users WHERE email = ?');
            $stmt->execute([$email]);
            if ($stmt->fetch()) {
                // メアドチェック
                $error = 'このメールアドレスは既に使用されています。';
            } else {
                // 3. パスワードのハッシュ化
                $password_hash = password_hash($password, PASSWORD_DEFAULT);

                // 4. データベースへ登録
                $stmt = $pdo->prepare('INSERT INTO users (user_name, email, password_hash) VALUES (?, ?, ?)');
                $stmt->execute([$user_name, $email, $password_hash]);

                // 登録成功後に別のページへリダイレクト
                // ※移動先の phpを 
                header('Location: login.php');
                exit;
            }
        } catch (\PDOException $e) {
            $error = 'データベースエラーが発生しました。';
        }
    }
}
?>
<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <title>アカウント新規登録</title>
</head>
<body>
    <h2>アカウント新規登録</h2>

    <?php if ($error !== ''): ?>
        <p style="color: red;;"><?= htmlspecialchars($error, ENT_QUOTES, 'UTF-8') ?></p>
    <?php endif; ?>

    <form action="" method="POST">
        <div>
            <label for="user_name">名前（口コミ表示用）:</label><br>
            <input type="text" id="user_name" name="user_name" value="<?= htmlspecialchars($user_name, ENT_QUOTES, 'UTF-8') ?>" required>
        </div>
        <br>
        <div>
            <label for="email">メールアドレス:</label><br>
            <input type="email" id="email" name="email" value="<?= htmlspecialchars($email, ENT_QUOTES, 'UTF-8') ?>" required>
        </div>
        <br>
        <div>
            <label for="password">パスワード（8文字以上）:</label><br>
            <input type="password" id="password" name="password" required>
        </div>
        <br>
        <button type="submit">登録する</button>
    </form>
</body>
</html>