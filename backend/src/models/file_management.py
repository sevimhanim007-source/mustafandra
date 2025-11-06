"""
Advanced File Management System
Versiyonlama, thumbnail, virus scanning, storage management
"""
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Literal
from datetime import datetime
from enum import Enum
import hashlib
from pathlib import Path


# ============================================================================
# ENUM'LAR
# ============================================================================

class FileStatus(str, Enum):
    """Dosya durumları"""
    UPLOADING = "uploading"          # Yükleniyor
    SCANNING = "scanning"            # Virus taranıyor
    PROCESSING = "processing"        # İşleniyor (thumbnail vb.)
    ACTIVE = "active"                # Aktif
    ARCHIVED = "archived"            # Arşivlenmiş
    DELETED = "deleted"              # Silinmiş (soft delete)
    QUARANTINE = "quarantine"        # Karantina (virus tespit)


class FileCategory(str, Enum):
    """Dosya kategorileri"""
    DOCUMENT = "document"            # Doküman (PDF, DOC, etc.)
    SPREADSHEET = "spreadsheet"      # Tablo (XLS, CSV)
    PRESENTATION = "presentation"    # Sunum (PPT)
    IMAGE = "image"                  # Resim
    VIDEO = "video"                  # Video
    AUDIO = "audio"                  # Ses
    ARCHIVE = "archive"              # Arşiv (ZIP, RAR)
    OTHER = "other"                  # Diğer


class StorageTier(str, Enum):
    """Storage katmanları"""
    HOT = "hot"                      # Sık erişilen (SSD)
    WARM = "warm"                    # Orta erişim (HDD)
    COLD = "cold"                    # Nadir erişim (Archive)
    FROZEN = "frozen"                # Çok nadir (Glacier)


class ScanStatus(str, Enum):
    """Virus tarama durumu"""
    PENDING = "pending"              # Bekliyor
    SCANNING = "scanning"            # Taranıyor
    CLEAN = "clean"                  # Temiz
    INFECTED = "infected"            # Virüslü
    ERROR = "error"                  # Hata
    SKIPPED = "skipped"              # Atlandı


# ============================================================================
# DOSYA MODELLERİ
# ============================================================================

class FileMetadata(BaseModel):
    """Dosya meta verisi"""
    width: Optional[int] = None              # Resim genişliği
    height: Optional[int] = None             # Resim yüksekliği
    duration: Optional[float] = None         # Video/audio süresi
    page_count: Optional[int] = None         # PDF sayfa sayısı
    author: Optional[str] = None             # Doküman yazarı
    title: Optional[str] = None              # Doküman başlığı
    creation_date: Optional[datetime] = None # Dosya oluşturma tarihi
    modification_date: Optional[datetime] = None  # Son değişiklik
    exif_data: Optional[Dict] = None         # EXIF verisi (resimler için)


class VirusScan(BaseModel):
    """Virus tarama sonucu"""
    scan_id: str
    status: ScanStatus
    engine: str = Field(default="clamav", description="Tarama motoru")
    engine_version: Optional[str] = None
    scanned_at: Optional[datetime] = None
    threat_found: Optional[str] = None       # Tespit edilen tehdit
    quarantine_path: Optional[str] = None    # Karantina yolu


class FileVersion(BaseModel):
    """Dosya versiyonu"""
    version: int
    file_id: str
    filename: str
    size: int
    hash_sha256: str
    uploaded_by: str
    uploaded_by_name: Optional[str] = None
    uploaded_at: datetime
    comment: Optional[str] = Field(None, max_length=500)
    is_current: bool = True


class Thumbnail(BaseModel):
    """Thumbnail bilgisi"""
    thumbnail_id: str
    size: Literal["small", "medium", "large"]
    width: int
    height: int
    file_path: str
    file_size: int
    created_at: datetime


class FileAccessLog(BaseModel):
    """Dosya erişim logu"""
    accessed_by: str
    accessed_by_name: Optional[str] = None
    accessed_at: datetime
    action: Literal["view", "download", "delete", "share"]
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None


class StorageStats(BaseModel):
    """Storage istatistikleri"""
    tier: StorageTier
    file_count: int
    total_size: int
    last_accessed: Optional[datetime] = None


class FileBase(BaseModel):
    """Dosya temel model"""
    filename: str = Field(..., min_length=1, max_length=255)
    original_filename: str
    mime_type: str
    size: int = Field(..., gt=0)
    category: FileCategory
    description: Optional[str] = Field(None, max_length=1000)
    tags: List[str] = Field(default_factory=list)


