---
title: QDMS Entegre Y?netim Sistemi ? Teknik Tasar?m
version: 0.2.0
author: Codex (ChatGPT)
date: 2025-10-14
---

# 1. Genel Bak??

## 1.1. Tan?m

QDMS (Quality, Risk, Audit, Performance and Compliance Management Software), kalite, risk, denetim ve uyumluluk s?re?lerinin tek bir platformda y?netilmesi i?in tasarlanm??, web tabanl?, mod?ler ve izin tabanl? bir entegre y?netim sistemidir. Kullan?c?lar taray?c? ?zerinden eri?ir; sistem hem bulut (SaaS) hem de ?irket i?i (on-premise) kurulum senaryolar?n? destekler.

## 1.2. Mimari Yakla??m

- **Sunucu Taraf?:** RESTful API (FastAPI veya e?de?eri), mikro servis mant???nda mod?ler yap?.
- **?stemci Taraf?:** SPA (React, Vue veya Angular); bile?en tabanl?, durum y?netimi (Redux/Zustand tbd.), eri?ilebilirli?i y?ksek bir aray?z.
- **Veritaban?:** Dok?man a??rl?kl? operasyonlar ve esnek ?ema gereksinimi nedeni ile NoSQL (MongoDB) ana veri taban?, gerekti?inde ili?kisel veritaban? (PostgreSQL) eklenebilir.
- **Mesajla?ma/Kuyruk:** Uzun s?ren s?re?ler (bildirim, e-posta, otomatik i? emirleri) i?in asenkron mesaj kuyru?u (RabbitMQ/SQS) ?nerilir.
- **Dosya Depolama:** Belge y?netimi i?in objeye dayal? depolama (S3, Azure Blob, MinIO).
- **Kimlik Do?rulama:** OAuth2 / OpenID Connect uyumlu, JWT ta??y?c?l? eri?im token?lar?; seans yenileme i?in refresh token.
- **Yetkilendirme:** RBAC (Role-Based Access Control) + ABAC (Attribute-Based) uzant?lar?; departman, pozisyon, grup bazl? k?s?tlar.

## 1.3. Da??t?m Senaryolar?

| Senaryo | A??klama | Not |
|---------|----------|-----|
| SaaS/Bulut | Uygulama konteyner tabanl? (Docker/Kubernetes) olarak bulut sa?lay?c?s?nda ko?ar. ?ok kirac?l? mimari opsiyonu. | SLA ve otomatik ?l?eklenebilirlik. |
| On-Premise | ?irket i?i veri merkezinde Docker Swarm veya Kubernetes ile da??t?m. | ?irket politikalar?na uygun verimlilik/isolasyon. |

## 1.4. Temel ?zellikler

1. Web tabanl? eri?im, responsif UI.
2. Yetki bazl? g?r?n?rl?k ve i?lem k?s?tlar?.
3. Ana sayfada g?rev/approval widget?lar? ve mod?ler navigasyon.
4. Kamera/ekran kayd?, belge ?n izleme (Word/Excel/PPT/PDF/g?rsel/ses/video).
5. Her mod?l i?in raporlama arac?, Excel/PDF export.
6. Mod?ler yap?: Dok?man, ?ikayet, D?F/CAPA, Denetim, Risk, Cihaz Y?netimi.

# 2. G?venlik ve Yetkilendirme

## 2.1. Kimlik Do?rulama

- OAuth2 Password / Authorization Code ak???.
- Kurumsal dizin/cloud SSO (Azure AD, Okta) entegrasyon opsiyonu.
- MFA deste?i (SMS, Authenticator).
- Session y?netimi: Access + Refresh token; k?sa ?m?rl? access token (15-30 dk), uzun ?m?rl? refresh (24-72 saat).

## 2.2. Yetkilendirme Modeli

### 2.2.1. Rol ve Grup Yap?s?

- **Rol Hiyerar?isi:** 
  - Sistem Y?neticisi
  - Mod?l Y?neticileri (Dok?man, Risk, Denetim, Cihaz vb.)
  - Departman Sorumlular?
  - ?? Denet?iler
  - Kullan?c?/Personel
- **Departman ve Grup:** Her kullan?c? bir veya daha fazla departman ve ?al??ma grubuna atan?r.
- **G?rev Bazl? K?s?t:** Belirli roller sadece belirli klas?rlere, risk modellerine veya cihaz kay?tlar?na eri?ebilir.

