"""
DÖF/CAPA API - Tam Implementasyon
Ekip yönetimi, aksiyon takibi, dosya yükleme, workflow
"""
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form, Query
from fastapi.responses import FileResponse
from motor.motor_asyncio import AsyncIOMotorDatabase
from typing import List, Optional
from datetime import datetime, timezone
from pathlib import Path
import uuid
import aiofiles
import os

from models.dof_complete import (
    DofCreate, DofUpdate, DofOut, DofStatus, DofFilter, DofStats,
    ActionCreate, ActionUpdate, ActionStatusUpdate, ActionVerification,
    Action, TeamMemberAdd, TeamUpdate, TeamRole,
    InitialInvestigation, RootCauseCreate, FinalReport,
    DofStatusChange, FileAttachment
)
from services.dof_service_complete import DofService
from api.v1.deps import get_db, get_current_user, require_permission
from core.config import settings, is_allowed_file, get_file_size_mb


router = APIRouter(prefix="/dof", tags=["DÖF/CAPA"])

# Upload dizini
UPLOAD_DIR = Path(settings.UPLOAD_DIR)
UPLOAD_DIR.mkdir(exist_ok=True)


# ============================================================================
# DÖF ANA İŞLEMLERİ
# ============================================================================

@router.post("/", response_model=DofOut, status_code=status.HTTP_201_CREATED)
async def create_dof(
    dof_data: DofCreate,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
    _=Depends(require_permission("capa.create"))
):
    """
    Yeni DÖF oluştur
    Gerekli izin: capa.create
    """
    service = DofService(db)
    
    # Otomatik DÖF numarası oluştur
    dof_no = await service.generate_dof_no()
    
    now = datetime.now(timezone.utc)
    dof_id = str(uuid.uuid4())
    
    dof_doc = {
        "id": dof_id,
        "dof_no": dof_no,
        **dof_data.dict(),
        "status": DofStatus.DRAFT,
        "team_leader_id": None,
        "team_leader_name": None,
        "team_members": [],
        "root_cause_analysis": None,
        "initial_investigation": None,
        "investigation_date": None,
        "investigated_by": None,
        "immediate_actions": None,
        "final_report": None,
        "final_report_date": None,
        "closed_by": None,
        "closed_at": None,
        "attachments": [],
        "target_date": None,
        "created_by": current_user["id"],
        "created_at": now,
        "updated_at": now,
        "status_history": [{
            "from_status": None,
            "to_status": DofStatus.DRAFT,
            "changed_by": current_user["id"],
            "changed_at": now,
            "notes": "DÖF oluşturuldu"
        }]
    }
    
    await db.capas.insert_one(dof_doc)
    
    # Departman bilgisini ekle
    department_name = None
    if dof_data.department_id:
        dept = await db.departments.find_one({"id": dof_data.department_id})
        if dept:
            department_name = dept["name"]
    
    # Kullanıcı bilgisini ekle
    creator = await db.users.find_one({"id": current_user["id"]})
    
    return DofOut(
        **dof_doc,
        department_name=department_name,
        created_by_name=creator["full_name"] if creator else None,
        actions=[],
        actions_completed=0,
        actions_total=0
    )


