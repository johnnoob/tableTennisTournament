# 💻 MacBook 開發環境設定指南
### 桌球賽事戰情室 — 跨平台開發同步

這份文件將引導您如何在 MacBook 上快速建立開發環境，並與目前的 PostgreSQL 雲端資料庫同步。

---

## 1. 系統需求工具
在開始之前，請確保您的 Mac 已安裝以下基礎工具：

*   **Homebrew**: Mac 必備套件管理工具。
*   **Git**: 用於同步代碼。
*   **Node.js**: 建議使用 v18 或以上版本。
*   **Python**: 建議使用 v3.10 或以上版本。

> [!TIP]
> 如果還沒安裝，可以打開終端機輸入：
> ```bash
> # 安裝 Homebrew
> /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
> 
> # 安裝 Node & Python
> brew install node python
> ```

---

## 2. 取得專案代碼
在您想要放置專案的目錄下：
```bash
git clone [您的 GitHub 專案網址]
cd tableTennisTournament
```

---

## 3. 後端環境設定 (Backend)

### 3.1 建立環境變數檔案
由於 `.env` 被 Git 忽略，您需要在 `backend/` 目錄下建立它：

```bash
cd backend
touch .env
```

請使用文字編輯器（如 VS Code 或 `nano .env`）開啟它，並填入以下內容：
> [!IMPORTANT]
> **DATABASE_URL** 必須包含正確的 Neon PostgreSQL 連線資訊。

```dotenv
GOOGLE_CLIENT_ID=879440963789-n0uolm3rtinv25gc6p4kpb47sck3k88s.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=...
SECRET_KEY=precision-arena-secret-key-2024
DATABASE_URL=postgresql://neondb_owner:npg_c5f4XaHepAZn@ep-red-mouse-a1jawjuw.ap-southeast-1.aws.neon.tech/arena_db?sslmode=require
CLOUDINARY_NAME=dk2ijhooi
CLOUDINARY_API_KEY=419647133142784
CLOUDINARY_API_SECRET=...
ENV_STATUS=development
```

### 3.2 安裝依賴
```bash
# 建立虛擬環境
python3 -m venv venv

# 啟動虛擬環境
source venv/bin/activate

# 更新 pip 並安裝套件
pip install --upgrade pip
pip install -r requirements.txt
```

---

## 4. 前端環境設定 (Frontend)
回到專案根目錄安裝 Node 套件：

```bash
cd ..
npm install
```

---

## 5. 啟動開發伺服器
您可以使用專案提供的便利指令一鍵啟動前後端：

```bash
# 在專案根目錄
npm run dev:all
```

或者分別啟動：
*   **後端**: `cd backend && uvicorn main:app --reload`
*   **前端**: `npm run dev`

---

## 6. 常見問題 (Q&A)

**Q: 為什麼連線失敗？**
A: 請檢查 MacBook 是否有網路連線，以及 `.env` 中的 `DATABASE_URL` 是否正確。Neon 資料庫有時候在一段時間沒用後會進入休眠，第一次連線可能會慢幾秒。

**Q: 需要在 Mac 安裝 PostgreSQL 軟體嗎？**
A: **不需要**。我們目前的資料庫是掛在雲端 (Neon) 的，專案會透過網路直接連線，不需要在地端跑資料庫服務。

**Q: 如何執行資料庫遷移？**
A: 除非您修改了 `models.py`，否則在 Mac 上不需要執行遷移。若需執行，請在啟動 venv 後使用 `alembic upgrade head`。
