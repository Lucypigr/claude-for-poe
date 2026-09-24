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

## Part 01 — 點擊／輕觸地面移動與障礙碰撞

- 分支：`feature/bootstrap-threejs-arpg`
- 完成：
  - 地面拾取：`InputManager.onWorldPointer` → `Game.onWorldPointer`（只接受主鍵／觸控）→ `World.pickGround()` 以 `THREE.Raycaster` 對地面 mesh 取 X/Z → `Player.setMoveTarget()`。UI／搖桿事件不會進入 world canvas，因此不會設定目標。
  - 移動目標：`moveTarget.js` 的 `steerToTarget()` 產生與直接輸入同型的方向（長度 ≤ 1），在 `slowRadius` 內減速、`stopDistance` 內判定到達並清除目標、速度歸零，不抖動。
  - 優先權：`Player.setMoveDirection()` 收到非零方向即清除目標，放開後不會回頭追舊目標。
  - 碰撞：`collision.js` 以圓形推離處理靜態石塊（`World.colliders`，半徑＝石塊尺寸 × `rockColliderScale`），保留切線分量可沿邊滑動；大步長分段避免穿透；點在石塊內的目標移到最近可站位置；正面卡住超過 `stuckTimeout` 放棄目標。
  - 設定集中於 `PLAYER_CONFIG`（`radius`、`stopDistance`、`slowRadius`、`stuckTimeout`、`stuckProgressRatio`）與 `WORLD_CONFIG.rockColliderScale`；HUD 提示加入點擊／輕觸移動。
- 變更檔案：`src/core/Game.js`、`src/game/Player.js`、`src/game/World.js`、`src/game/collision.js`（新）、`src/game/moveTarget.js`（新）、`src/config.js`、`src/ui/Hud.js`、`tests/clickMove.test.js`（新）、`tests/collision.test.js`（新）、`CLAUDE.md`、`docs/PROGRESS.md`
- 測試：
  - `npm test`：15 項通過（新增 11 項：steering、到達停止不漂移、直接輸入中斷、推離、防穿透、滑動、邊界、目標推出石塊、正面卡住放棄、繞石到達）。
  - `npm run build` 通過。
  - Playwright + Chromium（dev server，腳本不入庫）20/20：桌機 1280×720 點擊地面到達（誤差 0.027）且停止後無漂移、鏡頭跟隨、右鍵忽略、鍵盤中斷點擊移動且放開後不追舊目標、D 鍵方向為螢幕右、斜向速度 6.0、正面點穿石塊不穿透並放棄目標、斜向目標沿石塊滑動到達、鍵盤四向撞石不穿透、點石塊內的目標被推出；iPhone 13 模擬輕觸地面到達、輕觸搖桿區不設目標且 world pointer 計數不變、拖曳搖桿清除目標、放開不追舊目標；兩者 console 無錯誤。
- 已知問題：
  - 無尋路：目標正後方被石塊擋住時會放棄而非繞行（只在斜向可滑動時繞過）。
  - 目前只處理 pointerdown，按住拖曳不會持續更新目標。
  - 碰撞體為近似圓形，與低面數石塊外形有少量誤差。
  - 仍未在實體手機上測試。
