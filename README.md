# 配合手帳

ドラゴンクエストモンスターズ テリーのワンダーランド（指定GBデータ）の配合検索を行う、個人利用向けの静的Webアプリです。

## 起動

```bash
pnpm install
pnpm build
pnpm dev
```

データは `vendor/dqm1-gb-data` をビルド時に読み込み、`src/data/data.json` に正規化します。上流データを更新した場合は `pnpm data:build` を実行してください。

## 収録機能

- モンスター名の部分一致検索、系統フィルター
- 結果モンスターからの配合逆引き
- 血統・相手・配合後＋値からの配合検索
- 必要＋値、結果＋ボーナス、原典優先順の表示
- モンスター／配合のお気に入り（ブラウザのlocalStorage）

公式画像・ロゴ・ゲーム画面は使用していません。データの出典は [ossan-pg/dqm1-gb-data](https://github.com/ossan-pg/dqm1-gb-data) です。