@router.get("/", response_model=List[DofOut])
async def list_dofs(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    status: Optional[List[DofStatus]] = Query(None),
    priority: Optional[str] = None,
    department_id: Optional[str] = None,
    search: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
    _=Depends(require_permission("capa.read"))
):
    """
    DÖF'leri listele
    Gerekli izin: capa.read
    """
    query = {}
    
    if status:
        query["status"] = {"$in": status}
    
    if priority:
        query["priority"] = priority
    
    if department_id:
        query["department_id"] = department_id
    
    if search:
        query["$or"] = [
            {"dof_no": {"$regex": search, "$options": "i"}},
            {"title": {"$regex": search, "$options": "i"}},
            {"nonconformity_description": {"$regex": search, "$options": "i"}}
        ]
    
    dofs = await db.capas.find(query).sort("created_at", -1).skip(skip).limit(limit).to_list(length=limit)
    
    # Her DÖF için ek bilgileri ekle
    service = DofService(db)
    result = []
    
    for dof in dofs:
        # Departman
        department_name = None
        if dof.get("department_id"):
            dept = await db.departments.find_one({"id": dof["department_id"]})
            if dept:
                department_name = dept["name"]
        
        # Oluşturan
        creator = await db.users.find_one({"id": dof["created_by"]})
        creator_name = creator["full_name"] if creator else None
        
        # Aksiyonlar
        actions_completed, actions_total = await service.get_action_stats(dof["id"])
        
        # Dosyalar
        attachments = await service.get_dof_attachments(dof["id"])
        
        result.append(DofOut(
            **dof,
            department_name=department_name,
            created_by_name=creator_name,
            actions=[],  # Liste view'de aksiyonları dahil etmiyoruz
            actions_completed=actions_completed,
            actions_total=actions_total,
            attachments=attachments
        ))
    
    return result


@router.get("/{dof_id}", response_model=DofOut)
async def get_dof(
    dof_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
    _=Depends(require_permission("capa.read"))
):
    """
    DÖF detaylarını getir
    Gerekli izin: capa.read
    """
    dof = await db.capas.find_one({"id": dof_id})
    if not dof:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="DÖF bulunamadı"
        )
    
    service = DofService(db)
    
    # Departman
    department_name = None
    if dof.get("department_id"):
        dept = await db.departments.find_one({"id": dof["department_id"]})
        if dept:
            department_name = dept["name"]
    
    # Oluşturan
    creator = await db.users.find_one({"id": dof["created_by"]})
    creator_name = creator["full_name"] if creator else None
    
    # Aksiyonlar
    actions = await service.get_dof_actions(dof_id)
    actions_completed, actions_total = await service.get_action_stats(dof_id)
    
    # Dosyalar
    attachments = await service.get_dof_attachments(dof_id)
    
    return DofOut(
        **dof,
        department_name=department_name,
        created_by_name=creator_name,
        actions=actions,
        actions_completed=actions_completed,
        actions_total=actions_total,
        attachments=attachments
    )


@router.patch("/{dof_id}", response_model=DofOut)
async def update_dof(
    dof_id: str,
    dof_update: DofUpdate,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
    _=Depends(require_permission("capa.edit"))
):
    """
    DÖF güncelle
    Gerekli izin: capa.edit
    """
    dof = await db.capas.find_one({"id": dof_id})
    if not dof:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="DÖF bulunamadı"
        )
    
    update_data = dof_update.dict(exclude_unset=True)
    update_data["updated_at"] = datetime.now(timezone.utc)
    
    await db.capas.update_one(
        {"id": dof_id},
        {"$set": update_data}
    )
    
    # Güncellenmiş DÖF'ü getir
    return await get_dof(dof_id, current_user, db)


@router.delete("/{dof_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_dof(
    dof_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
    _=Depends(require_permission("capa.delete"))
):
    """
    DÖF sil (soft delete - iptal edildi olarak işaretle)
    Gerekli izin: capa.delete
    """
    dof = await db.capas.find_one({"id": dof_id})
    if not dof:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="DÖF bulunamadı"
        )
    
    service = DofService(db)
    await service.change_status(dof_id, DofStatus.CANCELLED, current_user["id"], "DÖF iptal edildi")


# ============================================================================
# EKİP YÖNETİMİ
# ============================================================================

@router.post("/{dof_id}/team/members", status_code=status.HTTP_201_CREATED)
async def add_team_member(
    dof_id: str,
    member_data: TeamMemberAdd,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
    _=Depends(require_permission("capa.assign"))
):
    """
    Ekibe üye ekle
    Gerekli izin: capa.assign
    """
    dof = await db.capas.find_one({"id": dof_id})
    if not dof:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="DÖF bulunamadı"
        )
    
    service = DofService(db)
    
    try:
        member = await service.add_team_member(
            dof_id,
            member_data.user_id,
            member_data.role,
            current_user["id"]
        )
        return member
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.delete("/{dof_id}/team/members/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_team_member(
    dof_id: str,
    user_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
    _=Depends(require_permission("capa.assign"))
):
    """
    Ekipten üye çıkar
    Gerekli izin: capa.assign
    """
    service = DofService(db)
    success = await service.remove_team_member(dof_id, user_id)
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Üye bulunamadı"
        )


