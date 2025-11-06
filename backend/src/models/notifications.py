"""
Notification System
Email, in-app notifications, preferences, template engine
"""
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Dict, Any, Literal
from datetime import datetime
from enum import Enum
import re


# ============================================================================
# ENUM'LAR
# ============================================================================

class NotificationType(str, Enum):
    """Bildirim tipi"""
    INFO = "info"
    SUCCESS = "success"
    WARNING = "warning"
    ERROR = "error"
    ACTION_REQUIRED = "action_required"


class NotificationChannel(str, Enum):
    """Bildirim kanalı"""
    EMAIL = "email"
    IN_APP = "in_app"
    SMS = "sms"
    PUSH = "push"
    WEBHOOK = "webhook"


class NotificationPriority(str, Enum):
    """Bildirim önceliği"""
    LOW = "low"
    NORMAL = "normal"
    HIGH = "high"
    URGENT = "urgent"


class NotificationStatus(str, Enum):
    """Bildirim durumu"""
    PENDING = "pending"
    SENT = "sent"
    DELIVERED = "delivered"
    READ = "read"
    FAILED = "failed"


# ============================================================================
# BİLDİRİM MODELLERİ
# ============================================================================

class NotificationBase(BaseModel):
    """Bildirim temel model"""
    title: str = Field(..., min_length=1, max_length=200)
    message: str = Field(..., min_length=1, max_length=2000)
    notification_type: NotificationType = NotificationType.INFO
    priority: NotificationPriority = NotificationPriority.NORMAL
    
    # İlişkili kayıt
    module: Optional[str] = None
    ref_id: Optional[str] = None
    ref_url: Optional[str] = None
    
    # Aksiyon
    action_url: Optional[str] = None
    action_label: Optional[str] = None
    
    # Metadata
    metadata: Dict[str, Any] = Field(default_factory=dict)


class NotificationCreate(NotificationBase):
    """Bildirim oluşturma"""
    recipient_ids: List[str] = Field(..., min_items=1)
    channels: List[NotificationChannel] = Field(default=[NotificationChannel.IN_APP])


class NotificationOut(NotificationBase):
    """Bildirim çıktı"""
    id: str
    recipient_id: str
    recipient_name: Optional[str] = None
    
    # Durum
    status: NotificationStatus
    channels: List[NotificationChannel]
    
    # Tarihler
    created_at: datetime
    sent_at: Optional[datetime] = None
    read_at: Optional[datetime] = None
    expires_at: Optional[datetime] = None
    
    # Email özgü
    email_sent: bool = False
    email_sent_at: Optional[datetime] = None
    
    class Config:
        json_schema_extra = {
            "example": {
                "id": "notif_123",
                "title": "Yeni DÖF Ataması",
                "message": "DOF-2025-0001 numaralı DÖF'te size bir görev atandı",
                "notification_type": "action_required",
                "priority": "high",
                "module": "dof",
                "ref_id": "dof_xxx",
                "action_url": "/dof/dof_xxx",
                "status": "sent",
                "read_at": None
            }
        }


# ============================================================================
# BİLDİRİM TERCİHLERİ
# ============================================================================

class NotificationPreference(BaseModel):
    """Bildirim tercihi"""
    event_type: str = Field(..., description="Olay tipi (dof.assigned, document.approved, etc.)")
    enabled: bool = True
    channels: List[NotificationChannel] = Field(default_factory=list)


class UserNotificationSettings(BaseModel):
    """Kullanıcı bildirim ayarları"""
    user_id: str
    
    # Genel ayarlar
    email_notifications: bool = True
    in_app_notifications: bool = True
    sms_notifications: bool = False
    push_notifications: bool = True
    
    # Sessiz saatler
    quiet_hours_enabled: bool = False
    quiet_hours_start: Optional[str] = Field(None, description="HH:MM formatında")
    quiet_hours_end: Optional[str] = Field(None, description="HH:MM formatında")
    
    # Özet bildirimler
    digest_enabled: bool = False
    digest_frequency: Literal["daily", "weekly"] = "daily"
    digest_time: str = "09:00"
    
    # Olay bazlı tercihler
    preferences: List[NotificationPreference] = Field(default_factory=list)
    
    # Güncelleme
    updated_at: datetime


