# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

原創 2.5D Web ARPG（打寶、裝備構築、技能寶石、裝備孔洞與連線），目標平台為桌機與手機瀏覽器。

## 指令
- `npm install` — 安裝依賴（Node >= 20.19）
- `npm run dev` — Vite 開發伺服器（`host: true`，同網段手機可連線）
- `npm run build` / `npm run preview` — 建置 `dist/` 並預覽（GitHub Pages，`base: './'`）
- `npm run build:cloudflare` / `npm run preview:cloudflare` — Cloudflare Pages 建置（`--mode cloudflare`，`base: '/'`）；base 只由 `vite.config.js` 的 `DEPLOY_BASES` 依 mode 決定
- `npm test` — Node 內建 test runner，執行 `tests/**/*.test.js`；單一檔案：`node --test tests/moveAxis.test.js`
- 部署：push 到 `main` 觸發 `.github/workflows/deploy-pages.yml`，測試＋建置後發布到 GitHub Pages（https://lucypigr.github.io/claude-for-poe/）。
- 分支預覽：Cloudflare Pages GitHub App（production branch `main`），設定與網址規則見 `docs/DEPLOYMENT.md`。
- 開發模式下 `window.__game` 提供除錯用的 `game` 與 `debug` 物件（僅 DEV）。

## 架構
- `src/core/Game.js`：組合根與**唯一**遊戲迴圈（`renderer.setAnimationLoop`）。每幀順序：input → world update → camera → render。
- `src/input/`：`InputManager` 是唯一的輸入擁有者。各 move source（鍵盤、觸控搖桿）只回報螢幕空間 axis（長度 ≤ 1），由 `InputManager.getMoveAxis()` 合併；world action 只接受 target 為 world canvas 的 pointer 事件（`onWorldPointer`）。鍵盤與觸控的離散動作（攻擊、開關背包等）一律經 `triggerAction()` 進入 InputManager action queue，由遊戲迴圈 `consumeAction()` 處理；UI 與各 gameplay object 不得另建平行的 action handler。模態 UI（如背包）以 `setWorldBlocked()` 在 InputManager 封鎖 world input（移動、world pointer、非 `uiActions` 動作），不逐一修改 gameplay object。
- `src/render/`：`Renderer`（唯一的 WebGLRenderer）與 `CameraRig`（固定斜上方視角，只跟隨不旋轉；`screenAxisToWorld` 把螢幕方向轉成世界 X/Z）。
- `src/game/`：`World`（場景、環境、實體、靜態碰撞物 `colliders`、地面拾取 `pickGround`）與 `Player`。玩家只能經由 `Player.setMoveDirection()`（直接輸入）與 `setMoveTarget()`（點擊移動）操控；非零直接輸入會清除移動目標。輸入裝置不得直接改玩家狀態。碰撞為 X/Z 平面圓形推離（`collision.js`），不引入物理引擎。
- `src/items/`：物品資料層（無 DOM）。`ITEM_DEFINITIONS` 為凍結的共用基礎資料；`ItemInstance` 以唯一 `uid` 識別並只以 `defId` 參照定義，個別狀態放在 `data`。`Inventory` 是唯一的格子背包模型，所有放置／移動都回傳明確驗證結果，失敗不改變狀態；UI 只能透過它改變物品位置。掉落流程：敵人每次死亡 `Enemy.claimLoot()` 只成立一次 → `rollLoot`（`LOOT_TABLES`，可注入 rng）→ `World.groundItems`（地面）→ `ItemPickup` 以 `inventory.addAnywhere()` 收納；掉落不得直接進背包，失敗時留在地面。
- `src/ui/`：HTML/CSS 疊層。`.ui-layer` 預設 `pointer-events: none`，只有 `.ui-interactive` 元素接收輸入且事件不會傳到 world canvas。
- `src/config.js`：可調數值集中於此；系統從設定讀取，不寫死數字。
- 所有模組提供 `dispose()`，移除監聽器並釋放 Three.js geometry/material/renderer；Vite HMR 時呼叫 `game.dispose()`。

## 核心規則
- 技術棧：JavaScript ES Modules、Three.js、Vite、HTML、CSS；長期目標是桌機與手機瀏覽器。
- 固定斜上方鏡頭的 2.5D ARPG：主要移動平面為 X/Z，Y 用於高度、特效與地形。
- 系統模組化、資料驅動；新功能先檢查並重用現有系統，禁止建立平行的第二套系統（第二個 renderer、game loop、輸入管理器等）。
- 技能組核心不變：Active Gem 提供技能；Support Gem 只有在同一裝備、同一連線群組且相容時才生效。裝在同一物品上不等於已連線。相容性必須使用明確規則，不可只依名稱或 tags 推斷。
- 手機 UI 需為可實際觸控的設計，不是縮小的桌機 UI；UI 觸控不得穿透到 world input。
- 每個 Part 限定一個可獨立測試與提交的交付目標。
- 不得直接提交到 main；在功能分支開發，測試通過後才為完成的 Part 建立一個 commit。
- 完成的 Part 推送到功能分支並開 PR 到 `main`，合併後 GitHub Pages 自動更新；除此之外未經使用者允許不得 push。
- 每個完成的網頁版遊戲任務都要 commit 並 push 到使用者指定的功能分支；不得自行 push 或 merge 到 `main`。
- push 後等待該分支 Cloudflare Pages preview deployment 成功（commit 等於 HEAD），實際開啟網址確認可載入，再把網址與部署狀態放進最終回報。部署未成功或無法取得確切網址時明確回報阻礙；禁止猜測或捏造 URL。
- 不複製 POE 原始碼、專有素材、角色、UI、美術、音效或完整文字；使用原創名稱與內容。
- 問題類任務先研究 codebase 再回答；程式碼風格、命名與註解密度與周圍既有程式碼一致。
- 不覆蓋或刪除 repository 內既有的有效指示；修改前先檢查目標內容。
- CLAUDE.md 保持精簡，只存長期架構與重要不變條件；進度與交接記錄在 `docs/PROGRESS.md`。
