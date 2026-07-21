# Laue-Simulator (modified X-ray Laue backscattering simulator)

X線ラウエ背面反射のシミュレーターです。
[中島太郎氏らによるオリジナル版 (MIT License)](https://github.com/taro-nakajima/X-ray_Laue_backscattering_simulator) をフォークし、機能を追加した改変版です。オリジナルの使い方は[こちらのチュートリアル](https://sites.google.com/view/t-nakajima-group/tools/xray_laue_simulator)を参照してください。

## 追加した機能 (ver 1.3+m1)

### 1. Diffraction / Stereographic projection のビュー切り替え
Detector map の上部にタブを追加しました。

- **Diffraction**: 従来通りの検出器マップ(ラウエ斑点)。
- **Stereographic projection**: 現在の条件(Bragg条件・λmin・Qmax・背面反射)で回折が生じる反射の極(検出器側を向く面法線 n = G/|G|)を、入射ビーム軸を視線としてステレオ投影した図。中心 = ビーム軸、右 = +y、上 = +z で、回折斑点と方位が対応します。破線円は χ = 30°, 60°、実線円は χ = 90°(赤道)。指数は最小整数比に約分して表示します(既定では低指数 |h|,|k|,|l| ≤ 3 のみラベル)。

Target reflection を設定すると、投影図上でその極がオレンジの円で強調され、**ビーム軸からの傾き χ と方位角 φ** が表示されます。目的の軸をビームに合わせるための回転量の目安として使えます。

### 2. 回転角の追跡 (Sample rotation)
「原点」( ***u***, ***v*** で定義した方位 = Set orientation 直後の状態 ) からの回転量を表示します。

- **Δx / Δy / Δz**: 各軸ボタンで加えた角度の単純合計。回転は非可換なので操作順序に依存する「目安」です。
- **Net rotation from origin**: 累積回転行列から求めた**厳密な**正味回転(回転角と回転軸)。
- **History**: 押した操作の履歴 (例: `x+1, x+1, y−2`)。実機で同じ回転を再現する際に使えます。
- **Reset rotation** ボタンで原点の方位に戻り、カウンターがリセットされます。

### 3. その他の改善
- **ホバー検査**: Detector map の斑点にカーソルを乗せると、その位置に重なる反射(高調波を含む)の指数・波長・検出器上の位置 (mm) を表示。投影図の極でも同様に指数・χ・φ を表示。
- **Show indices for all spots**: 全斑点に指数ラベルを表示するチェックボックス。
- **Reflection condition / Target reflection の変更で回転がリセットされないように変更**(オリジナルでは方位が u, v に戻っていました)。Set lattice / Set orientation では従来通りリセットされます。
- Sample orientation viewer の WebGL レンダラーを再利用するようにし、再描画のたびにWebGLコンテキストがリークする問題を修正。
- Google Analytics タグ(オリジナル作者のトラッキングID)を削除。

## 公開方法 (GitHub Pages)
リポジトリの Settings → Pages → 「Deploy from a branch」で `main` / `(root)` を選ぶと、
`https://<ユーザー名>.github.io/Laue-Simulator/` で公開されます。

## 注意
- `index_offline.html`(オフライン版)には未対応です(新機能はオンライン版 `index.html` のみ)。
- three.js は CDN (unpkg) から読み込みます。

## License
MIT License。オリジナルの著作権表示 (Copyright (c) 2020 Taro Nakajima) を `LICENSE` に保持しています。
Original: D. Kawana and T. Nakajima (ISSP-NSL, The University of Tokyo).
