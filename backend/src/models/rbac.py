"""
RBAC (Role-Based Access Control) Models
Kullanıcı rolleri, izinler ve yetkilendirme yapıları
"""
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Dict, Set
from datetime import datetime
from enum import Enum


class PermissionCategory(str, Enum):
    """İzin kategorileri"""
    DOCUMENT = "document"
    COMPLAINT = "complaint"
    CAPA = "capa"
    AUDIT = "audit"
    RISK = "risk"
    CALIBRATION = "calibration"
    USER = "user"
    ADMIN = "admin"


class Permission(BaseModel):
    """Sistem izni"""
    code: str = Field(..., description="İzin kodu (örn: document.read)")
    name: str = Field(..., description="İzin adı")
    category: PermissionCategory
    description: Optional[str] = None
    
    class Config:
        json_schema_extra = {
            "example": {
                "code": "document.read",
                "name": "Doküman Okuma",
                "category": "document",
                "description": "Dokümanları görüntüleme yetkisi"
            }
        }


class RoleBase(BaseModel):
    """Rol temel modeli"""
    name: str = Field(..., min_length=2, max_length=100)
    display_name: str = Field(..., min_length=2, max_length=150)
    description: Optional[str] = Field(None, max_length=500)
    permissions: List[str] = Field(default_factory=list)
    is_system: bool = Field(default=False, description="Sistem rolü mü (silinemez)")


class RoleCreate(RoleBase):
    """Rol oluşturma"""
    pass


class RoleUpdate(BaseModel):
    """Rol güncelleme"""
    display_name: Optional[str] = None
    description: Optional[str] = None
    permissions: Optional[List[str]] = None


class RoleOut(RoleBase):
    """Rol çıktısı"""
    id: str
    created_at: datetime
    updated_at: datetime
    user_count: int = Field(default=0, description="Bu role sahip kullanıcı sayısı")


class DepartmentBase(BaseModel):
    """Departman temel modeli"""
    code: str = Field(..., min_length=2, max_length=50)
    name: str = Field(..., min_length=2, max_length=150)
    description: Optional[str] = Field(None, max_length=500)
    parent_id: Optional[str] = Field(None, description="Üst departman ID")
    manager_id: Optional[str] = Field(None, description="Departman yöneticisi kullanıcı ID")


class DepartmentCreate(DepartmentBase):
    """Departman oluşturma"""
    pass


class DepartmentUpdate(BaseModel):
    """Departman güncelleme"""
    name: Optional[str] = None
    description: Optional[str] = None
    parent_id: Optional[str] = None
    manager_id: Optional[str] = None


class DepartmentOut(DepartmentBase):
    """Departman çıktısı"""
    id: str
    created_at: datetime
    updated_at: datetime
    user_count: int = Field(default=0)
    children: List[str] = Field(default_factory=list, description="Alt departman ID'leri")


class UserGroup(BaseModel):
    """Kullanıcı grubu"""
    id: str
    name: str = Field(..., min_length=2, max_length=100)
    description: Optional[str] = None
    members: List[str] = Field(default_factory=list, description="Üye kullanıcı ID'leri")
    created_at: datetime
    updated_at: datetime


class UserBase(BaseModel):
    """Kullanıcı temel modeli"""
    username: str = Field(..., min_length=3, max_length=50)
    email: EmailStr
    full_name: str = Field(..., min_length=2, max_length=200)
    first_name: str = Field(..., min_length=1, max_length=100)
    last_name: str = Field(..., min_length=1, max_length=100)
    
    # Organizasyon bilgileri
    department_id: Optional[str] = None
    position: Optional[str] = Field(None, max_length=100, description="Pozisyon/Unvan")
    
    # Yetkilendirme
    roles: List[str] = Field(default_factory=list, description="Rol ID'leri")
    groups: List[str] = Field(default_factory=list, description="Grup ID'leri")
    
    # Durum
    is_active: bool = True
    is_locked: bool = Field(default=False, description="Hesap kilitli mi")
    
    # İletişim
    phone: Optional[str] = Field(None, max_length=20)
    mobile: Optional[str] = Field(None, max_length=20)


class UserCreate(UserBase):
    """Kullanıcı oluşturma"""
    password: str = Field(..., min_length=8, max_length=128)


class UserUpdate(BaseModel):
    """Kullanıcı güncelleme"""
    email: Optional[EmailStr] = None
    full_name: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    department_id: Optional[str] = None
    position: Optional[str] = None
    roles: Optional[List[str]] = None
    groups: Optional[List[str]] = None
    is_active: Optional[bool] = None
    phone: Optional[str] = None
    mobile: Optional[str] = None


