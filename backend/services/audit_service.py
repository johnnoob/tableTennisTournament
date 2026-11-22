"""
services/audit_service.py

集中式管理員操作稽核日誌（AdminAuditLog）建立與寫入工具。
使用獨立 engine 確保資料表在 Serverless 環境下自動備妥，
寫入則加入呼叫端既有的 DB Session，確保與業務交易原子一致。
"""
import json
from typing import Any
from uuid import UUID
from sqlmodel import Session

from database import engine
from models import AdminAuditLog, User

_audit_table_ready = False


def ensure_audit_table() -> None:
    """確保 AdminAuditLog 資料表存在（使用獨立連線避免干擾請求交易）。"""
    global _audit_table_ready
    if _audit_table_ready:
        return
    AdminAuditLog.__table__.create(bind=engine, checkfirst=True)
    _audit_table_ready = True


def record_admin_audit(
    session: Session,
    actor: User | None,
    category: str,
    action: str,
    summary: str,
    target_type: str | None = None,
    target_id: str | UUID | None = None,
    metadata: dict[str, Any] | None = None,
    commit: bool = False,
) -> AdminAuditLog:
    """新增一筆管理員操作稽核紀錄；commit=True 時會立即提交。"""
    ensure_audit_table()

    meta_str: str | None = None
    if metadata is not None:
        meta_str = json.dumps(metadata, ensure_ascii=False, default=str)

    log = AdminAuditLog(
        actor_id=actor.id if actor else None,
        actor_name=actor.name if actor else "系統管理員",
        category=category,
        action=action,
        target_type=target_type,
        target_id=str(target_id) if target_id is not None else None,
        summary=summary,
        metadata_json=meta_str,
    )
    session.add(log)
    if commit:
        session.commit()
    return log
