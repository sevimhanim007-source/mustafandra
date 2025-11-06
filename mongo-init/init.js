// MongoDB Initialization Script for QDMS
// Bu script veritabanı ve koleksiyonları oluşturur, index'leri tanımlar

db = db.getSiblingDB('qdms');

// ============================================================================
// KULLANICI VE YETKİLENDİRME KOLEKSİYONLARI
// ============================================================================

// Kullanıcılar koleksiyonu
db.createCollection('users');
db.users.createIndex({ 'username': 1 }, { unique: true });
db.users.createIndex({ 'email': 1 }, { unique: true });
db.users.createIndex({ 'department_id': 1 });
db.users.createIndex({ 'roles': 1 });
db.users.createIndex({ 'groups': 1 });
db.users.createIndex({ 'is_active': 1 });
db.users.createIndex({ 'created_at': -1 });

// Roller koleksiyonu
db.createCollection('roles');
db.roles.createIndex({ 'name': 1 }, { unique: true });
db.roles.createIndex({ 'is_system': 1 });
db.roles.createIndex({ 'permissions': 1 });
db.roles.createIndex({ 'created_at': -1 });

// Departmanlar koleksiyonu
db.createCollection('departments');
db.departments.createIndex({ 'code': 1 }, { unique: true });
db.departments.createIndex({ 'name': 1 });
db.departments.createIndex({ 'parent_id': 1 });
db.departments.createIndex({ 'manager_id': 1 });
db.departments.createIndex({ 'created_at': -1 });

// Kullanıcı grupları koleksiyonu
db.createCollection('user_groups');
db.user_groups.createIndex({ 'name': 1 }, { unique: true });
db.user_groups.createIndex({ 'members': 1 });
db.user_groups.createIndex({ 'created_at': -1 });

// Oturum yönetimi
db.createCollection('sessions');
db.sessions.createIndex({ 'token': 1 }, { unique: true });
db.sessions.createIndex({ 'user_id': 1 });
db.sessions.createIndex({ 'expires_at': 1 }, { expireAfterSeconds: 0 }); // TTL index
db.sessions.createIndex({ 'revoked': 1 });

// ============================================================================
// DOKÜMAN YÖNETİMİ
// ============================================================================

db.createCollection('documents');
db.documents.createIndex({ 'doc_code': 1 }, { unique: true });
db.documents.createIndex({ 'folder_id': 1 });
db.documents.createIndex({ 'doc_type': 1 });
db.documents.createIndex({ 'status': 1 });
db.documents.createIndex({ 'department_id': 1 });
db.documents.createIndex({ 'created_by': 1 });
db.documents.createIndex({ 'version': 1 });
db.documents.createIndex({ 'created_at': -1 });
db.documents.createIndex({ 'updated_at': -1 });
// Text search için compound index
db.documents.createIndex({ 
  'title': 'text', 
  'description': 'text', 
  'content': 'text' 
}, {
  weights: {
    'title': 10,
    'description': 5,
    'content': 1
  },
  name: 'document_text_search'
});

// Doküman klasörleri
db.createCollection('document_folders');
db.document_folders.createIndex({ 'name': 1 });
db.document_folders.createIndex({ 'parent_id': 1 });
db.document_folders.createIndex({ 'path': 1 });
db.document_folders.createIndex({ 'created_at': -1 });

// Doküman versiyonları
db.createCollection('document_versions');
db.document_versions.createIndex({ 'document_id': 1, 'version': 1 }, { unique: true });
db.document_versions.createIndex({ 'created_by': 1 });
db.document_versions.createIndex({ 'created_at': -1 });

// Doküman onay akışları
db.createCollection('document_approvals');
db.document_approvals.createIndex({ 'document_id': 1 });
db.document_approvals.createIndex({ 'approver_id': 1 });
db.document_approvals.createIndex({ 'status': 1 });
db.document_approvals.createIndex({ 'created_at': -1 });

// Doküman okuma kayıtları
db.createCollection('document_reads');
db.document_reads.createIndex({ 'document_id': 1, 'user_id': 1 });
db.document_reads.createIndex({ 'user_id': 1 });
db.document_reads.createIndex({ 'read_at': -1 });

// ============================================================================
// MÜŞTERİ ŞİKAYETLERİ
// ============================================================================

