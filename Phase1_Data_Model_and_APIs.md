---
title: Faz 1 Veri Modeli ve API Tasar?m?
version: 0.1.0
date: 2025-10-14
---

# 1. Veri Modeli (MongoDB Koleksiyonlar?)

## 1.1. Kullan?c? Y?netimi

### `departments`
```json
{
  "_id": "ObjectId",
  "code": "quality",
  "name": "Kalite",
  "description": "Kalite Y?netimi Departman?",
  "parent_id": "ObjectId|null",
  "created_at": "Date",
  "updated_at": "Date"
}
```

### `roles`
```json
{
  "_id": "ObjectId",
  "name": "DocumentManager",
  "display_name": "Dok?man Y?neticisi",
  "description": "Dok?man klas?rleri ve onay s?re?lerini y?netir",
  "permissions": [
    "doc.folder.create",
    "doc.folder.update",
    "doc.document.create",
    "doc.document.approve",
    "doc.document.cancel"
  ],
  "is_system": true,
  "created_at": "Date",
  "updated_at": "Date"
}
```

### `users`
```json
{
  "_id": "ObjectId",
  "username": "jsmith",
  "email": "jsmith@example.com",
  "password_hash": "bcrypt hash",
  "first_name": "John",
  "last_name": "Smith",
  "full_name": "John Smith",
  "status": "active|disabled|locked",
  "department_id": "ObjectId",
  "position": "Kalite Uzman?",
  "groups": ["audit-team", "quality-committee"],
  "roles": ["RoleId"],
  "attributes": {
    "location": "Istanbul",
    "grade": "G7"
  },
  "last_login_at": "Date|null",
  "created_at": "Date",
  "updated_at": "Date"
}
```

### `sessions`
```json
{
  "_id": "ObjectId",
  "user_id": "ObjectId",
  "refresh_token": "string",
  "expires_at": "Date",
  "ip_address": "string",
  "user_agent": "string",
  "created_at": "Date"
}
```

### `audit_logs`
```json
{
  "_id": "ObjectId",
  "timestamp": "Date",
  "user_id": "ObjectId|null",
  "action": "user.login",
  "resource_type": "document",
  "resource_id": "ObjectId",
  "metadata": {
    "status": "success",
    "ip": "192.168.1.10"
  }
}
```

## 1.2. Dok?man Y?netimi

### `doc_folders`
```json
{
  "_id": "ObjectId",
  "parent_id": "ObjectId|null",
  "name": "Kalite Politikalar?",
  "code_prefix": "KAL-POL",
  "department_id": "ObjectId",
  "description": "Kalite politikalar?na ait dok?manlar",
  "permissions": [
    {
      "principal_type": "role|user|group|department",
      "principal_id": "RoleId",
      "capabilities": [
        "read",
        "download",
        "create",
        "revise",
        "approve",
        "cancel"
      ]
    }
  ],
  "auto_code_pattern": "{DEPT}-{TYPE}-{SEQ:000}",
  "auto_code_seq": 118,
  "created_by": "ObjectId",
  "created_at": "Date",
  "updated_at": "Date"
}
```

### `documents`
```json
{
  "_id": "ObjectId",
  "folder_id": "ObjectId",
  "code": "KAL-POL-019",
  "title": "Kalite Politikas? 2025",
  "document_type": "Policy|SOP|Procedure",
  "department_id": "ObjectId",
  "status": "draft|review|approved|archived|cancelled",
  "current_version_id": "ObjectId",
  "distribution_list": [
    {
      "principal_type": "department|role|user",
      "principal_id": "ObjectId|string",
      "required_to_read": true
    }
  ],
  "approval_matrix": [
    {
      "stage": 1,
      "approvers": ["ObjectId"],
      "approval_type": "all|any",
      "deadline": "Date|null"
    }
  ],
  "created_by": "ObjectId",
  "created_at": "Date",
  "updated_at": "Date"
}
```