class UserOut(UserBase):
    """Kullanıcı çıktısı (şifre hariç)"""
    id: str
    department_name: Optional[str] = None
    role_names: List[str] = Field(default_factory=list)
    permissions: List[str] = Field(default_factory=list, description="Tüm izinler (roller + gruplar)")
    created_at: datetime
    last_login: Optional[datetime] = None
    
    class Config:
        json_schema_extra = {
            "example": {
                "id": "usr_123",
                "username": "ahmet.yilmaz",
                "email": "ahmet@company.com",
                "full_name": "Ahmet Yılmaz",
                "first_name": "Ahmet",
                "last_name": "Yılmaz",
                "department_id": "dept_001",
                "department_name": "Kalite Güvence",
                "position": "Kalite Uzmanı",
                "roles": ["role_qc"],
                "role_names": ["QC Specialist"],
                "groups": ["grp_auditors"],
                "permissions": ["document.read", "capa.create", "audit.conduct"],
                "is_active": True,
                "is_locked": False,
                "created_at": "2025-01-15T10:00:00Z"
            }
        }


class PasswordChange(BaseModel):
    """Şifre değiştirme"""
    old_password: str
    new_password: str = Field(..., min_length=8, max_length=128)


class PasswordReset(BaseModel):
    """Şifre sıfırlama (admin)"""
    new_password: str = Field(..., min_length=8, max_length=128)


# Yetkilendirme kontrol modelleri
class PermissionCheck(BaseModel):
    """İzin kontrolü sonucu"""
    user_id: str
    permission: str
    granted: bool
    source: Optional[str] = Field(None, description="İznin nereden geldiği (role/group)")


class UserPermissions(BaseModel):
    """Kullanıcı tüm izinleri"""
    user_id: str
    username: str
    permissions: Set[str]
    roles: Dict[str, List[str]] = Field(default_factory=dict, description="Rol bazında izinler")
    groups: Dict[str, List[str]] = Field(default_factory=dict, description="Grup bazında izinler")


# Sistem izin tanımları
SYSTEM_PERMISSIONS = {
    # Doküman yönetimi
    "document.read": Permission(code="document.read", name="Doküman Okuma", category=PermissionCategory.DOCUMENT),
    "document.create": Permission(code="document.create", name="Doküman Oluşturma", category=PermissionCategory.DOCUMENT),
    "document.edit": Permission(code="document.edit", name="Doküman Düzenleme", category=PermissionCategory.DOCUMENT),
    "document.delete": Permission(code="document.delete", name="Doküman Silme", category=PermissionCategory.DOCUMENT),
    "document.approve": Permission(code="document.approve", name="Doküman Onaylama", category=PermissionCategory.DOCUMENT),
    "document.publish": Permission(code="document.publish", name="Doküman Yayınlama", category=PermissionCategory.DOCUMENT),
    "document.revise": Permission(code="document.revise", name="Doküman Revize", category=PermissionCategory.DOCUMENT),
    
    # Müşteri şikayetleri
    "complaint.read": Permission(code="complaint.read", name="Şikayet Okuma", category=PermissionCategory.COMPLAINT),
    "complaint.create": Permission(code="complaint.create", name="Şikayet Oluşturma", category=PermissionCategory.COMPLAINT),
    "complaint.edit": Permission(code="complaint.edit", name="Şikayet Düzenleme", category=PermissionCategory.COMPLAINT),
    "complaint.delete": Permission(code="complaint.delete", name="Şikayet Silme", category=PermissionCategory.COMPLAINT),
    "complaint.assign": Permission(code="complaint.assign", name="Şikayet Atama", category=PermissionCategory.COMPLAINT),
    "complaint.close": Permission(code="complaint.close", name="Şikayet Kapatma", category=PermissionCategory.COMPLAINT),
    
    # CAPA/DÖF
    "capa.read": Permission(code="capa.read", name="CAPA Okuma", category=PermissionCategory.CAPA),
    "capa.create": Permission(code="capa.create", name="CAPA Oluşturma", category=PermissionCategory.CAPA),
    "capa.edit": Permission(code="capa.edit", name="CAPA Düzenleme", category=PermissionCategory.CAPA),
    "capa.delete": Permission(code="capa.delete", name="CAPA Silme", category=PermissionCategory.CAPA),
    "capa.assign": Permission(code="capa.assign", name="CAPA Atama", category=PermissionCategory.CAPA),
    "capa.close": Permission(code="capa.close", name="CAPA Kapatma", category=PermissionCategory.CAPA),
    
    # Denetim
    "audit.read": Permission(code="audit.read", name="Denetim Okuma", category=PermissionCategory.AUDIT),
    "audit.create": Permission(code="audit.create", name="Denetim Planlama", category=PermissionCategory.AUDIT),
    "audit.conduct": Permission(code="audit.conduct", name="Denetim Yapma", category=PermissionCategory.AUDIT),
    "audit.report": Permission(code="audit.report", name="Denetim Rapor", category=PermissionCategory.AUDIT),
    
    # Risk yönetimi
    "risk.read": Permission(code="risk.read", name="Risk Okuma", category=PermissionCategory.RISK),
    "risk.create": Permission(code="risk.create", name="Risk Oluşturma", category=PermissionCategory.RISK),
    "risk.assess": Permission(code="risk.assess", name="Risk Değerlendirme", category=PermissionCategory.RISK),
    "risk.approve": Permission(code="risk.approve", name="Risk Onaylama", category=PermissionCategory.RISK),
    
    # Kalibrasyon
    "calibration.read": Permission(code="calibration.read", name="Kalibrasyon Okuma", category=PermissionCategory.CALIBRATION),
    "calibration.create": Permission(code="calibration.create", name="Cihaz Tanımlama", category=PermissionCategory.CALIBRATION),
    "calibration.perform": Permission(code="calibration.perform", name="Kalibrasyon Yapma", category=PermissionCategory.CALIBRATION),
    "calibration.approve": Permission(code="calibration.approve", name="Kalibrasyon Onaylama", category=PermissionCategory.CALIBRATION),
    
    # Kullanıcı yönetimi
    "user.read": Permission(code="user.read", name="Kullanıcı Listeleme", category=PermissionCategory.USER),
    "user.create": Permission(code="user.create", name="Kullanıcı Oluşturma", category=PermissionCategory.USER),
    "user.edit": Permission(code="user.edit", name="Kullanıcı Düzenleme", category=PermissionCategory.USER),
    "user.delete": Permission(code="user.delete", name="Kullanıcı Silme", category=PermissionCategory.USER),
    
    # Admin
    "admin.roles": Permission(code="admin.roles", name="Rol Yönetimi", category=PermissionCategory.ADMIN),
    "admin.permissions": Permission(code="admin.permissions", name="İzin Yönetimi", category=PermissionCategory.ADMIN),
    "admin.departments": Permission(code="admin.departments", name="Departman Yönetimi", category=PermissionCategory.ADMIN),
    "admin.system": Permission(code="admin.system", name="Sistem Ayarları", category=PermissionCategory.ADMIN),
}


