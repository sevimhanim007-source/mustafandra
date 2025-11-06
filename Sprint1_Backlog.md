---
sprint: 1
goal: Kimlik Yönetimi Temelleri (Kullanıcı, Rol, Departman, Login Akışı)
duration: "2 hafta"
---

# Sprint 1 Backlog

## 1. User Stories

| ID | Story | Kabul Kriterleri |
|----|-------|------------------|
| AUTH-01 | Bir kullanıcı olarak, kullanıcı adı ve şifremle sisteme giriş yapabilmek istiyorum. | Doğru bilgilerle login → access+refresh token döner; yanlış bilgilerde 401; audit log kaydı. |
| AUTH-02 | Sistem yöneticisi olarak, yeni kullanıcı oluşturup rol ve departman atayabilmek istiyorum. | POST /users; password reset link; UI form; required alan validasyonu. |
| AUTH-03 | Sistem yöneticisi olarak, rol ve izinleri yönetebilmek istiyorum. | Role CRUD ekranı; izin listesi; save edilince RBAC tablosu güncellenir. |
| AUTH-04 | Departman yöneticisi olarak, departmanımda yer alan kullanıcıları listeleyip durumlarını değiştirebilmek istiyorum. | GET /users?department=...; kullanıcı enable/disable API; UI filtreleme. |
| AUTH-05 | Bir kullanıcı olarak, profil bilgilerimi ve bağlı olduğum roller/izinleri görebilmek istiyorum. | `/auth/me` endpoint; UI profil sayfası. |
| AUTH-06 | Sistem olarak, süresi dolmuş access token’ı refresh token ile yenilemek istiyorum. | POST /auth/refresh; refresh token revocation; scope kontrolü. |

## 2. Teknik Görevler

| ID | Görev | Açıklama | Tahmini Süre |
|----|-------|----------|--------------|
| TECH-01 | Kullanıcı koleksiyonu ve indeksler | Mongo schema, unique indexler (username/e-mail) | 1g |
| TECH-02 | Password hashing servis | bcrypt + salt config, parametre ayarı | 0.5g |
| TECH-03 | Token servisi | JWT üretimi, refresh token üretimi, blacklisting | 1g |
| TECH-04 | RBAC middleware | Permission mapping, endpoint annotation | 2g |
| TECH-05 | ABAC kontrolleri | Departman, rol ve attribute bazlı kontrol | 2g |
| TECH-06 | Audit log interceptor | login/out, kullanıcı CRUD kayıtları | 1g |
| TECH-07 | API: Users CRUD | `/users` endpointleri, DTO validasyon | 2g |
| TECH-08 | API: Roles & permissions | `/roles`, `/permissions` | 1g |
| TECH-09 | API: Departments | Hierarchical departman CRUD | 1g |
| TECH-10 | API: Auth (login/refresh/logout) | OAuth2 password flow | 2g |
| TECH-11 | API: Profil | `/auth/me` | 0.5g |
| TECH-12 | UI: Login sayfası | Form, hata mesajları | 1g |
| TECH-13 | UI: Kullanıcı yönetimi | Liste, filtre, modal for create/edit | 2g |
| TECH-14 | UI: Rol yönetimi | Role list, permission checklist | 2g |
| TECH-15 | UI: Departman ağacı | Tree view, CRUD | 2g |
| TECH-16 | UI: Profil ekranı | Roller ve izinler | 1g |
| TECH-17 | Testler (API) | Postman/Newman koleksiyonu, pytest | 1.5g |
| TECH-18 | Testler (UI) | Cypress login ve user management senaryoları | 1.5g |
| TECH-19 | Dokümantasyon | Kullanıcı yönetimi kılavuzu, API doc update | 1g |

## 3. Tanımlı Definasyonlar

### Definition of Ready (DoR)
- Kabul kriterleri net.
- API sözleşmesi tasarlanmış (Phase1_Data_Model_and_APIs referans).
- Bağımlılıklar tanımlı (Sprint 0 çıktıları tamamlanmış).

### Definition of Done (DoD)
- Kod review’dan geçti.
- Birim ve entegrasyon testleri başarılı.
- Dokümantasyon (API + kullanıcı kılavuzu) güncellendi.
- Güvenlik kontrolleri (yetki testleri) yapıldı ve audit log’lar doğrulandı.
- CI pipeline’da lint/test/build başarıyla çalıştı.

## 4. Riskler
- RBAC/ABAC karmaşıklığı → Sprint başında proof-of-concept.
- UI karmaşıklığı → UX prototip onayı olmadan geliştirmeye başlanmamalı.
- Refresh token yönetimi → blacklisting yaklaşımı belirlenmeli.

## 5. Bağımlılıklar
- Sprint 0: ER diyagramı, güvenlik kararları, onaylı plan.
- DevOps: Ortam URL’leri, secret management (JWT secret, SMTP, S3).
- Üçüncü parti: OAuth2 provider yapılandırması (Keycloak vb.).
