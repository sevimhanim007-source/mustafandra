"""
FastAPI Dependencies
JWT doğrulama, kullanıcı bilgisi çekme, veritabanı bağımlılıkları
"""
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from motor.motor_asyncio import AsyncIOMotorDatabase
from typing import Optional
import jwt
from datetime import datetime, timezone

from db.mongo import get_database
from core.config import settings
from services.rbac_service import RBACService


# Security scheme
security = HTTPBearer(auto_error=True)


async def get_db() -> AsyncIOMotorDatabase:
    """
    Veritabanı dependency
    """
    return await get_database()


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncIOMotorDatabase = Depends(get_db)
) -> dict:
    """
    JWT token'dan mevcut kullanıcıyı al
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Kimlik doğrulama başarısız",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    try:
        # JWT token'ı decode et
        payload = jwt.decode(
            credentials.credentials,
            settings.JWT_SECRET,
            algorithms=[settings.JWT_ALGORITHM]
        )
        
        user_id: str = payload.get("sub")
        token_type: str = payload.get("type")
        
        if user_id is None or token_type != "access":
            raise credentials_exception
            
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token süresi dolmuş",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except jwt.JWTError:
        raise credentials_exception
    
    # Kullanıcıyı veritabanından al
    user = await db.users.find_one({"id": user_id})
    if user is None:
        raise credentials_exception
    
    # Kullanıcı aktif mi kontrol et
    if not user.get("is_active", False):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Kullanıcı hesabı devre dışı"
        )
    
    # Hesap kilitli mi kontrol et
    if user.get("is_locked", False):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Kullanıcı hesabı kilitli"
        )
    
    return user


async def get_current_active_user(
    current_user: dict = Depends(get_current_user)
) -> dict:
    """
    Aktif kullanıcı kontrolü (ek kontroller için)
    """
    return current_user


async def get_current_user_permissions(
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db)
) -> set:
    """
    Mevcut kullanıcının tüm izinlerini getir
    """
    rbac = RBACService(db)
    permissions = await rbac.get_user_permissions(current_user["id"])
    return permissions


def require_permission(permission: str):
    """
    Belirli bir izin gerektiren dependency factory
    
    Kullanım:
    @router.get("/protected")
    async def protected_route(
        _=Depends(require_permission("document.read"))
    ):
        ...
    """
    async def permission_checker(
        current_user: dict = Depends(get_current_user),
        db: AsyncIOMotorDatabase = Depends(get_db)
    ):
        rbac = RBACService(db)
        check = await rbac.check_permission(current_user["id"], permission)
        
        if not check.granted:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Bu işlem için '{permission}' izni gereklidir"
            )
        
        return current_user
    
    return permission_checker


def require_any_permission(*permissions: str):
    """
    Verilen izinlerden herhangi birine sahip olma gereksinimi
    
    Kullanım:
    @router.get("/protected")
    async def protected_route(
        _=Depends(require_any_permission("document.read", "document.edit"))
    ):
        ...
    """
    async def permission_checker(
        current_user: dict = Depends(get_current_user),
        db: AsyncIOMotorDatabase = Depends(get_db)
    ):
        rbac = RBACService(db)
        has_perm = await rbac.has_any_permission(current_user["id"], list(permissions))
        
        if not has_perm:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Bu işlem için şu izinlerden biri gereklidir: {', '.join(permissions)}"
            )
        
        return current_user
    
    return permission_checker


def require_all_permissions(*permissions: str):
    """
    Verilen tüm izinlere sahip olma gereksinimi
    
    Kullanım:
    @router.get("/protected")
    async def protected_route(
        _=Depends(require_all_permissions("document.read", "document.approve"))
    ):
        ...
    """
    async def permission_checker(
        current_user: dict = Depends(get_current_user),
        db: AsyncIOMotorDatabase = Depends(get_db)
    ):
        rbac = RBACService(db)
        has_all = await rbac.has_all_permissions(current_user["id"], list(permissions))
        
        if not has_all:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Bu işlem için şu izinlerin hepsi gereklidir: {', '.join(permissions)}"
            )
        
        return current_user
    
    return permission_checker


def require_role(role_name: str):
    """
    Belirli bir role sahip olma gereksinimi
    
    Kullanım:
    @router.get("/admin")
    async def admin_route(
        _=Depends(require_role("admin"))
    ):
        ...
    """
    async def role_checker(
        current_user: dict = Depends(get_current_user),
        db: AsyncIOMotorDatabase = Depends(get_db)
    ):
        user_roles = current_user.get("roles", [])
        
        # Rolleri al
        roles = await db.roles.find(
            {"id": {"$in": user_roles}}
        ).to_list(length=100)
        
        role_names = [role["name"] for role in roles]
        
        if role_name not in role_names:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Bu işlem için '{role_name}' rolü gereklidir"
            )
        
        return current_user
    
    return role_checker


async def get_rbac_service(
    db: AsyncIOMotorDatabase = Depends(get_db)
) -> RBACService:
    """
    RBAC servis dependency
    """
    return RBACService(db)


async def get_optional_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(HTTPBearer(auto_error=False)),
    db: AsyncIOMotorDatabase = Depends(get_db)
) -> Optional[dict]:
    """
    Opsiyonel kullanıcı - token varsa kullanıcıyı al, yoksa None döndür
    Public endpoint'ler için kullanışlı
    """
    if credentials is None:
        return None
    
    try:
        payload = jwt.decode(
            credentials.credentials,
            settings.JWT_SECRET,
            algorithms=[settings.JWT_ALGORITHM]
        )
        
        user_id: str = payload.get("sub")
        if user_id is None:
            return None
        
        user = await db.users.find_one({"id": user_id})
        return user
        
    except (jwt.ExpiredSignatureError, jwt.JWTError):
        return None


def require_department_access(department_id_param: str = "department_id"):
    """
    Kullanıcının belirli bir departmana erişim yetkisi kontrolü
    
    Kullanım:
    @router.get("/departments/{department_id}/data")
    async def get_department_data(
        department_id: str,
        _=Depends(require_department_access("department_id"))
    ):
        ...
    """
    async def department_checker(
        department_id: str,
        current_user: dict = Depends(get_current_user),
        db: AsyncIOMotorDatabase = Depends(get_db)
    ):
        rbac = RBACService(db)
        can_access = await rbac.can_access_department(current_user["id"], department_id)
        
        if not can_access:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Bu departmana erişim yetkiniz yok"
            )
        
        return current_user
    
    return department_checker
