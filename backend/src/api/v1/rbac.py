"""
RBAC API Endpoints
Rol, departman, grup ve yetkilendirme yönetimi
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from typing import List, Optional
from motor.motor_asyncio import AsyncIOMotorDatabase
from datetime import datetime, timezone
import uuid

from models.rbac import (
    RoleCreate, RoleUpdate, RoleOut,
    DepartmentCreate, DepartmentUpdate, DepartmentOut,
    UserGroup, PermissionCheck, UserPermissions,
    SYSTEM_PERMISSIONS, DEFAULT_ROLES, Permission, PermissionCategory
)
from services.rbac_service import RBACService
from api.v1.deps import get_db, get_current_user


router = APIRouter(prefix="/rbac", tags=["RBAC"])


# ============================================================================
# ROL YÖNETİMİ
# ============================================================================

@router.get("/roles", response_model=List[RoleOut])
async def list_roles(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    search: Optional[str] = None,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """
    Rolleri listele
    """
    query = {}
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"display_name": {"$regex": search, "$options": "i"}}
        ]
    
    roles = await db.roles.find(query).skip(skip).limit(limit).to_list(length=limit)
    
    # Her rol için kullanıcı sayısını hesapla
    result = []
    for role in roles:
        user_count = await db.users.count_documents({"roles": role["id"]})
        
        result.append(RoleOut(
            id=role["id"],
            name=role["name"],
            display_name=role["display_name"],
            description=role.get("description"),
            permissions=role.get("permissions", []),
            is_system=role.get("is_system", False),
            created_at=role["created_at"],
            updated_at=role["updated_at"],
            user_count=user_count
        ))
    
    return result


@router.post("/roles", response_model=RoleOut, status_code=status.HTTP_201_CREATED)
async def create_role(
    role_data: RoleCreate,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """
    Yeni rol oluştur
    Gerekli izin: admin.roles
    """
    # İzin kontrolü
    rbac = RBACService(db)
    perm_check = await rbac.check_permission(current_user["id"], "admin.roles")
    if not perm_check.granted:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Bu işlem için 'admin.roles' izni gereklidir"
        )
    
    # Rol adı benzersiz olmalı
    existing = await db.roles.find_one({"name": role_data.name})
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"'{role_data.name}' adında bir rol zaten mevcut"
        )
    
    # İzinleri doğrula
    invalid_perms = [p for p in role_data.permissions if p not in SYSTEM_PERMISSIONS]
    if invalid_perms:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Geçersiz izinler: {', '.join(invalid_perms)}"
        )
    
    now = datetime.now(timezone.utc)
    role_doc = {
        "id": str(uuid.uuid4()),
        "name": role_data.name,
        "display_name": role_data.display_name,
        "description": role_data.description,
        "permissions": role_data.permissions,
        "is_system": False,  # Kullanıcı tarafından oluşturulan roller sistem rolü değildir
        "created_at": now,
        "updated_at": now
    }
    
    await db.roles.insert_one(role_doc)
    
    return RoleOut(
        id=role_doc["id"],
        name=role_doc["name"],
        display_name=role_doc["display_name"],
        description=role_doc["description"],
        permissions=role_doc["permissions"],
        is_system=role_doc["is_system"],
        created_at=role_doc["created_at"],
        updated_at=role_doc["updated_at"],
        user_count=0
    )


@router.get("/roles/{role_id}", response_model=RoleOut)
async def get_role(
    role_id: str,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """
    Rol detaylarını getir
    """
    role = await db.roles.find_one({"id": role_id})
    if not role:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Rol bulunamadı"
        )
    
    user_count = await db.users.count_documents({"roles": role_id})
    
    return RoleOut(
        id=role["id"],
        name=role["name"],
        display_name=role["display_name"],
        description=role.get("description"),
        permissions=role.get("permissions", []),
        is_system=role.get("is_system", False),
        created_at=role["created_at"],
        updated_at=role["updated_at"],
        user_count=user_count
    )


@router.patch("/roles/{role_id}", response_model=RoleOut)
async def update_role(
    role_id: str,
    role_update: RoleUpdate,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """
    Rol güncelle
    Gerekli izin: admin.roles
    """
    # İzin kontrolü
    rbac = RBACService(db)
    perm_check = await rbac.check_permission(current_user["id"], "admin.roles")
    if not perm_check.granted:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Bu işlem için 'admin.roles' izni gereklidir"
        )
    
    role = await db.roles.find_one({"id": role_id})
    if not role:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Rol bulunamadı"
        )
    
    # Sistem rollerini düzenlenemez
    if role.get("is_system", False):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Sistem rolleri düzenlenemez"
        )
    
    update_data = role_update.dict(exclude_unset=True)
    
    # İzinleri doğrula
    if "permissions" in update_data:
        invalid_perms = [p for p in update_data["permissions"] if p not in SYSTEM_PERMISSIONS]
        if invalid_perms:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Geçersiz izinler: {', '.join(invalid_perms)}"
            )
    
    update_data["updated_at"] = datetime.now(timezone.utc)
    
    await db.roles.update_one(
        {"id": role_id},
        {"$set": update_data}
    )
    
    updated_role = await db.roles.find_one({"id": role_id})
    user_count = await db.users.count_documents({"roles": role_id})
    
    return RoleOut(
        id=updated_role["id"],
        name=updated_role["name"],
        display_name=updated_role["display_name"],
        description=updated_role.get("description"),
        permissions=updated_role.get("permissions", []),
        is_system=updated_role.get("is_system", False),
        created_at=updated_role["created_at"],
        updated_at=updated_role["updated_at"],
        user_count=user_count
    )


@router.delete("/roles/{role_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_role(
    role_id: str,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """
    Rol sil
    Gerekli izin: admin.roles
    """
    # İzin kontrolü
    rbac = RBACService(db)
    perm_check = await rbac.check_permission(current_user["id"], "admin.roles")
    if not perm_check.granted:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Bu işlem için 'admin.roles' izni gereklidir"
        )
    
    role = await db.roles.find_one({"id": role_id})
    if not role:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Rol bulunamadı"
        )
    
    # Sistem rolleri silinemez
    if role.get("is_system", False):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Sistem rolleri silinemez"
        )
    
    # Kullanıcılarda kullanılıyorsa silinemez
    user_count = await db.users.count_documents({"roles": role_id})
    if user_count > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Bu rol {user_count} kullanıcı tarafından kullanılıyor. Önce kullanıcılardan kaldırın."
        )
    
    await db.roles.delete_one({"id": role_id})


# ============================================================================
# DEPARTMAN YÖNETİMİ
# ============================================================================

@router.get("/departments", response_model=List[DepartmentOut])
async def list_departments(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    parent_id: Optional[str] = None,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """
    Departmanları listele
    """
    query = {}
    if parent_id:
        query["parent_id"] = parent_id
    
    departments = await db.departments.find(query).skip(skip).limit(limit).to_list(length=limit)
    
    result = []
    for dept in departments:
        user_count = await db.users.count_documents({"department_id": dept["id"]})
        
        # Alt departmanları bul
        children = await db.departments.find({"parent_id": dept["id"]}).to_list(length=100)
        child_ids = [child["id"] for child in children]
        
        result.append(DepartmentOut(
            id=dept["id"],
            code=dept["code"],
            name=dept["name"],
            description=dept.get("description"),
            parent_id=dept.get("parent_id"),
            manager_id=dept.get("manager_id"),
            created_at=dept["created_at"],
            updated_at=dept["updated_at"],
            user_count=user_count,
            children=child_ids
        ))
    
    return result


@router.post("/departments", response_model=DepartmentOut, status_code=status.HTTP_201_CREATED)
async def create_department(
    dept_data: DepartmentCreate,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """
    Yeni departman oluştur
    Gerekli izin: admin.departments
    """
    # İzin kontrolü
    rbac = RBACService(db)
    perm_check = await rbac.check_permission(current_user["id"], "admin.departments")
    if not perm_check.granted:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Bu işlem için 'admin.departments' izni gereklidir"
        )
    
    # Kod benzersiz olmalı
    existing = await db.departments.find_one({"code": dept_data.code})
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"'{dept_data.code}' kodunda bir departman zaten mevcut"
        )
    
    now = datetime.now(timezone.utc)
    dept_doc = {
        "id": str(uuid.uuid4()),
        "code": dept_data.code,
        "name": dept_data.name,
        "description": dept_data.description,
        "parent_id": dept_data.parent_id,
        "manager_id": dept_data.manager_id,
        "created_at": now,
        "updated_at": now
    }
    
    await db.departments.insert_one(dept_doc)
    
    return DepartmentOut(
        id=dept_doc["id"],
        code=dept_doc["code"],
        name=dept_doc["name"],
        description=dept_doc["description"],
        parent_id=dept_doc["parent_id"],
        manager_id=dept_doc["manager_id"],
        created_at=dept_doc["created_at"],
        updated_at=dept_doc["updated_at"],
        user_count=0,
        children=[]
    )


# ============================================================================
# İZİN YÖNETİMİ
# ============================================================================

@router.get("/permissions", response_model=List[Permission])
async def list_permissions(
    category: Optional[PermissionCategory] = None,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """
    Tüm sistem izinlerini listele
    """
    permissions = list(SYSTEM_PERMISSIONS.values())
    
    if category:
        permissions = [p for p in permissions if p.category == category]
    
    return permissions


@router.get("/permissions/check", response_model=PermissionCheck)
async def check_user_permission(
    permission: str = Query(..., description="Kontrol edilecek izin kodu"),
    user_id: Optional[str] = Query(None, description="Kontrol edilecek kullanıcı (boşsa mevcut kullanıcı)"),
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """
    Kullanıcının belirli bir izni olup olmadığını kontrol et
    """
    target_user_id = user_id if user_id else current_user["id"]
    
    rbac = RBACService(db)
    result = await rbac.check_permission(target_user_id, permission)
    
    return result


@router.get("/permissions/user", response_model=UserPermissions)
async def get_user_all_permissions(
    user_id: Optional[str] = Query(None, description="Kullanıcı ID (boşsa mevcut kullanıcı)"),
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """
    Kullanıcının tüm izinlerini detaylı olarak getir
    """
    target_user_id = user_id if user_id else current_user["id"]
    
    rbac = RBACService(db)
    permissions = await rbac.get_user_detailed_permissions(target_user_id)
    
    return permissions


# ============================================================================
# SİSTEM VE SEED
# ============================================================================

@router.post("/seed/roles", status_code=status.HTTP_201_CREATED)
async def seed_default_roles(
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """
    Öntanımlı rolleri sisteme ekle
    Gerekli izin: admin.system
    """
    # İzin kontrolü
    rbac = RBACService(db)
    perm_check = await rbac.check_permission(current_user["id"], "admin.system")
    if not perm_check.granted:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Bu işlem için 'admin.system' izni gereklidir"
        )
    
    created_count = 0
    now = datetime.now(timezone.utc)
    
    for role_data in DEFAULT_ROLES.values():
        # Zaten varsa atla
        existing = await db.roles.find_one({"name": role_data["name"]})
        if existing:
            continue
        
        role_doc = {
            "id": str(uuid.uuid4()),
            **role_data,
            "created_at": now,
            "updated_at": now
        }
        
        await db.roles.insert_one(role_doc)
        created_count += 1
    
    return {
        "message": f"{created_count} adet rol oluşturuldu",
        "total_roles": len(DEFAULT_ROLES)
    }