# Öntanımlı roller
DEFAULT_ROLES = {
    "super_admin": {
        "name": "super_admin",
        "display_name": "Süper Yönetici",
        "description": "Tüm sistem yetkilerine sahip",
        "permissions": list(SYSTEM_PERMISSIONS.keys()),
        "is_system": True
    },
    "admin": {
        "name": "admin",
        "display_name": "Yönetici",
        "description": "Genel yönetim yetkileri",
        "permissions": [
            "document.read", "document.create", "document.edit", "document.approve",
            "complaint.read", "complaint.create", "complaint.assign",
            "capa.read", "capa.create", "capa.assign",
            "audit.read", "audit.create",
            "risk.read", "risk.create", "risk.assess",
            "calibration.read", "calibration.create",
            "user.read"
        ],
        "is_system": True
    },
    "qc_manager": {
        "name": "qc_manager",
        "display_name": "Kalite Yöneticisi",
        "description": "Kalite yönetimi yetkileri",
        "permissions": [
            "document.read", "document.approve", "document.publish",
            "complaint.read", "complaint.assign", "complaint.close",
            "capa.read", "capa.assign", "capa.close",
            "audit.read", "audit.create", "audit.conduct",
            "risk.read", "risk.approve",
            "calibration.read", "calibration.approve"
        ],
        "is_system": True
    },
    "qc_specialist": {
        "name": "qc_specialist",
        "display_name": "Kalite Uzmanı",
        "description": "Kalite uzman yetkileri",
        "permissions": [
            "document.read", "document.create",
            "complaint.read", "complaint.create",
            "capa.read", "capa.create",
            "audit.read", "audit.conduct",
            "risk.read", "risk.create", "risk.assess",
            "calibration.read", "calibration.perform"
        ],
        "is_system": True
    },
    "auditor": {
        "name": "auditor",
        "display_name": "Denetçi",
        "description": "Denetim yetkileri",
        "permissions": [
            "document.read",
            "audit.read", "audit.conduct", "audit.report",
            "capa.read", "capa.create"
        ],
        "is_system": True
    },
    "viewer": {
        "name": "viewer",
        "display_name": "Görüntüleyici",
        "description": "Sadece okuma yetkisi",
        "permissions": [
            "document.read",
            "complaint.read",
            "capa.read",
            "audit.read",
            "risk.read",
            "calibration.read"
        ],
        "is_system": True
    }
}
