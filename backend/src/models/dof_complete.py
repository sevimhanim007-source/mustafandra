"""
DÖF/CAPA Models - Düzeltici Önleyici Faaliyet Modelleri
Ekip yönetimi, aksiyon takibi, dosya yükleme dahil
"""
from pydantic import BaseModel, Field
from typing import List, Optional, Literal
from datetime import datetime
from enum import Enum


# ============================================================================
# ENUM'LAR
# ============================================================================

class DofStatus(str, Enum):
    """DÖF durumları"""
    DRAFT = "draft"                          # Taslak
    PENDING_INVESTIGATION = "pending_investigation"  # İlk araştırma bekliyor
    INVESTIGATING = "investigating"          # İlk araştırma yapılıyor
    ROOT_CAUSE_ANALYSIS = "root_cause_analysis"  # Kök neden analizi
    ACTION_PLANNING = "action_planning"      # Aksiyon planlaması
    IN_PROGRESS = "in_progress"              # Aksiyonlar devam ediyor
    PENDING_VERIFICATION = "pending_verification"  # Doğrulama bekliyor
    VERIFICATION = "verification"            # Doğrulama aşaması
    PENDING_CLOSURE = "pending_closure"      # Kapanış onayı bekliyor
    CLOSED = "closed"                        # Kapalı
    CANCELLED = "cancelled"                  # İptal edildi


class DofSource(str, Enum):
    """DÖF kaynakları"""
    INTERNAL_AUDIT = "internal_audit"        # İç denetim
    EXTERNAL_AUDIT = "external_audit"        # Dış denetim
    CUSTOMER_COMPLAINT = "customer_complaint"  # Müşteri şikayeti
    MANAGEMENT_REVIEW = "management_review"  # Yönetim gözden geçirmesi
    PROCESS_MONITORING = "process_monitoring"  # Süreç izleme
    RISK_ASSESSMENT = "risk_assessment"      # Risk değerlendirme
    CALIBRATION = "calibration"              # Kalibrasyon
    SUPPLIER_ISSUE = "supplier_issue"        # Tedarikçi sorunu
    OTHER = "other"                          # Diğer


class DofPriority(str, Enum):
    """DÖF öncelik seviyeleri"""
    CRITICAL = "critical"  # Kritik
    HIGH = "high"          # Yüksek
    MEDIUM = "medium"      # Orta
    LOW = "low"            # Düşük


class ActionStatus(str, Enum):
    """Aksiyon durumları"""
    PENDING = "pending"              # Beklemede
    IN_PROGRESS = "in_progress"      # Devam ediyor
    COMPLETED = "completed"          # Tamamlandı
    VERIFIED = "verified"            # Doğrulandı
    REJECTED = "rejected"            # Reddedildi
    CANCELLED = "cancelled"          # İptal edildi


class ActionType(str, Enum):
    """Aksiyon tipleri"""
    IMMEDIATE = "immediate"          # Acil önlem
    CORRECTIVE = "corrective"        # Düzeltici faaliyet
    PREVENTIVE = "preventive"        # Önleyici faaliyet
    VERIFICATION = "verification"    # Doğrulama
    FOLLOW_UP = "follow_up"          # Takip


class TeamRole(str, Enum):
    """Ekip rolleri"""
    LEADER = "leader"                # Ekip lideri
    MEMBER = "member"                # Ekip üyesi
    APPROVER = "approver"            # Onaylayıcı
    OBSERVER = "observer"            # Gözlemci


class RootCauseMethod(str, Enum):
    """Kök neden analiz yöntemleri"""
    FIVE_WHY = "five_why"            # 5 Neden
    FISHBONE = "fishbone"            # Balık kılçığı
    FAULT_TREE = "fault_tree"        # Hata ağacı
    PARETO = "pareto"                # Pareto analizi
    EIGHT_D = "8d"                   # 8D metodolojisi
    OTHER = "other"                  # Diğer


# ============================================================================
# EKİP YÖNETİMİ
# ============================================================================

class TeamMember(BaseModel):
    """Ekip üyesi"""
    user_id: str
    username: str
    full_name: str
    role: TeamRole = TeamRole.MEMBER
    department_id: Optional[str] = None
    department_name: Optional[str] = None
    assigned_at: datetime = Field(default_factory=datetime.utcnow)
    assigned_by: Optional[str] = None


class TeamMemberAdd(BaseModel):
    """Ekip üyesi ekleme"""
    user_id: str
    role: TeamRole = TeamRole.MEMBER


class TeamUpdate(BaseModel):
    """Ekip güncelleme"""
    leader_id: Optional[str] = None
    members: Optional[List[TeamMemberAdd]] = None


