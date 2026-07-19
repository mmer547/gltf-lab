# GLTF Lab

GLB / glTFモデルを確認するための、Z-up対応リアルタイム3Dビューワーです。Web版とWindowsデスクトップ版を同じUIで提供します。

## Features

- `.glb` / `.gltf` のファイル選択とドラッグ＆ドロップ
- Z-up座標系
- 回転、ズーム、パン、カメラリセット
- グリッド、ワイヤーフレーム、自動回転の切り替え
- 露出調整とモデル情報表示
- デスクトップ版では外部 `.bin`・テクスチャ参照に対応
- オフライン動作（デスクトップ版）

## Requirements

- Node.js 22.13以降
- pnpm 11以降
- Windowsインストーラーを作る場合はWindows x64

## Setup

```bash
pnpm install
```

Electronのダウンロードスクリプトが無効化された環境では、依存関係のインストール後にElectronのセットアップを許可してください。

## Web development

```bash
pnpm dev
pnpm build
```

Web版はvinext、Vite、Cloudflare Workers互換の構成です。

## Desktop development

```bash
pnpm desktop:dev
```

別のターミナルでElectronを起動します。

```bash
pnpm exec electron .
```

## Windows installer

```bash
pnpm desktop:package
```

インストーラーは `outputs/desktop/` に生成されます。生成物はGit管理対象外です。

## Project structure

```text
app/                  Shared viewer UI and Three.js scene
desktop/              Electron main, preload and renderer entry points
worker/               Web deployment entry point
build/                Sites/Vite integration
public/               Static assets
desktop.vite.config.ts
vite.config.ts
```

## Coordinate system

ビュー、カメラ、床グリッドはZ-upです。VTKなどからZ-up座標で出力されたモデルは、頂点座標を追加回転せずに表示します。

## Security

Electronでは `contextIsolation` とsandboxを有効にし、Node.js APIをレンダラーへ直接公開していません。ローカルモデルはアプリ内部のループバックサーバーから配信し、選択したファイルと同じフォルダ内だけを参照できます。

## License

No license has been selected yet. All rights are reserved unless a license file is added.