class FileCreate(FileBase):
    """Dosya oluşturma"""
    module: str = Field(..., description="İlişkili modül (dof, document, etc.)")
    ref_id: str = Field(..., description="İlişkili kayıt ID")


class FileUpdate(BaseModel):
    """Dosya güncelleme"""
    description: Optional[str] = None
    tags: Optional[List[str]] = None
    category: Optional[FileCategory] = None


class FileOut(FileBase):
    """Dosya çıktı modeli"""
    id: str
    file_path: str
    hash_md5: str
    hash_sha256: str
    
    # İlişkiler
    module: str
    ref_id: str
    
    # Durum
    status: FileStatus
    storage_tier: StorageTier = StorageTier.HOT
    
    # Versiyonlama
    version: int = 1
    is_latest_version: bool = True
    parent_file_id: Optional[str] = None  # İlk versiyon ID'si
    
    # Metadata
    metadata: Optional[FileMetadata] = None
    
    # Virus tarama
    virus_scan: Optional[VirusScan] = None
    
    # Thumbnail'ler (resimler için)
    thumbnails: List[Thumbnail] = Field(default_factory=list)
    
    # İstatistikler
    download_count: int = 0
    view_count: int = 0
    last_accessed: Optional[datetime] = None
    
    # Sahibi
    uploaded_by: str
    uploaded_by_name: Optional[str] = None
    uploaded_at: datetime
    
    # Storage
    expires_at: Optional[datetime] = None  # Otomatik silme tarihi
    is_public: bool = False
    
    class Config:
        json_schema_extra = {
            "example": {
                "id": "file_123",
                "filename": "report_20250105.pdf",
                "original_filename": "Kalite Raporu.pdf",
                "mime_type": "application/pdf",
                "size": 2456789,
                "category": "document",
                "status": "active",
                "version": 2,
                "download_count": 15,
                "virus_scan": {
                    "status": "clean",
                    "engine": "clamav"
                }
            }
        }


class FileVersionOut(BaseModel):
    """Dosya versiyonları listesi"""
    file_id: str
    original_filename: str
    current_version: int
    versions: List[FileVersion]


class FileUploadResponse(BaseModel):
    """Dosya yükleme yanıtı"""
    file: FileOut
    upload_time: float  # Saniye
    message: str = "Dosya başarıyla yüklendi"


class FileMultiUploadResponse(BaseModel):
    """Çoklu dosya yükleme yanıtı"""
    files: List[FileOut]
    total_count: int
    successful_count: int
    failed_count: int
    total_size: int
    upload_time: float
    errors: List[Dict] = Field(default_factory=list)


# ============================================================================
# STORAGE YÖNETİMİ
# ============================================================================

class StorageQuota(BaseModel):
    """Storage kotası"""
    user_id: Optional[str] = None
    department_id: Optional[str] = None
    module: Optional[str] = None
    
    # Kotalar (bytes)
    total_quota: int = Field(..., gt=0, description="Toplam kota")
    used_space: int = Field(default=0, ge=0)
    
    # Dosya sayısı
    file_count_limit: Optional[int] = None
    current_file_count: int = 0
    
    # Hesaplama
    @property
    def remaining_space(self) -> int:
        return max(0, self.total_quota - self.used_space)
    
    @property
    def usage_percentage(self) -> float:
        if self.total_quota == 0:
            return 0
        return (self.used_space / self.total_quota) * 100
    
    @property
    def is_quota_exceeded(self) -> bool:
        return self.used_space >= self.total_quota


class StoragePolicy(BaseModel):
    """Storage politikası"""
    name: str
    description: Optional[str] = None
    
    # Otomatik arşivleme
    auto_archive_days: Optional[int] = Field(None, description="X gün erişilmezse arşivle")
    
    # Otomatik silme
    auto_delete_days: Optional[int] = Field(None, description="X gün sonra sil")
    
    # Tier geçişleri
    tier_transition_rules: List[Dict] = Field(default_factory=list)
    
    # Dosya tipleri
    allowed_mime_types: Optional[List[str]] = None
    max_file_size: int = 10 * 1024 * 1024  # 10MB default
    
    # Virus tarama
    enable_virus_scan: bool = True
    quarantine_infected: bool = True
    
    # Versiyonlama
    enable_versioning: bool = True
    max_versions: int = 10
    
    # Thumbnail
    generate_thumbnails: bool = True
    thumbnail_sizes: List[str] = Field(default=["small", "medium", "large"])


