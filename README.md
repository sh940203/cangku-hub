# cangku-hub

倉庫工作台。規格見 `docs/`，開發規則見 `CLAUDE.md`。

## 本機開發

```bash
pnpm install
cp .env.example .env.local   # 本機可用 TURSO_DATABASE_URL=file:local.db
pnpm db:migrate              # 套用 db/migrations
pnpm db:check                # 列出資料表，確認連線
pnpm dev
```

Service worker 在 `pnpm dev` 時停用。要測 PWA／離線，用正式建置：

```bash
pnpm build && pnpm start
```

## 資料庫

- schema：`db/schema.ts`；改完執行 `pnpm db:generate` 產生 migration。
- 連線遠端 Turso：在 `.env.local` 填 `TURSO_DATABASE_URL`（`libsql://...`）與 `TURSO_AUTH_TOKEN`，再執行 `pnpm db:migrate`。

## Cloudflare

```bash
pnpm preview   # 以 Workers runtime 在本機跑正式建置（wrangler，port 8787）
pnpm deploy    # 部署到 Cloudflare（需先 `pnpm wrangler login`）
```

正式環境的機密用 `pnpm wrangler secret put TURSO_DATABASE_URL` 等方式設定；本機 preview 讀 `.dev.vars`。

## 技術備註

- Next.js 16（Turbopack）。`cacheComponents` 未開啟。
- Service worker 原始碼在 `app/sw.ts`。`pnpm build` 在 `next build` 之後執行 `scripts/build-sw.mjs`，輸出 `public/sw.js`（不進版控）。
- 樣式 token 在 `app/globals.css`，對應 `docs/design.md`。