@router.patch("/{dof_id}/team/leader")
async def set_team_leader(
    dof_id: str,
    leader_id: str = Query(..., description="Yeni ekip lideri user ID"),
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
    _=Depends(require_permission("capa.assign"))
):
    """
    Ekip liderini değiştir
    Gerekli izin: capa.assign
    """
    service = DofService(db)
    
    # Önce lideri üye olarak ekle (varsa güncelle)
    await service.add_team_member(dof_id, leader_id, TeamRole.LEADER, current_user["id"])
    
    return {"message": "Ekip lideri atandı"}


# ============================================================================
# AKSİYON YÖNETİMİ
# ============================================================================

@router.post("/{dof_id}/actions", response_model=Action, status_code=status.HTTP_201_CREATED)
async def create_action(
    dof_id: str,
    action_data: ActionCreate,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
    _=Depends(require_permission("capa.assign"))
):
    """
    Yeni aksiyon oluştur
    Gerekli izin: capa.assign
    """
    service = DofService(db)
    
    try:
        action = await service.create_action(
            dof_id=dof_id,
            action_type=action_data.action_type,
            title=action_data.title,
            description=action_data.description,
            assigned_to=action_data.assigned_to,
            due_date=action_data.due_date,
            priority=action_data.priority,
            created_by=current_user["id"]
        )
        return action
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.get("/{dof_id}/actions", response_model=List[Action])
async def list_dof_actions(
    dof_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
    _=Depends(require_permission("capa.read"))
):
    """
    DÖF'ün aksiyonlarını listele
    Gerekli izin: capa.read
    """
    service = DofService(db)
    actions = await service.get_dof_actions(dof_id)
    return actions


@router.patch("/actions/{action_id}", response_model=Action)
async def update_action(
    action_id: str,
    action_update: ActionUpdate,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
    _=Depends(require_permission("capa.edit"))
):
    """
    Aksiyonu güncelle
    Gerekli izin: capa.edit
    """
    action = await db.capa_actions.find_one({"id": action_id})
    if not action:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Aksiyon bulunamadı"
        )
    
    update_data = action_update.dict(exclude_unset=True)
    update_data["updated_at"] = datetime.now(timezone.utc)
    
    await db.capa_actions.update_one(
        {"id": action_id},
        {"$set": update_data}
    )
    
    updated_action = await db.capa_actions.find_one({"id": action_id})
    return Action(**updated_action)


@router.patch("/actions/{action_id}/status")
async def update_action_status(
    action_id: str,
    status_update: ActionStatusUpdate,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
    _=Depends(require_permission("capa.edit"))
):
    """
    Aksiyon durumunu güncelle
    Gerekli izin: capa.edit
    """
    service = DofService(db)
    success = await service.update_action_status(
        action_id,
        status_update.status,
        status_update.notes,
        status_update.progress_percentage
    )
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Aksiyon bulunamadı"
        )
    
    return {"message": "Aksiyon durumu güncellendi"}


@router.post("/actions/{action_id}/verify")
async def verify_action(
    action_id: str,
    verification_data: ActionVerification,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
    _=Depends(require_permission("capa.close"))
):
    """
    Aksiyonu doğrula
    Gerekli izin: capa.close
    """
    service = DofService(db)
    success = await service.verify_action(
        action_id,
        current_user["id"],
        verification_data.is_approved,
        verification_data.verification_notes
    )
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Aksiyon bulunamadı"
        )
    
    return {"message": "Aksiyon doğrulandı" if verification_data.is_approved else "Aksiyon reddedildi"}


# ============================================================================
# WORKFLOW
# ============================================================================

