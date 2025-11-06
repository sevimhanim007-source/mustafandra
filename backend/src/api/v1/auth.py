"""
Authentication API
Login, logout, token yenileme, şifre değiştirme
"""
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from motor.motor_asyncio import AsyncIOMotorDatabase
from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime, timezone, timedelta
import uuid
import jwt
from passlib.context import CryptContext

from db.mongo import get_db
from core.config import settings, validate_password
from api.v1.deps import get_current_user
from models.rbac import UserOut, PasswordChange


router = APIRouter(prefix="/auth", tags=["Auth"])

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


# Models
class LoginRequest(BaseModel):
    username: str
    password: str


class LoginResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int
    user: UserOut


class RefreshTokenRequest(BaseModel):
    refresh_token: str


class RefreshTokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int


class PasswordResetRequest(BaseModel):
    email: EmailStr


class PasswordResetConfirm(BaseModel):
    token: str
    new_password: str


# Helper functions
def hash_password(password: str) -> str:
    """Şifreyi hashle"""
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Şifreyi doğrula"""
    return pwd_context.verify(plain_password, hashed_password)


def create_access_token(user_id: str) -> tuple[str, int]:
    """
    Access token oluştur
    Returns: (token, expires_in_seconds)
    """
    expires_delta = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    expire = datetime.now(timezone.utc) + expires_delta
    
    payload = {
        "sub": user_id,
        "type": "access",
        "exp": expire,
        "iat": datetime.now(timezone.utc)
    }
    
    token = jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)
    return token, settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60


async def create_refresh_token(user_id: str, db: AsyncIOMotorDatabase) -> str:
    """
    Refresh token oluştur ve veritabanına kaydet
    """
    expires_delta = timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    expire = datetime.now(timezone.utc) + expires_delta
    
    token = str(uuid.uuid4())
    
    session_doc = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "token": token,
        "expires_at": expire,
        "created_at": datetime.now(timezone.utc),
        "revoked": False,
        "ip_address": None,  # Request'ten alınabilir
        "user_agent": None   # Request'ten alınabilir
    }
    
    await db.sessions.insert_one(session_doc)
    
    return token


async def build_user_out(user: dict, db: AsyncIOMotorDatabase) -> UserOut:
    """
    Kullanıcı dict'inden UserOut modeli oluştur
    """
    # Departman adını al
    department_name = None
    if user.get("department_id"):
        dept = await db.departments.find_one({"id": user["department_id"]})
        if dept:
            department_name = dept["name"]
    
    # Rol adlarını al
    role_names = []
    if user.get("roles"):
        roles = await db.roles.find({"id": {"$in": user["roles"]}}).to_list(length=100)
        role_names = [role["display_name"] for role in roles]
    
    # Tüm izinleri topla
    from services.rbac_service import RBACService
    rbac = RBACService(db)
    permissions = await rbac.get_user_permissions(user["id"])
    
    return UserOut(
        id=user["id"],
        username=user["username"],
        email=user["email"],
        full_name=user["full_name"],
        first_name=user["first_name"],
        last_name=user["last_name"],
        department_id=user.get("department_id"),
        department_name=department_name,
        position=user.get("position"),
        roles=user.get("roles", []),
        role_names=role_names,
        groups=user.get("groups", []),
        permissions=list(permissions),
        is_active=user.get("is_active", True),
        is_locked=user.get("is_locked", False),
        phone=user.get("phone"),
        mobile=user.get("mobile"),
        created_at=user["created_at"],
        last_login=user.get("last_login")
    )


# Endpoints
@router.post("/login", response_model=LoginResponse)
async def login(
    login_data: LoginRequest,
    db: AsyncIOMotorDatabase = Depends(get_db)
):
    """
    Kullanıcı girişi
    """
    # Kullanıcıyı bul
    user = await db.users.find_one({"username": login_data.username})
    
    if not user or not verify_password(login_data.password, user["password"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Kullanıcı adı veya şifre hatalı",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Kullanıcı aktif mi?
    if not user.get("is_active", False):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Kullanıcı hesabı devre dışı"
        )
    
    # Hesap kilitli mi?
    if user.get("is_locked", False):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Kullanıcı hesabı kilitli. Yönetici ile iletişime geçin."
        )
    
    # Token'ları oluştur
    access_token, expires_in = create_access_token(user["id"])
    refresh_token = await create_refresh_token(user["id"], db)
    
    # Son giriş zamanını güncelle
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {"last_login": datetime.now(timezone.utc)}}
    )
    
    # Kullanıcı bilgilerini hazırla
    user_out = await build_user_out(user, db)
    
    return LoginResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer",
        expires_in=expires_in,
        user=user_out
    )


@router.post("/refresh", response_model=RefreshTokenResponse)
async def refresh_token(
    refresh_data: RefreshTokenRequest,
    db: AsyncIOMotorDatabase = Depends(get_db)
):
    """
    Access token'ı yenile
    """
    # Refresh token'ı bul
    session = await db.sessions.find_one({
        "token": refresh_data.refresh_token,
        "revoked": False
    })
    
    if not session:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Geçersiz refresh token"
        )
    
    # Token süresi dolmuş mu?
    if session["expires_at"] < datetime.now(timezone.utc):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token süresi dolmuş"
        )
    
    # Kullanıcı var mı ve aktif mi?
    user = await db.users.find_one({"id": session["user_id"]})
    if not user or not user.get("is_active", False):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Kullanıcı bulunamadı veya aktif değil"
        )
    
    # Yeni access token oluştur
    access_token, expires_in = create_access_token(user["id"])
    
    return RefreshTokenResponse(
        access_token=access_token,
        token_type="bearer",
        expires_in=expires_in
    )


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(
    refresh_data: RefreshTokenRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db)
):
    """
    Çıkış yap (refresh token'ı iptal et)
    """
    # Refresh token'ı iptal et
    await db.sessions.update_one(
        {
            "token": refresh_data.refresh_token,
            "user_id": current_user["id"]
        },
        {"$set": {"revoked": True}}
    )


@router.post("/change-password", status_code=status.HTTP_200_OK)
async def change_password(
    password_data: PasswordChange,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db)
):
    """
    Şifre değiştir
    """
    # Eski şifreyi doğrula
    if not verify_password(password_data.old_password, current_user["password"]):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Mevcut şifre hatalı"
        )
    
    # Yeni şifreyi doğrula
    is_valid, error_message = validate_password(password_data.new_password)
    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=error_message
        )
    
    # Yeni şifreyi hashle ve kaydet
    hashed_password = hash_password(password_data.new_password)
    
    await db.users.update_one(
        {"id": current_user["id"]},
        {"$set": {
            "password": hashed_password,
            "updated_at": datetime.now(timezone.utc)
        }}
    )
    
    return {"message": "Şifre başarıyla değiştirildi"}


@router.get("/me", response_model=UserOut)
async def get_current_user_info(
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db)
):
    """
    Mevcut kullanıcı bilgilerini getir
    """
    return await build_user_out(current_user, db)


@router.post("/password-reset/request")
async def request_password_reset(
    request_data: PasswordResetRequest,
    db: AsyncIOMotorDatabase = Depends(get_db)
):
    """
    Şifre sıfırlama talebi (email gönder)
    TODO: Email servisi entegrasyonu gerekli
    """
    user = await db.users.find_one({"email": request_data.email})
    
    if not user:
        # Güvenlik nedeniyle her durumda aynı mesaj
        return {"message": "Eğer bu email kayıtlıysa, şifre sıfırlama linki gönderildi"}
    
    # Reset token oluştur
    reset_token = str(uuid.uuid4())
    expires_at = datetime.now(timezone.utc) + timedelta(hours=1)
    
    # Token'ı veritabanına kaydet
    await db.password_reset_tokens.update_one(
        {"user_id": user["id"]},
        {
            "$set": {
                "token": reset_token,
                "expires_at": expires_at,
                "used": False,
                "created_at": datetime.now(timezone.utc)
            }
        },
        upsert=True
    )
    
    # TODO: Email gönder
    # send_password_reset_email(user["email"], reset_token)
    
    return {"message": "Eğer bu email kayıtlıysa, şifre sıfırlama linki gönderildi"}


@router.post("/password-reset/confirm")
async def confirm_password_reset(
    confirm_data: PasswordResetConfirm,
    db: AsyncIOMotorDatabase = Depends(get_db)
):
    """
    Şifre sıfırlama işlemini tamamla
    """
    # Token'ı bul
    reset = await db.password_reset_tokens.find_one({
        "token": confirm_data.token,
        "used": False
    })
    
    if not reset:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Geçersiz veya kullanılmış token"
        )
    
    # Token süresi dolmuş mu?
    if reset["expires_at"] < datetime.now(timezone.utc):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Token süresi dolmuş"
        )
    
    # Yeni şifreyi doğrula
    is_valid, error_message = validate_password(confirm_data.new_password)
    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=error_message
        )
    
    # Şifreyi güncelle
    hashed_password = hash_password(confirm_data.new_password)
    
    await db.users.update_one(
        {"id": reset["user_id"]},
        {"$set": {
            "password": hashed_password,
            "updated_at": datetime.now(timezone.utc)
        }}
    )
    
    # Token'ı kullanılmış olarak işaretle
    await db.password_reset_tokens.update_one(
        {"token": confirm_data.token},
        {"$set": {"used": True}}
    )
    
    return {"message": "Şifre başarıyla sıfırlandı"}


@router.post("/logout-all", status_code=status.HTTP_204_NO_CONTENT)
async def logout_all_sessions(
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db)
):
    """
    Tüm oturumlardan çıkış yap (tüm cihazlarda)
    """
    # Kullanıcının tüm session'larını iptal et
    await db.sessions.update_many(
        {"user_id": current_user["id"], "revoked": False},
        {"$set": {"revoked": True}}
    )
