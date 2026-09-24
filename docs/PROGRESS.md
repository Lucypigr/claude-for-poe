# Progress

## Part 00 — Three.js 專案底座與跨平台移動

- 分支：`feature/bootstrap-threejs-arpg`
- 完成：Vite + Three.js 專案；固定斜上方攝影機平滑跟隨；燈光、地面、石塊參考物；低面數 placeholder 角色；鍵盤（WASD／方向鍵）與觸控浮動搖桿共用 `InputManager` → `Player.setMoveDirection()`；視窗尺寸改變與直式手機 FOV 補償；安全區 CSS；各模組 `dispose()`。
- 變更檔案：`package.json`、`package-lock.json`、`.gitignore`、`index.html`、`vite.config.js`、`src/**`、`tests/moveAxis.test.js`、`CLAUDE.md`、`docs/PROGRESS.md`
- 測試：
  - `npm install`、`npm run build`、`npm test`（4 項通過）
  - Playwright + Chromium（SwiftShader）：桌機 1280×720 鍵盤移動，直向與斜向速度皆為 6.0；調整為 800×1000 後 camera aspect/FOV 與 canvas 尺寸正確更新；iPhone 13 模擬觸控拖曳搖桿可移動、放開歸零，操作搖桿時 world pointer 計數為 0，點擊 world 為 1；橫向 844×390 版面正常；console 無錯誤。
- 已知問題：
  - 未在實體手機（iOS Safari／Android Chrome）上測試；安全區只在模擬器中檢查版面，未驗證實際瀏海。
  - 角色為技術 placeholder。
  - build 產出單一 ~550 kB chunk（主要為 Three.js），暫時提高警告門檻。

## 部署 — GitHub Pages

- `.github/workflows/deploy-pages.yml`：push 到 `main`（或手動 workflow_dispatch）時執行 `npm ci`、`npm test`、`npm run build`，將 `dist/` 發布到 GitHub Pages。
- `vite.config.js` 改用 `base: './'`，建置結果可在 `/claude-for-poe/` 子路徑運作。
- 網址：https://lucypigr.github.io/claude-for-poe/（需在 repo Settings → Pages 將 Source 設為 GitHub Actions）。
