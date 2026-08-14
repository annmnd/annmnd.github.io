# X投稿生成ツール

## 概要

annmnd のX投稿用テキスト・画像・スケジュールを一括生成するツールです。

現在は手動でXへ予約投稿する運用を想定しています。

---

## フォルダ構成

```
tools/x/

generate_posts.py
config.yaml
archive_list.txt
state.json

x_daily.txt
x_gallery.txt

output/
```

---

## archive_list.txt

Gallery Archive に使用する作品IDを1行ずつ記述します。

例

```
art0001
art0035

# コメント
art0102
```

- 空行は無視されます。
- `#` 以降はコメントとして扱われます。

---

## 実行方法

初回または任意期間を生成する場合

```
python generate_posts.py ^
    --from 2026-07-20 ^
    --to 2026-07-26
```

次週分を生成する場合

```
py generate_posts.py --next-week
```

---

## Dry Run

生成内容のみ確認します。

```
python generate_posts.py ^
    --from 2026-07-20 ^
    --to 2026-07-26 ^
    --dry-run
```

---

## 出力

```
output/

schedule.csv

posts/

YYYYMMDD/

daily.txt
gallery.txt

daily.webp
gallery.webp

manifest.json
generate.log
```

---

## state.json

最後に正常生成した期間を保持します。

```
{
    "version":1,
    "last_from":"2026-07-20",
    "last_to":"2026-07-26",
    "generated_at":"..."
}
```

`--next-week` はこの情報を利用して次週分を生成します。

---

## manifest.json

将来的なPlaywrightによる自動予約投稿用の入力ファイルです。

versionを持たせ、将来の互換性を確保しています。

---

## 運用フロー

1. archive_list.txt を編集
2. generate_posts.py を実行
3. output を確認
4. Xへ画像とテキストを予約投稿
5. 翌週も同様に実行