db.createCollection('complaints');
db.complaints.createIndex({ 'complaint_no': 1 }, { unique: true });
db.complaints.createIndex({ 'customer_name': 1 });
db.complaints.createIndex({ 'status': 1 });
db.complaints.createIndex({ 'department_id': 1 });
db.complaints.createIndex({ 'category': 1 });
db.complaints.createIndex({ 'priority': 1 });
db.complaints.createIndex({ 'assigned_to': 1 });
db.complaints.createIndex({ 'created_by': 1 });
db.complaints.createIndex({ 'created_at': -1 });
db.complaints.createIndex({ 'updated_at': -1 });
db.complaints.createIndex({ 'target_date': 1 });
// Text search
db.complaints.createIndex({ 
  'customer_name': 'text', 
  'description': 'text',
  'product': 'text'
}, { name: 'complaint_text_search' });

// Şikayet aksiyonları
db.createCollection('complaint_actions');
db.complaint_actions.createIndex({ 'complaint_id': 1 });
db.complaint_actions.createIndex({ 'assigned_to': 1 });
db.complaint_actions.createIndex({ 'status': 1 });
db.complaint_actions.createIndex({ 'created_at': -1 });

// ============================================================================
// CAPA/DÖF (Düzeltici Önleyici Faaliyetler)
// ============================================================================

db.createCollection('capas');
db.capas.createIndex({ 'capa_no': 1 }, { unique: true });
db.capas.createIndex({ 'source': 1 });
db.capas.createIndex({ 'status': 1 });
db.capas.createIndex({ 'department_id': 1 });
db.capas.createIndex({ 'team_leader': 1 });
db.capas.createIndex({ 'created_by': 1 });
db.capas.createIndex({ 'created_at': -1 });
db.capas.createIndex({ 'updated_at': -1 });
db.capas.createIndex({ 'target_date': 1 });
// Text search
db.capas.createIndex({ 
  'title': 'text', 
  'nonconformity_description': 'text',
  'root_cause': 'text'
}, { name: 'capa_text_search' });

// CAPA aksiyonları
db.createCollection('capa_actions');
db.capa_actions.createIndex({ 'capa_id': 1 });
db.capa_actions.createIndex({ 'action_no': 1 });
db.capa_actions.createIndex({ 'assigned_to': 1 });
db.capa_actions.createIndex({ 'status': 1 });
db.capa_actions.createIndex({ 'action_type': 1 });
db.capa_actions.createIndex({ 'created_at': -1 });
db.capa_actions.createIndex({ 'due_date': 1 });

// CAPA ekibi
db.createCollection('capa_teams');
db.capa_teams.createIndex({ 'capa_id': 1 });
db.capa_teams.createIndex({ 'member_id': 1 });
db.capa_teams.createIndex({ 'role': 1 });

// ============================================================================
// DENETİM (AUDIT)
// ============================================================================

db.createCollection('audits');
db.audits.createIndex({ 'audit_code': 1 }, { unique: true });
db.audits.createIndex({ 'audit_type': 1 });
db.audits.createIndex({ 'status': 1 });
db.audits.createIndex({ 'lead_auditor_id': 1 });
db.audits.createIndex({ 'auditee_id': 1 });
db.audits.createIndex({ 'department_id': 1 });
db.audits.createIndex({ 'audit_date': 1 });
db.audits.createIndex({ 'created_at': -1 });
db.audits.createIndex({ 'updated_at': -1 });
// Text search
db.audits.createIndex({ 
  'subject': 'text', 
  'scope': 'text'
}, { name: 'audit_text_search' });

// Denetim ekibi
db.createCollection('audit_teams');
db.audit_teams.createIndex({ 'audit_id': 1 });
db.audit_teams.createIndex({ 'member_id': 1 });
db.audit_teams.createIndex({ 'role': 1 });

// Denetim soruları
db.createCollection('audit_questions');
db.audit_questions.createIndex({ 'category': 1 });
db.audit_questions.createIndex({ 'is_active': 1 });
db.audit_questions.createIndex({ 'created_at': -1 });

// Denetim cevapları
db.createCollection('audit_answers');
db.audit_answers.createIndex({ 'audit_id': 1 });
db.audit_answers.createIndex({ 'question_id': 1 });
db.audit_answers.createIndex({ 'is_compliant': 1 });
db.audit_answers.createIndex({ 'created_at': -1 });

// Denetim bulguları
db.createCollection('audit_findings');
db.audit_findings.createIndex({ 'audit_id': 1 });
db.audit_findings.createIndex({ 'finding_type': 1 }); // major/minor/observation
db.audit_findings.createIndex({ 'status': 1 });
db.audit_findings.createIndex({ 'created_at': -1 });

