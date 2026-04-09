# Alembic 資料庫遷移操作指南 (FastAPI + SQLModel)

本專案已成功導入 Alembic，後續所有資料庫結構 (Schema) 的變更請透過 Alembic 進行管理，不再使用 `create_all()`。

## 🚀 每日操作流程 (SOP)

當你修改了 `backend/models.py` 中的資料模型後，請執行以下步驟：

### 1. 自動生成遷移腳本
Alembic 會比對你的 `models.py` 與目前資料庫的差異。
```bash
python3 -m alembic revision --autogenerate -m "描述你的變更 (例如: add_user_age)"
```

### 2. 檢查腳本
產生的檔案位於 `backend/alembic/versions/` 下，請確認 `upgrade()` 與 `downgrade()` 內容是否正確。

### 3. 套用至資料庫
```bash
python3 -m alembic upgrade head
```

---

## 🛠 常用維護指令

### 撤銷 (Rollback)
如果套用後發現有問題，可以回滾到前一個版本：
```bash
python3 -m alembic downgrade -1
```

### 查看狀態
確認目前資料庫版本與歷史：
```bash
# 查看目前的版本號
python3 -m alembic current

# 查看完整的遷移歷史
python3 -m alembic history --verbose
```

---

## ⚠️ 重要注意事項 (SQLite 讀我)

1. **SQLite 限制**：由於 SQLite 原生不支援許多 `ALTER TABLE` 操作（如刪除或修改欄位），本專案已在 `env.py` 中啟用了 `render_as_batch=True`。這讓 Alembic 能透過「建立新表、搬資料、刪舊表」的模式來達成變更。
2. **Git 同步**：請務必將 `alembic/versions/` 下的 `.py` 檔案與 `alembic.ini` 加入 Git 版本控制，以確保所有開發環境的資料庫結構一致。
3. **不要手動改 DB**：請避免使用外部工具 (如 SQLite Browser) 手動修改 schema，否則會導致 Alembic 的版本追蹤出錯。

---

## 🔧 環境設定備註
*   **執行路徑**：請確保在 `backend/` 目錄下執行指令。
*   **指令前綴**：若 `alembic` 指令無效，請統一使用 `python3 -m alembic` 來確保使用虛擬環境內的套件。
