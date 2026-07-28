import path from "node:path";
import { defineConfig } from "prisma/config";
import dotenv from "dotenv";

dotenv.config();
// ローカル開発では .env.local を優先し、本番DBへ誤って接続・変更しないようにする。
// 本番(Vercel)には .env.local が存在しないため、この行は無視され挙動は変わらない。
dotenv.config({ path: path.join(__dirname, ".env.local"), override: true });

export default defineConfig({
  schema: path.join(__dirname, "prisma", "schema.prisma"),
  datasource: {
    url: process.env.DATABASE_URL ?? "postgresql://localhost:5432/mock",
  },
});