class StorageReport(BaseModel):
    """Storage raporu"""
    total_files: int
    total_size: int
    by_category: Dict[str, Dict] = Field(default_factory=dict)
    by_module: Dict[str, Dict] = Field(default_factory=dict)
    by_tier: Dict[str, StorageStats] = Field(default_factory=dict)
    by_status: Dict[str, int] = Field(default_factory=dict)
    
    # Zaman bazlı
    uploaded_today: int = 0
    uploaded_this_week: int = 0
    uploaded_this_month: int = 0
    
    # En büyük dosyalar
    largest_files: List[FileOut] = Field(default_factory=list)
    
    # En çok indirilen
    most_downloaded: List[FileOut] = Field(default_factory=list)


# ============================================================================
# FİLTRELEME VE ARAMA
# ============================================================================

class FileFilter(BaseModel):
    """Dosya filtreleme"""
    module: Optional[str] = None
    ref_id: Optional[str] = None
    category: Optional[List[FileCategory]] = None
    status: Optional[List[FileStatus]] = None
    uploaded_by: Optional[str] = None
    mime_type: Optional[str] = None
    min_size: Optional[int] = None
    max_size: Optional[int] = None
    date_from: Optional[datetime] = None
    date_to: Optional[datetime] = None
    tags: Optional[List[str]] = None
    search: Optional[str] = None
    has_virus: Optional[bool] = None
    storage_tier: Optional[StorageTier] = None


# ============================================================================
# YARDIMCI FONKSİYONLAR
# ============================================================================

def calculate_file_hash(file_content: bytes, algorithm: str = "sha256") -> str:
    """Dosya hash'ini hesapla"""
    if algorithm == "md5":
        return hashlib.md5(file_content).hexdigest()
    elif algorithm == "sha256":
        return hashlib.sha256(file_content).hexdigest()
    else:
        raise ValueError(f"Desteklenmeyen algoritma: {algorithm}")


def get_file_category(mime_type: str) -> FileCategory:
    """MIME type'dan kategori belirle"""
    if mime_type.startswith("image/"):
        return FileCategory.IMAGE
    elif mime_type.startswith("video/"):
        return FileCategory.VIDEO
    elif mime_type.startswith("audio/"):
        return FileCategory.AUDIO
    elif mime_type in ["application/pdf", "application/msword", 
                        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                        "text/plain"]:
        return FileCategory.DOCUMENT
    elif mime_type in ["application/vnd.ms-excel",
                        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                        "text/csv"]:
        return FileCategory.SPREADSHEET
    elif mime_type in ["application/vnd.ms-powerpoint",
                        "application/vnd.openxmlformats-officedocument.presentationml.presentation"]:
        return FileCategory.PRESENTATION
    elif mime_type in ["application/zip", "application/x-rar-compressed",
                        "application/x-7z-compressed", "application/gzip"]:
        return FileCategory.ARCHIVE
    else:
        return FileCategory.OTHER


def format_file_size(size_bytes: int) -> str:
    """Dosya boyutunu formatla"""
    for unit in ['B', 'KB', 'MB', 'GB', 'TB']:
        if size_bytes < 1024.0:
            return f"{size_bytes:.2f} {unit}"
        size_bytes /= 1024.0
    return f"{size_bytes:.2f} PB"


def get_storage_tier_by_access(last_accessed: Optional[datetime]) -> StorageTier:
    """Son erişim zamanına göre storage tier öner"""
    if last_accessed is None:
        return StorageTier.HOT
    
    from datetime import datetime, timezone, timedelta
    now = datetime.now(timezone.utc)
    days_since_access = (now - last_accessed).days
    
    if days_since_access < 7:
        return StorageTier.HOT
    elif days_since_access < 30:
        return StorageTier.WARM
    elif days_since_access < 90:
        return StorageTier.COLD
    else:
        return StorageTier.FROZEN


# Desteklenen MIME types
SUPPORTED_MIME_TYPES = {
    # Dokümanlar
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "text/plain",
    
    # Tablolar
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "text/csv",
    
    # Sunumlar
    "application/vnd.ms-powerpoint",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    
    # Resimler
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
    "image/svg+xml",
    
    # Arşivler
    "application/zip",
    "application/x-rar-compressed",
    "application/x-7z-compressed",
    "application/gzip",
}


# Thumbnail boyutları
THUMBNAIL_SIZES = {
    "small": (150, 150),
    "medium": (400, 400),
    "large": (800, 800)
}
