import json
import os
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, List, Optional

import jwt
from fastapi import Depends, FastAPI, HTTPException, Query, Response, status
from fastapi.security import OAuth2PasswordBearer
from motor.motor_asyncio import AsyncIOMotorClient
from passlib.context import CryptContext
from pydantic import BaseModel, EmailStr, Field

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

MONGO_URL = os.getenv("MONGO_URL", "mongodb://localhost:27017/qdms_phase1")
DB_NAME = os.getenv("DB_NAME", "qdms_phase1")
JWT_SECRET = os.getenv("JWT_SECRET", "change-me-secret")
JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "15"))
REFRESH_TOKEN_EXPIRE_DAYS = int(os.getenv("REFRESH_TOKEN_EXPIRE_DAYS", "7"))

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

app = FastAPI(title="QDMS Identity Service", version="0.1.0")


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------


class DepartmentBase(BaseModel):
    code: str = Field(min_length=2, max_length=50)
    name: str = Field(min_length=2, max_length=150)
    description: Optional[str] = Field(default=None, max_length=500)
    parent_id: Optional[str] = None


class DepartmentOut(DepartmentBase):
    id: str


class RoleBase(BaseModel):
    name: str = Field(min_length=2, max_length=50)
    display_name: str = Field(min_length=2, max_length=150)
    description: Optional[str] = Field(default=None, max_length=500)
    permissions: List[str] = Field(default_factory=list)


class RoleOut(RoleBase):
    id: str
    is_system: bool = False


class UserBase(BaseModel):
    username: str = Field(min_length=3, max_length=50)
    email: EmailStr
    first_name: str = Field(min_length=1, max_length=100)
    last_name: str = Field(min_length=1, max_length=100)
    department_id: Optional[str] = None
    position: Optional[str] = None
    groups: List[str] = Field(default_factory=list)
    roles: List[str] = Field(default_factory=list)
    status: str = Field(default="active", pattern="^(active|disabled|locked)$")


class UserCreate(UserBase):
    password: str = Field(min_length=8, max_length=128)


class UserUpdate(BaseModel):
    email: Optional[EmailStr] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    department_id: Optional[str] = None
    position: Optional[str] = None
    groups: Optional[List[str]] = None
    roles: Optional[List[str]] = None
    status: Optional[str] = Field(default=None, pattern="^(active|disabled|locked)$")


class UserOut(UserBase):
    id: str
    full_name: str
    created_at: datetime
    updated_at: datetime


class LoginRequest(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int


class RefreshRequest(BaseModel):
    refresh_token: str


class StatusUpdateRequest(BaseModel):
    status: str = Field(pattern="^(active|disabled|locked)$")


# ---------------------------------------------------------------------------
# Document management schemas
# ---------------------------------------------------------------------------


class FolderPermission(BaseModel):
    principal_type: str = Field(pattern="^(role|user|department|group)$")
    principal_id: str
    capabilities: List[str] = Field(default_factory=list)


class FolderBase(BaseModel):
    name: str = Field(min_length=2, max_length=150)
    code_prefix: Optional[str] = Field(default=None, max_length=50)
    department_id: Optional[str] = None
    description: Optional[str] = Field(default=None, max_length=500)
    parent_id: Optional[str] = None
    auto_code_pattern: Optional[str] = Field(
        default="{CODE}-{TYPE}-{SEQ:000}", max_length=100
    )
    permissions: List[FolderPermission] = Field(default_factory=list)


class FolderCreate(FolderBase):
    pass


class FolderUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=2, max_length=150)
    description: Optional[str] = Field(default=None, max_length=500)
    auto_code_pattern: Optional[str] = Field(default=None, max_length=100)
    code_prefix: Optional[str] = Field(default=None, max_length=50)
    department_id: Optional[str] = None


class FolderPermissionsUpdate(BaseModel):
    permissions: List[FolderPermission]


class FolderOut(FolderBase):
    id: str
    auto_code_seq: int
    created_at: datetime
    updated_at: datetime


class DistributionRecipient(BaseModel):
    principal_type: str = Field(pattern="^(department|role|user|group)$")
    principal_id: str
    required_to_read: bool = True


class ApprovalStage(BaseModel):
    stage: int = Field(ge=1)
    approvers: List[str]
    approval_type: str = Field(pattern="^(all|any)$", default="all")
    deadline: Optional[datetime] = None


class DocumentCreate(BaseModel):
    folder_id: str
    title: str = Field(min_length=3, max_length=255)
    document_type: str = Field(min_length=2, max_length=100)
    department_id: Optional[str] = None
    distribution_list: List[DistributionRecipient]
    approval_matrix: List[ApprovalStage]
    description: Optional[str] = None


class DocumentUpdate(BaseModel):
    title: Optional[str] = None
    document_type: Optional[str] = None
    department_id: Optional[str] = None
    distribution_list: Optional[List[DistributionRecipient]] = None
    approval_matrix: Optional[List[ApprovalStage]] = None
    description: Optional[str] = None


class DocumentOut(BaseModel):
    id: str
    folder_id: str
    code: str
    title: str
    document_type: str
    department_id: Optional[str]
    status: str
    description: Optional[str]
    current_version_id: Optional[str]
    distribution_list: List[DistributionRecipient]
    approval_matrix: List[ApprovalStage]
    created_by: str
    created_at: datetime
    updated_at: datetime


class VersionCreate(BaseModel):
    version_label: Optional[str] = None
    change_summary: Optional[str] = None


class VersionApproveRequest(BaseModel):
    decision: str = Field(pattern="^(approved|rejected)$")
    comment: Optional[str] = None


class VersionOut(BaseModel):
    id: str
    document_id: str
    version: str
    status: str
    change_summary: Optional[str]
    created_by: str
    created_at: datetime
    published_at: Optional[datetime]
    cancelled_at: Optional[datetime]
    approval_history: List[dict]
    distribution_read_status: List[dict]


class CapaActionBase(BaseModel):
    description: str = Field(min_length=3, max_length=500)
    responsible: str
    due_date: datetime


class CapaActionCreate(CapaActionBase):
    pass


class CapaActionUpdate(BaseModel):
    description: Optional[str] = None
    responsible: Optional[str] = None
    due_date: Optional[datetime] = None
    status: Optional[str] = Field(default=None, pattern="^(open|in_progress|completed|overdue)$")
    completion_note: Optional[str] = None


class CapaActionOut(CapaActionBase):
    id: str
    status: str
    completion_note: Optional[str]
    completion_date: Optional[datetime]
    created_at: datetime
    updated_at: datetime


class CapaCreate(BaseModel):
    title: str = Field(min_length=3, max_length=255)
    source: str = Field(min_length=2, max_length=100)
    department: str = Field(min_length=2, max_length=100)
    team_leader: str
    team_members: List[str] = Field(default_factory=list)
    nonconformity_description: str = Field(min_length=5, max_length=2000)
    root_cause: Optional[str] = None
    immediate_action: Optional[str] = None
    target_date: Optional[datetime] = None


class CapaUpdate(BaseModel):
    title: Optional[str] = None
    source: Optional[str] = None
    department: Optional[str] = None
    team_leader: Optional[str] = None
    team_members: Optional[List[str]] = None
    nonconformity_description: Optional[str] = None
    root_cause: Optional[str] = None
    immediate_action: Optional[str] = None
    target_date: Optional[datetime] = None
    status: Optional[str] = Field(default=None, pattern="^(open|investigating|implementing|closed)$")


class CapaStatusUpdate(BaseModel):
    status: str = Field(pattern="^(open|investigating|implementing|closed)$")
    note: Optional[str] = None


class CapaOut(BaseModel):
    id: str
    capa_no: str
    title: str
    source: str
    department: str
    team_leader: str
    team_members: List[str]
    nonconformity_description: str
    root_cause: Optional[str]
    immediate_action: Optional[str]
    target_date: Optional[datetime]
    status: str
    status_history: List[dict]
    created_by: str
    created_at: datetime
    updated_at: datetime
    actions: List[CapaActionOut]
    final_report: Optional[str]
    final_report_date: Optional[datetime]


class ComplaintTaskBase(BaseModel):
    description: str = Field(min_length=3, max_length=500)
    responsible: str
    due_date: datetime


class ComplaintTaskCreate(ComplaintTaskBase):
    pass


class ComplaintTaskUpdate(BaseModel):
    description: Optional[str] = None
    responsible: Optional[str] = None
    due_date: Optional[datetime] = None
    status: Optional[str] = Field(default=None, pattern="^(open|in_progress|completed|overdue|cancelled)$")
    resolution_note: Optional[str] = None


class ComplaintTaskOut(ComplaintTaskBase):
    id: str
    status: str
    resolution_note: Optional[str]
    completion_date: Optional[datetime]
    created_at: datetime
    updated_at: datetime


class ComplaintCreate(BaseModel):
    customer_name: str = Field(min_length=2, max_length=150)
    customer_contact: Optional[str] = Field(default=None, max_length=150)
    department: str = Field(min_length=2, max_length=100)
    complaint_type: str = Field(min_length=2, max_length=100)
    priority: str = Field(pattern="^(low|medium|high|critical)$")
    description: str = Field(min_length=5, max_length=2000)
    team_leader: Optional[str] = None
    team_members: List[str] = Field(default_factory=list)


class ComplaintUpdate(BaseModel):
    customer_contact: Optional[str] = None
    department: Optional[str] = None
    complaint_type: Optional[str] = None
    priority: Optional[str] = Field(default=None, pattern="^(low|medium|high|critical)$")
    description: Optional[str] = None
    team_leader: Optional[str] = None
    team_members: Optional[List[str]] = None


class ComplaintStatusUpdate(BaseModel):
    status: str = Field(pattern="^(open|investigating|resolved|closed|cancelled)$")
    note: Optional[str] = None


class ComplaintOut(BaseModel):
    id: str
    complaint_no: str
    customer_name: str
    customer_contact: Optional[str]
    department: str
    complaint_type: str
    priority: str
    description: str
    status: str
    team_leader: Optional[str]
    team_members: List[str]
    initial_report: Optional[str]
    final_report: Optional[str]
    status_history: List[dict]
    created_by: str
    created_at: datetime
    updated_at: datetime
    investigation_report: Optional[str]
    tasks: List[ComplaintTaskOut]


class RiskModelField(BaseModel):
    name: str = Field(min_length=2, max_length=50)
    label: str = Field(min_length=2, max_length=150)
    data_type: str = Field(pattern="^(number|string|enum|boolean)$")
    weight: float = Field(default=1.0)
    required: bool = True
    allowed_values: Optional[List[str]] = None


class RiskModelCreate(BaseModel):
    name: str = Field(min_length=3, max_length=150)
    description: Optional[str] = None
    fields: List[RiskModelField]
    formulas: Optional[dict] = None


class RiskModelUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    fields: Optional[List[RiskModelField]] = None
    formulas: Optional[dict] = None
    is_active: Optional[bool] = None


class RiskModelOut(BaseModel):
    id: str
    name: str
    description: Optional[str]
    fields: List[RiskModelField]
    formulas: Optional[dict]
    is_active: bool
    created_at: datetime
    updated_at: datetime


class RiskActionBase(BaseModel):
    description: str = Field(min_length=3, max_length=500)
    responsible: str
    due_date: datetime


class RiskActionCreate(RiskActionBase):
    pass


class RiskActionUpdate(BaseModel):
    description: Optional[str] = None
    responsible: Optional[str] = None
    due_date: Optional[datetime] = None
    status: Optional[str] = Field(default=None, pattern="^(open|in_progress|completed|cancelled)$")
    note: Optional[str] = None