### 2.2.2. ?zin Matrisi

| ??lem                 | Rol/Yetki         | Ek Ko?ul |
|-----------------------|-------------------|----------|
| Dok?man G?r?nt?leme   | `Doc.Read`        | Kullan?c? ilgili klas?r/da??t?m listesinde olmal? |
| Dok?man Revizyonu     | `Doc.Revise`      | Klas?r yetkisi `Revise` olmal? |
| ?ikayet Olu?turma     | `Complaint.Create`| Departman eri?imi |
| CAPA Kapatma          | `CAPA.Close`      | Ekip lideri veya y?neticisi |
| Denetim Sorusu Atama  | `Audit.Manage`    | Denetim ekibi ?yesi |
| Risk Modeli Tan?mlama | `Risk.Configure`  | Kalite/Risk y?netimi |
| ?? Emri Olu?turma     | `Equipment.WorkOrder`| Cihaz sorumlusu |

#### 2.2.2.1. Modul Bazli Detayli Yetki Matrisi

| Modul / Islem                                | Sistem Yoneticisi | Modul Yoneticisi | Departman Sorumlusu | Denetci | Kullanici |
|----------------------------------------------|:-----------------:|:----------------:|:-------------------:|:-------:|:---------:|
| **Dokuman**                                  |                   |                  |                     |         |           |
| Klasor Olusturma / Yapilandirma              | ?                 | ? (Dokuman)     | ? (yetkilendirilirse) | ?      | ?        |
| Dokuman Taslagi Olusturma                    | ?                 | ?               | ?                   | ?      | ? (rol bazli) |
| Revizyon Baslatma                            | ?                 | ?               | ?                   | ?      | ?        |
| Onay Sureci Yonetimi                         | ?                 | ?               | ? (yetkilendirilirse) | ?      | ?        |
| Okuma Onay Takibi                            | ?                 | ?               | ?                   | ?      | ? (kendi) |
| Dokuman Iptali                               | ?                 | ?               | ? (sinirli)          | ?      | ?        |
| **Sikayet**                                   |                   |                  |                     |         |           |
| Sikayet Kaydi Olusturma                      | ?                 | ? (Sikayet)     | ?                   | ?      | ?        |
| Cozum Ekibi Atama                            | ?                 | ?               | ?                   | ?      | ?        |
| Sorusturma Raporu Onaylama                   | ?                 | ?               | ?                   | ?      | ?        |
| Gorev Atama                                  | ?                 | ?               | ?                   | ?      | ?        |
| Nihai Rapor Onayi                            | ?                 | ?               | ?                   | ?      | ?        |
| **DOF/CAPA**                                  |                   |                  |                     |         |           |
| CAPA Kaydi Olusturma                         | ?                 | ? (CAPA)        | ?                   | ? (denetim kaynakli) | ? |
| Ekip / Lider Atama                           | ?                 | ?               | ?                   | ?      | ?        |
| Kok Neden Analizi Kaydi                      | ?                 | ?               | ?                   | ?      | ?        |
| Aksiyon Atama                                | ?                 | ?               | ?                   | ?      | ?        |
| CAPA Kapatma                                 | ?                 | ?               | ? (lider)           | ?      | ?        |
| **Denetim**                                   |                   |                  |                     |         |           |
| Denetim Plani Olusturma                      | ?                 | ? (Denetim)     | ? (denetlenen birim) | ?      | ?        |
| Soru Havuzu Yonetimi                         | ?                 | ?               | ?                   | ?      | ?        |
| Denetim Cevaplarinin Kaydi                   | ?                 | ?               | ? (denetlenen)      | ?      | ?        |
| Bulgulari CAPA?ya Baglama                    | ?                 | ?               | ?                   | ?      | ?        |
| **Risk**                                      |                   |                  |                     |         |           |
| Risk Modeli Tanimlama                        | ?                 | ? (Risk)        | ?                   | ?      | ?        |
| Risk Kaydi Olusturma                         | ?                 | ?               | ?                   | ?      | ?        |
| Risk Revizyonu                               | ?                 | ?               | ?                   | ?      | ?        |
| Risk Raporlama                               | ?                 | ?               | ?                   | ?      | ?        |
| **Cihaz Yonetimi / Kalibrasyon**             |                   |                  |                     |         |           |
| Cihaz Kaydi Olusturma                        | ?                 | ? (Cihaz)       | ?                   | ?      | ?        |
| Periyot / Politika Tanimlama                 | ?                 | ?               | ?                   | ?      | ?        |
| Otomatik Is Emri Parametreleri               | ?                 | ?               | ?                   | ?      | ?        |
| Is Emri Gerceklestirme                       | ?                 | ?               | ?                   | ?      | ? (atanan) |
| Kalibrasyon Raporu Goruntuleme               | ?                 | ?               | ?                   | ?      | ? (yetkili) |

