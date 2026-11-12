# 嗜好の領域 — 商品画像対応版

HTML / CSS / JavaScript / PHP / MySQL を用いたサイトです。追加した商品画像は `assets/products/` にあります。

## 今回の修正

- `assets/products/` に400商品分の画像を追加（960×960px以内に縮小し、WebP形式に統一）
- `js/detail.js` の `resolveProductImageUrl()` で商品と画像を紐付け
- `css/detail.css` で画像を枠内に収まるよう表示
- `html/detail.html` でCSSとJSのキャッシュ更新
- データベースの変更は不要。ウイスキーと日本酒は既存 `image_path`（画像番号）を使用し、ワインとカクテルは `product_id` から画像番号を補完

## 画像IDと商品IDの対応

| カテゴリ | products.product_id | 画像ファイル名 |
|---|---|---|
| ウイスキー | 1〜100 | 1001.webp〜1100.webp |
| 日本酒 | 101〜200 | 2001.webp〜2100.webp |
| ワイン | 201〜300 | 3001.webp〜3100.webp |
| カクテル | 301〜400 | 4001.webp〜4100.webp |

DBから返される `image_path` に4桁の画像番号が含まれる場合は、その番号を優先して表示します。

## 既存サーバーへの適用

サイト全体を入れ替える必要はありません。差分ZIPに入っている次のファイル・フォルダーを、稼働中のサイトの同じ場所に上書き・追加してください。

- `html/detail.html`
- `js/detail.js`
- `css/detail.css`
- `assets/products/`（新規フォルダー）

例: サイトが `/var/www/html/shikonoryoiki-main` にある場合、そこへ差分ZIPの内容を重ねて配置します。

Apacheでアクセスした場合の画像パス例: `http://<サーバーIP>/shikonoryoiki-main/assets/products/2099.webp`。
詳細ページ例: `http://<サーバーIP>/shikonoryoiki-main/html/detail.html?id=199`。

- ブラウザは必要に応じて `Ctrl + F5` で再読み込みしてください。
- 画像が表示されない場合、`assets/products/2099.webp` にアクセスして画像が開けるかを先に確認してください。
- サイトのフォルダー名が異なる場合はURLをその名前に読み替えてください。
- 現在のDB接続設定はそのまま使ってください。フルZIPには元のPHP・SQLも含まれますが、既存稼働環境のPHP設定やDBを不用意に上書きしないでください。

※ 提供された日本酒画像の一部は、元ファイル名が「生成_日本酒商品画像…」「参考画像_…」となっています。該当商品IDに紐付く画像をそのまま使用しています。
