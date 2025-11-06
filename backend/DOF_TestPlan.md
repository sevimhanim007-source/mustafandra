# DÖF Servisleri Test Planı

Bu plan, DÖF uç noktalarının JWT akışıyla Postman / Insomnia üzerinde doğrulanması için önerilen senaryoları içerir.

## Ön Koşullar

- API temel URL: `http://localhost:8001/api` (gereksinime göre uyarlayın)
- Geçerli bir kullanıcı JWT token'ı ( `/api/auth/login` veya mevcut oturum sürecini kullanın ); `.env` dosyasında `DISABLE_AUTH=true` ise bu adıma gerek yoktur ve istekler "Guest User" kimliğiyle çalışır.
- Postman veya Insomnia istemcisinde aşağıdaki global değişkenleri tanımlayın:
  - `baseUrl` = `http://localhost:8001/api`
  - `token` = `Bearer <JWT_TOKEN>`

## Ortak Header

Tüm isteklerde `Authorization: {{token}}` ve `Content-Type: application/json` değerlerini gönderin.

## Senaryolar

| # | Senaryo | İstek | Beklenen Sonuç |
|---|---------|-------|----------------|
| 1 | Departman listesi | `GET {{baseUrl}}/dof-tasks/departments` | 200, departman dizisi |
| 2 | DÖF oluşturma | `POST {{baseUrl}}/dof-tasks` | 201, yeni kayıt JSON'u |
| 3 | Listeleme | `GET {{baseUrl}}/dof-tasks?department=Kalite&status=open` | 200, filtreli liste |
| 4 | Detay | `GET {{baseUrl}}/dof-tasks/{id}` | 200, tek kayıt + `status_history` |
| 5 | Güncelleme | `PUT {{baseUrl}}/dof-tasks/{id}` | 200, güncel kayıt |
| 6 | Durum değişikliği | `PATCH {{baseUrl}}/dof-tasks/{id}/status` | 200, yeni durum geçmişi eklenecek |
| 7 | Özet rapor | `GET {{baseUrl}}/dof-tasks/report/summary` | 200, `status_counts`, `overdue`, `monthly_trends` |

## JWT Yenileme

30 dakikadan uzun testlerde token'ın zaman aşımına uğraması muhtemeldir. Süre bitiminde tekrar giriş yaparak yeni bir token üretin ve ortam değişkenini güncelleyin.

## Örnek Postman Koleksiyonu

1. Yeni bir koleksiyon oluşturun, adını `DÖF Servisleri` yapın.
2. Koleksiyona bir `Authorization` preset ekleyerek `Type: Bearer Token` seçin ve token değerini girin.
3. Yukarıdaki senaryoları sırayla ekleyin ve `Tests` sekmesine aşağıdaki gibi basit doğrulamaları koyun:

```javascript
pm.test("Yanıt başarılı", function () {
  pm.response.to.have.status(200);
});
```

## Veri Temizliği

Her test döngüsünde yeni veri oluşturulduğundan, gereksiz kayıtları ayıklamak için MongoDB üzerinde aşağıdaki sorgular kullanılabilir:

```javascript
db.dof_tasks.find().sort({ created_at: -1 }).limit(5)
db.dof_tasks.deleteOne({ id: "<TEST_KAYDI_ID>" })
```

Not: Üretim ortamında kayıt silme yetkisi açılmadığı için yalnızca test verisi üzerinde komut çalıştırın.

## Otomasyon Önerisi

CI/CD hattına basit bir Newman (Postman CLI) komutu eklenerek uç noktalar pipeline sırasında da doğrulanabilir:

```bash
newman run dof-collection.json --env-var baseUrl=http://localhost:8001/api --env-var token="Bearer <JWT>"
```

Pipeline'da sırayla DÖF oluşturma, durum değiştirme ve rapor çekme adımlarını çalıştırarak regresyon riskini azaltabilirsiniz.
