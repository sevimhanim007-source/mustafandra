---
title: Faz 1 Geliştirme Ortamı Hazırlık Kontrol Listesi
---

## 1. Repozituvar ve Versiyon Kontrol
- [ ] Git ana deposu oluşturuldu (`qdms-platform`).
- [ ] Ana branch stratejisi belirlendi (trunk-based veya GitFlow).
- [ ] Kod standartları (lint, commit mesajları) dokümante edildi.
- [ ] Özel erişim yetkileri (geliştirici / review / release) tanımlandı.
- [ ] Repo içinde aşağıdaki klasör yapısı oluşturuldu:
  ```
  backend/
    src/
    tests/
    requirements.txt
  frontend/
    src/
    tests/
    package.json
  infra/
    terraform/
    ansible/
  docs/
  ```

## 2. Geliştirme Ortamı
- [ ] Backend ortamı: Python 3.11, FastAPI, uvicorn.
- [ ] Frontend ortamı: Node 18+, React, Vite.
- [ ] Ortak `.env.example` dosyaları: JWT_SECRET, DB bağlantıları, SMTP.
- [ ] Docker-compose (dev): MongoDB, MinIO/S3 replacement, Redis (mesaj kuyruğu için placeholder).
- [ ] Pre-commit hook’ları (format/lint) ayarlandı.

## 3. CI/CD Temeli
- [ ] CI pipeline dosyası (`.github/workflows/ci.yml` veya GitLab CI) oluşturuldu:
  - Backend: lint (flake8), test (pytest), build (docker image).
  - Frontend: lint (eslint), test (jest/cypress), build.
  - Sonuç yayımlama (artifacts).
- [ ] CD taslağı:
  - Staging ortamına otomatik deployment (approval opsiyonlu).
  - Prod için manuel tetikleme.
- [ ] Secrets yönetimi (GitHub Secrets / Vault / AWS Parameter Store).

## 4. Altyapı (Infra)
- [ ] Terraform modülleri: VPC/VNet, MongoDB (Atlas veya VM), S3/Blob, Keycloak (opsiyonel).
- [ ] Ansible playbook: Uygulama hostlarına docker runtime kurulumu.
- [ ] Monitoring stack (Prometheus + Grafana) taslak konfig.
- [ ] Log yönetimi (ELK veya cloud native log service).
- [ ] Backup stratejisi: Mongo snapshot, S3 replication.

## 5. Güvenlik ve Uyumluluk
- [ ] JWT secret, DB şifreleri, SMTP kimlik bilgileri için secret manager.
- [ ] HTTPS (dev için self-signed, staging/prod için gerçek sertifika planı).
- [ ] Güvenlik duvarı kuralları, IP allow-list (on-prem senaryosu).
- [ ] Temel pen-test checklist (OWASP) hazırlandı.

## 6. Dokümantasyon
- [ ] Wiki / Confluence alanı (Mimari, API, sprint planları).
- [ ] ER diyagramları (Sprint 0 çıktısı) repo veya wikiye yüklendi.
- [ ] API dokümantasyonu için OpenAPI/Swagger config.
- [ ] Modül bazlı test planları (QA takımı tarafından).

## 7. Onay
- [ ] DevOps sorumlusu kontrol etti.
- [ ] Güvenlik ekibi tarafından gözden geçirildi.
- [ ] Proje yöneticisi onayladı (Go/No-Go).

Tamamlanan kalemler işaretlenip sorumlu kişilerce imzalanmalıdır. Bu checklist, Faz 1 geliştirme sürecine başlamadan önce minimum gereksinimleri doğrulamak için kullanılır.
