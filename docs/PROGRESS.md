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

## Part 03 — 物品實例與 12×5 格子背包

- 分支：`feature/bootstrap-threejs-arpg`（基於 Part 02 `d385160`）
- 完成：
  - 資料層 `src/items/`（無 DOM，可在 Node 測試）：
    - `ITEM_DEFINITIONS`（深度凍結）：`id`、`name`、`category`、`rarity`（基礎稀有度）、`width`／`height`（格數）、`icon`（字形＋色調的程式化暫代外觀）。原創範例：1×1 銅紋指環／河石墜飾、2×1 獸皮束帶、1×3 缺口短劍、2×2 鉚釘盔／木板圓盾、2×3 縫綴背心。
    - `ItemInstance`：`{ uid, defId, gridX, gridY, data }`。`uid` 由 `crypto.getRandomValues` 產生（區網 http 開發伺服器也能用），尺寸與外觀只從定義讀取；`data` 為深拷貝的 JSON 資料，保留給稀有度覆寫、詞綴、孔洞／連線等後續系統；不在格子內時 `gridX/gridY` 為 `null`（供之後的地面掉落與裝備槽使用）。
    - `Inventory`（`INVENTORY_CONFIG` 12×5）：`cells` 陣列記錄每格的 uid。`checkPlacement`／`canPlace` 檢查整數座標、邊界與佔位衝突（回傳 `blockers`）；`add`、`addAnywhere`（直欄優先找空位，供之後拾取）、`move`（可與自己舊位置重疊，不交換）、`remove` 都回傳 `{ ok, reason, ... }`，失敗時背包與物品完全不變。`serialize()` 產生含 `version`、uid、位置、尺寸與 data 的 JSON；`restore()` 先在暫存背包驗證整份快照（未知定義、尺寸不符、重疊、重複 uid、越界都拒絕），成功才替換。未新增 SaveSystem。
    - `fixtures.js`：明確標示的**測試 fixture**，`main.js` 啟動時放入 8 件範例物品（`data.fixture = true`），只為了在尚無掉落時操作 UI，不是掉落來源。
  - 輸入：`InputManager` 新增 `uiActions` 與 `setWorldBlocked(key, blocked)`／`isWorldBlocked()`。封鎖時 move axis 回傳 0、world pointer 丟棄、非 UI 動作的 `triggerAction` 忽略且開啟當下已排隊的攻擊被清除；`toggleInventory`／`closeInventory` 照常通過。`KeyboardActionSource` 綁定 `I` → `toggleInventory`、`Esc` → `closeInventory`；觸控按鈕同樣只呼叫 `triggerAction`，由 `Game.frame` 消費後 `setInventoryOpen()`。
  - UI（`InventoryButton`、`InventoryPanel`，HTML/CSS overlay）：右上 56px 背包按鈕（所有裝置顯示）；面板置中，格子大小依視窗寬高自動計算（桌機 52px、iPhone 直向 29px、橫向 48px）；每件物品是一張以百分比定位、跨越整個 footprint 的卡片；拖曳時顯示跟隨指標的 ghost 與綠色／紅色 footprint 預覽，放開後呼叫 `inventory.move()`，失敗時顯示「超出背包範圍／位置已被其他物品佔用」並留在原位（畫面一律依 model 重繪）；另有點選→點空格放置（觸控與滑鼠皆可），再點一次取消選取；滑鼠 hover 顯示名稱、類別、尺寸 tooltip；觸控時選取資訊顯示在底部。背包開啟時隱藏搖桿與攻擊按鈕；格子 `touch-action: none`、面板 `overscroll-behavior: contain`，並取消 contextmenu。關閉按鈕 44px。
  - HUD 提示加入背包操作。