class RiskActionOut(RiskActionBase):
    id: str
    status: str
    note: Optional[str]
    completion_date: Optional[datetime]
    created_at: datetime
    updated_at: datetime


class RiskRecordCreate(BaseModel):
    model_id: str
    subject: str = Field(min_length=3, max_length=255)
    department: str = Field(min_length=2, max_length=100)
    risk_owner: str
    likelihood: int = Field(ge=1, le=5)
    impact: int = Field(ge=1, le=5)
    detection: Optional[int] = Field(default=None, ge=1, le=5)
    initial_score: Optional[float] = None
    current_controls: Optional[str] = None
    evaluation_date: Optional[datetime] = None
    custom_fields: dict[str, Any] = Field(default_factory=dict)


class RiskRecordUpdate(BaseModel):
    subject: Optional[str] = None
    department: Optional[str] = None
    risk_owner: Optional[str] = None
    likelihood: Optional[int] = Field(default=None, ge=1, le=5)
    impact: Optional[int] = Field(default=None, ge=1, le=5)
    detection: Optional[int] = Field(default=None, ge=1, le=5)
    current_controls: Optional[str] = None
    evaluation_date: Optional[datetime] = None
    custom_fields: Optional[dict[str, Any]] = None
    status: Optional[str] = Field(default=None, pattern="^(open|monitoring|closed)$")


class RiskStatusUpdate(BaseModel):
    status: str = Field(pattern="^(open|monitoring|closed)$")
    note: Optional[str] = None


class RiskRevisionCreate(BaseModel):
    likelihood: int = Field(ge=1, le=5)
    impact: int = Field(ge=1, le=5)
    detection: Optional[int] = Field(default=None, ge=1, le=5)
    evaluation_date: Optional[datetime] = None
    custom_fields: Optional[dict[str, Any]] = None
    note: Optional[str] = None


class RiskRevisionOut(BaseModel):
    id: str
    likelihood: int
    impact: int
    detection: Optional[int]
    evaluation_date: Optional[datetime]
    risk_score: float
    note: Optional[str]
    changed_by: str
    changed_at: datetime
    custom_fields: dict[str, Any]


class RiskRecordOut(BaseModel):
    id: str
    risk_no: str
    model_id: str
    subject: str
    department: str
    risk_owner: str
    likelihood: int
    impact: int
    detection: Optional[int]
    risk_score: float
    current_controls: Optional[str]
    evaluation_date: Optional[datetime]
    status: str
    custom_fields: dict[str, Any]
    created_by: str
    created_at: datetime
    updated_at: datetime
    actions: List[RiskActionOut]
    revisions: List[RiskRevisionOut]
    status_history: List[dict]


class AuditTeamMember(BaseModel):
    user_id: str
    role: str = Field(min_length=2, max_length=50)


class AuditChecklistItem(BaseModel):
    question: str = Field(min_length=3, max_length=500)
    response: Optional[str] = None
    status: Optional[str] = Field(default="pending", pattern="^(pending|compliant|noncompliant|not_applicable)$")
    note: Optional[str] = None


class AuditCreate(BaseModel):
    audit_code: Optional[str] = None
    audit_type: str = Field(min_length=2, max_length=100)
    scope: str = Field(min_length=3, max_length=500)
    department: str = Field(min_length=2, max_length=100)
    start_date: datetime
    end_date: datetime
    lead_auditor: str
    audit_team: List[AuditTeamMember]
    auditee_representative: Optional[str] = None
    objectives: Optional[str] = None
    checklist: List[AuditChecklistItem] = Field(default_factory=list)


class AuditUpdate(BaseModel):
    audit_type: Optional[str] = None
    scope: Optional[str] = None
    department: Optional[str] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    audit_team: Optional[List[AuditTeamMember]] = None
    auditee_representative: Optional[str] = None
    objectives: Optional[str] = None
    checklist: Optional[List[AuditChecklistItem]] = None
    status: Optional[str] = Field(default=None, pattern="^(planned|in_progress|completed|cancelled)$")


class AuditStatusUpdate(BaseModel):
    status: str = Field(pattern="^(planned|in_progress|completed|cancelled)$")
    note: Optional[str] = None


class AuditFindingCreate(BaseModel):
    finding_type: str = Field(pattern="^(observation|minor|major|critical)$")
    description: str = Field(min_length=3, max_length=1000)
    requirement_reference: Optional[str] = None
    related_capa_id: Optional[str] = None


class AuditFindingUpdate(BaseModel):
    finding_type: Optional[str] = Field(default=None, pattern="^(observation|minor|major|critical)$")
    description: Optional[str] = None
    requirement_reference: Optional[str] = None
    related_capa_id: Optional[str] = None
    status: Optional[str] = Field(default=None, pattern="^(open|in_progress|closed)$")
    corrective_action: Optional[str] = None


class AuditFindingOut(BaseModel):
    id: str
    finding_type: str
    description: str
    requirement_reference: Optional[str]
    related_capa_id: Optional[str]
    status: str
    corrective_action: Optional[str]
    created_at: datetime
    updated_at: datetime


class AuditOut(BaseModel):
    id: str
    audit_code: str
    audit_type: str
    scope: str
    department: str
    start_date: datetime
    end_date: datetime
    status: str
    lead_auditor: str
    audit_team: List[AuditTeamMember]
    auditee_representative: Optional[str]
    objectives: Optional[str]
    checklist: List[AuditChecklistItem]
    findings: List[AuditFindingOut]
    status_history: List[dict]
    created_by: str
    created_at: datetime
    updated_at: datetime


class EquipmentProcess(BaseModel):
    process_type: str = Field(min_length=2, max_length=100)
    frequency_months: int = Field(gt=0)
    policy: Optional[str] = None
    location: Optional[str] = None


class EquipmentCreate(BaseModel):
    code: str = Field(min_length=2, max_length=50)
    name: str = Field(min_length=2, max_length=150)
    category: Optional[str] = None
    department: str = Field(min_length=2, max_length=100)
    responsible: str
    description: Optional[str] = None
    process_definitions: List[EquipmentProcess] = Field(default_factory=list)
    reference_value: Optional[str] = None
    acceptable_range: Optional[str] = None
    cost_center: Optional[str] = None