*Notlar:* ? izinli, ? izin yok, ? kosullu/konfigurasyona bagli.

### 2.2.3. ABAC ?rnekleri

- ?ikayet kay?tlar? sadece ilgili departman ve ??z?m ekibi taraf?ndan g?r?lebilir.
- Risk de?erlendirmeleri sadece ilgili varl?k grubu sorumlular? taraf?ndan revize edilebilir.
- Denetim raporlar?, denetim ekibi ve y?netim taraf?ndan g?r?nt?lenebilir.

# 3. Sistem Bile?enleri

## 3.1. Kullan?c? Aray?z?

- **Ana Sayfa (Dashboard):** Bekleyen g?revler, onay bekleyen dok?man/s?re?ler, kritik riskler, yakla?an kalibrasyonlar.
- **Widget Mekanizmas?:** Kullan?c? rol?ne g?re ?zelle?tirilebilir widget seti (dok?man onay?, a??k CAPA, planl? denetim vb.).
- **Sol Navigasyon:** Mod?ler; kullan?c? rol?ne g?re mod?llerin g?r?n?rl???.

## 3.2. Dosya G?r?nt?leyici

- Kullan?c? taray?c? i?i viewer ile belge/medya dosyalar?n? g?r?nt?ler.
- G?venlik: Pre-signed URL eri?imleri, watermark, salt okunur mod.

## 3.3. Raporlama ve Export

- Filtre kurgusu: T?m mod?ller i?in ko?ul/parametre bazl? rapor ?retimi.
- Export: Excel (XLSX), PDF; kapak + detay + grid.
- Rapor planlama: Cron benzeri zamanlanm?? rapor da??t?m? (iste?e ba?l?).

# 4. Mod?l Tasar?mlar?

## 4.1. Kontroll? Dok?man Y?netimi

### 4.1.1. Hedefler
- Haz?rlama, revizyon, onay, yay?nlama, ar?ivleme.
- Klas?r bazl? yetki y?netimi.
- Da??t?m/okuma takip mekanizmas?.

### 4.1.2. Veri Modeli (?rnek)

- `folders`: id, ad?, ?st klas?r, departman, kod deseni, yetki matrisleri (read/print/edit/revise/cancel).
- `documents`: id, folder_id, code, title, type, department, status, version, created_by, current_version_id.
- `document_versions`: id, document_id, version, file_id, status, created_by, approval_matrix, distribution_list, change_log.
- `document_permissions`: folder_id, role/department, permission_set.
- `document_reads`: document_version_id, user_id, read_at, status.

### 4.1.3. ?? Ak??lar?

1. **Dok?man Olu?turma:** Klas?r se?imi ? otomatik kod ?retimi ? taslak kayd? ? da??t?m/approval matrisinin tan?mlanmas?.
2. **Revizyon:** Versiyon ba?latma ? yeni dosya y?kleme ? onay s?reci ? eski versiyon ar?iv.
3. **Onay ve Yay?n:** Onay matrisi s?ras?na g?re e-imza/onay ? yay?nlama.
4. **Okuma Takibi:** Da??t?m listesi kullan?c?lar? i?in okundu/okunmad? durumu.
5. **?ptal:** ?ptal ak??? ? ar?iv klas?r?, referanslama.

### 4.1.4. Raporlar

- Dok?man Durum Raporu.
- Okuma Takip Raporu.
- Revizyon Ge?mi?i Kar??la?t?rmas?.

## 4.2. M??teri ?ikayetleri

### 4.2.1. Veri Modeli

- `complaints`: id, complaint_no, customer_name, category, department, description, status, created_by, created_at.
- `complaint_team`: complaint_id, user_id, role (lider/?ye).
- `complaint_actions`: id, complaint_id, description, due_date, responsible_user, status.
- `complaint_attachments`: complaint_id, file.
- `investigation_report`: complaint_id, report_text, submitted_by, submitted_at.

### 4.2.2. ?? Ak???

