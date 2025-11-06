"""
Workflow Engine
Dinamik iş akışı yönetimi, onay matrisi, otomatik görev atama
"""
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any, Literal
from datetime import datetime
from enum import Enum


# ============================================================================
# ENUM'LAR
# ============================================================================

class WorkflowStatus(str, Enum):
    """Workflow durumu"""
    ACTIVE = "active"
    INACTIVE = "inactive"
    ARCHIVED = "archived"


class StepStatus(str, Enum):
    """Adım durumu"""
    PENDING = "pending"              # Bekliyor
    IN_PROGRESS = "in_progress"      # Devam ediyor
    COMPLETED = "completed"          # Tamamlandı
    REJECTED = "rejected"            # Reddedildi
    SKIPPED = "skipped"              # Atlandı
    CANCELLED = "cancelled"          # İptal edildi


class StepType(str, Enum):
    """Adım tipi"""
    APPROVAL = "approval"            # Onay
    TASK = "task"                    # Görev
    NOTIFICATION = "notification"    # Bildirim
    AUTO_TASK = "auto_task"          # Otomatik görev
    CONDITION = "condition"          # Koşul
    PARALLEL = "parallel"            # Paralel işlem


class TriggerType(str, Enum):
    """Tetikleyici tipi"""
    MANUAL = "manual"                # Manuel
    STATUS_CHANGE = "status_change"  # Durum değişikliği
    TIME_BASED = "time_based"        # Zamana bağlı
    FIELD_UPDATE = "field_update"    # Alan güncelleme
    AUTO = "auto"                    # Otomatik


class ApprovalType(str, Enum):
    """Onay tipi"""
    SINGLE = "single"                # Tek onay
    ALL = "all"                      # Hepsi onaylamalı
    MAJORITY = "majority"            # Çoğunluk
    ANY = "any"                      # Herhangi biri
    SEQUENCE = "sequence"            # Sıralı


# ============================================================================
# WORKFLOW TANIMLARI
# ============================================================================

class WorkflowCondition(BaseModel):
    """Workflow koşulu"""
    field: str
    operator: Literal["equals", "not_equals", "contains", "greater_than", "less_than", "in", "not_in"]
    value: Any


class WorkflowAction(BaseModel):
    """Workflow aksiyonu"""
    action_type: Literal["set_field", "send_email", "create_task", "call_api", "run_script"]
    parameters: Dict[str, Any]


class StepAssignment(BaseModel):
    """Adım ataması"""
    assignment_type: Literal["user", "role", "group", "department", "auto"]
    user_ids: List[str] = Field(default_factory=list)
    role_names: List[str] = Field(default_factory=list)
    group_ids: List[str] = Field(default_factory=list)
    department_ids: List[str] = Field(default_factory=list)
    
    # Otomatik atama kuralları
    auto_rule: Optional[str] = Field(None, description="Örn: 'record.department_manager'")


class StepConfig(BaseModel):
    """Adım konfigürasyonu"""
    # Temel
    step_id: str
    name: str
    description: Optional[str] = None
    step_type: StepType
    
    # Atama
    assignment: StepAssignment
    
    # Onay ayarları (approval için)
    approval_type: Optional[ApprovalType] = None
    min_approvals: Optional[int] = None
    
    # Zaman limitleri
    due_in_hours: Optional[int] = None
    escalation_hours: Optional[int] = None
    escalate_to: Optional[List[str]] = None
    
    # Koşullar
    conditions: List[WorkflowCondition] = Field(default_factory=list)
    
    # Aksiyonlar
    on_complete: List[WorkflowAction] = Field(default_factory=list)
    on_reject: List[WorkflowAction] = Field(default_factory=list)
    
    # Sonraki adımlar
    next_step_on_approve: Optional[str] = None
    next_step_on_reject: Optional[str] = None
    next_step_default: Optional[str] = None
    
    # Seçenekler
    is_optional: bool = False
    allow_delegation: bool = False
    allow_comments: bool = True


class WorkflowTemplate(BaseModel):
    """Workflow şablonu"""
    id: str
    name: str
    description: Optional[str] = None
    module: str = Field(..., description="İlişkili modül (dof, document, etc.)")
    version: int = 1
    
    # Adımlar
    steps: List[StepConfig]
    initial_step_id: str
    
    # Tetikleyiciler
    triggers: List[TriggerType] = Field(default_factory=list)
    
    # Ayarlar
    allow_parallel: bool = False
    auto_start: bool = False
    
    # Durum
    status: WorkflowStatus = WorkflowStatus.ACTIVE
    
    # Metadata
    created_by: str
    created_at: datetime
    updated_at: datetime
    
    class Config:
        json_schema_extra = {
            "example": {
                "id": "wf_dof_approval",
                "name": "DÖF Onay Süreci",
                "module": "dof",
                "initial_step_id": "step_investigation",
                "steps": [
                    {
                        "step_id": "step_investigation",
                        "name": "İlk Araştırma",
                        "step_type": "task",
                        "assignment": {
                            "assignment_type": "auto",
                            "auto_rule": "record.team_leader"
                        }
                    }
                ]
            }
        }


# ============================================================================
# WORKFLOW İNSTANCE
# ============================================================================

class StepInstance(BaseModel):
    """Adım instance"""
    step_id: str
    step_config_id: str
    name: str
    step_type: StepType
    status: StepStatus = StepStatus.PENDING
    
    # Atananlar
    assigned_to: List[str] = Field(default_factory=list)
    assigned_to_names: List[str] = Field(default_factory=list)
    
    # Onaylar (approval için)
    approvers: List[Dict] = Field(default_factory=list)
    # Her approver: {user_id, status, approved_at, comments}
    
    # Tarihler
    started_at: Optional[datetime] = None
    due_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    
    # Sonuç
    result: Optional[str] = None  # approved/rejected/completed
    comments: Optional[str] = None
    completed_by: Optional[str] = None