class EquipmentUpdate(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None
    department: Optional[str] = None
    responsible: Optional[str] = None
    description: Optional[str] = None
    process_definitions: Optional[List[EquipmentProcess]] = None
    reference_value: Optional[str] = None
    acceptable_range: Optional[str] = None
    cost_center: Optional[str] = None


class WorkOrderCreate(BaseModel):
    process_type: str
    scheduled_date: datetime
    assigned_to: str
    notes: Optional[str] = None
    auto_generated: bool = False


class WorkOrderUpdate(BaseModel):
    status: Optional[str] = Field(pattern="^(scheduled|in_progress|completed|cancelled)$")
    actual_date: Optional[datetime] = None
    result: Optional[str] = None
    notes: Optional[str] = None


class EquipmentOut(BaseModel):
    id: str
    code: str
    name: str
    category: Optional[str]
    department: str
    responsible: str
    description: Optional[str]
    process_definitions: List[EquipmentProcess]
    reference_value: Optional[str]
    acceptable_range: Optional[str]
    cost_center: Optional[str]
    created_at: datetime
    updated_at: datetime
    work_orders: List[dict]


class ReportFilter(BaseModel):
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    department: Optional[str] = None
    status: Optional[str] = None


class CapaActionBase(BaseModel):
    description: str = Field(min_length=3, max_length=500)
    responsible: str
    due_date: datetime


class CapaActionCreate(CapaActionBase):
    pass


class CapaActionUpdate(BaseModel):
    description: Optional[str] = None
    responsible: Optional[str] = None
    due_date: Optional[datetime] = None
    status: Optional[str] = Field(default=None, pattern="^(open|in_progress|completed|overdue)$")
    completion_note: Optional[str] = None


class CapaActionOut(CapaActionBase):
    id: str
    status: str
    completion_note: Optional[str]
    completion_date: Optional[datetime]
    created_at: datetime
    updated_at: datetime


class CapaCreate(BaseModel):
    title: str = Field(min_length=3, max_length=255)
    source: str = Field(min_length=2, max_length=100)
    department: str = Field(min_length=2, max_length=100)
    team_leader: str
    team_members: List[str] = Field(default_factory=list)
    nonconformity_description: str = Field(min_length=5, max_length=2000)
    root_cause: Optional[str] = None
    immediate_action: Optional[str] = None
    target_date: Optional[datetime] = None


class CapaUpdate(BaseModel):
    title: Optional[str] = None
    source: Optional[str] = None
    department: Optional[str] = None
    team_leader: Optional[str] = None
    team_members: Optional[List[str]] = None
    nonconformity_description: Optional[str] = None
    root_cause: Optional[str] = None
    immediate_action: Optional[str] = None
    target_date: Optional[datetime] = None
    status: Optional[str] = Field(default=None, pattern="^(open|investigating|implementing|closed)$")


class CapaStatusUpdate(BaseModel):
    status: str = Field(pattern="^(open|investigating|implementing|closed)$")
    note: Optional[str] = None


class CapaOut(BaseModel):
    id: str
    capa_no: str
    title: str
    source: str
    department: str
    team_leader: str
    team_members: List[str]
    nonconformity_description: str
    root_cause: Optional[str]
    immediate_action: Optional[str]
    target_date: Optional[datetime]
    status: str
    status_history: List[dict]
    created_by: str
    created_at: datetime
    updated_at: datetime
    actions: List[CapaActionOut]
    final_report: Optional[str]
    final_report_date: Optional[datetime]


# ---------------------------------------------------------------------------
# Helper functions
# ---------------------------------------------------------------------------


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(password: str, hashed: str) -> bool:
    return pwd_context.verify(password, hashed)


def create_access_token(subject: str) -> str:
    expire = now_utc() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {"sub": subject, "type": "access", "exp": expire}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


async def create_refresh_token(subject: str) -> str:
    expire = now_utc() + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    token = str(uuid.uuid4())
    session_doc = {
        "_id": str(uuid.uuid4()),
        "user_id": subject,
        "token": token,
        "expires_at": expire,
        "created_at": now_utc(),
        "revoked": False,
    }
    await db.sessions.insert_one(session_doc)
    return token


async def revoke_refresh_token(token: str) -> None:
    await db.sessions.update_one({"token": token}, {"$set": {"revoked": True}})


async def validate_refresh_token(token: str) -> dict:
    session = await db.sessions.find_one({"token": token})
    if not session:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")
    if session.get("revoked"):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token revoked")
    if session.get("expires_at") and session["expires_at"] < now_utc():
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token expired")
    return session


def serialize_department(doc: dict) -> DepartmentOut:
    return DepartmentOut(
        id=doc["_id"],
        code=doc["code"],
        name=doc["name"],
        description=doc.get("description"),
        parent_id=doc.get("parent_id"),
    )


def serialize_role(doc: dict) -> RoleOut:
    return RoleOut(
        id=doc["_id"],
        name=doc["name"],
        display_name=doc["display_name"],
        description=doc.get("description"),
        permissions=doc.get("permissions", []),
        is_system=doc.get("is_system", False),
    )


def serialize_user(doc: dict) -> UserOut:
    return UserOut(
        id=doc["_id"],
        username=doc["username"],
        email=doc["email"],
        first_name=doc["first_name"],
        last_name=doc["last_name"],
        full_name=doc.get("full_name", f"{doc['first_name']} {doc['last_name']}"),
        department_id=doc.get("department_id"),
        position=doc.get("position"),
        groups=doc.get("groups", []),
        roles=doc.get("roles", []),
        status=doc.get("status", "active"),
        created_at=doc["created_at"],
        updated_at=doc["updated_at"],
    )


def serialize_folder(doc: dict) -> FolderOut:
    return FolderOut(
        id=doc["_id"],
        name=doc["name"],
        code_prefix=doc.get("code_prefix"),
        department_id=doc.get("department_id"),
        description=doc.get("description"),
        parent_id=doc.get("parent_id"),
        auto_code_pattern=doc.get("auto_code_pattern"),
        permissions=[
            FolderPermission(**perm) for perm in doc.get("permissions", [])
        ],
        auto_code_seq=doc.get("auto_code_seq", 0),
        created_at=doc["created_at"],
        updated_at=doc["updated_at"],
    )


def serialize_document(doc: dict) -> DocumentOut:
    return DocumentOut(
        id=doc["_id"],
        folder_id=doc["folder_id"],
        code=doc["code"],
        title=doc["title"],
        document_type=doc["document_type"],
        department_id=doc.get("department_id"),
        status=doc.get("status", "draft"),
        description=doc.get("description"),
        current_version_id=doc.get("current_version_id"),
        distribution_list=[
            DistributionRecipient(**item) for item in doc.get("distribution_list", [])
        ],
        approval_matrix=[
            ApprovalStage(**stage) for stage in doc.get("approval_matrix", [])
        ],
        created_by=doc["created_by"],
        created_at=doc["created_at"],
        updated_at=doc["updated_at"],
    )


def serialize_version(doc: dict) -> VersionOut:
    return VersionOut(
        id=doc["_id"],
        document_id=doc["document_id"],
        version=doc["version"],
        status=doc["status"],
        change_summary=doc.get("change_summary"),
        created_by=doc["created_by"],
        created_at=doc["created_at"],
        published_at=doc.get("published_at"),
        cancelled_at=doc.get("cancelled_at"),
        approval_history=doc.get("approval_history", []),
        distribution_read_status=doc.get("distribution_read_status", []),
    )


def serialize_capa_action(doc: dict) -> CapaActionOut:
    return CapaActionOut(
        id=doc["id"],
        description=doc["description"],
        responsible=doc["responsible"],
        due_date=doc["due_date"],
        status=doc.get("status", "open"),
        completion_note=doc.get("completion_note"),
        completion_date=doc.get("completion_date"),
        created_at=doc["created_at"],
        updated_at=doc["updated_at"],
    )


def serialize_capa(doc: dict) -> CapaOut:
    return CapaOut(
        id=doc["_id"],
        capa_no=doc["capa_no"],
        title=doc["title"],
        source=doc["source"],
        department=doc["department"],
        team_leader=doc["team_leader"],
        team_members=doc.get("team_members", []),
        nonconformity_description=doc["nonconformity_description"],
        root_cause=doc.get("root_cause"),
        immediate_action=doc.get("immediate_action"),
        target_date=doc.get("target_date"),
        status=doc.get("status", "open"),
        status_history=doc.get("status_history", []),
        created_by=doc["created_by"],
        created_at=doc["created_at"],
        updated_at=doc["updated_at"],
        actions=[serialize_capa_action(action) for action in doc.get("actions", [])],
        final_report=doc.get("final_report"),
        final_report_date=doc.get("final_report_date"),
    )


def serialize_complaint_task(doc: dict) -> ComplaintTaskOut:
    return ComplaintTaskOut(
        id=doc["id"],
        description=doc["description"],
        responsible=doc["responsible"],
        due_date=doc["due_date"],
        status=doc.get("status", "open"),
        resolution_note=doc.get("resolution_note"),
        completion_date=doc.get("completion_date"),
        created_at=doc["created_at"],
        updated_at=doc["updated_at"],
    )


def serialize_complaint(doc: dict) -> ComplaintOut:
    return ComplaintOut(
        id=doc["_id"],
        complaint_no=doc["complaint_no"],
        customer_name=doc["customer_name"],
        customer_contact=doc.get("customer_contact"),
        department=doc["department"],
        complaint_type=doc["complaint_type"],
        priority=doc["priority"],
        description=doc["description"],
        status=doc.get("status", "open"),
        team_leader=doc.get("team_leader"),
        team_members=doc.get("team_members", []),
        initial_report=doc.get("initial_report"),
        final_report=doc.get("final_report"),
        status_history=doc.get("status_history", []),
        created_by=doc["created_by"],
        created_at=doc["created_at"],
        updated_at=doc["updated_at"],
        investigation_report=doc.get("investigation_report"),
        tasks=[serialize_complaint_task(task) for task in doc.get("tasks", [])],
    )


def serialize_risk_model(doc: dict) -> RiskModelOut:
    return RiskModelOut(
        id=doc["_id"],
        name=doc["name"],
        description=doc.get("description"),
        fields=[RiskModelField(**field) for field in doc.get("fields", [])],
        formulas=doc.get("formulas"),
        is_active=doc.get("is_active", True),
        created_at=doc["created_at"],
        updated_at=doc["updated_at"],
    )


def serialize_risk_action(doc: dict) -> RiskActionOut:
    return RiskActionOut(
        id=doc["id"],
        description=doc["description"],
        responsible=doc["responsible"],
        due_date=doc["due_date"],
        status=doc.get("status", "open"),
        note=doc.get("note"),
        completion_date=doc.get("completion_date"),
        created_at=doc["created_at"],
        updated_at=doc["updated_at"],
    )


def serialize_risk_revision(doc: dict) -> RiskRevisionOut:
    return RiskRevisionOut(
        id=doc["id"],
        likelihood=doc["likelihood"],
        impact=doc["impact"],
        detection=doc.get("detection"),
        evaluation_date=doc.get("evaluation_date"),
        risk_score=doc["risk_score"],
        note=doc.get("note"),
        changed_by=doc["changed_by"],
        changed_at=doc["changed_at"],
        custom_fields=doc.get("custom_fields", {}),
    )


def serialize_risk_record(doc: dict) -> RiskRecordOut:
    return RiskRecordOut(
        id=doc["_id"],
        risk_no=doc["risk_no"],
        model_id=doc["model_id"],
        subject=doc["subject"],
        department=doc["department"],
        risk_owner=doc["risk_owner"],
        likelihood=doc["likelihood"],
        impact=doc["impact"],
        detection=doc.get("detection"),
        risk_score=doc.get("risk_score", 0.0),
        current_controls=doc.get("current_controls"),
        evaluation_date=doc.get("evaluation_date"),
        status=doc.get("status", "open"),
        custom_fields=doc.get("custom_fields", {}),
        created_by=doc["created_by"],
        created_at=doc["created_at"],
        updated_at=doc["updated_at"],
        actions=[serialize_risk_action(action) for action in doc.get("actions", [])],
        revisions=[serialize_risk_revision(rev) for rev in doc.get("revisions", [])],
        status_history=doc.get("status_history", []),
    )


def serialize_audit(doc: dict) -> AuditOut:
    return AuditOut(
        id=doc["_id"],
        audit_code=doc["audit_code"],
        audit_type=doc["audit_type"],
        scope=doc["scope"],
        department=doc["department"],
        start_date=doc["start_date"],
        end_date=doc["end_date"],
        status=doc.get("status", "planned"),
        lead_auditor=doc["lead_auditor"],
        audit_team=[AuditTeamMember(**member) for member in doc.get("audit_team", [])],
        auditee_representative=doc.get("auditee_representative"),
        objectives=doc.get("objectives"),
        checklist=[AuditChecklistItem(**item) for item in doc.get("checklist", [])],
        findings=[AuditFindingOut(**finding) for finding in doc.get("findings", [])],
        status_history=doc.get("status_history", []),
        created_by=doc["created_by"],
        created_at=doc["created_at"],
        updated_at=doc["updated_at"],
    )


def serialize_equipment(doc: dict) -> EquipmentOut:
    return EquipmentOut(
        id=doc["_id"],
        code=doc["code"],
        name=doc["name"],
        category=doc.get("category"),
        department=doc["department"],
        responsible=doc["responsible"],
        description=doc.get("description"),
        process_definitions=[
            EquipmentProcess(**proc) for proc in doc.get("process_definitions", [])
        ],
        reference_value=doc.get("reference_value"),
        acceptable_range=doc.get("acceptable_range"),
        cost_center=doc.get("cost_center"),
        created_at=doc["created_at"],
        updated_at=doc["updated_at"],
        work_orders=doc.get("work_orders", []),
    )

async def get_current_user(token: str = Depends(oauth2_scheme)) -> dict:
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.PyJWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    if payload.get("type") != "access":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token type")

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token subject")

    user = await db.users.find_one({"_id": user_id})
    if not user or user.get("status") != "active":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User inactive")

    return user


async def ensure_folder_exists(folder_id: str) -> dict:
    folder = await db.doc_folders.find_one({"_id": folder_id})
    if not folder:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Folder not found")
    return folder


async def ensure_document_exists(document_id: str) -> dict:
    document = await db.documents.find_one({"_id": document_id})
    if not document:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    return document


def next_document_code(folder: dict, document_type: str) -> tuple[str, int]:
    pattern = folder.get("auto_code_pattern") or "{CODE}-{TYPE}-{SEQ:000}"
    seq = int(folder.get("auto_code_seq", 0)) + 1
    code_prefix = folder.get("code_prefix") or folder["name"][:3].upper()
    replacements = {
        "{CODE}": code_prefix.upper(),
        "{TYPE}": document_type[:3].upper(),
        "{SEQ:000}": f"{seq:03d}",
        "{SEQ:0000}": f"{seq:04d}",
        "{SEQ}": str(seq),
    }
    code = pattern
    for placeholder, value in replacements.items():
        code = code.replace(placeholder, value)
    return code, seq


async def ensure_capa_exists(capa_id: str) -> dict:
    capa = await db.capas.find_one({"_id": capa_id})
    if not capa:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="CAPA not found")
    return capa


async def generate_capa_no() -> str:
    current_year = now_utc().year
    start_of_year = datetime(current_year, 1, 1, tzinfo=timezone.utc)
    count = await db.capas.count_documents({"created_at": {"$gte": start_of_year}})
    return f"CAPA-{current_year}-{count + 1:04d}"


async def ensure_complaint_exists(complaint_id: str) -> dict:
    complaint = await db.complaints.find_one({"_id": complaint_id})
    if not complaint:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Complaint not found")
    return complaint


async def generate_complaint_no() -> str:
    current_year = now_utc().year
    start_of_year = datetime(current_year, 1, 1, tzinfo=timezone.utc)
    count = await db.complaints.count_documents({"created_at": {"$gte": start_of_year}})
    return f"COMP-{current_year}-{count + 1:04d}"


async def ensure_risk_model_exists(model_id: str) -> dict:
    model = await db.risk_models.find_one({"_id": model_id})
    if not model:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Risk model not found")
    return model


async def ensure_risk_exists(risk_id: str) -> dict:
    record = await db.risk_records.find_one({"_id": risk_id})
    if not record:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Risk record not found")
    return record


async def generate_risk_no() -> str:
    current_year = now_utc().year
    start_of_year = datetime(current_year, 1, 1, tzinfo=timezone.utc)
    count = await db.risk_records.count_documents({"created_at": {"$gte": start_of_year}})
    return f"RISK-{current_year}-{count + 1:04d}"


def calculate_risk_score(likelihood: int, impact: int, detection: Optional[int]) -> float:
    if detection:
        return float(likelihood * impact * detection)
    return float(likelihood * impact)


async def export_to_json(data: List[dict]) -> bytes:
    return json.dumps(data, default=str, indent=2).encode("utf-8")