1. Kay?t yaratma (durum = open).
2. ??z?m ekibi atama.
3. ?lk soru?turma raporu ekleme.
4. G?rev atamalar? (aksiyaonlar).
5. Nihai rapor ve kapan??.

### 4.2.3. Raporlama

- ?ikayet Statu Raporu.
- ??z?m s?resi analizi.
- Departman bazl? da??l?m.

## 4.3. D?F / CAPA

### 4.3.1. Veri Modeli

- `capa`: id, capa_no, source (risk, audit, supplier), department, team_leader, team_members, nonconformity_description, status, created_at.
- `capa_actions`: capa_id, description, responsible, due_date, status, completion_date.
- `root_cause_analysis`: capa_id, 5Why/Fishbone sonu?lar?, risk seviyesi.
- `capa_reports`: final_report, submitted_by, submitted_at.

### 4.3.2. Ak??

1. CAPA kayd? a?ma (kaynak, uygunsuzluk detay?).
2. Ekip ve lider atama.
3. Soru?turma/k?k neden.
4. Aksiyon plan? ve atamalar.
5. Takip/kapan?? (final rapor).

### 4.3.3. Entegrasyon

- Risk ve Cihaz mod?l? ile kar??l?kl? ba?lant? (CAPA referans?).
- Denetim bulgular?n?n CAPA?ya d?n???m?.

## 4.4. Denetim Mod?l?

### 4.4.1. Veri Modeli

- `audits`: id, audit_code, type, start_date, end_date, scope, status, lead_auditor.
- `audit_team`: audit_id, user_id, role.
- `audit_checklists`: audit_id, question_id, response, evidence, attachments.
- `audit_findings`: audit_id, description, severity, recommendation, linked_capa_id.

### 4.4.2. ?zellikler

- Soru havuzu (modellerine g?re).
- Cevap kayd?, bulgu olu?turma.
- Ekler, de?erlendirme.
- Denetim sonu? raporu, CAPA ba?lant?s?.

## 4.5. Risk De?erlendirme

### 4.5.1. Altyap?

- Risk modelleri (form alanlar?, hesaplama form?lleri).
- 200+ parametre ile aktif/pasif ?zellik seti.
- G?rselle?tirme: Risk matrisleri (heatmap), trend grafik.

### 4.5.2. Veri Modeli

- `risk_models`: id, name, description, fields[], formulas.
- `risk_records`: id, model_id, code, subject, department, status, risk_value, created_at.
- `risk_revisions`: record_id, revision_no, fields_snapshot, risk_value, created_at.
- `risk_actions`: record_id, action, responsible, due_date, status.

### 4.5.3. ??levler

- De?erlendirme plan?, sorumlu gruplar.
- Otomatik risk endeksi hesaplama (form?l motoru).
- Revizyon kar??la?t?rmas? (0 vs 1, vs 2...).
- Renk kodlu risk seviyesi, trend ok y?n?.
- Raporlama: risk listeleri, grafikler, ?zel format export (field code + Word/Excel ?ablon).

## 4.6. Cihaz Y?netimi (Kalibrasyon)

### 4.6.1. Veri Modeli

- `equipment`: id, code, name, category, department, responsible, cost, specs.
- `equipment_processes`: equipment_id, process_type, frequency, policy, location, last_date, next_date.
- `equipment_measurements`: equipment_id, reference_value, acceptable_range.
- `work_orders`: id, equipment_id, process_type, scheduled_date, assigned_to, status, auto_generated.
- `calibration_reports`: work_order_id, measurements, result, attachments.

### 4.6.2. ?? Ak???

1. Cihaz tan?m?, periyot belirleme.
2. Otomatik/manuel i? emri olu?turma (parametre 26 vb.).
3. ??lem ger?ekle?tirme, ?l??m kay?tlar?.
4. Raporlama, maliyet takibi.
5. D?F entegrasyonu (kusur olu?tu?unda D?F a?).

### 4.6.3. Raporlar

- Planl? ??lem Raporu (ayl?k ?izelge).
- Zaman ?izelgesi.
- ?l??m De?eri raporlar?.

# 5. Entegrasyonlar

## 5.1. Risk ? D?F

- Risk aksiyonlar?na D?F referans? linklenir.
- Risk mod?l?nde ?D?F/Aksiyon? se?im kutusu; se?ilen kay?t D?F/CAPA detay?na ba?lan?r.
- Yeni D?F a??ld???nda risk kayd? ile ili?kilendirilebilir.

