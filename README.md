# 物件確認・内見受付・現況管理システム

東京みらい不動産向けの、仲介会社用内見予約窓口および社内用物件現況管理システムです。
Vercel Postgres (Prisma) および Google OAuth を利用して動作します。

## 主な機能

- **社内管理画面 (`/admin`)**: 物件の販売状況や内見状況（スリッパ・看板の有無など）の管理、および仲介会社からの内見予約の確認・承認を行います。
- **仲介会社向け窓口 (`/broker`)**: ログイン不要でリアルタイムの物件確認および内見予約申込が行えます。承認された予約IDで照会すると、鍵情報（キーボックス解除番号など）が自動的に安全に開示されます。

---

## 本番環境（Vercel）のセットアップ

本番環境でシステムを運用するには、以下の設定が必要です。

### 1. データベース (Vercel Postgres)
Vercel のプロジェクト管理画面から Postgres データベースを作成し、プロジェクトにリンクします。自動的に `DATABASE_URL` などの環境変数が追加されます。

初めてデプロイする際、またはスキーマを変更した際は、以下のコマンドを実行して本番用データベースにテーブルを作成してください。
```bash
npx prisma db push
```

### 2. 環境変数の設定
Vercel の `Environment Variables` に以下の変数を設定してください。

| 環境変数名 | 説明 | 例 |
| :--- | :--- | :--- |
| `DATABASE_URL` | Vercel Postgres への接続URL | `postgres://...` (自動設定) |
| `GOOGLE_CLIENT_ID` | Google API Console で発行した OAuth クライアント ID | `xxxxxx.apps.googleusercontent.com` |
| `GOOGLE_CLIENT_SECRET` | Google API Console で発行した クライアント シークレット | `GOCSPX-xxxxxx` |
| `JWT_SECRET` | セッション暗号化用の任意のランダムな文字列 | *(強固な文字列を生成して設定)* |
| `NEXT_PUBLIC_APP_URL` | アプリケーションの本番公開URL | `https://your-app.vercel.app` |

* ※ Google OAuth のリダイレクトURIには `${NEXT_PUBLIC_APP_URL}/api/auth/callback` を登録してください。
* ※ ログインできるGoogleアカウントは、自動的に `@tokyomf.co.jp` ドメインのものに制限されます。

---

## 開発環境の実行

1. 依存関係のインストール
   ```bash
   npm install
   ```

2. ローカル用環境変数の設定
   `.env` ファイルを作成し、必要な変数を定義します。

3. 開発サーバーの起動
   ```bash
   npm run dev
   ```

