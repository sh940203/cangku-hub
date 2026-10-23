# CLAUDE.md

倉庫工作台：手機優先的 PWA，管庫存（含拆賣組合）、儲位、出貨核對、上架、任務。

開始任何工作前先讀：
1. `docs/handoff.md`：交接、里程碑、尚未確認的事
2. `docs/系統結構規劃.md`：資料模型（第 4 節）、流程、路由、專案結構
3. `docs/design.md`：色彩、字型、版型、元件、文字規範

## 不可更動的原則

- **不呼叫任何電商平台 API**（蝦皮、露天、奇摩拍賣、酷澎）。資料進出只靠 Excel。
- **不自動回寫平台。** 只產生批次檔，由使用者手動上傳；按「已上傳」後才更新 `last_pushed_stock`。
- **不存顧客個資。** Excel 在瀏覽器端解析，經 `lib/pii.ts` 過濾後才送出。伺服器不得收到姓名、電話、地址、Email、收件人。
- **庫存變動一律寫入 `stock_movements`。** `skus.stock` 只是快取，必須能由異動紀錄重算。不得直接改 `stock` 而不寫異動。
- 組合商品不持有庫存；可售量 = 各部件 `floor(庫存 / qty)` 的最小值，即時計算不儲存。賣出組合扣的是部件。
- Anthropic API 只在伺服器端呼叫，模型名稱讀 `CLAUDE_MODEL`。
- 介面文字一律繁體中文。

## 技術棧

Next.js App Router + TypeScript、Turso（LibSQL）+ Drizzle、Cloudflare（`@opennextjs/cloudflare`）、R2、Tailwind、Serwist（`@serwist/next`）、SheetJS（官方 CDN 安裝，不用 npm 的 `xlsx`）。驗證由 Cloudflare Access 處理，不自寫登入。

## 開發慣例

- **一次只做一個里程碑**，完成後停下來讓使用者驗收，不自行進入下一個。
- 小步提交，一個 commit 只做一件事。註解與 commit 訊息可用英文。
- **改 schema 前先說明理由並詢問。**
- **新增文件沒提到的大型依賴前先詢問。**
- 平台差異只能出現在 `lib/platforms/<platform>/`；其他地方不寫 `if (platform === 'shopee')`。
- 平台 Excel 欄位名稱尚未確認：在 `columns.ts` 以 `TODO` 標註，**不要猜**，遇到就停下來問。範本放 `samples/`（gitignore，可能含個資）。
- 庫存計算、訂單匯入、個資過濾三塊必須有測試。
- 樣式：色彩、字級用 CSS 變數掛 Tailwind 主題，不在元件寫死色碼。儲位一律用 `<LocationTag>`。
- 每個步驟要能在一次短時段內獨立完成、獨立驗收。
