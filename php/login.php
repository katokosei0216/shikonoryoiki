<?php
    $host = "localhost";
    $dbname = "shikodb";
    $user = "root";
    $pass = "password";

    try{
        $pdo = new PDO(
            "mysql:host=$host;dbname=$dbname;charset=utf8mb4",
            $user,
            $pass
        );
        $pdo->setAttribute(PDO::ATT_ERRMODE, PDO::ERRMODE_EXCEPTION);
    } catch (PDOException $e){
        die("接続失敗：" . $e->getMessage());
    }
        $email = $_POST['email'];
        $password = $_POST['password'];

        $sql = "SELECT * FROM login WHERE email = :email";
        $stmt = $pdo->prepare($sql);
        $stmt->bindParam(':email', $email);
        $stmt->execute();

        $user = $stmt->fetch(PDO::FETCH_ASSOC);

        if ($user && password_verify($password, $user['password_hash'])){
            session_start();
            $_SESSION['user_id'] = $user['user_id'];
            $_SESSION['user_name'] = $user_name['user_name'];

            header("location: ../html/home.html");
            exit;
        } else {
            echo "メールアドレスまたはパスワードが違います";
        }

?>