- 變更檔案：`src/items/itemDefinitions.js`（新）、`src/items/ItemInstance.js`（新）、`src/items/Inventory.js`（新）、`src/items/fixtures.js`（新）、`src/ui/InventoryPanel.js`（新）、`src/ui/InventoryButton.js`（新）、`src/input/InputManager.js`、`src/core/Game.js`、`src/config.js`、`src/main.js`、`src/ui/Hud.js`、`src/styles.css`、`tests/inventory.test.js`（新）、`tests/inputActions.test.js`、`CLAUDE.md`（補上 action queue／world 封鎖輸入規則與 `src/items/` 架構）、`docs/PROGRESS.md`
- 測試：
  - `npm test`：47 項通過（新增 15 項：60 格空背包、定義凍結且含 1×1/2×2/2×3、uid 唯一且 instance data 不共用、1×1 與多格合法放置並佔滿 footprint、越界／非整數／重疊放置失敗且不改變狀態、重複 uid／未知定義、無效移動後位置與 cells 不變且不發 change、合法移動釋放舊格佔用新格、同定義不同 instance 分別移動、addAnywhere 與背包已滿、remove 保留 uid/data、JSON 序列化還原保留 uid/位置/尺寸/data、壞快照被拒且原內容保留、fixture 標記；InputManager 封鎖時移動歸零、world pointer 與攻擊被丟棄、UI 動作通過、解除後恢復）。
  - `npm run build` 通過。
  - Playwright + Chromium（dev server，腳本不入庫）42/42：桌機 1280×720：初始關閉、I 開啟並封鎖、60 格＋8 張卡片、2×3 卡片尺寸正確、hover tooltip、滑鼠拖曳有效預覽＋ghost 並移到 (8,1)、拖到其他物品上紅色預覽且兩件都不動並顯示訊息、拖出邊界無效、佔用格數一致、點選＋點格只移動該 instance、開啟時 Space 不攻擊／D 不移動／點 world 不計數、Esc 關閉後攻擊恢復、背包按鈕與關閉按鈕都不進入 world、關閉再開位置保留。iPhone 13 直向 390×664：按鈕 ≥44px 且不與 HUD 重疊、輕觸開啟、搖桿與攻擊按鈕隱藏、面板在視窗內、觸控拖曳有效（移動）與無效（留原位）、輕觸選取＋輕觸放置、越界與重疊的輕觸放置被拒、再輕觸取消選取、背包操作與輕觸 world／原搖桿與攻擊區域都不產生 world pointer、攻擊或移動；旋轉為 844×390 後面板完整、格子正方、位置正確且可觸控拖曳；轉回直向正常；關閉後控制項恢復且攻擊可用。兩個 context 的 console 均無錯誤。
- 已知問題：
  - iPhone 直向每格約 29px，小於 44px 建議觸控尺寸（12 欄受螢幕寬度限制）；以拖曳預覽與點選放置補償，橫向為 48px。
  - 不支援物品互換（拖到其他物品上一律失敗）與旋轉。
  - 背包開啟時遊戲不暫停：敵人仍會移動與攻擊，已設定的點擊移動目標會繼續走完。
  - 範例物品來自測試 fixture，每次重新整理都會重新產生（沒有持久化）。
  - 仍未在實體手機上測試。

## Part 04 — 敵人掉落、地面物品與格子背包拾取