# ============================================================================
# EMAIL TEMPLATE
# ============================================================================

class EmailTemplate(BaseModel):
    """Email şablonu"""
    template_id: str
    name: str
    description: Optional[str] = None
    
    # İçerik
    subject: str = Field(..., description="Email başlığı (değişkenler desteklenir)")
    html_body: str = Field(..., description="HTML içerik")
    text_body: Optional[str] = Field(None, description="Düz metin içerik")
    
    # Değişkenler
    variables: List[str] = Field(default_factory=list, description="Kullanılabilir değişkenler")
    # Örnek: ["user_name", "dof_no", "action_url"]
    
    # Kategori
    category: str = Field(..., description="Şablon kategorisi")
    
    # Ayarlar
    from_name: Optional[str] = None
    reply_to: Optional[str] = None
    
    # Durum
    is_active: bool = True
    
    # Metadata
    created_by: str
    created_at: datetime
    updated_at: datetime
    
    class Config:
        json_schema_extra = {
            "example": {
                "template_id": "dof_assignment",
                "name": "DÖF Ataması",
                "subject": "Yeni DÖF Ataması: {{dof_no}}",
                "html_body": "<p>Sayın {{user_name}},</p><p>{{dof_no}} numaralı DÖF'te size bir görev atandı.</p>",
                "variables": ["user_name", "dof_no", "dof_title", "action_url"],
                "category": "dof"
            }
        }


class EmailMessage(BaseModel):
    """Email mesajı"""
    to: List[EmailStr]
    cc: Optional[List[EmailStr]] = None
    bcc: Optional[List[EmailStr]] = None
    subject: str
    html_body: Optional[str] = None
    text_body: Optional[str] = None
    attachments: List[Dict] = Field(default_factory=list)
    # Her attachment: {filename, content_type, content}


# ============================================================================
# BİLDİRİM GRUPLARI
# ============================================================================

class NotificationGroup(BaseModel):
    """Bildirim grubu"""
    group_id: str
    name: str
    description: Optional[str] = None
    
    # Üyeler
    user_ids: List[str] = Field(default_factory=list)
    role_names: List[str] = Field(default_factory=list)
    department_ids: List[str] = Field(default_factory=list)
    
    # Ayarlar
    default_channels: List[NotificationChannel] = Field(default_factory=list)
    
    # Durum
    is_active: bool = True
    
    # Metadata
    created_by: str
    created_at: datetime


# ============================================================================
# BİLDİRİM KURALLARI
# ============================================================================

class NotificationRule(BaseModel):
    """Bildirim kuralı"""
    rule_id: str
    name: str
    description: Optional[str] = None
    
    # Tetikleyici
    event_type: str = Field(..., description="Tetikleyici olay tipi")
    module: Optional[str] = None
    
    # Koşullar
    conditions: List[Dict] = Field(default_factory=list)
    
    # Alıcılar
    recipient_type: Literal["user", "role", "group", "department", "custom"]
    recipient_ids: List[str] = Field(default_factory=list)
    custom_recipients_query: Optional[str] = None
    
    # Bildirim ayarları
    template_id: Optional[str] = None
    channels: List[NotificationChannel]
    priority: NotificationPriority = NotificationPriority.NORMAL
    
    # Zamanlama
    delay_minutes: int = 0
    
    # Durum
    is_active: bool = True
    
    # Metadata
    created_by: str
    created_at: datetime


# ============================================================================
# TEMPLATE ENGINE
# ============================================================================