# ============================================================================
# KÖK NEDEN ANALİZİ
# ============================================================================

class RootCauseAnalysis(BaseModel):
    """Kök neden analizi"""
    method: RootCauseMethod
    description: str = Field(..., min_length=10, max_length=5000)
    contributing_factors: List[str] = Field(default_factory=list)
    root_causes: List[str] = Field(default_factory=list, min_items=1)
    evidence: Optional[str] = None
    analysis_date: datetime = Field(default_factory=datetime.utcnow)
    analyzed_by: Optional[str] = None
    attachments: List[str] = Field(default_factory=list, description="Dosya ID'leri")


class RootCauseCreate(BaseModel):
    """Kök neden analizi oluşturma"""
    method: RootCauseMethod
    description: str = Field(..., min_length=10, max_length=5000)
    contributing_factors: List[str] = Field(default_factory=list)
    root_causes: List[str] = Field(..., min_items=1)
    evidence: Optional[str] = None


# ============================================================================
# AKSİYON YÖNETİMİ
# ============================================================================

class Action(BaseModel):
    """Aksiyon detayı"""
    id: str
    action_no: str
    action_type: ActionType
    title: str = Field(..., min_length=5, max_length=200)
    description: str = Field(..., min_length=10, max_length=2000)
    assigned_to: str
    assigned_to_name: Optional[str] = None
    due_date: datetime
    completed_date: Optional[datetime] = None
    status: ActionStatus = ActionStatus.PENDING
    priority: DofPriority = DofPriority.MEDIUM
    
    # İlerleme
    progress_percentage: int = Field(default=0, ge=0, le=100)
    completion_notes: Optional[str] = None
    verification_notes: Optional[str] = None
    verified_by: Optional[str] = None
    verified_at: Optional[datetime] = None
    
    # Dosyalar
    attachments: List[str] = Field(default_factory=list)
    
    # Metadata
    created_by: str
    created_at: datetime
    updated_at: datetime
    
    class Config:
        json_schema_extra = {
            "example": {
                "id": "act_123",
                "action_no": "ACT-2025-001-01",
                "action_type": "corrective",
                "title": "Süreç prosedürünü güncelle",
                "description": "İmalat prosedürü revize edilecek",
                "assigned_to": "usr_456",
                "assigned_to_name": "Ahmet Yılmaz",
                "due_date": "2025-11-30T23:59:59Z",
                "status": "in_progress",
                "priority": "high",
                "progress_percentage": 50
            }
        }


class ActionCreate(BaseModel):
    """Aksiyon oluşturma"""
    action_type: ActionType
    title: str = Field(..., min_length=5, max_length=200)
    description: str = Field(..., min_length=10, max_length=2000)
    assigned_to: str
    due_date: datetime
    priority: DofPriority = DofPriority.MEDIUM


class ActionUpdate(BaseModel):
    """Aksiyon güncelleme"""
    title: Optional[str] = Field(None, min_length=5, max_length=200)
    description: Optional[str] = Field(None, min_length=10, max_length=2000)
    assigned_to: Optional[str] = None
    due_date: Optional[datetime] = None
    priority: Optional[DofPriority] = None
    progress_percentage: Optional[int] = Field(None, ge=0, le=100)
    completion_notes: Optional[str] = None


class ActionStatusUpdate(BaseModel):
    """Aksiyon durum güncelleme"""
    status: ActionStatus
    notes: Optional[str] = None
    progress_percentage: Optional[int] = Field(None, ge=0, le=100)


class ActionVerification(BaseModel):
    """Aksiyon doğrulama"""
    is_approved: bool
    verification_notes: str = Field(..., min_length=10, max_length=2000)


# ============================================================================
# DOSYA YÖNETİMİ
# ============================================================================

class FileAttachment(BaseModel):
    """Dosya eki"""
    id: str
    filename: str
    original_filename: str
    mime_type: str
    size: int
    uploaded_by: str
    uploaded_by_name: Optional[str] = None
    uploaded_at: datetime
    file_path: str
    description: Optional[str] = None
    
    class Config:
        json_schema_extra = {
            "example": {
                "id": "file_123",
                "filename": "20251105_analysis.pdf",
                "original_filename": "Kök Neden Analizi.pdf",
                "mime_type": "application/pdf",
                "size": 245678,
                "uploaded_by": "usr_123",
                "uploaded_at": "2025-11-05T10:30:00Z"
            }
        }


# ============================================================================
# DÖF ANA MODEL
# ============================================================================