## 5.2. Cihaz Y?netimi ? D?F

- Cihaz i?lem sonras? kusur tespitinde ?Yeni D?F? butonu.
- D?F kayd? cihaz/proses referans?n? saklar.

## 5.3. Di?er

- Denetim bulgusu ? CAPA kayd?.
- Dok?man revizyon onay? ? Bildirim mod?l?.
- Raporlama arac? ? T?m mod?llerden veri ?ekebilir; dashboard widget?lar?.

# 6. Da??t?m ve DevOps

- Kod y?netimi: Git, trunk-based veya GitFlow.
- CI/CD: Otomatik test, lint, build pipeline (GitHub Actions, GitLab CI).
- Containerization: Docker + docker-compose (geli?tirme), Kubernetes (prod).
- IaC: Terraform / Ansible ile bulut/on-premise provisioning.
- ?zleme: Prometheus + Grafana, ELK/Splunk log y?netimi.

# 7. Test Stratejisi

- **Birim Testleri:** Backend servisleri, form?l motoru.
- **Entegrasyon Testleri:** API endpoint?leri, veri konsistans?.
- **E2E/UI Testleri:** Cypress/Playwright ile temel i? ak??lar?.
- **G?venlik Testleri:** Pen-test, rol/izolasyon testleri.
- **Y?k Testleri:** JMeter/k6 ile raporlama ve belge indirme senaryolar?.

# 8. Yol Haritas? (?neri)

1. **Faz 0 ? Tasar?m & POC:** Donan?ml? prototip (kullan?c? y?netimi, D?F ?ekirde?i).
2. **Faz 1 ? Yetkilendirme + Dok?man Mod?l?:** Klas?r, versiyon, onay, okuma.
3. **Faz 2 ? ?ikayet & CAPA:** ?? ak??lar?, ekip y?netimi, raporlar.
4. **Faz 3 ? Risk ve Denetim:** Model tan?mlama, soru havuzu, CAPA entegrasyonu.
5. **Faz 4 ? Cihaz Y?netimi:** ?? emirleri, raporlama, D?F ba?lant?s?.
6. **Faz 5 ? Raporlama & G?rselle?tirme:** Excel/PDF export, dashboard widget?lar?.
7. **Faz 6 ? Optimizasyon & Entegrasyonlar:** Otomasyon, d?? sistem entegrasyonlar? (ERP, HRM).

# 9. Sonraki Ad?mlar

## 9.1. Faz 1 Sprint-0 ??eleri
- ER diyagramlar? (kullan?c?, rol, klas?r, dok?man, versiyon, okuma takibi).
- G?venlik kararlar?: ?ifre hash algoritmalar?, token s?releri, refresh token rotasyonu.
- Onay matrisleri ve da??t?m listeleri i?in konfig?rasyon ?emas?.

## 9.2. Onay S?reci
- Tasar?m dok?man? ve Faz 1 plan?n?n payda? toplant?s?nda g?zden ge?irilmesi.
- Sprint 0 ba?lang?? toplant?s? (Scrum Master, ??z?m mimar?, g?venlik, DB).
- ??kt?: onaylanan veri modeli ve g?venlik kararlar?.

## 9.3. Sprint 0 Takvimi
- Hafta 0, G?n 1-2: ER diyagramlar?, ?ema d?k?man?.
- Hafta 0, G?n 3-4: G?venlik karar? dok?man?, token ya?am d?ng?s?.
- Hafta 0, G?n 5: Payda? onay?, Sprint 1 backlog onay?.

## 9.4. Sonras?
- Sprint 1: Kimlik y?netimi uygulamas? (kullan?c?, rol, departman, login ak???).
- Sprint 2: Dok?man klas?r yap?s? ve temel API in?as?.


- Bu tasar?m dok?man?n?n payda?larla g?zden ge?irilmesi.
- Veri modelinin ayr?nt?l? ER diyagramlar? ile geni?letilmesi.
- Rol/izin matrisi detayland?rmas? (rol x mod?l x i?lem tablosu).
- ?? ak??lar?n?n BPMN diyagramlar? ile modellendirilmesi.
- Teknik Proof-of-Concept ?al??malar? (?r. belge g?r?nt?leyici, form?l motoru).

Bu dok?man, QDMS sisteminin kapsaml? bir mimari plan?n? sunar. Onay sonras? her mod?l i?in detayl? teknik tasar?m ve sprint planlar? ??kar?lmal?d?r.
