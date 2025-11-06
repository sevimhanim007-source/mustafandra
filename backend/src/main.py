"""
QDMS Backend Main Application
FastAPI ile geliştirilmiş, MongoDB kullanan entegre yönetim sistemi
"""
from fastapi import FastAPI, HTTPException, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from motor.motor_asyncio import AsyncIOMotorClient
from contextlib import asynccontextmanager
import os
from pathlib import Path

# Core imports
from core.config import settings
from db.mongo import get_database, close_database_connection

# API Routers
from api.v1 import rbac, auth, dof, files

# Uygulama ayarları
ROOT_DIR = Path(__file__).parent.parent
UPLOAD_DIR = ROOT_DIR / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Uygulama başlatma ve kapatma işlemleri
    """
    # Startup
    print("🚀 QDMS Backend başlatılıyor...")
    
    # MongoDB bağlantısı
    await get_database()
    print("✅ MongoDB bağlantısı kuruldu")
    
    # Öntanımlı rolleri kontrol et ve oluştur
    from models.rbac import DEFAULT_ROLES
    from datetime import datetime, timezone
    import uuid
    
    db = await get_database()
    
    # Super admin rolünü kontrol et
    super_admin = await db.roles.find_one({"name": "super_admin"})
    if not super_admin:
        print("📝 Öntanımlı roller oluşturuluyor...")
        now = datetime.now(timezone.utc)
        
        for role_data in DEFAULT_ROLES.values():
            existing = await db.roles.find_one({"name": role_data["name"]})
            if not existing:
                role_doc = {
                    "id": str(uuid.uuid4()),
                    **role_data,
                    "created_at": now,
                    "updated_at": now
                }
                await db.roles.insert_one(role_doc)
                print(f"  ✅ {role_data['display_name']} rolü oluşturuldu")
    
    # İlk admin kullanıcısını kontrol et
    admin_user = await db.users.find_one({"username": "admin"})
    if not admin_user:
        print("👤 İlk admin kullanıcısı oluşturuluyor...")
        from passlib.context import CryptContext
        
        pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
        now = datetime.now(timezone.utc)
        
        # Super admin rolünü bul
        super_admin_role = await db.roles.find_one({"name": "super_admin"})
        
        admin_doc = {
            "id": str(uuid.uuid4()),
            "username": "admin",
            "email": "admin@qdms.local",
            "password": pwd_context.hash("admin123"),  # İlk şifre - değiştirilmeli!
            "full_name": "Sistem Yöneticisi",
            "first_name": "Sistem",
            "last_name": "Yöneticisi",
            "roles": [super_admin_role["id"]] if super_admin_role else [],
            "groups": [],
            "department_id": None,
            "position": "Sistem Yöneticisi",
            "is_active": True,
            "is_locked": False,
            "created_at": now,
            "last_login": None
        }
        
        await db.users.insert_one(admin_doc)
        print("  ✅ Admin kullanıcısı oluşturuldu (username: admin, password: admin123)")
        print("  ⚠️  GÜVENLİK UYARISI: İlk girişte şifrenizi değiştirin!")
    
    print("✅ QDMS Backend hazır!")
    
    yield
    
    # Shutdown
    print("🛑 QDMS Backend kapatılıyor...")
    await close_database_connection()
    print("✅ Veritabanı bağlantısı kapatıldı")


# FastAPI uygulaması
app = FastAPI(
    title="QDMS API",
    description="Entegre Kalite ve Yönetim Sistemi API",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json"
)

# CORS ayarları
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Static files
app.mount("/uploads", StaticFiles(directory=str(UPLOAD_DIR)), name="uploads")

# Health check
@app.get("/health")
async def health_check():
    """Sistem sağlık kontrolü"""
    return {
        "status": "healthy",
        "service": "QDMS Backend",
        "version": "1.0.0"
    }

# API Routers
app.include_router(auth.router, prefix="/api/v1", tags=["Auth"])
app.include_router(rbac.router, prefix="/api/v1", tags=["RBAC"])
app.include_router(dof.router, prefix="/api/v1", tags=["DOF/CAPA"])
app.include_router(files.router, prefix="/api/v1", tags=["Files"])

# Root endpoint
@app.get("/")
async def root():
    """API kök endpoint"""
    return {
        "message": "QDMS API",
        "version": "1.0.0",
        "docs": "/api/docs",
        "health": "/health"
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8001,
        reload=True,
        log_level="info"
    )
