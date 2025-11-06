"""
MongoDB Connection Management
"""
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from typing import Optional
from core.config import settings
import logging

logger = logging.getLogger(__name__)

# Global MongoDB client ve database
_client: Optional[AsyncIOMotorClient] = None
_database: Optional[AsyncIOMotorDatabase] = None


async def get_database() -> AsyncIOMotorDatabase:
    """
    MongoDB database instance'ını döndür
    Singleton pattern kullanarak tek bir bağlantı sağlar
    """
    global _client, _database
    
    if _database is None:
        logger.info(f"MongoDB bağlantısı kuruluyor: {settings.MONGO_URL}")
        
        try:
            _client = AsyncIOMotorClient(
                settings.MONGO_URL,
                serverSelectionTimeoutMS=5000,
                connectTimeoutMS=10000,
            )
            
            # Bağlantıyı test et
            await _client.admin.command('ping')
            
            _database = _client[settings.DB_NAME]
            logger.info(f"✅ MongoDB bağlantısı başarılı: {settings.DB_NAME}")
            
        except Exception as e:
            logger.error(f"❌ MongoDB bağlantı hatası: {e}")
            raise
    
    return _database


async def close_database_connection():
    """
    MongoDB bağlantısını kapat
    """
    global _client, _database
    
    if _client is not None:
        logger.info("MongoDB bağlantısı kapatılıyor...")
        _client.close()
        _client = None
        _database = None
        logger.info("✅ MongoDB bağlantısı kapatıldı")


async def ping_database() -> bool:
    """
    Veritabanı bağlantısını kontrol et
    """
    try:
        db = await get_database()
        await db.command('ping')
        return True
    except Exception as e:
        logger.error(f"Database ping hatası: {e}")
        return False


# Collection isimleri (constants)
class Collections:
    """MongoDB koleksiyon isimleri"""
    
    # Kullanıcı ve yetkilendirme
    USERS = "users"
    ROLES = "roles"
    DEPARTMENTS = "departments"
    USER_GROUPS = "user_groups"
    SESSIONS = "sessions"
    
    # Doküman yönetimi
    DOCUMENTS = "documents"
    DOCUMENT_FOLDERS = "document_folders"
    DOCUMENT_VERSIONS = "document_versions"
    DOCUMENT_APPROVALS = "document_approvals"
    DOCUMENT_READS = "document_reads"
    
    # Müşteri şikayetleri
    COMPLAINTS = "complaints"
    COMPLAINT_ACTIONS = "complaint_actions"
    
    # CAPA/DÖF
    CAPAS = "capas"
    CAPA_ACTIONS = "capa_actions"
    CAPA_TEAMS = "capa_teams"
    
    # Denetim
    AUDITS = "audits"
    AUDIT_TEAMS = "audit_teams"
    AUDIT_QUESTIONS = "audit_questions"
    AUDIT_ANSWERS = "audit_answers"
    AUDIT_FINDINGS = "audit_findings"
    
    # Risk yönetimi
    RISKS = "risks"
    RISK_FORMS = "risk_forms"
    RISK_CONTROLS = "risk_controls"
    RISK_REVISIONS = "risk_revisions"
    
    # Kalibrasyon
    DEVICES = "devices"
    CALIBRATIONS = "calibrations"
    CALIBRATION_MEASUREMENTS = "calibration_measurements"
    DEVICE_MAINTENANCES = "device_maintenances"
    
    # Dosya ve görev yönetimi
    FILES = "files"
    NOTIFICATIONS = "notifications"
    TASKS = "tasks"
    
    # Raporlama
    REPORTS = "reports"
    REPORT_TEMPLATES = "report_templates"
    
    # Sistem
    SYSTEM_SETTINGS = "system_settings"
    AUDIT_LOGS = "audit_logs"
    
    # İş akışı
    WORKFLOWS = "workflows"
    WORKFLOW_INSTANCES = "workflow_instances"
    WORKFLOW_STEPS = "workflow_steps"


# Dependency injection için
async def get_db() -> AsyncIOMotorDatabase:
    """
    FastAPI dependency olarak kullanılacak database getter
    """
    return await get_database()
