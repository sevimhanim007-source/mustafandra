"""
DÖF/CAPA Service - İş Mantığı
Ekip yönetimi, aksiyon takibi, workflow kontrolü
"""
from typing import List, Optional, Dict, Tuple
from motor.motor_asyncio import AsyncIOMotorDatabase
from datetime import datetime, timezone, timedelta
from bson import ObjectId
import uuid

from models.dof_complete import (
    DofStatus, DofSource, DofPriority, ActionStatus, ActionType,
    TeamRole, DofOut, Action, TeamMember, FileAttachment,
    RootCauseAnalysis
)


class DofService:
    """DÖF/CAPA iş mantığı servisi"""
    
    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db
    
    # ========================================================================
    # OTOMATIK KOD OLUŞTURMA
    # ========================================================================
    
    async def generate_dof_no(self, year: Optional[int] = None) -> str:
        """
        Otomatik DÖF numarası oluştur
        Format: DOF-YYYY-NNNN (örn: DOF-2025-0001)
        """
        if year is None:
            year = datetime.now(timezone.utc).year
        
        # Bu yıl için son numarayı bul
        last_dof = await self.db.capas.find_one(
            {"dof_no": {"$regex": f"^DOF-{year}-"}},
            sort=[("dof_no", -1)]
        )
        
        if last_dof and "dof_no" in last_dof:
            # Son numarayı parse et
            last_no = int(last_dof["dof_no"].split("-")[-1])
            new_no = last_no + 1
        else:
            new_no = 1
        
        return f"DOF-{year}-{new_no:04d}"
    
    async def generate_action_no(self, dof_no: str, action_count: int) -> str:
        """
        Otomatik aksiyon numarası oluştur
        Format: DOF-YYYY-NNNN-AA (örn: DOF-2025-0001-01)
        """
        action_no = action_count + 1
        return f"{dof_no}-{action_no:02d}"
    
    # ========================================================================
    # EKİP YÖNETİMİ
    # ========================================================================
    
    async def add_team_member(
        self,
        dof_id: str,
        user_id: str,
        role: TeamRole,
        assigned_by: str
    ) -> TeamMember:
        """Ekibe üye ekle"""
        
        # Kullanıcı bilgilerini al
        user = await self.db.users.find_one({"id": user_id})
        if not user:
            raise ValueError("Kullanıcı bulunamadı")
        
        # Departman bilgisini al
        department_name = None
        if user.get("department_id"):
            dept = await self.db.departments.find_one({"id": user["department_id"]})
            if dept:
                department_name = dept["name"]
        
        # Ekip üyesi oluştur
        member = TeamMember(
            user_id=user_id,
            username=user["username"],
            full_name=user["full_name"],
            role=role,
            department_id=user.get("department_id"),
            department_name=department_name,
            assigned_at=datetime.now(timezone.utc),
            assigned_by=assigned_by
        )
        
        # DÖF'e ekle
        await self.db.capas.update_one(
            {"id": dof_id},
            {
                "$push": {"team_members": member.dict()},
                "$set": {"updated_at": datetime.now(timezone.utc)}
            }
        )
        
        # Eğer lider ise, ayrıca team_leader_id'yi güncelle
        if role == TeamRole.LEADER:
            await self.db.capas.update_one(
                {"id": dof_id},
                {
                    "$set": {
                        "team_leader_id": user_id,
                        "team_leader_name": user["full_name"]
                    }
                }
            )
        
        return member
    
    async def remove_team_member(self, dof_id: str, user_id: str) -> bool:
        """Ekipten üye çıkar"""
        result = await self.db.capas.update_one(
            {"id": dof_id},
            {
                "$pull": {"team_members": {"user_id": user_id}},
                "$set": {"updated_at": datetime.now(timezone.utc)}
            }
        )
        
        # Eğer lider çıkarıldıysa, leader_id'yi de temizle
        dof = await self.db.capas.find_one({"id": dof_id})
        if dof and dof.get("team_leader_id") == user_id:
            await self.db.capas.update_one(
                {"id": dof_id},
                {
                    "$set": {
                        "team_leader_id": None,
                        "team_leader_name": None
                    }
                }
            )
        
        return result.modified_count > 0
    
    async def update_team_member_role(
        self,
        dof_id: str,
        user_id: str,
        new_role: TeamRole
    ) -> bool:
        """Ekip üyesinin rolünü güncelle"""
        result = await self.db.capas.update_one(
            {
                "id": dof_id,
                "team_members.user_id": user_id
            },
            {
                "$set": {
                    "team_members.$.role": new_role,
                    "updated_at": datetime.now(timezone.utc)
                }
            }
        )
        
        return result.modified_count > 0
    
    # ========================================================================
    # AKSİYON YÖNETİMİ
    # ========================================================================
    
    async def create_action(
        self,
        dof_id: str,
        action_type: ActionType,
        title: str,
        description: str,
        assigned_to: str,
        due_date: datetime,
        priority: DofPriority,
        created_by: str
    ) -> Action:
        """Yeni aksiyon oluştur"""
        
        # DÖF'ü bul
        dof = await self.db.capas.find_one({"id": dof_id})
        if not dof:
            raise ValueError("DÖF bulunamadı")
        
        # Atanan kullanıcıyı kontrol et
        assigned_user = await self.db.users.find_one({"id": assigned_to})
        if not assigned_user:
            raise ValueError("Atanan kullanıcı bulunamadı")
        
        # Mevcut aksiyon sayısını al
        current_actions = await self.db.capa_actions.count_documents({"capa_id": dof_id})
        
        # Aksiyon numarası oluştur
        action_no = await self.generate_action_no(dof["dof_no"], current_actions)
        
        now = datetime.now(timezone.utc)
        action_id = str(uuid.uuid4())
        
        action_doc = {
            "id": action_id,
            "capa_id": dof_id,
            "action_no": action_no,
            "action_type": action_type,
            "title": title,
            "description": description,
            "assigned_to": assigned_to,
            "assigned_to_name": assigned_user["full_name"],
            "due_date": due_date,
            "completed_date": None,
            "status": ActionStatus.PENDING,
            "priority": priority,
            "progress_percentage": 0,
            "completion_notes": None,
            "verification_notes": None,
            "verified_by": None,
            "verified_at": None,
            "attachments": [],
            "created_by": created_by,
            "created_at": now,
            "updated_at": now
        }
        
        await self.db.capa_actions.insert_one(action_doc)
        
        # DÖF'ün updated_at'ini güncelle
        await self.db.capas.update_one(
            {"id": dof_id},
            {"$set": {"updated_at": now}}
        )
        
        # Oluşturan kullanıcı bilgisini al
        creator = await self.db.users.find_one({"id": created_by})
        
        return Action(**action_doc)
    
    async def update_action_status(
        self,
        action_id: str,
        new_status: ActionStatus,
        notes: Optional[str] = None,
        progress_percentage: Optional[int] = None
    ) -> bool:
        """Aksiyon durumunu güncelle"""
        
        update_data = {
            "status": new_status,
            "updated_at": datetime.now(timezone.utc)
        }
        
        if notes:
            update_data["completion_notes"] = notes
        
        if progress_percentage is not None:
            update_data["progress_percentage"] = progress_percentage
        
        # Eğer tamamlandı ise tarihi ekle
        if new_status == ActionStatus.COMPLETED:
            update_data["completed_date"] = datetime.now(timezone.utc)
            update_data["progress_percentage"] = 100
        
        result = await self.db.capa_actions.update_one(
            {"id": action_id},
            {"$set": update_data}
        )
        
        return result.modified_count > 0
    
    async def verify_action(
        self,
        action_id: str,
        verified_by: str,
        is_approved: bool,
        verification_notes: str
    ) -> bool:
        """Aksiyonu doğrula"""
        
        new_status = ActionStatus.VERIFIED if is_approved else ActionStatus.REJECTED
        
        result = await self.db.capa_actions.update_one(
            {"id": action_id},
            {
                "$set": {
                    "status": new_status,
                    "verified_by": verified_by,
                    "verified_at": datetime.now(timezone.utc),
                    "verification_notes": verification_notes,
                    "updated_at": datetime.now(timezone.utc)
                }
            }
        )
        
        return result.modified_count > 0
    
    async def get_dof_actions(self, dof_id: str) -> List[Action]:
        """DÖF'ün tüm aksiyonlarını getir"""
        actions = await self.db.capa_actions.find(
            {"capa_id": dof_id}
        ).sort("created_at", 1).to_list(length=100)
        
        return [Action(**action) for action in actions]
    
    async def get_action_stats(self, dof_id: str) -> Tuple[int, int]:
        """
        DÖF aksiyon istatistikleri
        Returns: (completed_count, total_count)
        """
        total = await self.db.capa_actions.count_documents({"capa_id": dof_id})
        completed = await self.db.capa_actions.count_documents({
            "capa_id": dof_id,
            "status": {"$in": [ActionStatus.COMPLETED, ActionStatus.VERIFIED]}
        })
        
        return completed, total
    
    # ========================================================================
    # DOSYA YÖNETİMİ
    # ========================================================================
    
    async def add_attachment(
        self,
        dof_id: str,
        file_id: str,
        filename: str,
        original_filename: str,
        mime_type: str,
        size: int,
        file_path: str,
        uploaded_by: str,
        description: Optional[str] = None
    ) -> FileAttachment:
        """DÖF'e dosya ekle"""
        
        # Yükleyen kullanıcı bilgisini al
        user = await self.db.users.find_one({"id": uploaded_by})
        
        attachment = FileAttachment(
            id=file_id,
            filename=filename,
            original_filename=original_filename,
            mime_type=mime_type,
            size=size,
            uploaded_by=uploaded_by,
            uploaded_by_name=user["full_name"] if user else None,
            uploaded_at=datetime.now(timezone.utc),
            file_path=file_path,
            description=description
        )
        
        # Dosya kaydını veritabanına ekle
        file_doc = {
            **attachment.dict(),
            "module": "dof",
            "ref_id": dof_id
        }
        
        await self.db.files.insert_one(file_doc)
        
        # DÖF'e dosya ID'sini ekle
        await self.db.capas.update_one(
            {"id": dof_id},
            {
                "$push": {"attachments": file_id},
                "$set": {"updated_at": datetime.now(timezone.utc)}
            }
        )
        
        return attachment
    
    async def add_action_attachment(
        self,
        action_id: str,
        file_id: str,
        **file_data
    ) -> FileAttachment:
        """Aksiyona dosya ekle"""
        
        # Önce aksiyonu bul
        action = await self.db.capa_actions.find_one({"id": action_id})
        if not action:
            raise ValueError("Aksiyon bulunamadı")
        
        attachment = FileAttachment(
            id=file_id,
            **file_data,
            uploaded_at=datetime.now(timezone.utc)
        )
        
        # Dosya kaydını veritabanına ekle
        file_doc = {
            **attachment.dict(),
            "module": "dof_action",
            "ref_id": action_id
        }
        
        await self.db.files.insert_one(file_doc)
        
        # Aksiyona dosya ID'sini ekle
        await self.db.capa_actions.update_one(
            {"id": action_id},
            {
                "$push": {"attachments": file_id},
                "$set": {"updated_at": datetime.now(timezone.utc)}
            }
        )
        
        return attachment
    
    async def get_dof_attachments(self, dof_id: str) -> List[FileAttachment]:
        """DÖF'ün tüm dosyalarını getir"""
        files = await self.db.files.find(
            {"module": "dof", "ref_id": dof_id}
        ).sort("uploaded_at", -1).to_list(length=100)
        
        return [FileAttachment(**file) for file in files]
    
    # ========================================================================
    # İŞ AKIŞI (WORKFLOW)
    # ========================================================================
    
    async def change_status(
        self,
        dof_id: str,
        new_status: DofStatus,
        changed_by: str,
        notes: Optional[str] = None
    ) -> bool:
        """DÖF durumunu değiştir ve geçmişe ekle"""
        
        # Mevcut DÖF'ü al
        dof = await self.db.capas.find_one({"id": dof_id})
        if not dof:
            raise ValueError("DÖF bulunamadı")
        
        old_status = dof.get("status")
        now = datetime.now(timezone.utc)
        
        # Durum geçmişi kaydı
        history_entry = {
            "from_status": old_status,
            "to_status": new_status,
            "changed_by": changed_by,
            "changed_at": now,
            "notes": notes
        }
        
        # Güncelleme
        result = await self.db.capas.update_one(
            {"id": dof_id},
            {
                "$set": {
                    "status": new_status,
                    "updated_at": now
                },
                "$push": {"status_history": history_entry}
            }
        )
        
        return result.modified_count > 0
    
    async def can_close_dof(self, dof_id: str) -> Tuple[bool, str]:
        """
        DÖF kapatılabilir mi kontrol et
        Returns: (can_close, reason)
        """
        dof = await self.db.capas.find_one({"id": dof_id})
        if not dof:
            return False, "DÖF bulunamadı"
        
        # Kök neden analizi var mı?
        if not dof.get("root_cause_analysis"):
            return False, "Kök neden analizi tamamlanmamış"
        
        # Tüm aksiyonlar tamamlandı mı?
        actions = await self.db.capa_actions.find(
            {"capa_id": dof_id}
        ).to_list(length=1000)
        
        if not actions:
            return False, "Hiç aksiyon tanımlanmamış"
        
        for action in actions:
            if action["status"] not in [ActionStatus.COMPLETED, ActionStatus.VERIFIED]:
                return False, f"Aksiyon {action['action_no']} henüz tamamlanmadı"
        
        # Nihai rapor var mı?
        if not dof.get("final_report"):
            return False, "Nihai rapor girilmemiş"
        
        return True, "DÖF kapatılabilir"
    
    async def close_dof(
        self,
        dof_id: str,
        closed_by: str,
        final_report: str
    ) -> bool:
        """DÖF'ü kapat"""
        
        # Kapatılabilir mi kontrol et
        can_close, reason = await self.can_close_dof(dof_id)
        if not can_close:
            raise ValueError(f"DÖF kapatılamaz: {reason}")
        
        now = datetime.now(timezone.utc)
        
        result = await self.db.capas.update_one(
            {"id": dof_id},
            {
                "$set": {
                    "status": DofStatus.CLOSED,
                    "final_report": final_report,
                    "final_report_date": now,
                    "closed_by": closed_by,
                    "closed_at": now,
                    "updated_at": now
                }
            }
        )
        
        # Durum geçmişine ekle
        await self.change_status(dof_id, DofStatus.CLOSED, closed_by, "DÖF kapatıldı")
        
        return result.modified_count > 0
    
    # ========================================================================
    # İSTATİSTİKLER VE RAPORLAMA
    # ========================================================================
    
    async def get_overdue_dofs(self) -> List[dict]:
        """Süresi geçmiş DÖF'leri getir"""
        now = datetime.now(timezone.utc)
        
        dofs = await self.db.capas.find({
            "status": {"$nin": [DofStatus.CLOSED, DofStatus.CANCELLED]},
            "target_date": {"$lt": now}
        }).to_list(length=1000)
        
        return dofs
    
    async def get_overdue_actions(self) -> List[dict]:
        """Süresi geçmiş aksiyonları getir"""
        now = datetime.now(timezone.utc)
        
        actions = await self.db.capa_actions.find({
            "status": {"$nin": [ActionStatus.COMPLETED, ActionStatus.VERIFIED, ActionStatus.CANCELLED]},
            "due_date": {"$lt": now}
        }).to_list(length=1000)
        
        return actions
    
    async def get_user_pending_actions(self, user_id: str) -> List[Action]:
        """Kullanıcının bekleyen aksiyonlarını getir"""
        actions = await self.db.capa_actions.find({
            "assigned_to": user_id,
            "status": {"$in": [ActionStatus.PENDING, ActionStatus.IN_PROGRESS]}
        }).sort("due_date", 1).to_list(length=100)
        
        return [Action(**action) for action in actions]
