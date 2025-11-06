# DÖF (Düzeltici Önleyici Faaliyet) Servisleri

Bu dosya, `server.py` içerisine eklenen DÖF servislerinin hızlı bir özetini sunar.

## Kullanılan Kaynak Adı

Tüm istekler `/api/dof-tasks` yolu altında toplanır ve JWT Bearer kimlik doğrulaması ister.

> Not: `.env` dosyasında `DISABLE_AUTH=true` tanımlanırsa kimlik doğrulaması devre dışı kalır ve servisler "Guest User" hesabı ile çalışır. Bu mod yalnızca geliştirme ortamında kullanılmalıdır.

## Uç Noktalar

| Metot | Yol | Açıklama |
| --- | --- | --- |
| `GET` | `/api/dof-tasks` | Filtrelenebilir DÖF listesini (sayfalı) döner. |
| `POST` | `/api/dof-tasks` | Yeni DÖF kaydı oluşturur. |
| `GET` | `/api/dof-tasks/{id}` | Tekil DÖF kaydını getirir. |
| `PUT` | `/api/dof-tasks/{id}` | Başlık, açıklama, departman, sorumlu veya hedef tarihi günceller. |
| `PATCH` | `/api/dof-tasks/{id}/status` | Durum günceller; geçmişe not düşer. |
| `GET` | `/api/dof-tasks/report/summary` | Durum/departman dağılımı ve istatistikleri döner. |
| `GET` | `/api/dof-tasks/departments` | Kullanılabilir departman listesini döner. |

## DÖF Durumları

```
open
in_progress
closed
cancelled
```

## Örnek İstekler

### DÖF Oluşturma

```http
POST /api/dof-tasks
Authorization: Bearer <JWT>
Content-Type: application/json

{
  "title": "Kalite kontrol raporu incelenecek",
  "description": "Üretim hattı X için rapor bulguları değerlendirilecek.",
  "department": "Kalite",
  "responsible_person": "Ali Veli",
  "due_date": "2025-09-30T00:00:00Z"
}
```

### Listeleme (filtreli)

```http
GET /api/dof-tasks?department=Kalite&status=open&search=rapor
Authorization: Bearer <JWT>
```

### Durum Güncelleme

```http
PATCH /api/dof-tasks/7b52.../status
Authorization: Bearer <JWT>
Content-Type: application/json

{
  "status": "closed",
  "note": "İlgili aksiyon tamamlandı."
}
```

## Rapor Sonuçları

`GET /api/dof-tasks/report/summary` yanıtı:

```json
{
  "total": 12,
  "status_counts": { "open": 5, "in_progress": 4, "closed": 2, "cancelled": 1 },
  "department_counts": [
    { "_id": "Kalite", "count": 6 },
    { "_id": "Üretim", "count": 4 }
  ],
  "overdue": 3,
  "upcoming_deadlines": [
    {
      "id": "7b52...",
      "dof_no": "DOF-2025-0003",
      "title": "Hammadde kontrolü",
      "due_date": "2025-09-12T00:00:00Z",
      "department": "Depo",
      "responsible_person": "Ayşe"
    }
  ],
  "monthly_trends": [
    { "label": "2025-08", "count": 5 },
    { "label": "2025-09", "count": 7 }
  ]
}
```

## Test Önerisi

```bash
python -m py_compile server.py
```

Üretim ortamında `pytest` veya API testi yapan araçlarla (Postman, Hoppscotch) uç noktalar doğrulanmalıdır.
