# CLAUDE.md

## 專案狀態
- 目前僅有 `README.md`，尚無程式碼、建置或測試流程。新增後請在此補充指令。

## 核心規則
- 問題類任務：先研究 codebase，再給出詳細回答。
- 實作類任務：完成修改後 commit 並 push。
- 在指定的功能分支開發與 push，不得未經允許推送到其他分支；分支不存在時先在本地建立。
- Push 使用 `git push -u origin <branch>`；僅在網路錯誤時以指數退避（2s、4s、8s、16s）重試最多 4 次。
- Fetch/pull 優先指定分支：`git fetch origin <branch>` / `git pull origin <branch>`。
- 除非使用者明確要求，不要建立 pull request；建立時若有 PR template，依其結構填寫。
- Commit 訊息需清楚描述變更內容。
- 不要覆蓋或刪除 repository 內既有的有效指示；修改前先檢查目標內容。
- 程式碼風格、命名與註解密度應與周圍既有程式碼一致。
