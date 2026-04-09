# SQLite → PostgreSQL 遷移完整指南
### 桌球賽事戰情室 — 後端資料庫升級

> **已完成的程式碼修改：**
> - ✅ `backend/database.py` — 已更新為 PostgreSQL 版本
> - ✅ `backend/alembic/env.py` — 已更新為讀取環境變數
> - ✅ `backend/requirements.txt` — 已新增 psycopg2-binary + alembic

---

## Step 0 — 確認你架好了 PostgreSQL

在開始前，你需要一個可連線的 PostgreSQL instance。推薦選項：

| 選項 | 說明 |
|------|------|
| **Docker（最快）** | `docker run -d -e POSTGRES_PASSWORD=yourpassword -p 5432:5432 postgres:16` |
| **本機安裝** | 從 [postgresql.org](https://www.postgresql.org/download/) 下載 Windows 版 |
| **雲端服務** | Supabase (免費層)、Railway、Render 都可以 |

---

## Step 1 — 安裝 PostgreSQL 驅動

> [!IMPORTANT]
> 必須在 **venv 啟動後** 執行這些指令。

```powershell
# 進入 backend 目錄並啟動 venv
cd h:\tableTennisTournament\backend
.\venv\Scripts\activate

# 安裝 PostgreSQL 同步驅動（SQLModel/SQLAlchemy 使用）
pip install psycopg2-binary

# 若 alembic 尚未安裝（requirements.txt 已加入，以防萬一）
pip install alembic
```

**為何選 `psycopg2-binary` 而非 `asyncpg`？**

你目前的 FastAPI 使用 **同步 Session** (`Session` from sqlmodel)，搭配 psycopg2-binary 完全正確。
若未來要升級為 async（`AsyncSession`），才需要改成 asyncpg。

---

## Step 2 — 設定 `.env` 環境變數

在 `backend/.env` 新增以下這行（依你的 PostgreSQL 設定調整）：

```dotenv
# PostgreSQL 連線字串格式：
# postgresql://[使用者]:[密碼]@[主機]:[埠號]/[資料庫名稱]
DATABASE_URL=postgresql://postgres:yourpassword@localhost:5432/arena_db

# 其他既有變數保持不變...
GOOGLE_CLIENT_ID=...
SECRET_KEY=...
```

> [!TIP]
> 先在 PostgreSQL 建立資料庫：
> ```sql
> -- 在 psql 或 pgAdmin 執行
> CREATE DATABASE arena_db;
> ```

---

## Step 3 — 程式碼確認（已自動修改完畢）

### `backend/database.py` — 已修改完畢 ✅

主要變更點：
- 移除 `sqlite_file_name`, `sqlite_url`, `connect_args` (SQLite 専用)
- 改為 `os.getenv("DATABASE_URL")` 讀環境變數
- 新增 `pool_pre_ping=True` 避免 stale connection

### `backend/alembic/env.py` — 已修改完畢 ✅

主要變更點：
- 移除 hardcode 的 `sqlite:///arena.db` 路徑
- 改為讀取 `DATABASE_URL` 環境變數，找不到就拋出清晰錯誤
- 移除 `render_as_batch=True`（PostgreSQL 原生支援 ALTER TABLE，此設定是 SQLite workaround）
- 新增 `compare_type=True` 和 `compare_server_default=True` 讓 autogenerate 更精準

---

## Step 4 — 關鍵決策：舊 Alembic 遷移檔的處理方式

### ❌ 不要做的事
直接對 PostgreSQL 跑原本的 `ca3aee7e1bad_initial_schema.py`。
因為那個檔案的 `upgrade()` 是 **空的 `pass`**（你的 schema 是被 `create_all` 建立的，不是 alembic 管的），直接 upgrade 後 PostgreSQL 會是空庫。

### ✅ 最穩妥的作法：**刪除舊版本，全新生成**

你的舊遷移檔 `upgrade()` 本來就是 `pass`，沒有任何實質的 DDL，刪掉完全沒有任何損失。

---

## Step 5 — Alembic 重置與執行（終端機指令逐步說明）

```powershell
# ===== 確保你在 backend 目錄且 venv 已啟動 =====
cd h:\tableTennisTournament\backend
.\venv\Scripts\activate

# ----- 5.1 刪除舊的 SQLite 遷移版本 -----
Remove-Item .\alembic\versions\ca3aee7e1bad_initial_schema.py

# ----- 5.2 驗證 .env 已正確設定（看到 postgresql:// 開頭就對了）-----
python -c "import os; from dotenv import load_dotenv; load_dotenv(); print(os.getenv('DATABASE_URL'))"

# ----- 5.3 測試 PostgreSQL 連線是否成功 -----
python -c "
from sqlalchemy import create_engine, text
import os; from dotenv import load_dotenv; load_dotenv()
engine = create_engine(os.getenv('DATABASE_URL'))
with engine.connect() as conn:
    print('✅ 連線成功！PostgreSQL 版本：', conn.execute(text('SELECT version()')).scalar())
"

# ----- 5.4 生成全新的 PostgreSQL 初始 revision -----
# autogenerate 會掃描 models.py 中的所有 SQLModel Table，產生完整 DDL
alembic revision --autogenerate -m "initial_schema_postgres"

# ----- 5.5 審查自動生成的遷移檔（重要！）-----
# 打開新生成的 versions/xxxx_initial_schema_postgres.py 確認：
# - UUID 欄位應顯示為 sa.Uuid() 或 sa.UUID() 而非 sa.String()
# - datetime 欄位應顯示為 sa.DateTime(timezone=True)
# - Boolean 欄位應顯示為 sa.Boolean() 而非 sa.Integer()

# ----- 5.6 執行遷移，建立所有資料表 -----
alembic upgrade head

# ----- 5.7 驗證遷移結果 -----
alembic current   # 應該顯示新的 revision ID (head)
```

---

## Step 6 — UUID 欄位的深度說明（你的 models.py）

你的 `models.py` 中所有 `id: UUID = Field(default_factory=uuid4, primary_key=True)` 欄位，在 PostgreSQL 遷移後的行為：

| 層面 | SQLite（舊） | PostgreSQL（新） |
|------|-------------|-----------------|
| 資料庫型態 | `VARCHAR(36)` (字串) | `UUID` (原生二進位) |
| Python 操作 | 完全不變 | 完全不變 |
| 查詢方式 | 不變 | 不變 |

**你不需要修改任何 CRUD 程式碼**，SQLAlchemy 的 UUID 型別處理器會自動在 Python UUID 物件和 PostgreSQL UUID 之間做轉換。

---

## Step 7 — 時區 datetime 的深度說明

你的 `utc_now()` 函式：
```python
def utc_now() -> datetime:
    return datetime.now(timezone.utc)  # 回傳 timezone-aware datetime
```

在 PostgreSQL 遷移後：

| 層面 | SQLite（舊） | PostgreSQL（新） |
|------|-------------|-----------------|
| 資料庫型態 | `DATETIME` (無時區) | `TIMESTAMP WITH TIME ZONE` |
| 儲存值 | 字串 `2026-04-10 12:00:00` | UTC 數值，自動轉換 |
| Python 讀回 | naive datetime（需手動補時區） | aware datetime (UTC) |

> [!TIP]
> PostgreSQL 的 `TIMESTAMP WITH TIME ZONE` 一律以 UTC 儲存，
> 讀回時 SQLAlchemy 會給你 `timezone-aware` 的 datetime 物件，與你現在的 `utc_now()` 完全一致。
> **不需要修改任何現有程式碼。**

---

## Step 8 — CRUD 操作潛在地雷

### 🟡 地雷 1：UUID 字串 vs 物件的輸入

在 API 端點收到 path/query parameter 時，FastAPI 會將字串自動轉為 `UUID` 物件（若你的型別宣告正確）。
但若有任何地方用字串直接 `where(Model.id == "some-uuid-string")`，在 PostgreSQL 可能因型別不符而查不到資料。

**修正方式：**
```python
# ❌ 危寫
session.get(User, "123e4567-e89b-...")

# ✅ 安全（UUID 物件）
from uuid import UUID
session.get(User, UUID("123e4567-e89b-..."))
```

### 🟡 地雷 2：大小寫敏感的表名與欄位名

SQLite 大小寫不敏感，PostgreSQL 預設小寫。SQLModel 會自動將 Python class 名稱轉成小寫表名，通常沒問題，但要確認：

- `User` → 資料表名為 `user`（PostgreSQL 保留字！）
- `Match` → `match`
- `Season` → `season`

> [!WARNING]
> `user` 是 PostgreSQL 保留字。SQLModel 預設會加引號處理，通常沒問題，
> 但若你的原生 SQL 查詢直接寫 `SELECT * FROM user`，在 PostgreSQL 需改為 `SELECT * FROM "user"`。

### 🟡 地雷 3：True/False vs 1/0

SQLite 用整數 0/1 存 boolean，PostgreSQL 用原生 `TRUE`/`FALSE`。
SQLAlchemy/SQLModel 會自動處理，但若有任何地方用 `== 1` 或 `== 0` 判斷 boolean 欄位，需改為 `== True` / `== False`。

### 🟡 地雷 4：`ON CONFLICT` / Upsert 語法

若你的程式碼有用到 SQLite 的 `INSERT OR REPLACE`，PostgreSQL 寫法不同：
```sql
-- PostgreSQL Upsert
INSERT INTO ... VALUES ... ON CONFLICT (id) DO UPDATE SET ...
```
用 SQLAlchemy 的 ORM 方式操作通常不會遇到此問題。

---

## 快速除錯清單

| 錯誤訊息 | 原因 | 解法 |
|----------|------|------|
| `could not connect to server` | PostgreSQL 未啟動或連線字串錯誤 | 確認 Docker/本機 PG 在跑，檢查 `.env` |
| `database "arena_db" does not exist` | 資料庫未建立 | 執行 `CREATE DATABASE arena_db;` |
| `password authentication failed` | 密碼錯誤 | 確認 `.env` 中的密碼 |
| `RuntimeError: DATABASE_URL 環境變數未設定` | `.env` 未載入 | 確認 `.env` 在 `backend/` 目錄下 |
| `Target database is not up to date` | 有遷移未執行 | 執行 `alembic upgrade head` |
