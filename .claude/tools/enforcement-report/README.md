# enforcement-report

機械チェックの**能力**（張れる層 L1/L2/L3）と**現状**（各チェックがどの層で効いているか・
未強制のギャップ）を検出して Markdown レポートにする harness 同梱ツール。**読み取り専用**
（`--out` 指定時のみレポートを書く）。

- **規約の SSOT**: `../../rules/engineering/conventions/enforcement/`
- 依存: `git`（必須）、`gh`（あれば admin / ブランチ保護を判定。無ければ unknown に劣化）

```bash
bash enforcement-report.sh                    # stdout に出力
bash enforcement-report.sh --out docs/enforcement.md
```

L3（ブランチ保護）はアカウント能力（admin 権限・private の有料プラン）に依存する。張れない場合は
「未設定」と明示し、L1+L2 で留めて手動運用で補うことを促す。終了コード 0（検出は失敗を含みうるが
レポート生成自体は成功扱い）。