async def ensure_audit_exists(audit_id: str) -> dict:
    audit = await db.audits.find_one({"_id": audit_id})
    if not audit:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Audit not found")
    return audit


async def generate_audit_code() -> str:
    current_year = now_utc().year
    start_of_year = datetime(current_year, 1, 1, tzinfo=timezone.utc)
    count = await db.audits.count_documents({"created_at": {"$gte": start_of_year}})
    return f"AUD-{current_year}-{count + 1:04d}"


async def ensure_equipment_exists(equipment_id: str) -> dict:
    equipment = await db.equipment.find_one({"_id": equipment_id})
    if not equipment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Equipment not found")
    return equipment


async def ensure_work_order_exists(equipment: dict, work_order_id: str) -> dict:
    work_orders = equipment.get("work_orders", [])
    work_order = next((item for item in work_orders if item["id"] == work_order_id), None)
    if not work_order:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Work order not found")
    return work_order


def parse_datetime(value: Optional[str]) -> Optional[datetime]:
    if not value:
        return None
    try:
        dt = datetime.fromisoformat(value)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid datetime format: {value}. Use ISO 8601.",
        )
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt


# ---------------------------------------------------------------------------
# Department endpoints
# ---------------------------------------------------------------------------


@app.post("/departments", response_model=DepartmentOut, status_code=status.HTTP_201_CREATED)
async def create_department(department: DepartmentBase, current_user: dict = Depends(get_current_user)):
    existing = await db.departments.find_one({"code": department.code})
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Department code already exists")
    doc = {
        "_id": str(uuid.uuid4()),
        **department.model_dump(),
        "created_at": now_utc(),
        "updated_at": now_utc(),
    }
    await db.departments.insert_one(doc)
    return serialize_department(doc)


@app.get("/departments", response_model=List[DepartmentOut])
async def list_departments(current_user: dict = Depends(get_current_user)):
    cursor = db.departments.find({}).sort("name", 1)
    departments = [serialize_department(doc) async for doc in cursor]
    return departments


# ---------------------------------------------------------------------------
# Folder endpoints
# ---------------------------------------------------------------------------


@app.post("/folders", response_model=FolderOut, status_code=status.HTTP_201_CREATED)
async def create_folder(
    payload: FolderCreate,
    current_user: dict = Depends(get_current_user),
):
    doc = {
        "_id": str(uuid.uuid4()),
        **payload.model_dump(),
        "auto_code_seq": 0,
        "created_by": current_user["_id"],
        "created_at": now_utc(),
        "updated_at": now_utc(),
    }
    await db.doc_folders.insert_one(doc)
    return serialize_folder(doc)


@app.get("/folders", response_model=List[FolderOut])
async def list_folders(
    parent_id: Optional[str] = Query(default=None),
    current_user: dict = Depends(get_current_user),
):
    query = {}
    if parent_id is not None:
        query["parent_id"] = parent_id
    cursor = db.doc_folders.find(query).sort("name", 1)
    folders = [serialize_folder(doc) async for doc in cursor]
    return folders


@app.put("/folders/{folder_id}", response_model=FolderOut)
async def update_folder(
    folder_id: str,
    payload: FolderUpdate,
    current_user: dict = Depends(get_current_user),
):
    update_data = {
        k: v for k, v in payload.model_dump(exclude_unset=True).items()
    }
    if not update_data:
        folder = await ensure_folder_exists(folder_id)
        return serialize_folder(folder)
    update_data["updated_at"] = now_utc()
    result = await db.doc_folders.update_one({"_id": folder_id}, {"$set": update_data})
    if result.matched_count == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Folder not found")
    folder = await db.doc_folders.find_one({"_id": folder_id})
    return serialize_folder(folder)