- 分支：`feature/bootstrap-threejs-arpg`（基於 Part 03 `462fe30`）
- 完成：
  - 掉落規則（`config.js`）：`LOOT_TABLES.shaleStalker` — `dropChance` 0.7、每次掉落 `minDrops`–`maxDrops` = 1–2 件（均勻）、7 種現有原創裝備依權重抽選（指環 14、束帶 12、墜飾 10、短劍 10、鉚釘盔 9、圓盾 9、背心 6）。`ENEMY_TYPES.*.lootTable` 指向表格。新增 `GROUND_ITEM_CONFIG`（拾取半徑 0.9、提示半徑 3.5、散落半徑、間距、標籤上限 12 等）與 `RARITY_COLORS`。
  - `src/items/loot.js`：`rollLoot(table, rng)` 純函式，rng 可注入（抽取順序：機率 → 數量 → 每件權重）；每件以 `createItemInstance(def)` 產生獨立 uid，不修改共用定義；未知 defId 直接丟錯。
  - 死亡只掉落一次：`Enemy.claimLoot()` 在死亡後第一次呼叫回傳 true，之後（倒地動畫、屍體計時、移除）都回傳 false；`World.update` 在 `updateSpawns` 之前呼叫，所以屍體移除的同一幀也不會漏掉或重複。重生是新的 `Enemy`，有自己的一次掉落。
  - 地面物品 `src/game/GroundItems.js`（無 DOM、無 Inventory）：每個 entry 保存 ItemInstance（以 uid 識別）。程式生成外觀：依 footprint 大小與定義色調的平板、稀有度顏色地面環與細光柱、從屍體拋出的短動畫；靠近時環與光柱變亮。落點用 `nearestFreePoint` 避開石塊（留出玩家可站的空間）並盡量彼此保持間距。幾何共用，每件的 material 在移除時釋放。
  - 拾取 `src/game/ItemPickup.js`：玩家（存活）進入拾取半徑即由近到遠呼叫 `inventory.addAnywhere()`；成功後才從地面移除，ItemInstance 物件、uid、data 不變。失敗（背包滿或沒有符合 footprint 的空位）時地面與背包都不變，只回報一次 `blocked`；在背包內容改變或玩家離開再回來之前不重試。背包開啟（`InputManager.isWorldBlocked()`）時暫停拾取，關閉後才繼續。
  - 標籤 `src/ui/GroundItemLabels.js`：HTML overlay，最先建立所以在所有 UI 之下，容器與標籤皆 `pointer-events: none`（點擊／輕觸直接落到 world canvas，可點擊移動）。固定大小的元素池（最多 12 個），只給離玩家最近的物品；同一物品沿用同一元素，文字變更時才量測寬度；重疊時以較近物品優先、往上（超出畫面則往下）堆疊並限制在視窗內；只在位置／狀態改變時寫 DOM。
  - HUD：新增不攔截輸入的短提示（`拾取：X`／`背包空間不足，X 留在地上`），計時器於 dispose 清除；操作提示加入「走近物品拾取」。
  - 樣本物品：`main.js` 不再於啟動時填包，正式遊戲背包從空的開始。`fixtures.js` 保留給測試，並只在 DEV 以 `window.__game.debug.seedFixture()` 明確呼叫；fixture 仍標記 `data.fixture = true`，與掉落無關。
- 變更檔案：`src/config.js`、`src/items/loot.js`（新）、`src/game/GroundItems.js`（新）、`src/game/ItemPickup.js`（新）、`src/ui/GroundItemLabels.js`（新）、`src/game/Enemy.js`、`src/game/World.js`、`src/core/Game.js`、`src/ui/Hud.js`、`src/styles.css`、`src/main.js`、`src/items/fixtures.js`、`tests/loot.test.js`（新）、`CLAUDE.md`（一行掉落流程不變條件）、`docs/PROGRESS.md`
- 測試：
  - `npm test`：61 項通過（新增 14 項：掉落表都指向現有定義；固定 RNG 下掉落／不掉落、數量與權重邊界；150 件掉落 uid 唯一、data 不共用、定義不變；`claimLoot` 只成立一次；World 擊殺後物品在屍體附近的地面而不在背包；不掉落結果地面為空；屍體計時、移除與重生不重複掉落，重生後的敵人另有一次；多件掉落避開石塊且互相保持間距；拾取半徑外保留、進入後以合法格子加入且 uid/data/佔格正確、地面模型移除且 material 釋放；背包滿時留在地面且背包序列化不變、提示不重複、離開再進入再提示、空出格子後拾取；有空格但放不下 2×3 時保留、1×1 仍可拾取；多件依距離各拾取一次；world 封鎖或玩家死亡時暫停；移除與 dispose 釋放資源）。
  - `npm run build` 通過。
  - Playwright + Chromium（dev server，腳本不入庫）48/48：桌機 1280×720：啟動背包為空；D 鍵移動；Space／J 擊殺；固定 rng 掉落 2 件在地面、不進背包、兩個名稱標籤不重疊且 pointer-events none；等待屍體移除後仍為 2 件；標籤位置的 elementFromPoint 為 canvas、點標籤會觸發 world pointer；點擊物品地面位置走過去自動拾取、標籤消失、提示「拾取：…」、背包面板以 uid 顯示；背包塞滿後走到物品上：提示背包空間不足、物品留在地上、背包序列化不變；開背包空出 (11,4) 時仍不拾取、點 world 被封鎖；關閉後放入 (11,4)；20 件地面物品只有 ≤12 個標籤元素且不重疊，移動時元素數維持上限；每隻敵人的掉落流程最多執行一次。iPhone 13 直向 390×664：啟動背包為空；攻擊按鈕擊殺；CDP 觸控拖曳搖桿走向物品後拾取；在攻擊按鈕、搖桿、背包按鈕下方放置標籤時控制項仍在最上層，輕觸攻擊有效且不產生 world pointer；背包滿時提示在視窗內、不與控制項重疊且 pointer-events none；標籤在視窗內；開背包後輕觸不進 world。橫向 844×390：標籤在視窗內、攻擊按鈕可點、輕觸標籤可點擊移動。三個 viewport 的 console 均無錯誤；截圖目視確認標籤可讀。
