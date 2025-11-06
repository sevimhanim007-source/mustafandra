"""
Backend Configuration
Ortam değişkenleri ve sistem ayarları
"""
from pydantic_settings import BaseSettings
from typing import List
import os
from pathlib import Path


class Settings(BaseSettings):
    """Uygulama ayarları"""
    
    # Uygulama
    APP_NAME: str = "QDMS"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False
    
    # MongoDB
    MONGO_URL: str = "mongodb://localhost:27017"
    DB_NAME: str = "qdms"
    
    # JWT
    JWT_SECRET: str = "change-me-in-production-use-strong-secret"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60  # 1 saat
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7  # 7 gün
    
    # CORS
    CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://localhost:5173",
        "http://localhost:8080",
    ]
    
    # SMTP
    SMTP_SERVER: str = "mail.example.com"
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM_NAME: str = "QDMS Portal"
    SMTP_USE_TLS: bool = True
    
    # Dosya yükleme
    UPLOAD_DIR: str = "uploads"
    MAX_UPLOAD_SIZE: int = 10 * 1024 * 1024  # 10MB
    ALLOWED_EXTENSIONS: List[str] = [
        ".pdf", ".doc", ".docx", ".xls", ".xlsx",
        ".ppt", ".pptx", ".txt", ".csv",
        ".jpg", ".jpeg", ".png", ".gif",
        ".zip", ".rar"
    ]
    
    # Güvenlik
    PASSWORD_MIN_LENGTH: int = 8
    PASSWORD_REQUIRE_UPPERCASE: bool = True
    PASSWORD_REQUIRE_LOWERCASE: bool = True
    PASSWORD_REQUIRE_DIGIT: bool = True
    PASSWORD_REQUIRE_SPECIAL: bool = False
    
    # Session
    SESSION_COOKIE_NAME: str = "qdms_session"
    SESSION_COOKIE_SECURE: bool = False  # Production'da True
    SESSION_COOKIE_HTTPONLY: bool = True
    SESSION_COOKIE_SAMESITE: str = "lax"
    
    # Rate limiting (opsiyonel - ileride eklenecek)
    RATE_LIMIT_ENABLED: bool = False
    RATE_LIMIT_PER_MINUTE: int = 60
    
    # Logging
    LOG_LEVEL: str = "INFO"
    LOG_FILE: str = "logs/qdms.log"
    
    # Redis (opsiyonel - cache ve queue için)
    REDIS_URL: str = "redis://localhost:6379/0"
    REDIS_ENABLED: bool = False
    
    # Modül aktivasyonu
    MODULE_DOCUMENT: bool = True
    MODULE_COMPLAINT: bool = True
    MODULE_CAPA: bool = True
    MODULE_AUDIT: bool = True
    MODULE_RISK: bool = True
    MODULE_CALIBRATION: bool = True
    
    class Config:
        env_file = ".env"
        case_sensitive = True


# Global settings instance
settings = Settings()


# Yardımcı fonksiyonlar
def get_upload_path(filename: str) -> Path:
    """Yükleme dosya yolunu döndür"""
    upload_dir = Path(settings.UPLOAD_DIR)
    upload_dir.mkdir(exist_ok=True)
    return upload_dir / filename


def is_allowed_file(filename: str) -> bool:
    """Dosya uzantısının izinli olup olmadığını kontrol et"""
    ext = Path(filename).suffix.lower()
    return ext in settings.ALLOWED_EXTENSIONS


def get_file_size_mb(size_bytes: int) -> float:
    """Dosya boyutunu MB cinsinden döndür"""
    return size_bytes / (1024 * 1024)


def validate_password(password: str) -> tuple[bool, str]:
    """
    Şifre kurallarını kontrol et
    Returns: (is_valid, error_message)
    """
    if len(password) < settings.PASSWORD_MIN_LENGTH:
        return False, f"Şifre en az {settings.PASSWORD_MIN_LENGTH} karakter olmalıdır"
    
    if settings.PASSWORD_REQUIRE_UPPERCASE and not any(c.isupper() for c in password):
        return False, "Şifre en az bir büyük harf içermelidir"
    
    if settings.PASSWORD_REQUIRE_LOWERCASE and not any(c.islower() for c in password):
        return False, "Şifre en az bir küçük harf içermelidir"
    
    if settings.PASSWORD_REQUIRE_DIGIT and not any(c.isdigit() for c in password):
        return False, "Şifre en az bir rakam içermelidir"
    
    if settings.PASSWORD_REQUIRE_SPECIAL:
        special_chars = "!@#$%^&*()_+-=[]{}|;:,.<>?"
        if not any(c in special_chars for c in password):
            return False, "Şifre en az bir özel karakter içermelidir"
    
    return True, ""
