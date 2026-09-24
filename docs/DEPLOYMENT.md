# 部署

兩個部署目標共用同一份原始碼，只靠 build mode 切換 Vite `base`（`vite.config.js` 的 `DEPLOY_BASES`），不需手動改檔。

| 目標 | 觸發 | Build 指令 | `base` | 輸出 |
| --- | --- | --- | --- | --- |
| GitHub Pages（production） | push 到 `main`（`.github/workflows/deploy-pages.yml`） | `npm run build` | `./`（相對路徑，支援 `/claude-for-poe/` 子路徑） | `dist` |
| Cloudflare Pages（分支預覽） | Cloudflare GitHub App，push 到設定的分支 | `npm run build:cloudflare` | `/`（網域根路徑） | `dist` |

本機檢查：`npm run build:cloudflare && npm run preview:cloudflare`，`dist/index.html` 內的引用應為 `/assets/...`；`npm run build` 則為 `./assets/...`。Node 版本由 `.node-version`（22）指定。

## Cloudflare Pages 一次性設定（使用者在 Dashboard 完成）

使用 Cloudflare GitHub App，不需要 API token；任何秘密都不進 repository，也不貼給 Claude。

1. Cloudflare Dashboard → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**。
2. 選 GitHub，安裝／授權 **Cloudflare Workers and Pages** GitHub App，repository 存取至少包含 `Lucypigr/claude-for-poe`。
3. 選擇 `claude-for-poe` → **Begin setup**：
   - Project name：`claude-for-poe`（若已被使用，Cloudflare 會給不同的 `*.pages.dev` 子網域，以實際顯示為準）
   - Production branch：**`main`**
   - Framework preset：**None**（Vite preset 預設的 `npm run build` 會用 GitHub Pages 的 base）
   - Build command：**`npm run build:cloudflare`**
   - Build output directory：**`dist`**
   - Root directory：留空
4. **Save and Deploy**（第一次建置 `main`）。
5. 專案 → **Settings** → **Build** → **Branch control**：
   - Production branch：`main`，啟用 automatic deployments。
   - Preview branch：**Custom branches**，Include 加入 `feature/bootstrap-threejs-arpg`（之後的功能分支也加在這裡；或改選 All non-production branches）。
6. 對 `feature/bootstrap-threejs-arpg` push 一次（或在 Deployments 對該分支 **Retry deployment**），產生第一個預覽。

## 預覽網址規則

- 每筆 deployment：`https://<commit-hash-前綴>.<project>.pages.dev`，固定指向那次建置。
- 分支 alias：`https://<branch-alias>.<project>.pages.dev`，永遠指向該分支最新成功的 deployment。alias = 分支名稱轉小寫、非英數字元換成 `-`，並截斷至 28 字元。
- `feature/bootstrap-threejs-arpg` 依規則推算為 `https://feature-bootstrap-threejs-ar.claude-for-poe.pages.dev`。**這是推算值，尚未確認**；以 Dashboard 或 GitHub check 顯示的實際網址為準，並更新下方紀錄。

## 確認 deployment 成功

1. Cloudflare Dashboard → 專案 → **Deployments**：該分支最新一筆的 commit hash 等於剛 push 的 HEAD，狀態 **Success**；**View details** 顯示 deployment 網址與 branch alias。
2. GitHub：該 commit 的 **Cloudflare Pages** check 成功，details 內附預覽網址。
3. 開啟 branch alias：首頁 HTTP 200、`/assets/*.js` 與 `/assets/*.css` 為 200、出現遊戲 canvas、console 無錯誤。
4. Claude Code 雲端環境必須能連到 `*.pages.dev`（在環境設定的 Network access 允許此網域）；否則只能回報無法驗證，不得假設成功。

## 已確認的網址

- Cloudflare 專案名稱：尚未建立
- Production（`main`）：尚未確認
- `feature/bootstrap-threejs-arpg` 預覽：尚未確認
