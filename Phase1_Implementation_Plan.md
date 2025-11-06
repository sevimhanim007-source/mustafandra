# Faz 1 – Kimlik & Kontrollü Doküman Yönetimi Uygulama Planı

Bu plan, QDMS projesinin ilk fazı için ayrıntılı görev listesini, bağımlılıkları, varsayımları ve başarı ölçütlerini içerir.

---

## 1. Kapsam
**Faz 1 hedefi:** Kimlik doğrulama / yetkilendirme altyapısı ve kontrollü doküman yönetimi modülünün temel sürümünü devreye almak.

Alt bileşenler:
1. Kullanıcı, rol, grup, departman yönetimi
2. RBAC + ABAC politika tanımları
3. Giriş, token yenileme, audit log
4. Klasör yapısı, doküman versiyonlama, onay & dağıtım matrisi
5. Doküman onay, revizyon, iptal akışı
6. Doküman okuma takibi, temel raporlama (dashboard widget + durum raporu)

---

## 2. Varsayımlar & Bağımlılıklar
- Dev ortamında MongoDB, belgeler için obje depolama (MinIO/S3) erişimi mevcut.
- LDAP/AD entegrasyonu Faz 2’ye ertelenebilir; OAuth2/OIDC provider (Keycloak/Azure AD) belirlendi.
- Bildirim ve e-posta servisleri (SMTP) yapılandırılabilir durumda.
- UI için React tabanlı kod kütüphanesi (mevcut prototip) kullanılacak.
- Güvenlik gözden geçirmeleri (pen test) Faz 1 bittiğinde yapılacak.

---

## 3. İş Paketleri ve Görevler

### 3.1. Mimari Hazırlık
| # | Görev | Sorumlu | Süre (gün) | Çıktı |
|---|-------|---------|------------|-------|
| 1 | Mimari tasarım dokümanının Faz 1 kapsamıyla uyumlu revizyonu | Çözüm Mimarı | 2 | Faz 1 teknik ek | 
| 2 | ER diyagramları ve koleksiyon şemaları oluşturma (kullanıcı, rol, doküman, klasör, versiyon) | DB mühendisi | 3 | ER diyagramları, JSON şema dökümanı |
| 3 | Güvenlik kararları: hashing (bcrypt/SHA), salt, token süresi, refresh token modeli | Güvenlik mühendisi | 2 | Güvenlik kararı dokümanı |

### 3.2. Kimlik ve Yetkilendirme
| # | Görev | Sorumlu | Süre | Not |
|---|-------|---------|------|-----|
| 4 | Kullanıcı modeli (departman, grup, rol, pozisyon, izin seti) | Backend lead | 3 | Mongo şeması + migration |
| 5 | Rol & izin tablosu (RBAC matrisinin kodlanması) | Backend/DevOps | 2 | Seed script + API |
| 6 | ABAC politikaları (departman, grup, klasör) için middleware | Backend | 3 | Policy engine |
| 7 | OAuth2/OIDC entegrasyonu + JWT/refresh akışı | Backend | 4 | `/auth/login`, `/auth/token-refresh` |
| 8 | Audit log (giriş/çıkış, kritik işlemler) | Backend | 3 | Log koleksiyonu, hook’lar |
| 9 | Yönetim UI (kullanıcı, rol, departman yönetimi) | Frontend lead | 5 | React ekranları |
| 10 | Birim/entegrasyon testleri (kimlik modülü) | QA | 4 | Test planı + otomasyon |

