# 紙タバコの商品詳細ページ 更新（2026-11-13）

## 修正内容
- `php/detail.php`：`category_code = cigarette` で `tobacco_details` から `brand`, `tar_mg`, `nicotine_mg` を取得。
- `js/detail.js`：商品情報に「ブランド」「タール」「ニコチン」を表示。タール・ニコチンは mg 単位、0mg に対応。`cigarette` カテゴリ名を表示。
- `js/detail.js`：商品ID 401〜500 の画像を 6001.webp〜6100.webp に紐付け。DBの `image_path` が未登録でも画像表示。既存の画像パスに問題がある場合も同梱画像で再試行。
- `html/detail.html`：キャッシュ対策で `detail.js` のバージョンを更新。
- `assets/products/6001.webp`〜`6100.webp`：提供された「神たばこ商品画像.zip」から同梱。

## インストール
**既存環境に変更がある場合、先にバックアップを取得してから適用してください。**

差し替え用ZIPはサイトのドキュメントルート（`html`, `js`, `php`, `assets` が並ぶフォルダ）に展開します。

例：`/var/www/html/shikonoryoiki/` がサイトのフォルダの場合

```bash
cd /var/www/html/shikonoryoiki
sudo unzip -o /path/to/紙タバコ詳細_差し替え用.zip -d .
```

※ `-o` は同名ファイルを上書きします。Gitで運用中なら ZIP の直接上書きではなく、提供した `.patch` を確認してから適用する方法もあります。

## 動作確認
- `html/detail.html?id=499&from=search&category=cigarette`：セブンスター画像は `assets/products/6099.webp`。
- 右側「商品情報」でタール・ニコチン量（mg単位）を確認してください。
- 画像が古い表示のままなら、ブラウザで Ctrl+F5 などの強制再読み込みを行ってください。

## DB について
現在使用中の MySQL に `tobacco_details(product_id,brand,tar_mg,nicotine_mg)` が存在し、紙タバコの商品データが登録されていることが前提です。提供された元の `shikodb.sql` には `tobacco_details` の作成・データ挿入は含まれていません（今回の更新では既存DBを変更しません）。