class TemplateEngine:
    """Basit template engine (Jinja2 benzeri)"""
    
    @staticmethod
    def render(template: str, context: Dict[str, Any]) -> str:
        """
        Template'i render et
        
        Desteklenen syntax:
        - {{variable}} - Değişken
        - {% if condition %}...{% endif %} - Koşul
        - {% for item in list %}...{% endfor %} - Döngü
        """
        result = template
        
        # Basit değişken değiştirme
        for key, value in context.items():
            result = result.replace(f"{{{{{key}}}}}", str(value))
        
        # Koşullar (basit implementasyon)
        # {% if variable %}...{% endif %}
        if_pattern = r'\{% if (\w+) %\}(.*?)\{% endif %\}'
        matches = re.finditer(if_pattern, result, re.DOTALL)
        for match in matches:
            var_name = match.group(1)
            content = match.group(2)
            if context.get(var_name):
                result = result.replace(match.group(0), content)
            else:
                result = result.replace(match.group(0), '')
        
        return result
    
    @staticmethod
    def validate_template(template: str, required_vars: List[str]) -> Tuple[bool, List[str]]:
        """
        Template'i doğrula
        Returns: (is_valid, missing_vars)
        """
        # Template'deki değişkenleri bul
        var_pattern = r'\{\{(\w+)\}\}'
        found_vars = set(re.findall(var_pattern, template))
        
        # Eksik değişkenler
        missing = [var for var in required_vars if var not in found_vars]
        
        return len(missing) == 0, missing


# ============================================================================
# BİLDİRİM İSTATİSTİKLERİ
# ============================================================================

class NotificationStats(BaseModel):
    """Bildirim istatistikleri"""
    # Toplam
    total_sent: int
    total_delivered: int
    total_read: int
    total_failed: int
    
    # Kanal bazlı
    by_channel: Dict[str, int] = Field(default_factory=dict)
    
    # Tip bazlı
    by_type: Dict[str, int] = Field(default_factory=dict)
    
    # Oranlar
    delivery_rate: float = 0.0
    read_rate: float = 0.0
    
    # Zaman
    avg_read_time_minutes: Optional[float] = None
    
    # Son 24 saat
    sent_last_24h: int = 0
    sent_last_7d: int = 0


# ============================================================================
# TOPLU BİLDİRİM
# ============================================================================

class BulkNotificationRequest(BaseModel):
    """Toplu bildirim isteği"""
    title: str
    message: str
    notification_type: NotificationType = NotificationType.INFO
    
    # Alıcılar
    user_ids: Optional[List[str]] = None
    role_names: Optional[List[str]] = None
    department_ids: Optional[List[str]] = None
    group_ids: Optional[List[str]] = None
    
    # Ayarlar
    channels: List[NotificationChannel] = Field(default=[NotificationChannel.IN_APP])
    priority: NotificationPriority = NotificationPriority.NORMAL
    
    # İçerik
    module: Optional[str] = None
    ref_id: Optional[str] = None
    action_url: Optional[str] = None


class BulkNotificationResponse(BaseModel):
    """Toplu bildirim yanıtı"""
    total_recipients: int
    successful: int
    failed: int
    notification_ids: List[str]
    errors: List[Dict] = Field(default_factory=list)


# ============================================================================
# ÖNTANIMLI TEMPLATE'LER
# ============================================================================