### `document_versions`
```json
{
  "_id": "ObjectId",
  "document_id": "ObjectId",
  "version": "1.2",
  "status": "draft|in_review|rejected|approved|published|archived",
  "file_id": "ObjectId (GridFS or S3 key)",
  "change_summary": "Yeni kalite hedefleri eklendi",
  "root_cause": null,
  "created_by": "ObjectId",
  "created_at": "Date",
  "published_at": "Date|null",
  "cancelled_at": "Date|null",
  "cancelled_reason": "Revizyon 2 sonras? ge?ersiz",
  "approval_history": [
    {
      "approver_id": "ObjectId",
      "decision": "approved|rejected",
      "comment": "Uygun",
      "decided_at": "Date"
    }
  ],
  "distribution_read_status": [
    {
      "recipient_id": "ObjectId",
      "read_at": "Date|null",
      "status": "unread|read|acknowledged"
    }
  ]
}
```

### `document_files` (S3 metadata)
```json
{
  "_id": "ObjectId",
  "storage_key": "documents/kal-pol-019/v1/file.pdf",
  "filename": "Kalite_Politikasi.pdf",
  "filesize": 2345678,
  "mime_type": "application/pdf",
  "checksum": "sha256...",
  "uploaded_by": "ObjectId",
  "uploaded_at": "Date"
}
```

---

# 2. API Tasar?m? (Faz 1)

## 2.1. Kimlik ve Yetkilendirme

### 2.1.1. Authentication
- `POST /auth/login`
  - Body: `{ "username": "...", "password": "..." }`
  - Response: `{ "access_token": "...", "refresh_token": "...", "expires_in": 900 }`
- `POST /auth/refresh`
  - Body: `{ "refresh_token": "..." }`
  - Response: yeni access token
- `POST /auth/logout`
  - Akif refresh token iptali

### 2.1.2. Kullan?c? Y?netimi
- `GET /users` ? filtreleme (department, role, status)
- `POST /users` ? kullan?c? olu?turma
- `PUT /users/{id}` ? g?ncelleme
- `PATCH /users/{id}/status` ? aktive/deaktive
- `POST /users/{id}/password-reset`
- `GET /roles`, `POST /roles`, `PUT /roles/{id}`
- `GET /departments`, `POST /departments`, `PUT /departments/{id}`

### 2.1.3. Yetki Kontrol?
- `POST /auth/check` ? client-side yetki do?rulamas? i?in (opsiyonel)
- `GET /auth/me` ? profil ve ba?l? izin seti

## 2.2. Dok?man Y?netimi

### 2.2.1. Klas?r ??lemleri
- `GET /folders` ? hiyerar?ik liste (tree)
- `POST /folders` ? klas?r olu?turma
  ```json
  {
    "name": "Kalite Politikalar?",
    "parent_id": "...",
    "department_id": "...",
    "auto_code_pattern": "{DEPT}-{TYPE}-{SEQ:000}",
    "permissions": [
      { "principal_type": "role", "principal_id": "DocumentManager", "capabilities": ["read","create","approve"] }
    ]
  }
  ```
- `PUT /folders/{id}` ? klas?r bilgileri g?ncelleme
- `PATCH /folders/{id}/permissions` ? yetki matrisini g?ncelleme

### 2.2.2. Dok?man ??lemleri
- `GET /documents` ? filtreleme (folder, status, type, search)
- `POST /documents`
  ```json
  {
    "folder_id": "...",
    "title": "Kalite Politikas? 2025",
    "document_type": "Policy",
    "department_id": "...",
    "distribution_list": [{ "principal_type": "department", "principal_id": "...", "required_to_read": true }],
    "approval_matrix": [
      { "stage": 1, "approvers": ["..."], "approval_type": "any" },
      { "stage": 2, "approvers": ["..."], "approval_type": "all" }
    ]
  }
  ```
