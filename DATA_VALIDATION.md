# 配合データ検証メモ

## 結論

指定リポジトリの数値列を再解析し、配合表は **825件（No.0〜824）** を取り込みました。元の固定幅名寄せで欠落していた No.202、204、532 を復元し、M1/M2 の `F0〜F9` を系統参照として正規化しています。

通常プレイ対象のモンスターは 215種です。原典末尾の D7〜DC（6件）は内部・特殊データとして通常検索から除外し、JSONには `status: "special"` として保持しました。

## 機械検査

- モンスター: 221件（playable 215 / special 6）
- 配合: 825件（UI表示は完全重複の No.802/803 を1件に集約）
- 配合No: 0〜824、欠番なし
- M1/M2/MH の未解決ID: 0件
- M2の系統参照: 102件（`F0〜F9`）
- 完全重複: `F7 × 1B → 9C`（No.802/803）
- PP: 0〜5、P+: 0〜2

## 外部照合

任天堂・スクウェア・エニックス公式の説明から、RETRO版はGB版をほぼ再現した移植であることを確認しました。個別の配合式は、GB/RETRO対応を明記する攻略表と、GameFAQsのGBC配合表、XGameManiaの一覧を突合し、主要な配合構造が一致することを確認しています。必要+値（PP）と結果+（P+）は指定リポジトリの解析値を正本として保持しています。

### 参照先

- [任天堂公式](https://www.nintendo.com/jp/topics/article/1e53ea46-cdf8-11e9-b641-063b7ac45a6d)
- [スクウェア・エニックス公式](https://www.dragonquest.jp/news/detail/3075/)
- [じっぺ（GB/RETRO対応）](https://jippe-game.com/terryretro/haigou-list/)
- [Re:Gamers（GB/RETRO 215種）](https://regamers.net/2022/03/07/dqm%E3%83%86%E3%83%AA%E3%83%BC%E3%81%AE%E3%83%AF%E3%83%B3%E3%83%80%E3%83%BC%E3%83%A9%E3%83%B3%E3%83%89%E3%80%8E%E5%85%A8%E3%83%A2%E3%83%B3%E3%82%B9%E3%82%BF%E3%83%BC-%E7%B3%BB%E7%B5%B1%E5%88%A5/)
- [GameFAQs GBC配合表](https://gamefaqs.gamespot.com/switch/273389-dragon-quest-monsters-terrys-wonderland-retro/faqs/6817)
- [XGameMania 配合一覧](https://xgamemania.com/dq/monsters_gb/mix/11.html)

攻略サイトはコミュニティ資料のため、公式による個別配合の保証ではありません。通信お見合い・通信対戦はRETRO版に搭載されないため、本データの通常配合検索には含めていません。
