"""
RBAC Service - Yetkilendirme İş Mantığı
"""
from typing import List, Set, Optional, Dict
from motor.motor_asyncio import AsyncIOMotorDatabase
from datetime import datetime, timezone
from models.rbac import (
    UserOut, RoleOut, DepartmentOut, PermissionCheck, 
    UserPermissions, SYSTEM_PERMISSIONS
)


class RBACService:
    """RBAC iş mantığı servisi"""
    
    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db
    
    async def get_user_permissions(self, user_id: str) -> Set[str]:
        """
        Kullanıcının tüm izinlerini getir (roller + gruplar)
        """
        user = await self.db.users.find_one({"id": user_id})
        if not user:
            return set()
        
        permissions = set()
        
        # Rollerden izinler
        if user.get("roles"):
            roles = await self.db.roles.find(
                {"id": {"$in": user["roles"]}}
            ).to_list(length=100)
            
            for role in roles:
                permissions.update(role.get("permissions", []))
        
        # Gruplardan izinler
        if user.get("groups"):
            groups = await self.db.user_groups.find(
                {"id": {"$in": user["groups"]}}
            ).to_list(length=100)
            
            for group in groups:
                permissions.update(group.get("permissions", []))
        
        return permissions
    
    async def check_permission(
        self, 
        user_id: str, 
        permission: str
    ) -> PermissionCheck:
        """
        Kullanıcının belirli bir izni olup olmadığını kontrol et
        """
        user_perms = await self.get_user_permissions(user_id)
        granted = permission in user_perms
        
        # İznin nereden geldiğini bul
        source = None
        if granted:
            user = await self.db.users.find_one({"id": user_id})
            
            # Rollerde ara
            if user.get("roles"):
                roles = await self.db.roles.find(
                    {
                        "id": {"$in": user["roles"]},
                        "permissions": permission
                    }
                ).to_list(length=10)
                
                if roles:
                    source = f"role:{roles[0]['name']}"
            
            # Gruplarda ara
            if not source and user.get("groups"):
                groups = await self.db.user_groups.find(
                    {
                        "id": {"$in": user["groups"]},
                        "permissions": permission
                    }
                ).to_list(length=10)
                
                if groups:
                    source = f"group:{groups[0]['name']}"
        
        return PermissionCheck(
            user_id=user_id,
            permission=permission,
            granted=granted,
            source=source
        )
    
    async def check_permissions(
        self, 
        user_id: str, 
        permissions: List[str]
    ) -> Dict[str, bool]:
        """
        Birden fazla izni kontrol et
        """
        user_perms = await self.get_user_permissions(user_id)
        return {
            perm: perm in user_perms 
            for perm in permissions
        }
    
    async def get_user_detailed_permissions(
        self, 
        user_id: str
    ) -> UserPermissions:
        """
        Kullanıcının detaylı izin bilgilerini getir
        """
        user = await self.db.users.find_one({"id": user_id})
        if not user:
            return UserPermissions(
                user_id=user_id,
                username="unknown",
                permissions=set()
            )
        
        all_permissions = set()
        role_perms = {}
        group_perms = {}
        
        # Rollerden izinler
        if user.get("roles"):
            roles = await self.db.roles.find(
                {"id": {"$in": user["roles"]}}
            ).to_list(length=100)
            
            for role in roles:
                perms = role.get("permissions", [])
                role_perms[role["name"]] = perms
                all_permissions.update(perms)
        
        # Gruplardan izinler
        if user.get("groups"):
            groups = await self.db.user_groups.find(
                {"id": {"$in": user["groups"]}}
            ).to_list(length=100)
            
            for group in groups:
                perms = group.get("permissions", [])
                group_perms[group["name"]] = perms
                all_permissions.update(perms)
        
        return UserPermissions(
            user_id=user_id,
            username=user["username"],
            permissions=all_permissions,
            roles=role_perms,
            groups=group_perms
        )
    
    async def has_any_permission(
        self, 
        user_id: str, 
        permissions: List[str]
    ) -> bool:
        """
        Kullanıcının verilen izinlerden en az birine sahip olup olmadığını kontrol et
        """
        user_perms = await self.get_user_permissions(user_id)
        return any(perm in user_perms for perm in permissions)
    
    async def has_all_permissions(
        self, 
        user_id: str, 
        permissions: List[str]
    ) -> bool:
        """
        Kullanıcının verilen tüm izinlere sahip olup olmadığını kontrol et
        """
        user_perms = await self.get_user_permissions(user_id)
        return all(perm in user_perms for perm in permissions)
    
    async def get_users_with_permission(
        self, 
        permission: str
    ) -> List[str]:
        """
        Belirli bir izne sahip tüm kullanıcı ID'lerini getir
        """
        user_ids = set()
        
        # İzne sahip rolleri bul
        roles = await self.db.roles.find(
            {"permissions": permission}
        ).to_list(length=100)
        
        role_ids = [role["id"] for role in roles]
        
        # Bu rollere sahip kullanıcıları bul
        if role_ids:
            users = await self.db.users.find(
                {"roles": {"$in": role_ids}}
            ).to_list(length=1000)
            
            user_ids.update(user["id"] for user in users)
        
        # İzne sahip grupları bul
        groups = await self.db.user_groups.find(
            {"permissions": permission}
        ).to_list(length=100)
        
        group_ids = [group["id"] for group in groups]
        
        # Bu gruplara üye kullanıcıları bul
        if group_ids:
            users = await self.db.users.find(
                {"groups": {"$in": group_ids}}
            ).to_list(length=1000)
            
            user_ids.update(user["id"] for user in users)
        
        return list(user_ids)
    
    async def can_access_department(
        self, 
        user_id: str, 
        department_id: str
    ) -> bool:
        """
        Kullanıcının belirli bir departmana erişim yetkisi olup olmadığını kontrol et
        """
        user = await self.db.users.find_one({"id": user_id})
        if not user:
            return False
        
        # Kullanıcı aynı departmandaysa
        if user.get("department_id") == department_id:
            return True
        
        # Admin izni varsa
        perms = await self.get_user_permissions(user_id)
        if "admin.departments" in perms or "admin.system" in perms:
            return True
        
        # Departman yöneticisiyse
        department = await self.db.departments.find_one({"id": department_id})
        if department and department.get("manager_id") == user_id:
            return True
        
        return False
    
    async def get_accessible_departments(
        self, 
        user_id: str
    ) -> List[str]:
        """
        Kullanıcının erişebildiği departman ID'lerini getir
        """
        user = await self.db.users.find_one({"id": user_id})
        if not user:
            return []
        
        perms = await self.get_user_permissions(user_id)
        
        # Admin ise tüm departmanlara erişebilir
        if "admin.departments" in perms or "admin.system" in perms:
            departments = await self.db.departments.find().to_list(length=1000)
            return [dept["id"] for dept in departments]
        
        accessible = []
        
        # Kendi departmanı
        if user.get("department_id"):
            accessible.append(user["department_id"])
        
        # Yönetici olduğu departmanlar
        managed_depts = await self.db.departments.find(
            {"manager_id": user_id}
        ).to_list(length=100)
        
        accessible.extend([dept["id"] for dept in managed_depts])
        
        return list(set(accessible))
    
    async def validate_permissions(
        self, 
        permissions: List[str]
    ) -> Dict[str, bool]:
        """
        İzin kodlarının geçerli olup olmadığını kontrol et
        """
        return {
            perm: perm in SYSTEM_PERMISSIONS
            for perm in permissions
        }
    
    async def get_role_hierarchy(
        self, 
        role_id: str
    ) -> Dict[str, any]:
        """
        Rolün hiyerarşik yapısını getir (şu an basit, geliştirilecek)
        """
        role = await self.db.roles.find_one({"id": role_id})
        if not role:
            return {}
        
        return {
            "id": role["id"],
            "name": role["name"],
            "permissions": role.get("permissions", []),
            "permission_count": len(role.get("permissions", [])),
            "is_system": role.get("is_system", False)
        }


