# 好好吃飯｜三餐紀錄網站

一個可部署到 GitHub Pages 的純前端三餐紀錄網站。支援餐點名稱、價格、照片、備註、餐費統計與用餐提醒。

## 專案檔案

- `index.html`：網站結構
- `style.css`：網站樣式與手機版排版
- `script.js`：餐點紀錄、照片儲存、統計與提醒功能

## 在 GitHub 建立網站

1. 登入 [GitHub](https://github.com/)。
2. 建立新的 **Public** repository，例如 `meal-tracker`。
3. 將這三個檔案（`index.html`、`style.css`、`script.js`）以及 README 上傳到 repository 根目錄。
4. 開啟 repository 的 **Settings → Pages**。
5. 在 **Build and deployment** 中選擇 **Deploy from a branch**。
6. Branch 選 `main`，資料夾選 `/(root)`，按 **Save**。
7. 等待 GitHub Pages 部署完成，網址通常會是：
   `https://你的GitHub帳號.github.io/meal-tracker/`

## 本機資料保存方式

- 餐點文字、價格、備註與日期存在瀏覽器的 `localStorage`。
- 照片存在瀏覽器的 `IndexedDB`。
- 不需要登入，也不會把資料上傳到 GitHub 或其他伺服器。
- 資料只存在目前使用的瀏覽器與裝置。清除瀏覽器網站資料、改用無痕模式、換裝置或換瀏覽器，都可能看不到原本紀錄。
- 請不要把私人照片或個人資料提交到 GitHub repository。

## 用餐提醒注意事項

- 可設定早餐、午餐、晚餐時間。
- 網站開啟時會定期檢查是否到用餐時間；若該餐尚未記錄，會顯示提醒。
- 可選擇啟用瀏覽器通知，並授予通知權限。
- **GitHub Pages 是靜態網站服務**，本版本沒有背景伺服器或推播服務。關閉網站或瀏覽器後，不保證能準時收到提醒。若需要關閉網站仍能收到通知，之後需加入 PWA 推播或其他後端排程服務。

## 本機測試

直接用瀏覽器開啟 `index.html` 可測試大部分功能。若瀏覽器限制本機檔案的資料庫功能，建議使用 VS Code 的 Live Server，或部署到 GitHub Pages 後測試。

## 目前版本限制

- 此版本是單機本機保存，不會跨裝置同步。
- 本機資料沒有自動雲端備份；重要紀錄請自行保留備份。
- 不含帳號登入、多人共用或雲端資料庫。

## v2 新增功能
- 點心與額外花費：可新增多筆點心紀錄，包含名稱、花費、時間與備註，並可編輯或刪除。
- 每日回顧：可選擇日期，查看當日三餐與點心明細、筆數及總花費。
- 餐費統計已將點心花費納入總額，並獨立顯示點心支出。

更新網站時，將新版 ZIP 解壓縮後的四個檔案上傳到原本 GitHub repository，選擇覆蓋同名檔案並 Commit changes。原有紀錄使用相同的瀏覽器本機儲存名稱，更新程式檔不會主動清除舊資料。