class DofBase(BaseModel):
    """DÖF temel model"""
    title: str = Field(..., min_length=5, max_length=200)
    source: DofSource
    source_reference: Optional[str] = Field(None, max_length=100, description="Kaynak referans no")
    priority: DofPriority = DofPriority.MEDIUM
    department_id: Optional[str] = None
    location: Optional[str] = Field(None, max_length=200)
    nonconformity_description: str = Field(..., min_length=10, max_length=5000)


class DofCreate(DofBase):
    """DÖF oluşturma"""
    pass


class DofUpdate(BaseModel):
    """DÖF güncelleme"""
    title: Optional[str] = Field(None, min_length=5, max_length=200)
    priority: Optional[DofPriority] = None
    department_id: Optional[str] = None
    location: Optional[str] = None
    nonconformity_description: Optional[str] = Field(None, min_length=10, max_length=5000)


class DofOut(DofBase):
    """DÖF çıktı modeli"""
    id: str
    dof_no: str
    status: DofStatus
    
    # Ekip
    team_leader_id: Optional[str] = None
    team_leader_name: Optional[str] = None
    team_members: List[TeamMember] = Field(default_factory=list)
    
    # Departman
    department_name: Optional[str] = None
    
    # Kök neden
    root_cause_analysis: Optional[RootCauseAnalysis] = None
    
    # Aksiyonlar
    actions: List[Action] = Field(default_factory=list)
    actions_completed: int = Field(default=0)
    actions_total: int = Field(default=0)
    
    # İlk araştırma
    initial_investigation: Optional[str] = None
    investigation_date: Optional[datetime] = None
    investigated_by: Optional[str] = None
    
    # Acil önlemler
    immediate_actions: Optional[str] = None
    
    # Kapanış
    final_report: Optional[str] = None
    final_report_date: Optional[datetime] = None
    closed_by: Optional[str] = None
    closed_at: Optional[datetime] = None
    
    # Dosyalar
    attachments: List[FileAttachment] = Field(default_factory=list)
    
    # Tarihler
    target_date: Optional[datetime] = None
    created_by: str
    created_by_name: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    
    # İş akışı geçmişi
    status_history: List[dict] = Field(default_factory=list)
    
    class Config:
        json_schema_extra = {
            "example": {
                "id": "dof_123",
                "dof_no": "DOF-2025-001",
                "title": "Ürün Kalite Sorunu",
                "source": "customer_complaint",
                "priority": "high",
                "status": "in_progress",
                "nonconformity_description": "Üründe görsel kusur tespit edildi",
                "team_leader_id": "usr_123",
                "team_leader_name": "Ahmet Yılmaz",
                "actions_completed": 2,
                "actions_total": 5
            }
        }


# ============================================================================
# İŞ AKIŞI
# ============================================================================

class InitialInvestigation(BaseModel):
    """İlk araştırma raporu"""
    investigation_report: str = Field(..., min_length=50, max_length=5000)
    immediate_actions: Optional[str] = Field(None, max_length=2000)


class FinalReport(BaseModel):
    """Nihai rapor"""
    final_report: str = Field(..., min_length=50, max_length=5000)
    effectiveness_verified: bool = Field(default=False)
    lessons_learned: Optional[str] = Field(None, max_length=2000)


class DofStatusChange(BaseModel):
    """DÖF durum değişikliği"""
    new_status: DofStatus
    notes: Optional[str] = Field(None, max_length=1000)


# ============================================================================
# RAPORLAMA VE FİLTRELEME
# ============================================================================

class DofFilter(BaseModel):
    """DÖF filtreleme parametreleri"""
    status: Optional[List[DofStatus]] = None
    source: Optional[List[DofSource]] = None
    priority: Optional[List[DofPriority]] = None
    department_id: Optional[str] = None
    team_leader_id: Optional[str] = None
    created_by: Optional[str] = None
    date_from: Optional[datetime] = None
    date_to: Optional[datetime] = None
    search: Optional[str] = None
    overdue_only: bool = False


class DofStats(BaseModel):
    """DÖF istatistikleri"""
    total: int
    by_status: dict
    by_source: dict
    by_priority: dict
    overdue: int
    completed_this_month: int
    average_completion_days: Optional[float] = None
    
    class Config:
        json_schema_extra = {
            "example": {
                "total": 45,
                "by_status": {
                    "draft": 5,
                    "in_progress": 20,
                    "closed": 20
                },
                "by_source": {
                    "customer_complaint": 15,
                    "internal_audit": 30
                },
                "by_priority": {
                    "critical": 3,
                    "high": 12,
                    "medium": 20,
                    "low": 10
                },
                "overdue": 3,
                "completed_this_month": 8,
                "average_completion_days": 15.5
            }
        }