- 已知問題：
  - 同一處堆很多物品時，往上堆疊的標籤可能落在左上 HUD 底下（被 HUD 遮住，但不攔截 HUD 或控制項）；只顯示最近 12 個標籤。
  - 只做走近自動拾取，沒有點標籤拾取或拾取過濾；背包滿時物品無限期留在地上，也沒有地面物品上限或清除機制。
  - 掉落只使用定義的基礎稀有度（目前皆為 normal），沒有稀有度擲骰或詞綴。
  - 背包開啟時遊戲仍在模擬，只有拾取暫停；地面物品與背包都沒有持久化，重新整理後消失。
  - 仍未在實體手機上測試。

## Part 05 — Cloudflare Pages 分支預覽部署

- 分支：`feature/bootstrap-threejs-arpg`（基於 Part 04 `de31979`）
- 完成：
  - `vite.config.js` 改為依 build mode 取 `DEPLOY_BASES`：預設（`npm run build`，GitHub Pages）維持 `./`；`npm run build:cloudflare`（`--mode cloudflare`）為 `/`。另加 `preview:cloudflare`。`.github/workflows/deploy-pages.yml` 未修改。
  - `.node-version`（22）供 Cloudflare 建置環境使用。
  - `docs/DEPLOYMENT.md`：兩個部署目標、Cloudflare Dashboard 一次性設定、branch alias 規則、確認部署成功的方法、已確認網址紀錄（目前皆未確認）。
  - `CLAUDE.md`：build 指令、預覽部署指向文件，以及「push 到功能分支 → 等待預覽部署成功並驗證 → 回報網址；禁止捏造 URL、不得 push/merge main」規則。
- 變更檔案：`vite.config.js`、`package.json`、`.node-version`（新）、`tests/buildConfig.test.js`（新）、`docs/DEPLOYMENT.md`（新）、`CLAUDE.md`、`docs/PROGRESS.md`
- 測試：
  - `npm test`：64 項通過（新增 3 項：預設 mode base `./`、cloudflare mode base `/`、未知 mode 回到 `./`）。
  - `npm run build`：輸出與修改前逐位元相同（`diff -r`），引用 `./assets/...`。
  - `npm run build:cloudflare`：輸出 `dist/`，引用 `/assets/...`。
  - Playwright + Chromium（靜態伺服器，腳本不入庫）：GitHub Pages build 放在 `/claude-for-poe/` 子路徑、Cloudflare build 放在根路徑，兩者 JS/CSS 皆 200、canvas 出現、console 無錯誤、畫面正常。
- 已知問題：
  - Cloudflare Pages 專案尚未建立（需使用者在 Dashboard 完成 GitHub App 授權），因此沒有線上 preview deployment，預覽網址尚未確認。
  - 本雲端環境的網路政策擋住 `*.pages.dev` 與 `developers.cloudflare.com`；要讓 Claude 驗證預覽網址，需在環境 Network access 允許 `*.pages.dev`。