// ============================================================================
// RİSK DEĞERLENDİRME
// ============================================================================

db.createCollection('risks');
db.risks.createIndex({ 'risk_code': 1 }, { unique: true });
db.risks.createIndex({ 'risk_model': 1 });
db.risks.createIndex({ 'status': 1 });
db.risks.createIndex({ 'risk_level': 1 }); // low/medium/high/critical
db.risks.createIndex({ 'department_id': 1 });
db.risks.createIndex({ 'owner_id': 1 });
db.risks.createIndex({ 'risk_score': -1 });
db.risks.createIndex({ 'created_at': -1 });
db.risks.createIndex({ 'updated_at': -1 });
db.risks.createIndex({ 'review_date': 1 });
// Text search
db.risks.createIndex({ 
  'title': 'text', 
  'description': 'text',
  'consequence': 'text'
}, { name: 'risk_text_search' });

// Risk değerlendirme formları
db.createCollection('risk_forms');
db.risk_forms.createIndex({ 'form_code': 1 }, { unique: true });
db.risk_forms.createIndex({ 'risk_model': 1 });
db.risk_forms.createIndex({ 'is_active': 1 });
db.risk_forms.createIndex({ 'created_at': -1 });

// Risk önlemleri
db.createCollection('risk_controls');
db.risk_controls.createIndex({ 'risk_id': 1 });
db.risk_controls.createIndex({ 'control_type': 1 }); // preventive/detective/corrective
db.risk_controls.createIndex({ 'effectiveness': 1 });
db.risk_controls.createIndex({ 'responsible_id': 1 });
db.risk_controls.createIndex({ 'status': 1 });
db.risk_controls.createIndex({ 'created_at': -1 });

// Risk revizyonları
db.createCollection('risk_revisions');
db.risk_revisions.createIndex({ 'risk_id': 1 });
db.risk_revisions.createIndex({ 'revision_no': 1 });
db.risk_revisions.createIndex({ 'created_by': 1 });
db.risk_revisions.createIndex({ 'created_at': -1 });

// ============================================================================
// KALİBRASYON / CİHAZ YÖNETİMİ
// ============================================================================

db.createCollection('devices');
db.devices.createIndex({ 'device_code': 1 }, { unique: true });
db.devices.createIndex({ 'device_name': 1 });
db.devices.createIndex({ 'device_type': 1 });
db.devices.createIndex({ 'department_id': 1 });
db.devices.createIndex({ 'location': 1 });
db.devices.createIndex({ 'responsible_id': 1 });
db.devices.createIndex({ 'status': 1 }); // active/maintenance/retired
db.devices.createIndex({ 'created_at': -1 });
// Text search
db.devices.createIndex({ 
  'device_code': 'text', 
  'device_name': 'text',
  'manufacturer': 'text'
}, { name: 'device_text_search' });

// Kalibrasyon işlemleri
db.createCollection('calibrations');
db.calibrations.createIndex({ 'device_id': 1 });
db.calibrations.createIndex({ 'calibration_no': 1 }, { unique: true });
db.calibrations.createIndex({ 'operation_type': 1 }); // calibration/verification/maintenance
db.calibrations.createIndex({ 'status': 1 });
db.calibrations.createIndex({ 'responsible_id': 1 });
db.calibrations.createIndex({ 'performed_date': 1 });
db.calibrations.createIndex({ 'next_due_date': 1 });
db.calibrations.createIndex({ 'is_passed': 1 });
db.calibrations.createIndex({ 'created_at': -1 });

// Kalibrasyon ölçüm değerleri
db.createCollection('calibration_measurements');
db.calibration_measurements.createIndex({ 'calibration_id': 1 });
db.calibration_measurements.createIndex({ 'measurement_point': 1 });
db.calibration_measurements.createIndex({ 'is_within_tolerance': 1 });
db.calibration_measurements.createIndex({ 'created_at': -1 });

// Cihaz bakım kayıtları
db.createCollection('device_maintenances');
db.device_maintenances.createIndex({ 'device_id': 1 });
db.device_maintenances.createIndex({ 'maintenance_type': 1 });
db.device_maintenances.createIndex({ 'performed_by': 1 });
db.device_maintenances.createIndex({ 'performed_date': 1 });
db.device_maintenances.createIndex({ 'created_at': -1 });

// ============================================================================
// DOSYA YÖNETİMİ
// ============================================================================