### 3.3. Doküman Yönetimi
| # | Görev | Sorumlu | Süre | Not |
|---|-------|---------|------|-----|
| 11 | Klasör modeli (hiyerarşi, kod şablonu, yetki setleri) | Backend | 4 | API: `/folders` |
| 12 | Doküman & versiyon modelleri | Backend | 4 | API: `/documents`, `/documents/{id}/versions` |
| 13 | Otomatik kodlama (ör. DEPT-TYP-###) | Backend | 2 | Servis/yardımcı |
| 14 | Onay & dağıtım matrisleri (UI + API) | Fullstack | 5 | Akış yapılandırma ekranı |
| 15 | Revizyon & iptal iş akışı (BPMN engine veya state machine) | Backend | 4 | Workflow servisi |
| 16 | Dosya yükleme & viewer entegrasyonu (S3 + PDF.js) | Backend + Frontend | 5 | Upload API + viewer bileşeni |
| 17 | Okuma takibi (read receipt) | Backend | 3 | `/documents/{id}/read` |
| 18 | Doküman durum & okuma raporları | Backend + Frontend | 4 | API + UI grid/export |
| 19 | Dashboard widget entegrasyonu (onay bekleyen dokümanlar) | Frontend | 2 | Widget component |
| 20 | Otomatik bildirimler (e-posta, sistem içi) | Backend | 4 | Queue/Background task |

### 3.4. DevOps & Altyapı
| # | Görev | Sorumlu | Süre | Not |
|---|-------|---------|------|-----|
| 21 | Terraform/Ansible ile ortam hazırlığı (dev/staging) | DevOps | 4 | IaC betikleri |
| 22 | CI/CD pipeline (lint, test, build, deploy) | DevOps | 3 | GitHub Actions/GitLab |
| 23 | Loglama & izleme (ELK, Prometheus) | DevOps | 4 | Dashboard kurulum |
| 24 | Yedekleme stratejisi (Mongo snapshot, dosya backup) | DevOps | 3 | Backup dokümantasyonu |

### 3.5. QA & Dokümantasyon
| # | Görev | Sorumlu | Süre | Not |
|---|-------|---------|------|-----|
| 25 | Test senaryoları (pozitif/negatif) | QA | 4 | Test cases |
| 26 | Otomasyon (API + UI) | QA | 5 | Postman/Newman + Cypress |
| 27 | Kullanıcı dokümantasyonu (kimlik, doküman modülü) | Teknik yazar | 4 | Kullanım kılavuzu |
| 28 | Yayın notu (Release note) | PO | 2 | Faz 1 deliverable |

---

## 4. Zaman Çizelgesi (Öneri)

| Sprint | Süre | Odak |
|--------|------|------|
| Sprint 0 | 1 hafta | Mimari hazırlık, ER diyagram, güvenlik kararları |
| Sprint 1 | 2 hafta | Kimlik yönetimi: kullanıcı/rol/izin, login akışı, yönetim UI |
| Sprint 2 | 2 hafta | Klasör & doküman modelleri, kodlama, temel API’ler |
| Sprint 3 | 2 hafta | Onay/dağıtım, revizyon/iptal iş akışı, dosya yönetimi |
| Sprint 4 | 2 hafta | Okuma takibi, raporlar, dashboard widget, bildirimler |
| Sprint 5 | 1 hafta | QA, güvenlik testleri, dökümantasyon, UAT hazırlığı |

Toplam tahmini süre: 10 hafta (çapraz scrum takımlarıyla paralel işler hızlandırılabilir).

---

## 5. Kritik Başarı Kriterleri
- Rol/izin sistemi tüm modüller için temel oluşturacak esneklikte.
- Doküman onay & revizyon süreçleri eksiksiz çalışıyor; audit trail tutuluyor.
- Okuma/dağıtım takibi raporlanabilir durumda.
- UI, kullanıcı profiline göre widget ve modül gösterimini dinamik yönetiyor.
- CI/CD, loglama, backup süreçleri kurgulandı.
- Güvenlik gereksinimleri (hashing, JWT süresi, erişim kontrolleri) dokümante ve test edildi.

---

## 6. Riskler & Azaltma
| Risk | Etki | Azaltma |
|------|------|---------|
| RBAC/ABAC karmaşıklığı | Yüksek | İzin matrisi prototipleri, sınırlı POC; Faz 1 sonunda denetim |
| Doküman dosya boyutları (büyük dosyalar) | Orta | Chunk upload, S3 multipart; limit ve uyarı mekanizması |
| Onay iş akışının varyasyonları | Yüksek | BPMN ile modelleme, süreç konfigürasyon ekranı |
| UI karmaşıklığı (matris yönetimi) | Orta | Tasarım sprinti, UX prototipi, kullanıcı testleri |

---

## 7. Bağımlılıklar & Sonraki Fazlara Devredilenler
- LDAP/SSO, MFA’ye geçiş (Faz 2).
- Doküman karşılaştırma (diff), advanced viewer özelliği.
- Mobil uygulama uyarlaması.
- Dış sistem entegrasyonları (ERP, HRM).

---

## 8. Onay ve Süreç
1. Faz 1 planının paydaş onayı.
2. Sprint planlama toplantısı (Scrum master + takım).
3. Demo/UAT sonrası Faz 2 kapsam ve tasarımına geçiş.

---

Bu plan, QDMS projesinin Faz 1’inde kimlik/yetkilendirme ve doküman yönetimi modülünü eksiksiz ve denetlenebilir şekilde hayata geçirmek için izlenecek detaylı yol haritasını sunar.