class PermissionDecorator:
    """
    İzin kontrolü için decorator fonksiyonları
    (FastAPI dependency'lerde kullanılacak)
    """
    
    @staticmethod
    def require_permission(permission: str):
        """Belirli bir izin gerektiren endpoint için"""
        async def check(user_id: str, rbac_service: RBACService):
            result = await rbac_service.check_permission(user_id, permission)
            if not result.granted:
                from fastapi import HTTPException
                raise HTTPException(
                    status_code=403,
                    detail=f"Bu işlem için '{permission}' izni gereklidir"
                )
            return True
        return check
    
    @staticmethod
    def require_any_permission(*permissions: str):
        """Verilen izinlerden herhangi birine sahip olma gereksinimi"""
        async def check(user_id: str, rbac_service: RBACService):
            has_perm = await rbac_service.has_any_permission(user_id, list(permissions))
            if not has_perm:
                from fastapi import HTTPException
                raise HTTPException(
                    status_code=403,
                    detail=f"Bu işlem için şu izinlerden biri gereklidir: {', '.join(permissions)}"
                )
            return True
        return check
    
    @staticmethod
    def require_all_permissions(*permissions: str):
        """Verilen tüm izinlere sahip olma gereksinimi"""
        async def check(user_id: str, rbac_service: RBACService):
            has_all = await rbac_service.has_all_permissions(user_id, list(permissions))
            if not has_all:
                from fastapi import HTTPException
                raise HTTPException(
                    status_code=403,
                    detail=f"Bu işlem için şu izinlerin hepsi gereklidir: {', '.join(permissions)}"
                )
            return True
        return check
