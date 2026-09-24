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

## Part 02 — 基礎戰鬥垂直切片：玩家攻擊、敵人追擊與生命值

- 分支：`feature/bootstrap-threejs-arpg`（基於 Part 01 `85972cc`）
- 完成：
  - 輸入：`InputManager` 新增一次性 action 佇列（`triggerAction` / `consumeAction` / `endFrame`）。`KeyboardActionSource` 把 Space / J 對應到 `attack`（這兩鍵原本未被占用；忽略自動重複，按住不連發）。`AttackButton`（右下角、96px、只在觸控模式顯示）以 Pointer Events 回報 `attack`，事件 `stopPropagation`，與搖桿是不同元素，不會進 world canvas，長按也只觸發一次。`Game.frame` 在 input 階段消費一次攻擊。
  - 玩家攻擊「橫斬」（`PLAYER_ATTACK`）：`Player.tryAttack()` 以邊緣距離選取射程內最近的存活敵人（`combat.findNearestTarget`），轉向目標並只在此處造成一次傷害；沒有目標時照樣揮擊（有斬擊效果）但不造成傷害；攻擊間隔以遊戲時間 dt 計算。
  - 敵人「頁岩潛獵者」（`ENEMY_TYPES.shaleStalker`、`Enemy.js`、暫代模型 `enemyModel.js`）：狀態 idle → chase → attack／dead。進入 `aggroRange` 開始追擊，超過 `leashRange` 或玩家死亡時停止；移動重用 `collision.moveCircle`，碰撞體為石塊＋玩家＋其他存活敵人（`World.collidersFor`），被擊退也走同一條路徑；首次接近有 `firstAttackDelay`，之後每 `attackInterval` 命中一次；死亡後不再移動或攻擊。
  - 生命值：`Health`（玩家、敵人共用）。玩家死亡後無法移動或攻擊，`respawnDelay` 秒後在出生點復活。敵人屍體 `corpseTime` 秒後從 World／scene 移除並釋放 geometry/material，`respawnDelay` 秒後在原出生點重生（`ENEMY_SPAWNS`）。
  - 回饋（全部由程式生成）：揮擊弧光、命中火花、死亡擴散環（`Effects.js`，每個效果結束時釋放 material）；敵人受擊白閃＋擊退、攻擊前撲；玩家受擊紅閃＋HUD 畫面邊緣紅暈；死亡的敵人倒地、變暗、下沉；玩家死亡時倒下並顯示重生倒數。
  - HUD：玩家生命條、目前目標（最近交戰的敵人）名稱與生命條、敵人頭上 billboard 生命條、依輸入模式顯示攻擊鍵（`Space / J` 或攻擊按鈕），觸控按鈕顯示冷卻。
  - 數值集中於 `config.js`：`PLAYER_CONFIG`（maxHealth、hurtFlashTime、respawnDelay）、`PLAYER_ATTACK`、`ENEMY_TYPES`、`ENEMY_SPAWNS`、`FX_CONFIG`。
- 變更檔案：`src/config.js`、`src/core/Game.js`、`src/input/InputManager.js`、`src/input/KeyboardActionSource.js`（新）、`src/game/Player.js`、`src/game/World.js`、`src/game/Enemy.js`（新）、`src/game/enemyModel.js`（新）、`src/game/Health.js`（新）、`src/game/combat.js`（新）、`src/game/Effects.js`（新）、`src/ui/Hud.js`、`src/ui/AttackButton.js`（新）、`src/styles.css`、`tests/combat.test.js`（新）、`tests/inputActions.test.js`（新）、`docs/PROGRESS.md`
- 測試：
  - `npm test`：32 項通過（新增 17 項：Health、最近目標／死亡與射程外排除、只打最近目標且只扣一次、射程外不扣血、30/60/144 FPS 下攻擊間隔一致、敵人追擊並依間隔命中、aggro 外保持 idle、敵人死亡後不動不打、玩家死亡後不動不打且敵人停手、復活、敵人追擊與擊退不穿石塊、按鍵只消費一次、自動重複不觸發、未消費的按壓在幀尾丟棄、action 與 world pointer 互不影響、dispose 移除監聽）。
  - `npm run build` 通過。
  - Playwright + Chromium（SwiftShader，dev server，腳本不入庫）45/45：桌機 1280×720：HUD 顯示 Space / J、揮空不扣血但有斬擊效果、Space 只打最近敵人一次並轉向、目標生命條、按住 J 只攻擊一次、間隔內連按無效、擊殺後屍體不動並在 corpseTime 後從 scene 移除、敵人追擊到近戰距離並扣玩家血（紅暈、HUD 同步）、玩家死亡無法移動／攻擊、敵人回到 idle、重生倒數後復活、追擊中的敵人與鍵盤移動的玩家都不會進入石塊、點擊移動時按攻擊鍵不取消目標、點擊到達與鏡頭跟隨、右鍵忽略。iPhone 13 直向 390×664 與橫向 844×390：攻擊按鈕與搖桿都顯示且不重疊、按鈕不擋 HUD、輕觸按鈕命中且 world pointer 計數不變、長按只攻擊一次、搖桿拖曳不觸發攻擊、按住搖桿時第二指按攻擊可觸發且搖桿維持、放開後歸零、輕觸地面移動且不攻擊。三個 viewport 的 console 均無錯誤。
- 已知問題：
  - 敵人沒有尋路：玩家躲在石塊正後方時，敵人只會沿石塊邊緣滑動，可能卡住。
  - 敵人與角色都是程式幾何暫代素材；沒有攻擊動畫骨架，只有簡單的前撲與傾倒。
  - console 的既有警告：Three.js r186 已移除 `PCFSoftShadowMap`，會自動改用 `PCFShadowMap`（Part 00 的 Renderer 設定，不在本 Part 範圍內）。
  - 敵人碰撞會把玩家當成障礙物，玩家也會被存活敵人擋住；被包圍時需要攻擊開路。
  - 仍未在實體手機上測試。