@router.post("/{dof_id}/investigation")
async def submit_initial_investigation(
    dof_id: str,
    investigation_data: InitialInvestigation,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
    _=Depends(require_permission("capa.edit"))
):
    """
    İlk araştırma raporunu gönder
    Gerekli izin: capa.edit
    """
    now = datetime.now(timezone.utc)
    
    await db.capas.update_one(
        {"id": dof_id},
        {
            "$set": {
                "initial_investigation": investigation_data.investigation_report,
                "investigation_date": now,
                "investigated_by": current_user["id"],
                "immediate_actions": investigation_data.immediate_actions,
                "status": DofStatus.ROOT_CAUSE_ANALYSIS,
                "updated_at": now
            }
        }
    )
    
    # Durum geçmişine ekle
    service = DofService(db)
    await service.change_status(
        dof_id,
        DofStatus.ROOT_CAUSE_ANALYSIS,
        current_user["id"],
        "İlk araştırma tamamlandı"
    )
    
    return {"message": "İlk araştırma raporu kaydedildi"}


@router.post("/{dof_id}/root-cause")
async def submit_root_cause_analysis(
    dof_id: str,
    rca_data: RootCauseCreate,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
    _=Depends(require_permission("capa.edit"))
):
    """
    Kök neden analizi gönder
    Gerekli izin: capa.edit
    """
    from models.dof_complete import RootCauseAnalysis
    
    now = datetime.now(timezone.utc)
    
    rca = RootCauseAnalysis(
        **rca_data.dict(),
        analysis_date=now,
        analyzed_by=current_user["id"],
        attachments=[]
    )
    
    await db.capas.update_one(
        {"id": dof_id},
        {
            "$set": {
                "root_cause_analysis": rca.dict(),
                "status": DofStatus.ACTION_PLANNING,
                "updated_at": now
            }
        }
    )
    
    # Durum geçmişine ekle
    service = DofService(db)
    await service.change_status(
        dof_id,
        DofStatus.ACTION_PLANNING,
        current_user["id"],
        "Kök neden analizi tamamlandı"
    )
    
    return {"message": "Kök neden analizi kaydedildi"}


@router.post("/{dof_id}/close")
async def close_dof(
    dof_id: str,
    final_report_data: FinalReport,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
    _=Depends(require_permission("capa.close"))
):
    """
    DÖF'ü kapat
    Gerekli izin: capa.close
    """
    service = DofService(db)
    
    try:
        success = await service.close_dof(
            dof_id,
            current_user["id"],
            final_report_data.final_report
        )
        
        if success:
            return {"message": "DÖF başarıyla kapatıldı"}
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="DÖF kapatılamadı"
            )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.patch("/{dof_id}/status")
async def change_dof_status(
    dof_id: str,
    status_change: DofStatusChange,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
    _=Depends(require_permission("capa.edit"))
):
    """
    DÖF durumunu değiştir
    Gerekli izin: capa.edit
    """
    service = DofService(db)
    
    try:
        success = await service.change_status(
            dof_id,
            status_change.new_status,
            current_user["id"],
            status_change.notes
        )
        
        if success:
            return {"message": f"DÖF durumu {status_change.new_status} olarak güncellendi"}
        else:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="DÖF bulunamadı"
            )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


# ============================================================================
# DOSYA YÖNETİMİ
# ============================================================================

@router.post("/{dof_id}/attachments", response_model=FileAttachment)
async def upload_dof_attachment(
    dof_id: str,
    file: UploadFile = File(...),
    description: Optional[str] = Form(None),
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
    _=Depends(require_permission("capa.edit"))
):
    """
    DÖF'e dosya ekle
    Gerekli izin: capa.edit
    """
    # Dosya kontrolü
    if not is_allowed_file(file.filename):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"İzin verilmeyen dosya tipi. İzin verilen: {settings.ALLOWED_EXTENSIONS}"
        )
    
    # Dosya boyutu kontrolü
    contents = await file.read()
    file_size = len(contents)
    
    if file_size > settings.MAX_UPLOAD_SIZE:
        max_size_mb = get_file_size_mb(settings.MAX_UPLOAD_SIZE)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Dosya çok büyük. Maksimum: {max_size_mb:.2f} MB"
        )
    
    # Dosyayı kaydet
    file_id = str(uuid.uuid4())
    file_ext = Path(file.filename).suffix
    filename = f"{file_id}{file_ext}"
    file_path = UPLOAD_DIR / filename
    
    async with aiofiles.open(file_path, 'wb') as f:
        await f.write(contents)
    
    # Veritabanına kaydet
    service = DofService(db)
    attachment = await service.add_attachment(
        dof_id=dof_id,
        file_id=file_id,
        filename=filename,
        original_filename=file.filename,
        mime_type=file.content_type or "application/octet-stream",
        size=file_size,
        file_path=str(file_path),
        uploaded_by=current_user["id"],
        description=description
    )
    
    return attachment


