---
paths:
  - "**/*.tsx"
  - "**/*.ts"
  - "**/app.json"
  - "**/app.config.*"
  - "**/eas.json"
---

# 🎨 Expo / frontend — 表面のコーディング規約

> **適用範囲: Expo (expo-router) の React Native アプリ。** Expo でなければ本書は適用外として読み捨てること。
>
> **共通則は [common/coding.md](../common/coding.md)**（整形はツール／型を弱めて緑にしない／
> default export 禁止・barrel 禁止・パスエイリアス／`EXPO_PUBLIC_` の秘密／ネイティブ依存の境界）。
> 本書は**それに従ったうえで**、React Native の表面にだけ効く差分を定める。共通側の再掲はしない。

---

## 0. 到達点の定義（RN のランタイムができること・できないこと）

React Native のランタイムは**ブラウザでも Node でもない。**

DOM は無い。CSS のカスケードも継承もセレクタもメディアクエリも無い。
`document` / `window` / `localStorage` / `alert` は無いか、別物である。
`Buffer` / `crypto` / `Intl` の一部は無いか、プラットフォームごとに挙動が違う。

**最大の事故源は、JSX が Web と同じ形をしていることである。**
同じ見た目のコードが書けてしまうので Web の知識がそのまま通ると錯覚し、
**Web なら表示崩れで済むミスが、ここでは実行時クラッシュや片方のプラットフォームでの無反応になる。**

**本書の役目は、見た目が同じために開いている抜け道を塞ぐことにある。**

---

## 1. 裸の文字列は `<Text>` の中にしか置けない

`<View>` の直下に文字列が現れると、**実行時に例外で落ちる**（`Text strings must be rendered within a <Text> component`）。
Web の React なら何事もなく表示される同じコードが、ここではアプリを落とす。

危険なのは意図して書いた文字列ではなく、**条件式から漏れる文字列**である。

```tsx
//  NG: count が 0 のとき、0 が View の直下に落ちてクラッシュする
<View>{count && <Badge count={count} />}</View>

//  NG: 空文字・スペースも同じく落ちる
<View>{isNew && ' '}</View>

//  OK: 三項で書き、出さない場合は明示的に null
<View>{count > 0 ? <Badge count={count} /> : null}</View>
```

**条件描画は `&&` ではなく三項＋明示的な `null` で書く。**
`&&` の左辺が数値・空文字になりうるかを毎回考えるより、形を固定するほうが安い。

---

## 2. スタイルは CSS ではない

### `StyleSheet.create` に置く

**JSX の中でスタイルオブジェクトのリテラルを毎回作らない。**
レンダのたびに新しい参照が生まれ、`React.memo` された子の再レンダ回避を無条件に壊す。
リストの行コンポーネントでこれをやると、スクロールのたびに全行が再レンダされる。

```tsx
//  NG: 毎レンダで新しいオブジェクト
<View style={{ padding: 16, backgroundColor: '#fff' }} />

//  OK: 定義は外、条件付きは配列で合成
<View style={[styles.card, isActive && styles.cardActive]} />
```

### CSS の常識を持ち込まない

| Web の常識 | React Native では |
| --- | --- |
| スタイルはカスケード・継承する | **しない。**`<Text>` の入れ子で一部の文字スタイルが継承されるだけ |
| `flexDirection` の既定は `row` | **既定は `column`** |
| `position: fixed` がある | **無い。**画面固定は絶対配置＋レイアウト構造で作る |
| `box-shadow` 一つで影が出る | **iOS は `shadowColor`/`shadowOffset`/`shadowOpacity`/`shadowRadius`、Android は `elevation`。両方書かないと片方で影が消える** |
| コンテナの `padding` が中身に効く | `ScrollView` は **`contentContainerStyle`** に書く（`style` に書くと効かない） |
| `text-overflow: ellipsis` | **`numberOfLines` プロパティ**で指定する |
| `gap` / `%` / `vh` が使える | `gap` は使えるが `vh` は無い。画面寸法は `useWindowDimensions` から取る |

**「Web ではこう書く」で手が動いたら、いったん止めて上の表を確認する。**

---

## 3. プラットフォーム分岐は差の大きさで手段を変える