@app.patch("/folders/{folder_id}/permissions", response_model=FolderOut)
async def set_folder_permissions(
    folder_id: str,
    payload: FolderPermissionsUpdate,
    current_user: dict = Depends(get_current_user),
):
    permissions = [perm.model_dump() for perm in payload.permissions]
    result = await db.doc_folders.update_one(
        {"_id": folder_id},
        {"$set": {"permissions": permissions, "updated_at": now_utc()}},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Folder not found")
    folder = await db.doc_folders.find_one({"_id": folder_id})
    return serialize_folder(folder)


# ---------------------------------------------------------------------------
# Document endpoints
# ---------------------------------------------------------------------------


@app.post("/documents", response_model=DocumentOut, status_code=status.HTTP_201_CREATED)
async def create_document(
    payload: DocumentCreate,
    current_user: dict = Depends(get_current_user),
):
    folder = await ensure_folder_exists(payload.folder_id)
    code, seq = next_document_code(folder, payload.document_type)
    document_id = str(uuid.uuid4())
    now = now_utc()

    doc = {
        "_id": document_id,
        "folder_id": payload.folder_id,
        "code": code,
        "title": payload.title,
        "document_type": payload.document_type,
        "department_id": payload.department_id or folder.get("department_id"),
        "status": "draft",
        "description": payload.description,
        "current_version_id": None,
        "distribution_list": [item.model_dump() for item in payload.distribution_list],
        "approval_matrix": [stage.model_dump() for stage in payload.approval_matrix],
        "created_by": current_user["_id"],
        "created_at": now,
        "updated_at": now,
    }

    version_id = str(uuid.uuid4())
    version_doc = {
        "_id": version_id,
        "document_id": document_id,
        "version": "1.0",
        "status": "draft",
        "change_summary": "Initial version",
        "created_by": current_user["_id"],
        "created_at": now,
        "published_at": None,
        "cancelled_at": None,
        "approval_history": [],
        "distribution_read_status": [],
    }
    doc["current_version_id"] = version_id

    async with await client.start_session() as session:
        async with session.start_transaction():
            await db.doc_folders.update_one(
                {"_id": folder["_id"]},
                {"$set": {"auto_code_seq": seq, "updated_at": now}},
                session=session,
            )
            await db.documents.insert_one(doc, session=session)
            await db.document_versions.insert_one(version_doc, session=session)

    return serialize_document(doc)


@app.get("/documents", response_model=List[DocumentOut])
async def list_documents(
    folder_id: Optional[str] = Query(default=None),
    status_filter: Optional[str] = Query(default=None),
    document_type: Optional[str] = Query(default=None),
    search: Optional[str] = Query(default=None),
    current_user: dict = Depends(get_current_user),
):
    query = {}
    if folder_id:
        query["folder_id"] = folder_id
    if status_filter:
        query["status"] = status_filter
    if document_type:
        query["document_type"] = document_type
    if search:
        query["$text"] = {"$search": search}

    cursor = db.documents.find(query).sort("updated_at", -1)
    documents = [serialize_document(doc) async for doc in cursor]
    return documents


@app.get("/documents/{document_id}", response_model=DocumentOut)
async def get_document(document_id: str, current_user: dict = Depends(get_current_user)):
    doc = await ensure_document_exists(document_id)
    return serialize_document(doc)


@app.patch("/documents/{document_id}", response_model=DocumentOut)
async def update_document(
    document_id: str,
    payload: DocumentUpdate,
    current_user: dict = Depends(get_current_user),
):
    update_data = {
        k: v for k, v in payload.model_dump(exclude_unset=True).items()
    }
    if update_data:
        update_data["updated_at"] = now_utc()
        result = await db.documents.update_one({"_id": document_id}, {"$set": update_data})
        if result.matched_count == 0:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    doc = await ensure_document_exists(document_id)
    return serialize_document(doc)


@app.post("/documents/{document_id}/versions", response_model=VersionOut, status_code=status.HTTP_201_CREATED)
async def create_version(
    document_id: str,
    payload: VersionCreate,
    current_user: dict = Depends(get_current_user),
):
    await ensure_document_exists(document_id)
    last_version = (
        await db.document_versions.find({"document_id": document_id})
        .sort("created_at", -1)
        .limit(1)
        .to_list(1)
    )

    if last_version:
        prev = last_version[0]["version"]
        major, _, minor = prev.partition(".")
        try:
            major_i = int(major)
            minor_i = int(minor or "0")
        except ValueError:
            major_i, minor_i = 1, 0
        new_version_label = payload.version_label or f"{major_i}.{minor_i + 1}"
    else:
        new_version_label = payload.version_label or "1.0"

    version_id = str(uuid.uuid4())
    now = now_utc()
    version_doc = {
        "_id": version_id,
        "document_id": document_id,
        "version": new_version_label,
        "status": "draft",
        "change_summary": payload.change_summary or "Revision",
        "created_by": current_user["_id"],
        "created_at": now,
        "published_at": None,
        "cancelled_at": None,
        "approval_history": [],
        "distribution_read_status": [],
    }
    await db.document_versions.insert_one(version_doc)
    await db.documents.update_one(
        {"_id": document_id},
        {"$set": {"current_version_id": version_id, "updated_at": now}},
    )
    return serialize_version(version_doc)


@app.get("/documents/{document_id}/versions", response_model=List[VersionOut])
async def list_versions(document_id: str, current_user: dict = Depends(get_current_user)):
    await ensure_document_exists(document_id)
    cursor = db.document_versions.find({"document_id": document_id}).sort("created_at", -1)
    versions = [serialize_version(doc) async for doc in cursor]
    return versions


@app.get("/document-versions/{version_id}", response_model=VersionOut)
async def get_version(version_id: str, current_user: dict = Depends(get_current_user)):
    version = await db.document_versions.find_one({"_id": version_id})
    if not version:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Version not found")
    return serialize_version(version)


@app.post("/document-versions/{version_id}/submit-review", response_model=VersionOut)
async def submit_version_for_review(version_id: str, current_user: dict = Depends(get_current_user)):
    version = await db.document_versions.find_one({"_id": version_id})
    if not version:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Version not found")
    if version["status"] not in {"draft", "rejected"}:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Version not in draft state")
    await db.document_versions.update_one(
        {"_id": version_id},
        {"$set": {"status": "in_review", "submitted_at": now_utc()}},
    )
    updated = await db.document_versions.find_one({"_id": version_id})
    return serialize_version(updated)


@app.post("/document-versions/{version_id}/approve", response_model=VersionOut)
async def approve_version(
    version_id: str,
    payload: VersionApproveRequest,
    current_user: dict = Depends(get_current_user),
):
    version = await db.document_versions.find_one({"_id": version_id})
    if not version:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Version not found")
    if version["status"] not in {"in_review", "draft"}:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Version not awaiting approval")

    decision_entry = {
        "approver_id": current_user["_id"],
        "decision": payload.decision,
        "comment": payload.comment,
        "decided_at": now_utc(),
    }
    new_status = "approved" if payload.decision == "approved" else "rejected"

    update_fields = {
        "status": new_status,
        "approval_history": version.get("approval_history", []) + [decision_entry],
    }
    if new_status == "approved":
        update_fields["published_at"] = now_utc()

    await db.document_versions.update_one(
        {"_id": version_id},
        {"$set": update_fields},
    )

    updated = await db.document_versions.find_one({"_id": version_id})
    if new_status == "approved":
        await db.documents.update_one(
            {"_id": updated["document_id"]},
            {"$set": {"status": "approved", "current_version_id": version_id, "updated_at": now_utc()}},
        )
    return serialize_version(updated)


@app.post("/document-versions/{version_id}/read")
async def acknowledge_read(version_id: str, current_user: dict = Depends(get_current_user)):
    version = await db.document_versions.find_one({"_id": version_id})
    if not version:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Version not found")

    read_status = version.get("distribution_read_status", [])
    existing = next((item for item in read_status if item["recipient_id"] == current_user["_id"]), None)
    now = now_utc()
    if existing:
        existing["status"] = "read"
        existing["read_at"] = now
    else:
        read_status.append(
            {
                "recipient_id": current_user["_id"],
                "status": "read",
                "read_at": now,
            }
        )
    await db.document_versions.update_one(
        {"_id": version_id},
        {"$set": {"distribution_read_status": read_status}},
    )
    return {"status": "ok"}


# ---------------------------------------------------------------------------
# CAPA endpoints
# ---------------------------------------------------------------------------


@app.post("/capas", response_model=CapaOut, status_code=status.HTTP_201_CREATED)
async def create_capa(payload: CapaCreate, current_user: dict = Depends(get_current_user)):
    capa_no = await generate_capa_no()
    now = now_utc()
    capa_id = str(uuid.uuid4())
    capa_doc = {
        "_id": capa_id,
        "capa_no": capa_no,
        **payload.model_dump(),
        "status": "open",
        "status_history": [
            {
                "status": "open",
                "note": "Created",
                "changed_by": current_user["_id"],
                "changed_at": now,
            }
        ],
        "actions": [],
        "created_by": current_user["_id"],
        "created_at": now,
        "updated_at": now,
        "final_report": None,
        "final_report_date": None,
    }
    await db.capas.insert_one(capa_doc)
    return serialize_capa(capa_doc)


@app.get("/capas", response_model=List[CapaOut])
async def list_capas(
    status_filter: Optional[str] = Query(default=None),
    department: Optional[str] = Query(default=None),
    source: Optional[str] = Query(default=None),
    search: Optional[str] = Query(default=None),
    current_user: dict = Depends(get_current_user),
):
    query = {}
    if status_filter:
        query["status"] = status_filter
    if department:
        query["department"] = department
    if source:
        query["source"] = source
    if search:
        query["$or"] = [
            {"title": {"$regex": search, "$options": "i"}},
            {"capa_no": {"$regex": search, "$options": "i"}},
            {"nonconformity_description": {"$regex": search, "$options": "i"}},
        ]
    cursor = db.capas.find(query).sort("updated_at", -1)
    capas = [serialize_capa(doc) async for doc in cursor]
    return capas


@app.get("/capas/{capa_id}", response_model=CapaOut)
async def get_capa(capa_id: str, current_user: dict = Depends(get_current_user)):
    capa = await ensure_capa_exists(capa_id)
    return serialize_capa(capa)


# ---------------------------------------------------------------------------
# Complaint endpoints
# ---------------------------------------------------------------------------


@app.post("/complaints", response_model=ComplaintOut, status_code=status.HTTP_201_CREATED)
async def create_complaint(
    payload: ComplaintCreate,
    current_user: dict = Depends(get_current_user),
):
    complaint_no = await generate_complaint_no()
    now = now_utc()
    complaint_id = str(uuid.uuid4())
    doc = {
        "_id": complaint_id,
        "complaint_no": complaint_no,
        **payload.model_dump(),
        "status": "open",
        "status_history": [
            {
                "status": "open",
                "note": "Complaint registered",
                "changed_by": current_user["_id"],
                "changed_at": now,
            }
        ],
        "initial_report": None,
        "investigation_report": None,
        "final_report": None,
        "tasks": [],
        "created_by": current_user["_id"],
        "created_at": now,
        "updated_at": now,
    }
    await db.complaints.insert_one(doc)
    return serialize_complaint(doc)


@app.get("/complaints", response_model=List[ComplaintOut])
async def list_complaints(
    status_filter: Optional[str] = Query(default=None),
    department: Optional[str] = Query(default=None),
    priority: Optional[str] = Query(default=None),
    search: Optional[str] = Query(default=None),
    current_user: dict = Depends(get_current_user),
):
    query = {}
    if status_filter:
        query["status"] = status_filter
    if department:
        query["department"] = department
    if priority:
        query["priority"] = priority
    if search:
        query["$or"] = [
            {"complaint_no": {"$regex": search, "$options": "i"}},
            {"customer_name": {"$regex": search, "$options": "i"}},
            {"description": {"$regex": search, "$options": "i"}},
        ]
    cursor = db.complaints.find(query).sort("updated_at", -1)
    complaints = [serialize_complaint(doc) async for doc in cursor]
    return complaints


@app.get("/complaints/{complaint_id}", response_model=ComplaintOut)
async def get_complaint(
    complaint_id: str,
    current_user: dict = Depends(get_current_user),
):
    complaint = await ensure_complaint_exists(complaint_id)
    return serialize_complaint(complaint)


@app.patch("/complaints/{complaint_id}", response_model=ComplaintOut)
async def update_complaint(
    complaint_id: str,
    payload: ComplaintUpdate,
    current_user: dict = Depends(get_current_user),
):
    complaint = await ensure_complaint_exists(complaint_id)
    update_data = {k: v for k, v in payload.model_dump(exclude_unset=True).items()}
    if update_data:
        update_data["updated_at"] = now_utc()
        await db.complaints.update_one({"_id": complaint_id}, {"$set": update_data})
    complaint = await ensure_complaint_exists(complaint_id)
    return serialize_complaint(complaint)


@app.post("/complaints/{complaint_id}/status", response_model=ComplaintOut)
async def update_complaint_status(
    complaint_id: str,
    payload: ComplaintStatusUpdate,
    current_user: dict = Depends(get_current_user),
):
    complaint = await ensure_complaint_exists(complaint_id)
    history_entry = {
        "status": payload.status,
        "note": payload.note,
        "changed_by": current_user["_id"],
        "changed_at": now_utc(),
    }
    updates = {
        "status": payload.status,
        "updated_at": now_utc(),
        "status_history": complaint.get("status_history", []) + [history_entry],
    }
    await db.complaints.update_one({"_id": complaint_id}, {"$set": updates})
    complaint = await ensure_complaint_exists(complaint_id)
    return serialize_complaint(complaint)


@app.post("/complaints/{complaint_id}/tasks", response_model=ComplaintOut)
async def add_complaint_task(
    complaint_id: str,
    payload: ComplaintTaskCreate,
    current_user: dict = Depends(get_current_user),
):
    await ensure_complaint_exists(complaint_id)
    now = now_utc()
    task_doc = {
        "id": str(uuid.uuid4()),
        "description": payload.description,
        "responsible": payload.responsible,
        "due_date": payload.due_date,
        "status": "open",
        "resolution_note": None,
        "completion_date": None,
        "created_at": now,
        "updated_at": now,
    }
    await db.complaints.update_one(
        {"_id": complaint_id},
        {"$push": {"tasks": task_doc}, "$set": {"updated_at": now}},
    )
    complaint = await ensure_complaint_exists(complaint_id)
    return serialize_complaint(complaint)


@app.patch("/complaints/{complaint_id}/tasks/{task_id}", response_model=ComplaintOut)
async def update_complaint_task(
    complaint_id: str,
    task_id: str,
    payload: ComplaintTaskUpdate,
    current_user: dict = Depends(get_current_user),
):
    complaint = await ensure_complaint_exists(complaint_id)
    tasks = complaint.get("tasks", [])
    task = next((item for item in tasks if item["id"] == task_id), None)
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
    data = payload.model_dump(exclude_unset=True)
    now = now_utc()
    if "description" in data:
        task["description"] = data["description"]
    if "responsible" in data:
        task["responsible"] = data["responsible"]
    if "due_date" in data:
        task["due_date"] = data["due_date"]
    if "status" in data:
        task["status"] = data["status"]
        if data["status"] == "completed":
            task["completion_date"] = now
        elif data["status"] in {"open", "in_progress"}:
            task["completion_date"] = None
    if "resolution_note" in data:
        task["resolution_note"] = data["resolution_note"]
    task["updated_at"] = now
    await db.complaints.update_one(
        {"_id": complaint_id},
        {"$set": {"tasks": tasks, "updated_at": now}},
    )
    complaint = await ensure_complaint_exists(complaint_id)
    return serialize_complaint(complaint)


# ---------------------------------------------------------------------------
# Risk model endpoints
# ---------------------------------------------------------------------------


@app.post("/risk-models", response_model=RiskModelOut, status_code=status.HTTP_201_CREATED)
async def create_risk_model(
    payload: RiskModelCreate,
    current_user: dict = Depends(get_current_user),
):
    doc = {
        "_id": str(uuid.uuid4()),
        **payload.model_dump(),
        "is_active": True,
        "created_by": current_user["_id"],
        "created_at": now_utc(),
        "updated_at": now_utc(),
    }
    await db.risk_models.insert_one(doc)
    return serialize_risk_model(doc)


@app.get("/risk-models", response_model=List[RiskModelOut])
async def list_risk_models(
    include_inactive: bool = Query(default=False),
    current_user: dict = Depends(get_current_user),
):
    query = {}
    if not include_inactive:
        query["is_active"] = True
    cursor = db.risk_models.find(query).sort("name", 1)
    models = [serialize_risk_model(doc) async for doc in cursor]
    return models


@app.get("/risk-models/{model_id}", response_model=RiskModelOut)
async def get_risk_model(model_id: str, current_user: dict = Depends(get_current_user)):
    model = await ensure_risk_model_exists(model_id)
    return serialize_risk_model(model)


@app.put("/risk-models/{model_id}", response_model=RiskModelOut)
async def update_risk_model(
    model_id: str,
    payload: RiskModelUpdate,
    current_user: dict = Depends(get_current_user),
):
    model = await ensure_risk_model_exists(model_id)
    update_data = payload.model_dump(exclude_unset=True)
    if update_data:
        update_data["updated_at"] = now_utc()
        await db.risk_models.update_one({"_id": model_id}, {"$set": update_data})
        model = await ensure_risk_model_exists(model_id)
    return serialize_risk_model(model)


# ---------------------------------------------------------------------------
# Risk record endpoints
# ---------------------------------------------------------------------------


@app.post("/risks", response_model=RiskRecordOut, status_code=status.HTTP_201_CREATED)
async def create_risk_record(
    payload: RiskRecordCreate,
    current_user: dict = Depends(get_current_user),
):
    model = await ensure_risk_model_exists(payload.model_id)
    # basic validation for required fields
    required_fields = [field.name for field in model.get("fields", []) if field.get("required")]
    missing_required = [
        name for name in required_fields if name not in payload.custom_fields
    ]
    if missing_required:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Missing required custom fields: {', '.join(missing_required)}",
        )

    risk_no = await generate_risk_no()
    now = now_utc()
    risk_score = payload.initial_score or calculate_risk_score(
        payload.likelihood, payload.impact, payload.detection
    )
    doc = {
        "_id": str(uuid.uuid4()),
        "risk_no": risk_no,
        **payload.model_dump(),
        "risk_score": risk_score,
        "status": "open",
        "actions": [],
        "revisions": [],
        "status_history": [
            {
                "status": "open",
                "note": "Risk created",
                "changed_by": current_user["_id"],
                "changed_at": now,
            }
        ],
        "created_by": current_user["_id"],
        "created_at": now,
        "updated_at": now,
    }
    await db.risk_records.insert_one(doc)
    return serialize_risk_record(doc)


@app.get("/risks", response_model=List[RiskRecordOut])
async def list_risk_records(
    model_id: Optional[str] = Query(default=None),
    status_filter: Optional[str] = Query(default=None),
    department: Optional[str] = Query(default=None),
    owner: Optional[str] = Query(default=None),
    search: Optional[str] = Query(default=None),
    current_user: dict = Depends(get_current_user),
):
    query = {}
    if model_id:
        query["model_id"] = model_id
    if status_filter:
        query["status"] = status_filter
    if department:
        query["department"] = department
    if owner:
        query["risk_owner"] = owner
    if search:
        query["$or"] = [
            {"risk_no": {"$regex": search, "$options": "i"}},
            {"subject": {"$regex": search, "$options": "i"}},
        ]
    cursor = db.risk_records.find(query).sort("updated_at", -1)
    risks = [serialize_risk_record(doc) async for doc in cursor]
    return risks