- `GET /documents/{id}`
- `PATCH /documents/{id}` ? ba?l?k, tip, da??t?m listesi gibi metadata g?ncelleme
- `DELETE /documents/{id}` ? (yaln?zca draft i?in, audit log?a kay?t)

### 2.2.3. Versiyon ve Revizyon
- `POST /documents/{id}/versions` ? yeni versiyon ba?latma
- `GET /documents/{id}/versions`
- `GET /document-versions/{versionId}`
- `POST /document-versions/{versionId}/submit-review` ? onay s?reci ba?latma
- `POST /document-versions/{versionId}/approve`
  ```json
  {
    "decision": "approved|rejected",
    "comment": "Uygun",
    "signature": "optional e-imza"
  }
  ```
- `POST /document-versions/{versionId}/publish` ? onay tamamland?ktan sonra
- `POST /document-versions/{versionId}/cancel`
- `POST /document-versions/{versionId}/read` ? kullan?c? okudu?unu teyit ediyor

### 2.2.4. Dosya ??lemleri
- `POST /documents/{id}/versions/{versionId}/file` ? dosya y?kleme (multipart veya pre-signed URL)
- `GET /documents/{id}/versions/{versionId}/file` ? download/view (pre-signed URL)
- `GET /documents/{id}/versions/{versionId}/viewer` ? inline viewer (PDF.js)

### 2.2.5. Raporlama
- `GET /reports/documents/status` ? parametreler: folder, status, date range
- `GET /reports/documents/readers` ? okuma durum raporu
- Export endpoint?leri: `?format=excel|pdf`

---

# 3. ?zin Kontrol Ak???

1. API ?a?r?s? JWT ile yap?l?r.
2. Middleware:
   - Token do?rulama, kullan?c? bilgisi ? request context.
   - RBAC kontrol?: endpoint + method ? gerekli permission.
   - ABAC kontrol?: request parametreleri (?r. folder_id, document_id) ?zerinden departman/rol e?le?mesi.
   - Klas?r/dok?man spesifik yetkiler: `doc_folders.permissions` veya `documents.distribution_list`.

Pseudo kod:
```python
def authorize(principal, action, resource):
    if principal.is_system_admin:
        return True
    if not principal.has_permission(action):
        return False
    if resource.type == "document":
        return check_document_permissions(principal, resource)
    return True
```

# 4. Veri Do?rulama & Tutarl?l?k

- Kullan?c? ad?/e-posta unique index.
- Dok?man kodu unique (folder + code).
- Versiyon numaras? otomatik artan (1.0, 1.1, 2.0).
- Approval matrix stage sequence kontrol?.
- Distribution list bo? olamaz (en az bir al?c?).
- Dok?man iptal edildi?inde yeni revizyon bloklan?r.

# 5. Test Kapsam? (Faz 1 i?in)
- Auth: yanl?? ?ifre, lock mekanizmas?, token refresh expiry.
- Role-based access: farkl? rol kombinasyonlar? i?in pozitif/negatif testler.
- Klas?r yetkileri: okuma/yazma k?s?t testi.
- Dok?man i? ak???: taslaktan yay?n s?reci.
- Revizyon: eski versiyon eri?imi, audit log tutarl???.
- Okuma takibi: da??t?m listesi, rapor ??kt?s?.

# 6. A??k Noktalar (Karar Gerektiren)
- E-imza / ?slak imza gereksinimi? (HSM, e-imza entegrasyonu).
- ?oklu dil deste?i (dok?man metadata, UI).
- Bildirim kanallar? (e-posta, push, SMS?).
- Dosya boyutu limiti ve i?erik taramas? (antivir?s).
- Dok?man diff/kar??la?t?rma ara?lar? (Faz 2?de planl?).

---

Bu belge, Faz 1 kapsam?ndaki kimlik ve dok?man y?netimi mod?lleri i?in veri modeli ve API tasar?m?n? netle?tirir. Onay sonras? geli?tirme ekibi bu ?emalar? baz alarak uygulama ?al??malar?na ba?layabilir.