| 差の大きさ | 手段 |
| --- | --- |
| 値が数個違うだけ（余白・フォント・影） | `Platform.select` / `Platform.OS` を式の中で使う |
| **コンポーネントの構造ごと違う／片方だけがネイティブ依存を持つ** | **`Foo.ios.tsx` / `Foo.android.tsx` に分割する**（バンドラが解決する。import 側は `./Foo` のまま） |

**ファイル分割したときは、両ファイルが同一の props 型と同一の export 名を持つこと。**
片方だけ signature が変わる壊れ方は、もう一方のプラットフォームでビルドするまで気づけず、
**最も発見が遅れる欠陥**になる。props 型は共通のファイルに置いて両方から import する。

`Platform.OS === 'web'` の分岐は、**そのプロジェクトが Expo Web を出すと決めている場合だけ**書く。
決まっていないなら書かない（存在しない要件のための分岐は、検証されないまま腐る）。

---

## 4. 画面の縁 — safe area とキーボード

**どちらも任意ではなく、CSS で代替できない。** 見落とすと実機でだけ壊れる。

### safe area

- **`react-native-safe-area-context` を使う**（`useSafeAreaInsets` / 同ライブラリの `SafeAreaView`）
- **`react-native` から import する `SafeAreaView` を使わない。** iOS 専用で、**Android では何もしない**ので、
  片方のプラットフォームでだけノッチやジェスチャバーに潜り込む
- ヘッダやタブを持つ画面で**インセットを二重に足さない**。ナビゲータが既に消費している辺は
  `edges` で除外する（上下に不自然な余白が乗るのはこれが原因）

### キーボード

入力を含む画面は、キーボードで隠れない設計を**最初から入れる**（後付けでレイアウトを組み替えることになる）。

**入力を含む `ScrollView` には `keyboardShouldPersistTaps="handled"` を付ける。**
付けないと、キーボードが出ている間の**1 回目のタップがキーボードを閉じるだけで消費され、ボタンが効かない。**
「たまに押せない」としか報告されず、レビューでも再現しにくい欠陥になる。

---

## 5. アクセシビリティと testID は「発行」するもの

**RN にはセマンティックな要素が無い。** `<Pressable>` も `<View>` も、自分が何であるかを名乗らない。
Web のようにマークアップから自動で決まることは無いので、**明示的に発行する。**

| 対象 | 付けるもの |
| --- | --- |
| 押せるもの全般 | `accessibilityRole`（`button` / `link` / `checkbox` など） |
| アイコンだけで文字を持たない要素 | `accessibilityLabel`（何をするかを書く。「アイコン名」ではない） |
| 無効・選択・展開などの状態 | `accessibilityState`（見た目だけで表現しない） |
| タップ領域が 44pt 未満のもの | `hitSlop`（見た目は変えずに当たり判定だけ広げる） |

さらに、**押せるもの・テストで同定したいものには安定した `testID` を付ける。**
値は**表示文字のコピーではなく機能で命名**する（文言変更でテストが落ちるのを避けるため）。

```tsx
//  NG: 何も名乗らない。読み上げでは無反応、テストからも引けない
<Pressable onPress={onSubmit}><Icon name="check" /></Pressable>

//  OK
<Pressable
  onPress={onSubmit}
  accessibilityRole="button"
  accessibilityLabel="送信する"
  accessibilityState={{ disabled: isSubmitting }}
  testID="submit-button"
  hitSlop={8}
>
  <Icon name="check" />
</Pressable>
```

> ここで発行した属性は a11y／将来の FE テストの同定手段になる。
> **FE テストの書き方葉は当面置かない**（develop は FE テストを起票しない）。

---

## ✅ 返す前チェックリスト

- [ ] `&&` による条件描画が残っていないか（三項＋ `null` になっているか）
- [ ] JSX の中にスタイルオブジェクトのリテラルを書いていないか
- [ ] 影を付けた箇所で iOS 側と Android 側の両方を指定したか
- [ ] `.ios.tsx` / `.android.tsx` に分割した場合、両者の props 型と export 名が一致しているか
- [ ] safe area を `react-native-safe-area-context` から取っているか（`react-native` の `SafeAreaView` を使っていないか）
- [ ] 入力を含む `ScrollView` に `keyboardShouldPersistTaps="handled"` を付けたか
- [ ] 押せるものすべてに `accessibilityRole` と（文字を持たないなら）`accessibilityLabel` があるか
- [ ] 状態を見た目だけでなく `accessibilityState` でも表現したか
- [ ] `testID` が表示文字ではなく機能で命名されているか