DEFAULT_EMAIL_TEMPLATES = {
    "dof_assigned": {
        "name": "DÖF Ataması",
        "subject": "Yeni DÖF Ataması: {{dof_no}}",
        "html_body": """
        <html>
        <body style="font-family: Arial, sans-serif;">
            <h2 style="color: #333;">Yeni DÖF Ataması</h2>
            <p>Sayın {{user_name}},</p>
            <p><strong>{{dof_no}}</strong> numaralı DÖF'te size bir görev atandı.</p>
            <p><strong>Başlık:</strong> {{dof_title}}</p>
            <p><strong>Öncelik:</strong> {{priority}}</p>
            <p><strong>Termin Tarihi:</strong> {{due_date}}</p>
            <p>
                <a href="{{action_url}}" 
                   style="background-color: #4CAF50; color: white; padding: 10px 20px; 
                          text-decoration: none; border-radius: 5px;">
                    DÖF'ü Görüntüle
                </a>
            </p>
            <hr>
            <p style="color: #666; font-size: 12px;">
                Bu otomatik bir bildirimdir. Lütfen bu e-postaya yanıt vermeyin.
            </p>
        </body>
        </html>
        """,
        "variables": ["user_name", "dof_no", "dof_title", "priority", "due_date", "action_url"]
    },
    
    "action_completed": {
        "name": "Aksiyon Tamamlandı",
        "subject": "Aksiyon Tamamlandı: {{action_no}}",
        "html_body": """
        <html>
        <body style="font-family: Arial, sans-serif;">
            <h2 style="color: #4CAF50;">✓ Aksiyon Tamamlandı</h2>
            <p>Sayın {{user_name}},</p>
            <p><strong>{{action_no}}</strong> numaralı aksiyon tamamlandı.</p>
            <p><strong>Tamamlayan:</strong> {{completed_by}}</p>
            <p><strong>Tamamlanma Tarihi:</strong> {{completed_date}}</p>
            <p><strong>Not:</strong> {{completion_notes}}</p>
            <p>
                <a href="{{action_url}}" 
                   style="background-color: #2196F3; color: white; padding: 10px 20px; 
                          text-decoration: none; border-radius: 5px;">
                    Detayları Görüntüle
                </a>
            </p>
        </body>
        </html>
        """,
        "variables": ["user_name", "action_no", "completed_by", "completed_date", "completion_notes", "action_url"]
    },
    
    "approval_request": {
        "name": "Onay Talebi",
        "subject": "Onay Bekleniyor: {{title}}",
        "html_body": """
        <html>
        <body style="font-family: Arial, sans-serif;">
            <h2 style="color: #FF9800;">⏳ Onay Bekleniyor</h2>
            <p>Sayın {{user_name}},</p>
            <p>Aşağıdaki kayıt için onayınız beklenmektedir:</p>
            <p><strong>{{title}}</strong></p>
            <p><strong>Talep Eden:</strong> {{requested_by}}</p>
            <p><strong>Talep Tarihi:</strong> {{requested_date}}</p>
            <p>
                <a href="{{approval_url}}" 
                   style="background-color: #4CAF50; color: white; padding: 10px 20px; 
                          text-decoration: none; border-radius: 5px; margin-right: 10px;">
                    Onayla
                </a>
                <a href="{{rejection_url}}" 
                   style="background-color: #f44336; color: white; padding: 10px 20px; 
                          text-decoration: none; border-radius: 5px;">
                    Reddet
                </a>
            </p>
        </body>
        </html>
        """,
        "variables": ["user_name", "title", "requested_by", "requested_date", "approval_url", "rejection_url"]
    },
    
    "document_published": {
        "name": "Doküman Yayınlandı",
        "subject": "Yeni Doküman: {{document_code}}",
        "html_body": """
        <html>
        <body style="font-family: Arial, sans-serif;">
            <h2 style="color: #2196F3;">📄 Yeni Doküman Yayınlandı</h2>
            <p>Sayın {{user_name}},</p>
            <p>Yeni bir doküman yayınlandı ve okumanız gerekmektedir:</p>
            <p><strong>Kod:</strong> {{document_code}}</p>
            <p><strong>Başlık:</strong> {{document_title}}</p>
            <p><strong>Versiyon:</strong> {{version}}</p>
            <p><strong>Yayınlanma Tarihi:</strong> {{published_date}}</p>
            <p>
                <a href="{{document_url}}" 
                   style="background-color: #2196F3; color: white; padding: 10px 20px; 
                          text-decoration: none; border-radius: 5px;">
                    Dokümanı Oku
                </a>
            </p>
        </body>
        </html>
        """,
        "variables": ["user_name", "document_code", "document_title", "version", "published_date", "document_url"]
    }
}


# ============================================================================
# YARDIMCI FONKSİYONLAR
# ============================================================================

def format_notification_time(dt: datetime) -> str:
    """Bildirim zamanını formatla (örn: '2 saat önce')"""
    now = datetime.now(dt.tzinfo or timezone.utc)
    diff = now - dt
    
    seconds = diff.total_seconds()
    
    if seconds < 60:
        return "Az önce"
    elif seconds < 3600:
        minutes = int(seconds / 60)
        return f"{minutes} dakika önce"
    elif seconds < 86400:
        hours = int(seconds / 3600)
        return f"{hours} saat önce"
    elif seconds < 604800:
        days = int(seconds / 86400)
        return f"{days} gün önce"
    else:
        return dt.strftime("%d.%m.%Y %H:%M")