class WorkflowInstance(BaseModel):
    """Workflow çalışma instance"""
    id: str
    workflow_template_id: str
    workflow_name: str
    
    # İlişkili kayıt
    module: str
    ref_id: str
    
    # Durum
    status: Literal["active", "completed", "cancelled", "failed"]
    current_step_id: Optional[str] = None
    
    # Adımlar
    steps: List[StepInstance] = Field(default_factory=list)
    
    # Geçmiş
    step_history: List[Dict] = Field(default_factory=list)
    
    # Tarihler
    started_at: datetime
    completed_at: Optional[datetime] = None
    
    # Metadata
    started_by: str
    context_data: Dict[str, Any] = Field(default_factory=dict)


class WorkflowInstanceOut(WorkflowInstance):
    """Workflow instance çıktı"""
    started_by_name: Optional[str] = None
    progress_percentage: int = 0
    completed_steps: int = 0
    total_steps: int = 0


# ============================================================================
# ONAY MATRİSİ
# ============================================================================

class ApprovalRule(BaseModel):
    """Onay kuralı"""
    rule_id: str
    name: str
    description: Optional[str] = None
    
    # Tetikleyici
    module: str
    trigger_field: Optional[str] = None  # Hangi alan değiştiğinde tetiklensin
    
    # Koşullar
    conditions: List[WorkflowCondition] = Field(default_factory=list)
    
    # Onay gereksinimleri
    approval_type: ApprovalType
    approvers: StepAssignment
    min_approvals: Optional[int] = None
    
    # Zaman limitleri
    due_in_hours: Optional[int] = None
    
    # Durum
    is_active: bool = True
    
    # Metadata
    created_by: str
    created_at: datetime


class ApprovalMatrix(BaseModel):
    """Onay matrisi"""
    id: str
    name: str
    description: Optional[str] = None
    module: str
    
    # Kurallar
    rules: List[ApprovalRule]
    
    # Ayarlar
    allow_self_approval: bool = False
    require_all_rules: bool = False  # Tüm kurallar mı uygulanmalı
    
    # Durum
    is_active: bool = True
    
    # Metadata
    created_by: str
    created_at: datetime
    updated_at: datetime


# ============================================================================
# GÖREV ATAMA
# ============================================================================

class AutoAssignmentRule(BaseModel):
    """Otomatik atama kuralı"""
    rule_id: str
    name: str
    module: str
    
    # Koşullar
    conditions: List[WorkflowCondition] = Field(default_factory=list)
    
    # Atama stratejisi
    strategy: Literal["round_robin", "least_loaded", "department_manager", "role_based", "custom"]
    
    # Parametreler
    role_name: Optional[str] = None
    department_field: Optional[str] = None
    custom_rule: Optional[str] = None
    
    # Yedek atama
    fallback_users: List[str] = Field(default_factory=list)
    
    # Durum
    is_active: bool = True


class TaskTemplate(BaseModel):
    """Görev şablonu"""
    template_id: str
    name: str
    description: str
    module: str
    
    # Atama
    assignment_rule_id: Optional[str] = None
    default_assigned_to: Optional[List[str]] = None
    
    # Zaman
    default_due_in_hours: int = 24
    
    # Öncelik
    default_priority: str = "medium"
    
    # Durum
    is_active: bool = True


# ============================================================================
# WORKFLOW EVENTS
# ============================================================================

class WorkflowEvent(BaseModel):
    """Workflow olayı"""
    event_id: str
    workflow_instance_id: str
    event_type: Literal[
        "workflow_started",
        "step_started",
        "step_completed",
        "step_rejected",
        "approval_granted",
        "approval_rejected",
        "task_assigned",
        "escalated",
        "workflow_completed",
        "workflow_cancelled"
    ]
    step_id: Optional[str] = None
    actor_id: Optional[str] = None
    actor_name: Optional[str] = None
    timestamp: datetime
    data: Dict[str, Any] = Field(default_factory=dict)


# ============================================================================
# İSTATİSTİKLER
# ============================================================================

class WorkflowStats(BaseModel):
    """Workflow istatistikleri"""
    template_id: str
    template_name: str
    
    # Sayılar
    total_instances: int
    active_instances: int
    completed_instances: int
    cancelled_instances: int
    
    # Zaman
    avg_completion_hours: Optional[float] = None
    min_completion_hours: Optional[float] = None
    max_completion_hours: Optional[float] = None
    
    # Adımlar
    step_stats: List[Dict] = Field(default_factory=list)
    # Her adım için: {step_name, avg_time, completion_rate}
    
    # Onaylar
    approval_rate: Optional[float] = None
    avg_approval_time_hours: Optional[float] = None


# ============================================================================
# YARDIMCI FONKSİYONLAR
# ============================================================================

def evaluate_condition(condition: WorkflowCondition, record: Dict[str, Any]) -> bool:
    """Koşulu değerlendir"""
    field_value = record.get(condition.field)
    
    if condition.operator == "equals":
        return field_value == condition.value
    elif condition.operator == "not_equals":
        return field_value != condition.value
    elif condition.operator == "contains":
        return condition.value in str(field_value)
    elif condition.operator == "greater_than":
        return field_value > condition.value
    elif condition.operator == "less_than":
        return field_value < condition.value
    elif condition.operator == "in":
        return field_value in condition.value
    elif condition.operator == "not_in":
        return field_value not in condition.value
    
    return False


def evaluate_all_conditions(conditions: List[WorkflowCondition], record: Dict[str, Any]) -> bool:
    """Tüm koşulları değerlendir"""
    if not conditions:
        return True
    return all(evaluate_condition(c, record) for c in conditions)