@app.get("/risks/{risk_id}", response_model=RiskRecordOut)
async def get_risk_record(risk_id: str, current_user: dict = Depends(get_current_user)):
    record = await ensure_risk_exists(risk_id)
    return serialize_risk_record(record)


@app.patch("/risks/{risk_id}", response_model=RiskRecordOut)
async def update_risk_record(
    risk_id: str,
    payload: RiskRecordUpdate,
    current_user: dict = Depends(get_current_user),
):
    record = await ensure_risk_exists(risk_id)
    update_data = payload.model_dump(exclude_unset=True)
    if update_data:
        if "custom_fields" in update_data and update_data["custom_fields"] is None:
            update_data["custom_fields"] = record.get("custom_fields", {})
        update_data["updated_at"] = now_utc()
        if any(key in update_data for key in ("likelihood", "impact", "detection")):
            likelihood = update_data.get("likelihood", record["likelihood"])
            impact = update_data.get("impact", record["impact"])
            detection = update_data.get("detection", record.get("detection"))
            update_data["risk_score"] = calculate_risk_score(likelihood, impact, detection)
        await db.risk_records.update_one({"_id": risk_id}, {"$set": update_data})
        record = await ensure_risk_exists(risk_id)
    return serialize_risk_record(record)


@app.post("/risks/{risk_id}/status", response_model=RiskRecordOut)
async def update_risk_status(
    risk_id: str,
    payload: RiskStatusUpdate,
    current_user: dict = Depends(get_current_user),
):
    record = await ensure_risk_exists(risk_id)
    history_entry = {
        "status": payload.status,
        "note": payload.note,
        "changed_by": current_user["_id"],
        "changed_at": now_utc(),
    }
    await db.risk_records.update_one(
        {"_id": risk_id},
        {
            "$set": {"status": payload.status, "updated_at": now_utc()},
            "$push": {"status_history": history_entry},
        },
    )
    record = await ensure_risk_exists(risk_id)
    return serialize_risk_record(record)


@app.post("/risks/{risk_id}/revisions", response_model=RiskRecordOut)
async def add_risk_revision(
    risk_id: str,
    payload: RiskRevisionCreate,
    current_user: dict = Depends(get_current_user),
):
    record = await ensure_risk_exists(risk_id)
    now = now_utc()
    risk_score = calculate_risk_score(payload.likelihood, payload.impact, payload.detection)
    revision = {
        "id": str(uuid.uuid4()),
        "likelihood": payload.likelihood,
        "impact": payload.impact,
        "detection": payload.detection,
        "evaluation_date": payload.evaluation_date or now,
        "risk_score": risk_score,
        "note": payload.note,
        "changed_by": current_user["_id"],
        "changed_at": now,
        "custom_fields": payload.custom_fields or record.get("custom_fields", {}),
    }
    await db.risk_records.update_one(
        {"_id": risk_id},
        {
            "$set": {
                "likelihood": payload.likelihood,
                "impact": payload.impact,
                "detection": payload.detection,
                "risk_score": risk_score,
                "evaluation_date": payload.evaluation_date or now,
                "custom_fields": revision["custom_fields"],
                "updated_at": now,
            },
            "$push": {"revisions": revision},
        },
    )
    record = await ensure_risk_exists(risk_id)
    return serialize_risk_record(record)


@app.post("/risks/{risk_id}/actions", response_model=RiskRecordOut)
async def add_risk_action(
    risk_id: str,
    payload: RiskActionCreate,
    current_user: dict = Depends(get_current_user),
):
    await ensure_risk_exists(risk_id)
    now = now_utc()
    action_doc = {
        "id": str(uuid.uuid4()),
        "description": payload.description,
        "responsible": payload.responsible,
        "due_date": payload.due_date,
        "status": "open",
        "note": None,
        "completion_date": None,
        "created_at": now,
        "updated_at": now,
    }
    await db.risk_records.update_one(
        {"_id": risk_id},
        {"$push": {"actions": action_doc}, "$set": {"updated_at": now}},
    )
    record = await ensure_risk_exists(risk_id)
    return serialize_risk_record(record)


@app.patch("/risks/{risk_id}/actions/{action_id}", response_model=RiskRecordOut)
async def update_risk_action(
    risk_id: str,
    action_id: str,
    payload: RiskActionUpdate,
    current_user: dict = Depends(get_current_user),
):
    record = await ensure_risk_exists(risk_id)
    actions = record.get("actions", [])
    action = next((item for item in actions if item["id"] == action_id), None)
    if not action:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Action not found")
    data = payload.model_dump(exclude_unset=True)
    now = now_utc()
    if "description" in data:
        action["description"] = data["description"]
    if "responsible" in data:
        action["responsible"] = data["responsible"]
    if "due_date" in data:
        action["due_date"] = data["due_date"]
    if "status" in data:
        action["status"] = data["status"]
        if data["status"] == "completed":
            action["completion_date"] = now
        elif data["status"] in {"open", "in_progress"}:
            action["completion_date"] = None
    if "note" in data:
        action["note"] = data["note"]
    action["updated_at"] = now
    await db.risk_records.update_one(
        {"_id": risk_id},
        {"$set": {"actions": actions, "updated_at": now}},
    )
    record = await ensure_risk_exists(risk_id)
    return serialize_risk_record(record)


# ---------------------------------------------------------------------------
# Audit endpoints
# ---------------------------------------------------------------------------


@app.post("/audits", response_model=AuditOut, status_code=status.HTTP_201_CREATED)
async def create_audit(
    payload: AuditCreate,
    current_user: dict = Depends(get_current_user),
):
    audit_code = payload.audit_code or await generate_audit_code()
    now = now_utc()
    doc = {
        "_id": str(uuid.uuid4()),
        "audit_code": audit_code,
        "audit_type": payload.audit_type,
        "scope": payload.scope,
        "department": payload.department,
        "start_date": payload.start_date,
        "end_date": payload.end_date,
        "status": "planned",
        "lead_auditor": payload.lead_auditor,
        "audit_team": [member.model_dump() for member in payload.audit_team],
        "auditee_representative": payload.auditee_representative,
        "objectives": payload.objectives,
        "checklist": [item.model_dump() for item in payload.checklist],
        "findings": [],
        "status_history": [
            {
                "status": "planned",
                "note": "Audit created",
                "changed_by": current_user["_id"],
                "changed_at": now,
            }
        ],
        "created_by": current_user["_id"],
        "created_at": now,
        "updated_at": now,
    }
    await db.audits.insert_one(doc)
    return serialize_audit(doc)


@app.get("/audits", response_model=List[AuditOut])
async def list_audits(
    status_filter: Optional[str] = Query(default=None),
    department: Optional[str] = Query(default=None),
    audit_type: Optional[str] = Query(default=None),
    search: Optional[str] = Query(default=None),
    current_user: dict = Depends(get_current_user),
):
    query = {}
    if status_filter:
        query["status"] = status_filter
    if department:
        query["department"] = department
    if audit_type:
        query["audit_type"] = audit_type
    if search:
        query["$or"] = [
            {"audit_code": {"$regex": search, "$options": "i"}},
            {"scope": {"$regex": search, "$options": "i"}},
        ]
    cursor = db.audits.find(query).sort("updated_at", -1)
    audits = [serialize_audit(doc) async for doc in cursor]
    return audits


@app.get("/audits/{audit_id}", response_model=AuditOut)
async def get_audit(audit_id: str, current_user: dict = Depends(get_current_user)):
    audit = await ensure_audit_exists(audit_id)
    return serialize_audit(audit)


@app.patch("/audits/{audit_id}", response_model=AuditOut)
async def update_audit(
    audit_id: str,
    payload: AuditUpdate,
    current_user: dict = Depends(get_current_user),
):
    audit = await ensure_audit_exists(audit_id)
    update_data = payload.model_dump(exclude_unset=True)
    if update_data:
        if "audit_team" in update_data:
            update_data["audit_team"] = [member.dict() for member in payload.audit_team]  # type: ignore[attr-defined]
        if "checklist" in update_data and update_data["checklist"] is not None:
            update_data["checklist"] = [item.dict() for item in payload.checklist]  # type: ignore[attr-defined]
        update_data["updated_at"] = now_utc()
        await db.audits.update_one({"_id": audit_id}, {"$set": update_data})
        audit = await ensure_audit_exists(audit_id)
    return serialize_audit(audit)


@app.post("/audits/{audit_id}/status", response_model=AuditOut)
async def update_audit_status(
    audit_id: str,
    payload: AuditStatusUpdate,
    current_user: dict = Depends(get_current_user),
):
    audit = await ensure_audit_exists(audit_id)
    history_entry = {
        "status": payload.status,
        "note": payload.note,
        "changed_by": current_user["_id"],
        "changed_at": now_utc(),
    }
    await db.audits.update_one(
        {"_id": audit_id},
        {
            "$set": {"status": payload.status, "updated_at": now_utc()},
            "$push": {"status_history": history_entry},
        },
    )
    audit = await ensure_audit_exists(audit_id)
    return serialize_audit(audit)


@app.post("/audits/{audit_id}/findings", response_model=AuditOut)
async def add_audit_finding(
    audit_id: str,
    payload: AuditFindingCreate,
    current_user: dict = Depends(get_current_user),
):
    await ensure_audit_exists(audit_id)
    now = now_utc()
    finding = {
        "id": str(uuid.uuid4()),
        "finding_type": payload.finding_type,
        "description": payload.description,
        "requirement_reference": payload.requirement_reference,
        "related_capa_id": payload.related_capa_id,
        "status": "open",
        "corrective_action": None,
        "created_at": now,
        "updated_at": now,
    }
    await db.audits.update_one(
        {"_id": audit_id},
        {"$push": {"findings": finding}, "$set": {"updated_at": now}},
    )
    audit = await ensure_audit_exists(audit_id)
    return serialize_audit(audit)


@app.patch("/audits/{audit_id}/findings/{finding_id}", response_model=AuditOut)
async def update_audit_finding(
    audit_id: str,
    finding_id: str,
    payload: AuditFindingUpdate,
    current_user: dict = Depends(get_current_user),
):
    audit = await ensure_audit_exists(audit_id)
    findings = audit.get("findings", [])
    finding = next((item for item in findings if item["id"] == finding_id), None)
    if not finding:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Finding not found")
    data = payload.model_dump(exclude_unset=True)
    now = now_utc()
    if "finding_type" in data:
        finding["finding_type"] = data["finding_type"]
    if "description" in data:
        finding["description"] = data["description"]
    if "requirement_reference" in data:
        finding["requirement_reference"] = data["requirement_reference"]
    if "related_capa_id" in data:
        finding["related_capa_id"] = data["related_capa_id"]
    if "status" in data:
        finding["status"] = data["status"]
        if data["status"] == "closed" and "corrective_action" not in data:
            finding.setdefault("corrective_action", "Closed without corrective action detail")
    if "corrective_action" in data:
        finding["corrective_action"] = data["corrective_action"]
    finding["updated_at"] = now
    await db.audits.update_one(
        {"_id": audit_id},
        {"$set": {"findings": findings, "updated_at": now}},
    )
    audit = await ensure_audit_exists(audit_id)
    return serialize_audit(audit)


# ---------------------------------------------------------------------------
# Equipment endpoints
# ---------------------------------------------------------------------------