db.createCollection('files');
db.files.createIndex({ 'file_hash': 1 });
db.files.createIndex({ 'filename': 1 });
db.files.createIndex({ 'mime_type': 1 });
db.files.createIndex({ 'uploaded_by': 1 });
db.files.createIndex({ 'module': 1 }); // document/complaint/capa/audit/risk/calibration
db.files.createIndex({ 'ref_id': 1 }); // İlgili kaydın ID'si
db.files.createIndex({ 'created_at': -1 });
db.files.createIndex({ 'size': 1 });

// ============================================================================
// BİLDİRİM VE GÖREV YÖNETİMİ
// ============================================================================

db.createCollection('notifications');
db.notifications.createIndex({ 'user_id': 1 });
db.notifications.createIndex({ 'type': 1 });
db.notifications.createIndex({ 'is_read': 1 });
db.notifications.createIndex({ 'priority': 1 });
db.notifications.createIndex({ 'created_at': -1 });
db.notifications.createIndex({ 'expires_at': 1 }, { expireAfterSeconds: 0 }); // TTL index

db.createCollection('tasks');
db.tasks.createIndex({ 'task_no': 1 }, { unique: true });
db.tasks.createIndex({ 'assigned_to': 1 });
db.tasks.createIndex({ 'created_by': 1 });
db.tasks.createIndex({ 'module': 1 });
db.tasks.createIndex({ 'ref_id': 1 });
db.tasks.createIndex({ 'status': 1 });
db.tasks.createIndex({ 'priority': 1 });
db.tasks.createIndex({ 'due_date': 1 });
db.tasks.createIndex({ 'created_at': -1 });

// ============================================================================
// RAPORLAMA VE ANALİTİK
// ============================================================================

db.createCollection('reports');
db.reports.createIndex({ 'report_code': 1 }, { unique: true });
db.reports.createIndex({ 'module': 1 });
db.reports.createIndex({ 'report_type': 1 });
db.reports.createIndex({ 'created_by': 1 });
db.reports.createIndex({ 'created_at': -1 });
db.reports.createIndex({ 'is_scheduled': 1 });

db.createCollection('report_templates');
db.report_templates.createIndex({ 'name': 1 }, { unique: true });
db.report_templates.createIndex({ 'module': 1 });
db.report_templates.createIndex({ 'is_active': 1 });
db.report_templates.createIndex({ 'created_at': -1 });

// ============================================================================
// SİSTEM AYARLARI VE LOG
// ============================================================================

db.createCollection('system_settings');
db.system_settings.createIndex({ 'key': 1 }, { unique: true });
db.system_settings.createIndex({ 'category': 1 });
db.system_settings.createIndex({ 'updated_at': -1 });

db.createCollection('audit_logs');
db.audit_logs.createIndex({ 'user_id': 1 });
db.audit_logs.createIndex({ 'action': 1 });
db.audit_logs.createIndex({ 'module': 1 });
db.audit_logs.createIndex({ 'ip_address': 1 });
db.audit_logs.createIndex({ 'timestamp': -1 });
// TTL index - 1 yıl sonra otomatik sil
db.audit_logs.createIndex({ 'timestamp': 1 }, { expireAfterSeconds: 31536000 });

// ============================================================================
// İŞ AKIŞI (WORKFLOW)
// ============================================================================

db.createCollection('workflows');
db.workflows.createIndex({ 'name': 1 }, { unique: true });
db.workflows.createIndex({ 'module': 1 });
db.workflows.createIndex({ 'is_active': 1 });
db.workflows.createIndex({ 'created_at': -1 });

db.createCollection('workflow_instances');
db.workflow_instances.createIndex({ 'workflow_id': 1 });
db.workflow_instances.createIndex({ 'ref_id': 1 });
db.workflow_instances.createIndex({ 'current_step': 1 });
db.workflow_instances.createIndex({ 'status': 1 });
db.workflow_instances.createIndex({ 'created_at': -1 });

db.createCollection('workflow_steps');
db.workflow_steps.createIndex({ 'instance_id': 1 });
db.workflow_steps.createIndex({ 'step_name': 1 });
db.workflow_steps.createIndex({ 'assigned_to': 1 });
db.workflow_steps.createIndex({ 'status': 1 });
db.workflow_steps.createIndex({ 'created_at': -1 });
db.workflow_steps.createIndex({ 'completed_at': 1 });

print('✅ QDMS veritabanı başarıyla oluşturuldu!');
print('✅ Tüm koleksiyonlar ve index\'ler tanımlandı!');
print('📊 Toplam koleksiyon sayısı: ' + db.getCollectionNames().length);
