"""
File Management Service
Versiyonlama, thumbnail, virus scanning, storage management
"""
from typing import List, Optional, Tuple, BinaryIO
from motor.motor_asyncio import AsyncIOMotorDatabase
from datetime import datetime, timezone, timedelta
from pathlib import Path
import uuid
import hashlib
import aiofiles
import shutil
from PIL import Image
import io
import subprocess
import asyncio

from models.file_management import (
    FileStatus, FileCategory, StorageTier, ScanStatus,
    FileOut, FileVersion, Thumbnail, VirusScan, FileMetadata,
    FileAccessLog, StorageQuota, StoragePolicy, StorageReport,
    calculate_file_hash, get_file_category, get_storage_tier_by_access,
    THUMBNAIL_SIZES
)


class FileManagementService:
    """Dosya yönetim servisi"""
    
    def __init__(self, db: AsyncIOMotorDatabase, upload_dir: Path):
        self.db = db
        self.upload_dir = Path(upload_dir)
        self.upload_dir.mkdir(exist_ok=True)
        
        # Alt dizinler
        self.versions_dir = self.upload_dir / "versions"
        self.thumbnails_dir = self.upload_dir / "thumbnails"
        self.quarantine_dir = self.upload_dir / "quarantine"
        
        for dir_path in [self.versions_dir, self.thumbnails_dir, self.quarantine_dir]:
            dir_path.mkdir(exist_ok=True)
    
    # ========================================================================
    # DOSYA YÜKLEME
    # ========================================================================
    
    async def upload_file(
        self,
        file_content: bytes,
        original_filename: str,
        mime_type: str,
        module: str,
        ref_id: str,
        uploaded_by: str,
        description: Optional[str] = None,
        tags: Optional[List[str]] = None,
        enable_versioning: bool = True,
        generate_thumbnail: bool = True,
        scan_virus: bool = True
    ) -> FileOut:
        """
        Dosya yükle (tüm özellikler dahil)
        """
        # Hash hesapla
        hash_md5 = calculate_file_hash(file_content, "md5")
        hash_sha256 = calculate_file_hash(file_content, "sha256")
        
        # Duplicate kontrolü
        existing = await self.db.files.find_one({
            "hash_sha256": hash_sha256,
            "module": module,
            "ref_id": ref_id,
            "status": {"$ne": FileStatus.DELETED}
        })
        
        if existing:
            # Aynı dosya zaten var
            return FileOut(**existing)
        
        file_id = str(uuid.uuid4())
        file_ext = Path(original_filename).suffix
        filename = f"{file_id}{file_ext}"
        
        # Kategori belirle
        category = get_file_category(mime_type)
        
        # Dosyayı kaydet
        file_path = self.upload_dir / filename
        async with aiofiles.open(file_path, 'wb') as f:
            await f.write(file_content)
        
        now = datetime.now(timezone.utc)
        
        # Dosya kaydı oluştur
        file_doc = {
            "id": file_id,
            "filename": filename,
            "original_filename": original_filename,
            "mime_type": mime_type,
            "size": len(file_content),
            "category": category,
            "description": description,
            "tags": tags or [],
            "module": module,
            "ref_id": ref_id,
            "file_path": str(file_path),
            "hash_md5": hash_md5,
            "hash_sha256": hash_sha256,
            "status": FileStatus.UPLOADING,
            "storage_tier": StorageTier.HOT,
            "version": 1,
            "is_latest_version": True,
            "parent_file_id": None,
            "metadata": None,
            "virus_scan": None,
            "thumbnails": [],
            "download_count": 0,
            "view_count": 0,
            "last_accessed": None,
            "uploaded_by": uploaded_by,
            "uploaded_at": now,
            "expires_at": None,
            "is_public": False
        }
        
        await self.db.files.insert_one(file_doc)
        
        # Arka plan işlemleri başlat
        asyncio.create_task(self._process_file_background(
            file_id, file_path, file_content, category, mime_type,
            scan_virus, generate_thumbnail
        ))
        
        # Kullanıcı bilgisini ekle
        user = await self.db.users.find_one({"id": uploaded_by})
        file_doc["uploaded_by_name"] = user["full_name"] if user else None
        
        return FileOut(**file_doc)
    
    async def _process_file_background(
        self,
        file_id: str,
        file_path: Path,
        file_content: bytes,
        category: FileCategory,
        mime_type: str,
        scan_virus: bool,
        generate_thumbnail: bool
    ):
        """Arka planda dosya işleme"""
        try:
            # Durum: processing
            await self.db.files.update_one(
                {"id": file_id},
                {"$set": {"status": FileStatus.PROCESSING}}
            )
            
            # 1. Virus taraması
            if scan_virus:
                virus_scan = await self.scan_file_for_virus(file_path)
                await self.db.files.update_one(
                    {"id": file_id},
                    {"$set": {"virus_scan": virus_scan.dict()}}
                )
                
                if virus_scan.status == ScanStatus.INFECTED:
                    # Karantinaya al
                    await self.quarantine_file(file_id)
                    return
            
            # 2. Metadata çıkar
            metadata = await self.extract_metadata(file_path, category, mime_type)
            if metadata:
                await self.db.files.update_one(
                    {"id": file_id},
                    {"$set": {"metadata": metadata.dict()}}
                )
            
            # 3. Thumbnail oluştur (resimler için)
            if generate_thumbnail and category == FileCategory.IMAGE:
                thumbnails = await self.generate_thumbnails(file_id, file_path)
                await self.db.files.update_one(
                    {"id": file_id},
                    {"$set": {"thumbnails": [t.dict() for t in thumbnails]}}
                )
            
            # Durum: active
            await self.db.files.update_one(
                {"id": file_id},
                {"$set": {"status": FileStatus.ACTIVE}}
            )
            
        except Exception as e:
            print(f"File processing error: {e}")
            await self.db.files.update_one(
                {"id": file_id},
                {"$set": {"status": FileStatus.ACTIVE}}  # Yine de aktif yap
            )
    
    # ========================================================================
    # VİRUS TARAMA
    # ========================================================================
    
    async def scan_file_for_virus(self, file_path: Path) -> VirusScan:
        """
        ClamAV ile virus taraması
        """
        scan_id = str(uuid.uuid4())
        
        try:
            # ClamAV kurulu mu kontrol et
            result = subprocess.run(
                ["clamscan", "--version"],
                capture_output=True,
                text=True,
                timeout=5
            )
            
            if result.returncode != 0:
                # ClamAV kurulu değil
                return VirusScan(
                    scan_id=scan_id,
                    status=ScanStatus.SKIPPED,
                    engine="clamav",
                    scanned_at=datetime.now(timezone.utc)
                )
            
            engine_version = result.stdout.split()[1] if result.stdout else None
            
            # Dosyayı tara
            result = subprocess.run(
                ["clamscan", "--no-summary", str(file_path)],
                capture_output=True,
                text=True,
                timeout=60
            )
            
            scanned_at = datetime.now(timezone.utc)
            
            if "FOUND" in result.stdout:
                # Virus tespit edildi
                threat_lines = [line for line in result.stdout.split('\n') if 'FOUND' in line]
                threat_found = threat_lines[0].split(':')[1].strip() if threat_lines else "Unknown"
                
                return VirusScan(
                    scan_id=scan_id,
                    status=ScanStatus.INFECTED,
                    engine="clamav",
                    engine_version=engine_version,
                    scanned_at=scanned_at,
                    threat_found=threat_found
                )
            else:
                # Temiz
                return VirusScan(
                    scan_id=scan_id,
                    status=ScanStatus.CLEAN,
                    engine="clamav",
                    engine_version=engine_version,
                    scanned_at=scanned_at
                )
                
        except subprocess.TimeoutExpired:
            return VirusScan(
                scan_id=scan_id,
                status=ScanStatus.ERROR,
                engine="clamav",
                scanned_at=datetime.now(timezone.utc)
            )
        except Exception as e:
            print(f"Virus scan error: {e}")
            return VirusScan(
                scan_id=scan_id,
                status=ScanStatus.SKIPPED,
                engine="clamav",
                scanned_at=datetime.now(timezone.utc)
            )
    
    async def quarantine_file(self, file_id: str) -> bool:
        """Dosyayı karantinaya al"""
        file_doc = await self.db.files.find_one({"id": file_id})
        if not file_doc:
            return False
        
        source_path = Path(file_doc["file_path"])
        quarantine_path = self.quarantine_dir / source_path.name
        
        # Dosyayı taşı
        shutil.move(str(source_path), str(quarantine_path))
        
        # Veritabanını güncelle
        await self.db.files.update_one(
            {"id": file_id},
            {
                "$set": {
                    "status": FileStatus.QUARANTINE,
                    "file_path": str(quarantine_path),
                    "virus_scan.quarantine_path": str(quarantine_path)
                }
            }
        )
        
        return True
    
    # ========================================================================
    # THUMBNAIL OLUŞTURMA
    # ========================================================================
    
    async def generate_thumbnails(
        self,
        file_id: str,
        image_path: Path
    ) -> List[Thumbnail]:
        """
        Resim için thumbnail'ler oluştur
        """
        thumbnails = []
        
        try:
            # Resmi aç
            with Image.open(image_path) as img:
                # Her boyut için thumbnail oluştur
                for size_name, (width, height) in THUMBNAIL_SIZES.items():
                    thumbnail_id = str(uuid.uuid4())
                    thumbnail_filename = f"{file_id}_{size_name}.jpg"
                    thumbnail_path = self.thumbnails_dir / thumbnail_filename
                    
                    # Thumbnail oluştur (aspect ratio koru)
                    img_copy = img.copy()
                    img_copy.thumbnail((width, height), Image.Resampling.LANCZOS)
                    
                    # RGB'ye dönüştür (JPEG için)
                    if img_copy.mode in ('RGBA', 'LA', 'P'):
                        background = Image.new('RGB', img_copy.size, (255, 255, 255))
                        if img_copy.mode == 'P':
                            img_copy = img_copy.convert('RGBA')
                        background.paste(img_copy, mask=img_copy.split()[-1] if img_copy.mode == 'RGBA' else None)
                        img_copy = background
                    
                    # Kaydet
                    img_copy.save(thumbnail_path, 'JPEG', quality=85, optimize=True)
                    
                    # Thumbnail bilgisi
                    thumbnail = Thumbnail(
                        thumbnail_id=thumbnail_id,
                        size=size_name,
                        width=img_copy.width,
                        height=img_copy.height,
                        file_path=str(thumbnail_path),
                        file_size=thumbnail_path.stat().st_size,
                        created_at=datetime.now(timezone.utc)
                    )
                    
                    thumbnails.append(thumbnail)
        
        except Exception as e:
            print(f"Thumbnail generation error: {e}")
        
        return thumbnails
    
    # ========================================================================
    # METADATA ÇIKARMA
    # ========================================================================
    
    async def extract_metadata(
        self,
        file_path: Path,
        category: FileCategory,
        mime_type: str
    ) -> Optional[FileMetadata]:
        """Dosyadan metadata çıkar"""
        metadata = FileMetadata()
        
        try:
            if category == FileCategory.IMAGE:
                # Resim metadata
                with Image.open(file_path) as img:
                    metadata.width = img.width
                    metadata.height = img.height
                    
                    # EXIF data
                    exif = img.getexif()
                    if exif:
                        metadata.exif_data = {
                            k: str(v) for k, v in exif.items() if k in [271, 272, 306, 36867]
                        }
            
            elif category == FileCategory.DOCUMENT and mime_type == "application/pdf":
                # PDF metadata (PyPDF2 kullanılabilir)
                try:
                    import PyPDF2
                    with open(file_path, 'rb') as f:
                        pdf = PyPDF2.PdfReader(f)
                        metadata.page_count = len(pdf.pages)
                        
                        if pdf.metadata:
                            metadata.author = pdf.metadata.get('/Author')
                            metadata.title = pdf.metadata.get('/Title')
                except:
                    pass
            
            return metadata if any([
                metadata.width, metadata.height, metadata.page_count,
                metadata.author, metadata.title
            ]) else None
            
        except Exception as e:
            print(f"Metadata extraction error: {e}")
            return None
    
    # ========================================================================
    # VERSİYONLAMA
    # ========================================================================
    
    async def create_new_version(
        self,
        parent_file_id: str,
        file_content: bytes,
        uploaded_by: str,
        comment: Optional[str] = None
    ) -> FileOut:
        """Yeni dosya versiyonu oluştur"""
        
        # Parent dosyayı al
        parent = await self.db.files.find_one({"id": parent_file_id})
        if not parent:
            raise ValueError("Parent dosya bulunamadı")
        
        # En son versiyonu bul
        latest_version = await self.db.files.find_one(
            {
                "$or": [
                    {"id": parent_file_id},
                    {"parent_file_id": parent_file_id}
                ],
                "is_latest_version": True
            }
        )
        
        new_version = latest_version["version"] + 1 if latest_version else 1
        
        # Yeni dosyayı yükle
        new_file = await self.upload_file(
            file_content=file_content,
            original_filename=parent["original_filename"],
            mime_type=parent["mime_type"],
            module=parent["module"],
            ref_id=parent["ref_id"],
            uploaded_by=uploaded_by,
            description=parent.get("description"),
            tags=parent.get("tags", []),
            enable_versioning=False  # Recursive önlemek için
        )
        
        # Yeni versiyonu güncelle
        await self.db.files.update_one(
            {"id": new_file.id},
            {
                "$set": {
                    "version": new_version,
                    "parent_file_id": parent_file_id,
                    "is_latest_version": True
                }
            }
        )
        
        # Eski versiyonu güncelle
        if latest_version:
            await self.db.files.update_one(
                {"id": latest_version["id"]},
                {"$set": {"is_latest_version": False}}
            )
        
        # Version history kaydı oluştur
        version_record = {
            "version": new_version,
            "file_id": new_file.id,
            "filename": new_file.filename,
            "size": new_file.size,
            "hash_sha256": new_file.hash_sha256,
            "uploaded_by": uploaded_by,
            "uploaded_at": datetime.now(timezone.utc),
            "comment": comment,
            "is_current": True
        }
        
        await self.db.file_versions.insert_one({
            "parent_file_id": parent_file_id,
            **version_record
        })
        
        # Güncellenmiş dosyayı getir
        updated_file = await self.db.files.find_one({"id": new_file.id})
        return FileOut(**updated_file)
    
    async def get_file_versions(self, file_id: str) -> List[FileVersion]:
        """Dosyanın tüm versiyonlarını getir"""
        
        # Parent ID bul
        file_doc = await self.db.files.find_one({"id": file_id})
        if not file_doc:
            return []
        
        parent_id = file_doc.get("parent_file_id") or file_id
        
        # Tüm versiyonları getir
        versions = await self.db.files.find({
            "$or": [
                {"id": parent_id},
                {"parent_file_id": parent_id}
            ]
        }).sort("version", -1).to_list(length=100)
        
        result = []
        for v in versions:
            user = await self.db.users.find_one({"id": v["uploaded_by"]})
            
            result.append(FileVersion(
                version=v["version"],
                file_id=v["id"],
                filename=v["filename"],
                size=v["size"],
                hash_sha256=v["hash_sha256"],
                uploaded_by=v["uploaded_by"],
                uploaded_by_name=user["full_name"] if user else None,
                uploaded_at=v["uploaded_at"],
                comment=v.get("comment"),
                is_current=v.get("is_latest_version", False)
            ))
        
        return result
    
    # ========================================================================
    # STORAGE YÖNETİMİ
    # ========================================================================
    
    async def check_quota(
        self,
        user_id: Optional[str] = None,
        department_id: Optional[str] = None,
        module: Optional[str] = None,
        file_size: int = 0
    ) -> Tuple[bool, Optional[StorageQuota]]:
        """
        Kota kontrolü
        Returns: (has_space, quota_info)
        """
        # Kota bilgisini al
        query = {}
        if user_id:
            query["user_id"] = user_id
        if department_id:
            query["department_id"] = department_id
        if module:
            query["module"] = module
        
        quota_doc = await self.db.storage_quotas.find_one(query)
        
        if not quota_doc:
            # Kota tanımlı değil, izin ver
            return True, None
        
        quota = StorageQuota(**quota_doc)
        
        # Kontrol
        if quota.used_space + file_size > quota.total_quota:
            return False, quota
        
        if quota.file_count_limit and quota.current_file_count >= quota.file_count_limit:
            return False, quota
        
        return True, quota
    
    async def update_quota_usage(
        self,
        user_id: Optional[str],
        department_id: Optional[str],
        module: Optional[str],
        size_delta: int,
        file_count_delta: int = 0
    ):
        """Kota kullanımını güncelle"""
        query = {}
        if user_id:
            query["user_id"] = user_id
        if department_id:
            query["department_id"] = department_id
        if module:
            query["module"] = module
        
        await self.db.storage_quotas.update_one(
            query,
            {
                "$inc": {
                    "used_space": size_delta,
                    "current_file_count": file_count_delta
                }
            },
            upsert=True
        )
    
    async def optimize_storage(self):
        """Storage optimizasyonu (arka plan görevi)"""
        now = datetime.now(timezone.utc)
        
        # 1. Eski dosyaları arşivle
        files_to_archive = await self.db.files.find({
            "status": FileStatus.ACTIVE,
            "storage_tier": StorageTier.HOT,
            "last_accessed": {"$lt": now - timedelta(days=30)}
        }).to_list(length=1000)
        
        for file_doc in files_to_archive:
            await self.move_to_tier(file_doc["id"], StorageTier.WARM)
        
        # 2. Çok eski dosyaları cold storage'a taşı
        files_to_cold = await self.db.files.find({
            "status": FileStatus.ACTIVE,
            "storage_tier": StorageTier.WARM,
            "last_accessed": {"$lt": now - timedelta(days=90)}
        }).to_list(length=1000)
        
        for file_doc in files_to_cold:
            await self.move_to_tier(file_doc["id"], StorageTier.COLD)
    
    async def move_to_tier(self, file_id: str, new_tier: StorageTier) -> bool:
        """Dosyayı başka tier'a taşı"""
        # Şimdilik sadece metadata güncelle
        # Gerçek implementasyonda fiziksel taşıma yapılabilir
        result = await self.db.files.update_one(
            {"id": file_id},
            {"$set": {"storage_tier": new_tier}}
        )
        return result.modified_count > 0
    
    # ========================================================================
    # ERİŞİM TAKİBİ
    # ========================================================================
    
    async def log_file_access(
        self,
        file_id: str,
        accessed_by: str,
        action: str,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None
    ):
        """Dosya erişimini logla"""
        user = await self.db.users.find_one({"id": accessed_by})
        
        log_entry = FileAccessLog(
            accessed_by=accessed_by,
            accessed_by_name=user["full_name"] if user else None,
            accessed_at=datetime.now(timezone.utc),
            action=action,
            ip_address=ip_address,
            user_agent=user_agent
        )
        
        # Log kaydet
        await self.db.file_access_logs.insert_one({
            "file_id": file_id,
            **log_entry.dict()
        })
        
        # Dosya istatistiklerini güncelle
        update_data = {"last_accessed": datetime.now(timezone.utc)}
        
        if action == "download":
            update_data["$inc"] = {"download_count": 1}
        elif action == "view":
            update_data["$inc"] = {"view_count": 1}
        
        await self.db.files.update_one(
            {"id": file_id},
            {"$set" if "$inc" not in update_data else "$set": update_data, **({"$inc": update_data.pop("$inc")} if "$inc" in update_data else {})}
        )