@app.post("/equipment", response_model=EquipmentOut, status_code=status.HTTP_201_CREATED)
async def create_equipment(
    payload: EquipmentCreate,
    current_user: dict = Depends(get_current_user),
):
    now = now_utc()
    doc = {
        "_id": str(uuid.uuid4()),
        **payload.model_dump(),
        "process_definitions": [proc.model_dump() for proc in payload.process_definitions],
        "work_orders": [],
        "created_by": current_user["_id"],
        "created_at": now,
        "updated_at": now,
    }
    existing = await db.equipment.find_one({"code": payload.code})
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Equipment code already exists")
    await db.equipment.insert_one(doc)
    return serialize_equipment(doc)


@app.get("/equipment", response_model=List[EquipmentOut])
async def list_equipment(
    department: Optional[str] = Query(default=None),
    category: Optional[str] = Query(default=None),
    responsible: Optional[str] = Query(default=None),
    search: Optional[str] = Query(default=None),
    current_user: dict = Depends(get_current_user),
):
    query = {}
    if department:
        query["department"] = department
    if category:
        query["category"] = category
    if responsible:
        query["responsible"] = responsible
    if search:
        query["$or"] = [
            {"code": {"$regex": search, "$options": "i"}},
            {"name": {"$regex": search, "$options": "i"}},
            {"description": {"$regex": search, "$options": "i"}},
        ]
    cursor = db.equipment.find(query).sort("name", 1)
    equipment_list = [serialize_equipment(doc) async for doc in cursor]
    return equipment_list


@app.get("/equipment/{equipment_id}", response_model=EquipmentOut)
async def get_equipment(
    equipment_id: str,
    current_user: dict = Depends(get_current_user),
):
    equipment = await ensure_equipment_exists(equipment_id)
    return serialize_equipment(equipment)


@app.patch("/equipment/{equipment_id}", response_model=EquipmentOut)
async def update_equipment(
    equipment_id: str,
    payload: EquipmentUpdate,
    current_user: dict = Depends(get_current_user),
):
    equipment = await ensure_equipment_exists(equipment_id)
    update_data = payload.model_dump(exclude_unset=True)
    if update_data:
        if "process_definitions" in update_data:
            update_data["process_definitions"] = [proc.dict() for proc in payload.process_definitions]  # type: ignore[attr-defined]
        update_data["updated_at"] = now_utc()
        await db.equipment.update_one({"_id": equipment_id}, {"$set": update_data})
        equipment = await ensure_equipment_exists(equipment_id)
    return serialize_equipment(equipment)


@app.post("/equipment/{equipment_id}/work-orders", response_model=EquipmentOut)
async def create_work_order(
    equipment_id: str,
    payload: WorkOrderCreate,
    current_user: dict = Depends(get_current_user),
):
    equipment = await ensure_equipment_exists(equipment_id)
    now = now_utc()
    work_order = {
        "id": str(uuid.uuid4()),
        "process_type": payload.process_type,
        "scheduled_date": payload.scheduled_date,
        "assigned_to": payload.assigned_to,
        "status": "scheduled",
        "notes": payload.notes,
        "auto_generated": payload.auto_generated,
        "actual_date": None,
        "result": None,
        "created_at": now,
        "updated_at": now,
    }
    await db.equipment.update_one(
        {"_id": equipment_id},
        {"$push": {"work_orders": work_order}, "$set": {"updated_at": now}},
    )
    equipment = await ensure_equipment_exists(equipment_id)
    return serialize_equipment(equipment)


@app.patch("/equipment/{equipment_id}/work-orders/{work_order_id}", response_model=EquipmentOut)
async def update_work_order(
    equipment_id: str,
    work_order_id: str,
    payload: WorkOrderUpdate,
    current_user: dict = Depends(get_current_user),
):
    equipment = await ensure_equipment_exists(equipment_id)
    work_orders = equipment.get("work_orders", [])
    work_order = next((item for item in work_orders if item["id"] == work_order_id), None)
    if not work_order:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Work order not found")
    data = payload.model_dump(exclude_unset=True)
    now = now_utc()
    if "status" in data:
        work_order["status"] = data["status"]
        if data["status"] == "completed" and "actual_date" not in data:
            work_order.setdefault("actual_date", now)
    if "actual_date" in data:
        work_order["actual_date"] = data["actual_date"]
    if "result" in data:
        work_order["result"] = data["result"]
    if "notes" in data:
        work_order["notes"] = data["notes"]
    work_order["updated_at"] = now
    await db.equipment.update_one(
        {"_id": equipment_id},
        {"$set": {"work_orders": work_orders, "updated_at": now}},
    )
    equipment = await ensure_equipment_exists(equipment_id)
    return serialize_equipment(equipment)


# ---------------------------------------------------------------------------
# Reporting endpoints
# ---------------------------------------------------------------------------


@app.get("/reports/capa")
async def capa_report(
    start_date: Optional[str] = Query(default=None),
    end_date: Optional[str] = Query(default=None),
    department: Optional[str] = Query(default=None),
    status_filter: Optional[str] = Query(default=None),
    export: bool = Query(default=False),
    current_user: dict = Depends(get_current_user),
):
    start_dt = parse_datetime(start_date)
    end_dt = parse_datetime(end_date)

    query: dict[str, Any] = {}
    if department:
        query["department"] = department
    if status_filter:
        query["status"] = status_filter
    if start_dt or end_dt:
        query["created_at"] = {}
        if start_dt:
            query["created_at"]["$gte"] = start_dt
        if end_dt:
            query["created_at"]["$lte"] = end_dt

    total_capas = await db.capas.count_documents(query)

    status_pipeline = [
        {"$match": query},
        {"$group": {"_id": "$status", "count": {"$sum": 1}}},
    ]
    status_counts_docs = await db.capas.aggregate(status_pipeline).to_list(None)
    status_counts = {doc["_id"] or "unknown": doc["count"] for doc in status_counts_docs}

    department_pipeline = [
        {"$match": query},
        {"$group": {"_id": "$department", "count": {"$sum": 1}}},
    ]
    department_counts_docs = await db.capas.aggregate(department_pipeline).to_list(None)
    department_counts = {doc["_id"] or "Unassigned": doc["count"] for doc in department_counts_docs}

    now = now_utc()
    overdue_filter = dict(query)
    overdue_filter["status"] = {"$in": ["open", "investigating", "implementing"]}
    overdue_filter["target_date"] = {"$lt": now}
    overdue_total = await db.capas.count_documents(overdue_filter)

    overdue_cursor = (
        db.capas.find(
            overdue_filter,
            {
                "_id": 1,
                "capa_no": 1,
                "title": 1,
                "department": 1,
                "target_date": 1,
                "team_leader": 1,
                "status": 1,
            },
        )
        .sort("target_date", 1)
        .limit(10)
    )
    overdue_items = []
    async for doc in overdue_cursor:
        overdue_items.append(
            {
                "id": doc["_id"],
                "capa_no": doc.get("capa_no"),
                "title": doc.get("title"),
                "department": doc.get("department"),
                "team_leader": doc.get("team_leader"),
                "status": doc.get("status"),
                "target_date": doc.get("target_date"),
            }
        )

    action_pipeline = [
        {"$match": query},
        {"$unwind": "$actions"},
        {"$group": {"_id": "$actions.status", "count": {"$sum": 1}}},
    ]
    action_counts_docs = await db.capas.aggregate(action_pipeline).to_list(None)
    action_counts = {doc["_id"] or "unknown": doc["count"] for doc in action_counts_docs}
    total_actions = sum(action_counts.values())

    overdue_actions_pipeline = [
        {"$match": query},
        {"$unwind": "$actions"},
        {
            "$match": {
                "actions.status": {"$in": ["open", "in_progress", "overdue"]},
                "actions.due_date": {"$lt": now},
            }
        },
        {"$count": "total"},
    ]
    overdue_actions_docs = await db.capas.aggregate(overdue_actions_pipeline).to_list(None)
    overdue_actions = overdue_actions_docs[0]["total"] if overdue_actions_docs else 0

    closure_pipeline = [
        {"$match": {**query, "status": "closed", "final_report_date": {"$ne": None}}},
        {
            "$project": {
                "duration_days": {
                    "$divide": [
                        {"$subtract": ["$final_report_date", "$created_at"]},
                        86400000,
                    ]
                }
            }
        },
        {
            "$group": {
                "_id": None,
                "avg_duration": {"$avg": "$duration_days"},
                "min_duration": {"$min": "$duration_days"},
                "max_duration": {"$max": "$duration_days"},
            }
        },
    ]
    closure_stats_doc = await db.capas.aggregate(closure_pipeline).to_list(1)
    closure_stats = (
        {
            "average_days": round(closure_stats_doc[0]["avg_duration"], 2),
            "min_days": round(closure_stats_doc[0]["min_duration"], 2),
            "max_days": round(closure_stats_doc[0]["max_duration"], 2),
        }
        if closure_stats_doc
        else {"average_days": None, "min_days": None, "max_days": None}
    )

    summary = {
        "generated_at": now,
        "filters": {
            "start_date": start_dt,
            "end_date": end_dt,
            "department": department,
            "status": status_filter,
        },
        "total_capas": total_capas,
        "status_counts": status_counts,
        "department_counts": department_counts,
        "overdue": {"count": overdue_total, "top_items": overdue_items},
        "actions": {
            "total": total_actions,
            "status_counts": action_counts,
            "overdue_actions": overdue_actions,
        },
        "closure_stats": closure_stats,
    }

    if export:
        payload = await export_to_json([summary])
        filename = f"capa_report_{now.strftime('%Y%m%d%H%M%S')}.json"
        headers = {"Content-Disposition": f'attachment; filename="{filename}"'}
        return Response(content=payload, media_type="application/json", headers=headers)

    return summary