@router.get("/{dof_id}/attachments", response_model=List[FileAttachment])
async def list_dof_attachments(
    dof_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
    _=Depends(require_permission("capa.read"))
):
    """
    DÖF dosyalarını listele
    Gerekli izin: capa.read
    """
    service = DofService(db)
    attachments = await service.get_dof_attachments(dof_id)
    return attachments


@router.get("/files/{file_id}/download")
async def download_file(
    file_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
    _=Depends(require_permission("capa.read"))
):
    """
    Dosyayı indir
    Gerekli izin: capa.read
    """
    file_doc = await db.files.find_one({"id": file_id})
    if not file_doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dosya bulunamadı"
        )
    
    file_path = Path(file_doc["file_path"])
    if not file_path.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dosya sistemde bulunamadı"
        )
    
    return FileResponse(
        path=file_path,
        filename=file_doc["original_filename"],
        media_type=file_doc["mime_type"]
    )


# ============================================================================
# İSTATİSTİKLER VE RAPORLAMA
# ============================================================================

@router.get("/stats/overview", response_model=DofStats)
async def get_dof_stats(
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
    _=Depends(require_permission("capa.read"))
):
    """
    DÖF istatistikleri
    Gerekli izin: capa.read
    """
    total = await db.capas.count_documents({})
    
    # Durumlara göre
    by_status = {}
    for status_val in DofStatus:
        count = await db.capas.count_documents({"status": status_val})
        by_status[status_val] = count
    
    # Kaynaklara göre
    by_source = {}
    for source_val in DofSource:
        count = await db.capas.count_documents({"source": source_val})
        if count > 0:
            by_source[source_val] = count
    
    # Önceliklere göre
    by_priority = {}
    for priority_val in ["critical", "high", "medium", "low"]:
        count = await db.capas.count_documents({"priority": priority_val})
        by_priority[priority_val] = count
    
    # Süresi geçmiş
    service = DofService(db)
    overdue_dofs = await service.get_overdue_dofs()
    overdue = len(overdue_dofs)
    
    # Bu ay kapananlar
    from datetime import datetime, timezone
    start_of_month = datetime.now(timezone.utc).replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    completed_this_month = await db.capas.count_documents({
        "status": DofStatus.CLOSED,
        "closed_at": {"$gte": start_of_month}
    })
    
    return DofStats(
        total=total,
        by_status=by_status,
        by_source=by_source,
        by_priority=by_priority,
        overdue=overdue,
        completed_this_month=completed_this_month
    )


@router.get("/my/pending-actions", response_model=List[Action])
async def get_my_pending_actions(
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db)
):
    """
    Kullanıcının bekleyen aksiyonları
    """
    service = DofService(db)
    actions = await service.get_user_pending_actions(current_user["id"])
    return actions


@router.get("/overdue", response_model=List[DofOut])
async def get_overdue_dofs(
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
    _=Depends(require_permission("capa.read"))
):
    """
    Süresi geçmiş DÖF'ler
    Gerekli izin: capa.read
    """
    service = DofService(db)
    overdue_dofs = await service.get_overdue_dofs()
    
    result = []
    for dof in overdue_dofs:
        # Ek bilgileri ekle (basitleştirilmiş)
        result.append(DofOut(
            **dof,
            actions=[],
            actions_completed=0,
            actions_total=0
        ))
    
    return result