@app.get("/reports/complaints")
async def complaint_report(
    start_date: Optional[str] = Query(default=None),
    end_date: Optional[str] = Query(default=None),
    department: Optional[str] = Query(default=None),
    priority: Optional[str] = Query(default=None),
    status_filter: Optional[str] = Query(default=None),
    export: bool = Query(default=False),
    current_user: dict = Depends(get_current_user),
):
    start_dt = parse_datetime(start_date)
    end_dt = parse_datetime(end_date)

    query: dict[str, Any] = {}
    if department:
        query["department"] = department
    if priority:
        query["priority"] = priority
    if status_filter:
        query["status"] = status_filter
    if start_dt or end_dt:
        query["created_at"] = {}
        if start_dt:
            query["created_at"]["$gte"] = start_dt
        if end_dt:
            query["created_at"]["$lte"] = end_dt

    total_complaints = await db.complaints.count_documents(query)

    status_pipeline = [
        {"$match": query},
        {"$group": {"_id": "$status", "count": {"$sum": 1}}},
    ]
    status_counts_docs = await db.complaints.aggregate(status_pipeline).to_list(None)
    status_counts = {doc["_id"] or "unknown": doc["count"] for doc in status_counts_docs}

    department_pipeline = [
        {"$match": query},
        {"$group": {"_id": "$department", "count": {"$sum": 1}}},
    ]
    department_counts_docs = await db.complaints.aggregate(department_pipeline).to_list(None)
    department_counts = {doc["_id"] or "Unassigned": doc["count"] for doc in department_counts_docs}

    priority_pipeline = [
        {"$match": query},
        {"$group": {"_id": "$priority", "count": {"$sum": 1}}},
    ]
    priority_counts_docs = await db.complaints.aggregate(priority_pipeline).to_list(None)
    priority_counts = {doc["_id"] or "unknown": doc["count"] for doc in priority_counts_docs}

    now = now_utc()
    overdue_tasks_cursor = db.complaints.find(
        {
            **query,
            "tasks": {
                "$elemMatch": {
                    "status": {"$in": ["open", "in_progress"]},
                    "due_date": {"$lt": now},
                }
            },
        },
        {
            "_id": 1,
            "complaint_no": 1,
            "customer_name": 1,
            "department": 1,
            "priority": 1,
            "tasks": 1,
        },
    )
    overdue_tasks_items = []
    async for doc in overdue_tasks_cursor:
        overdue_tasks = [
            {
                "task_id": task["id"],
                "description": task["description"],
                "responsible": task["responsible"],
                "due_date": task["due_date"],
                "status": task["status"],
            }
            for task in doc.get("tasks", [])
            if task["status"] in {"open", "in_progress"} and task["due_date"] < now
        ]
        if overdue_tasks:
            overdue_tasks_items.append(
                {
                    "id": doc["_id"],
                    "complaint_no": doc.get("complaint_no"),
                    "customer_name": doc.get("customer_name"),
                    "department": doc.get("department"),
                    "priority": doc.get("priority"),
                    "overdue_tasks": overdue_tasks,
                }
            )

    resolution_pipeline = [
        {"$match": {**query, "status": {"$in": ["resolved", "closed"]}}},
        {
            "$project": {
                "duration_days": {
                    "$divide": [{"$subtract": ["$updated_at", "$created_at"]}, 86400000]
                }
            }
        },
        {
            "$group": {
                "_id": None,
                "avg_duration": {"$avg": "$duration_days"},
                "min_duration": {"$min": "$duration_days"},
                "max_duration": {"$max": "$duration_days"},
            }
        },
    ]
    resolution_stats_doc = await db.complaints.aggregate(resolution_pipeline).to_list(1)
    resolution_stats = (
        {
            "average_days": round(resolution_stats_doc[0]["avg_duration"], 2),
            "min_days": round(resolution_stats_doc[0]["min_duration"], 2),
            "max_days": round(resolution_stats_doc[0]["max_duration"], 2),
        }
        if resolution_stats_doc
        else {"average_days": None, "min_days": None, "max_days": None}
    )

    summary = {
        "generated_at": now,
        "filters": {
            "start_date": start_dt,
            "end_date": end_dt,
            "department": department,
            "priority": priority,
            "status": status_filter,
        },
        "totals": {
            "complaints": total_complaints,
            "status_counts": status_counts,
            "department_counts": department_counts,
            "priority_counts": priority_counts,
        },
        "overdue_tasks": overdue_tasks_items,
        "resolution_stats": resolution_stats,
    }

    if export:
        payload = await export_to_json([summary])
        filename = f"complaint_report_{now.strftime('%Y%m%d%H%M%S')}.json"
        headers = {"Content-Disposition": f'attachment; filename="{filename}"'}
        return Response(content=payload, media_type="application/json", headers=headers)

    return summary

@app.patch("/capas/{capa_id}", response_model=CapaOut)
async def update_capa(
    capa_id: str,
    payload: CapaUpdate,
    current_user: dict = Depends(get_current_user),
):
    capa = await ensure_capa_exists(capa_id)
    update_data = {k: v for k, v in payload.model_dump(exclude_unset=True).items()}
    if not update_data:
        return serialize_capa(capa)
    update_data["updated_at"] = now_utc()
    await db.capas.update_one({"_id": capa_id}, {"$set": update_data})
    capa = await ensure_capa_exists(capa_id)
    return serialize_capa(capa)


@app.post("/capas/{capa_id}/status", response_model=CapaOut)
async def update_capa_status(
    capa_id: str,
    payload: CapaStatusUpdate,
    current_user: dict = Depends(get_current_user),
):
    capa = await ensure_capa_exists(capa_id)
    history_entry = {
        "status": payload.status,
        "note": payload.note,
        "changed_by": current_user["_id"],
        "changed_at": now_utc(),
    }
    updates = {
        "status": payload.status,
        "updated_at": now_utc(),
        "status_history": capa.get("status_history", []) + [history_entry],
    }
    if payload.status == "closed":
        updates["final_report_date"] = now_utc()
    await db.capas.update_one({"_id": capa_id}, {"$set": updates})
    capa = await ensure_capa_exists(capa_id)
    return serialize_capa(capa)


@app.post("/capas/{capa_id}/actions", response_model=CapaOut)
async def add_capa_action(
    capa_id: str,
    payload: CapaActionCreate,
    current_user: dict = Depends(get_current_user),
):
    await ensure_capa_exists(capa_id)
    now = now_utc()
    action_doc = {
        "id": str(uuid.uuid4()),
        "description": payload.description,
        "responsible": payload.responsible,
        "due_date": payload.due_date,
        "status": "open",
        "completion_note": None,
        "completion_date": None,
        "created_at": now,
        "updated_at": now,
    }
    await db.capas.update_one(
        {"_id": capa_id},
        {
            "$push": {"actions": action_doc},
            "$set": {"updated_at": now},
        },
    )
    capa = await ensure_capa_exists(capa_id)
    return serialize_capa(capa)


@app.patch("/capas/{capa_id}/actions/{action_id}", response_model=CapaOut)
async def update_capa_action(
    capa_id: str,
    action_id: str,
    payload: CapaActionUpdate,
    current_user: dict = Depends(get_current_user),
):
    capa = await ensure_capa_exists(capa_id)
    actions = capa.get("actions", [])
    action = next((item for item in actions if item["id"] == action_id), None)
    if not action:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Action not found")

    update_data = payload.model_dump(exclude_unset=True)
    now = now_utc()
    if "description" in update_data:
        action["description"] = update_data["description"]
    if "responsible" in update_data:
        action["responsible"] = update_data["responsible"]
    if "due_date" in update_data:
        action["due_date"] = update_data["due_date"]
    if "status" in update_data:
        action["status"] = update_data["status"]
        if update_data["status"] == "completed":
            action["completion_date"] = now
        elif update_data["status"] in {"open", "in_progress"}:
            action["completion_date"] = None
    if "completion_note" in update_data:
        action["completion_note"] = update_data["completion_note"]
    action["updated_at"] = now

    await db.capas.update_one(
        {"_id": capa_id},
        {"$set": {"actions": actions, "updated_at": now}},
    )
    capa = await ensure_capa_exists(capa_id)
    return serialize_capa(capa)




# ---------------------------------------------------------------------------
# Role endpoints
# ---------------------------------------------------------------------------


@app.post("/roles", response_model=RoleOut, status_code=status.HTTP_201_CREATED)
async def create_role(role: RoleBase, current_user: dict = Depends(get_current_user)):
    existing = await db.roles.find_one({"name": role.name})
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Role already exists")
    doc = {
        "_id": str(uuid.uuid4()),
        **role.model_dump(),
        "is_system": False,
        "created_at": now_utc(),
        "updated_at": now_utc(),
    }
    await db.roles.insert_one(doc)
    return serialize_role(doc)


@app.get("/roles", response_model=List[RoleOut])
async def list_roles(current_user: dict = Depends(get_current_user)):
    cursor = db.roles.find({}).sort("display_name", 1)
    roles = [serialize_role(doc) async for doc in cursor]
    return roles


# ---------------------------------------------------------------------------
# User endpoints
# ---------------------------------------------------------------------------


@app.post("/users", response_model=UserOut, status_code=status.HTTP_201_CREATED)
async def create_user(payload: UserCreate, current_user: dict = Depends(get_current_user)):
    if await db.users.find_one({"username": payload.username}):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Username already exists")
    if await db.users.find_one({"email": payload.email}):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="E-mail already exists")

    doc = {
        "_id": str(uuid.uuid4()),
        **payload.model_dump(exclude={"password"}),
        "password_hash": hash_password(payload.password),
        "full_name": f"{payload.first_name} {payload.last_name}",
        "created_at": now_utc(),
        "updated_at": now_utc(),
    }
    await db.users.insert_one(doc)
    return serialize_user(doc)


@app.get("/users", response_model=List[UserOut])
async def list_users(
    department_id: Optional[str] = Query(default=None),
    role_id: Optional[str] = Query(default=None),
    status_filter: Optional[str] = Query(default=None),
    current_user: dict = Depends(get_current_user),
):
    query = {}
    if department_id:
        query["department_id"] = department_id
    if role_id:
        query["roles"] = role_id
    if status_filter:
        query["status"] = status_filter

    cursor = db.users.find(query).sort("full_name", 1)
    users = [serialize_user(doc) async for doc in cursor]
    return users


@app.put("/users/{user_id}", response_model=UserOut)
async def update_user(user_id: str, payload: UserUpdate, current_user: dict = Depends(get_current_user)):
    update_data = {k: v for k, v in payload.model_dump(exclude_unset=True).items()}
    if not update_data:
        user = await db.users.find_one({"_id": user_id})
        if not user:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
        return serialize_user(user)
    update_data["updated_at"] = now_utc()
    if "first_name" in update_data or "last_name" in update_data:
        user = await db.users.find_one({"_id": user_id})
        if not user:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
        update_data.setdefault("first_name", user["first_name"])
        update_data.setdefault("last_name", user["last_name"])
        update_data["full_name"] = f"{update_data['first_name']} {update_data['last_name']}"
    result = await db.users.update_one({"_id": user_id}, {"$set": update_data})
    if result.matched_count == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    user = await db.users.find_one({"_id": user_id})
    return serialize_user(user)


@app.patch("/users/{user_id}/status", response_model=UserOut)
async def update_user_status(user_id: str, payload: StatusUpdateRequest, current_user: dict = Depends(get_current_user)):
    result = await db.users.update_one(
        {"_id": user_id},
        {"$set": {"status": payload.status, "updated_at": now_utc()}},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    user = await db.users.find_one({"_id": user_id})
    return serialize_user(user)


# ---------------------------------------------------------------------------
# Auth endpoints
# ---------------------------------------------------------------------------


@app.post("/auth/login", response_model=TokenResponse)
async def login(request: LoginRequest):
    user = await db.users.find_one({"username": request.username})
    if not user or not verify_password(request.password, user["password_hash"]):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    if user.get("status") != "active":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User is not active")

    access_token = create_access_token(user["_id"])
    refresh_token = await create_refresh_token(user["_id"])
    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        expires_in=ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )


@app.post("/auth/refresh", response_model=TokenResponse)
async def refresh_token(request: RefreshRequest):
    session = await validate_refresh_token(request.refresh_token)
    user = await db.users.find_one({"_id": session["user_id"]})
    if not user or user.get("status") != "active":
        await revoke_refresh_token(request.refresh_token)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not active")

    access_token = create_access_token(session["user_id"])
    # Optionally rotate refresh token
    await revoke_refresh_token(request.refresh_token)
    new_refresh_token = await create_refresh_token(session["user_id"])

    return TokenResponse(
        access_token=access_token,
        refresh_token=new_refresh_token,
        expires_in=ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )


@app.post("/auth/logout")
async def logout(request: RefreshRequest, current_user: dict = Depends(get_current_user)):
    session = await validate_refresh_token(request.refresh_token)
    if session["user_id"] != current_user["_id"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Token does not belong to user")
    await revoke_refresh_token(request.refresh_token)
    return {"status": "ok"}


@app.get("/auth/me", response_model=UserOut)
async def get_profile(current_user: dict = Depends(get_current_user)):
    return serialize_user(current_user)


# ---------------------------------------------------------------------------
# Startup health check routes
# ---------------------------------------------------------------------------


@app.get("/health")
async def health_check():
    return {"status": "ok", "timestamp": now_utc()}
