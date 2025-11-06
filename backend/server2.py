<artifacts>
<artifact type="application/vnd.ant.code" language="python" title="Backend - Eksik Modüller (server.py eklentileri)" id="backend_modules">
# ========== DENETIM YÖNETİMİ MODÜLÜ ==========
Audit Models
class AuditQuestion(BaseModel):
id: str = Field(default_factory=lambda: str(uuid.uuid4()))
category: str
question: str
expected_answer: Optional[str] = None
weight: int = 1
is_active: bool = True
class AuditResponse(BaseModel):
question_id: str
question_text: str
response: str
status: str  # compliant, non-compliant, observation
evidence: Optional[str] = None
comments: Optional[str] = None
class AuditFinding(BaseModel):
id: str = Field(default_factory=lambda: str(uuid.uuid4()))
finding_type: str  # major, minor, observation
description: str
requirement: str
evidence: Optional[str] = None
corrective_action_required: bool = False
capa_id: Optional[str] = None
class Audit(BaseModel):
id: str = Field(default_factory=lambda: str(uuid.uuid4()))
audit_no: str
audit_type: str  # internal, external, supplier, customer
audit_date: datetime
audit_end_date: Optional[datetime] = None
department: str
audited_area: str
lead_auditor: str
audit_team: List[str] = []
auditee_representative: str
status: str = "planned"  # planned, in_progress, completed, cancelled
scope: str
criteria: str  # ISO 9001, ISO 14001, etc.
objectives: Optional[str] = None
responses: List[AuditResponse] = []
findings: List[AuditFinding] = []
file_attachments: List[str] = []
final_report: Optional[str] = None
created_by: str
created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
class AuditCreate(BaseModel):
audit_type: str
audit_date: datetime
department: str
audited_area: str
lead_auditor: str
audit_team: List[str]
auditee_representative: str
scope: str
criteria: str
objectives: Optional[str] = None
========== RİSK DEĞERLENDİRME MODÜLÜ ==========
class RiskControl(BaseModel):
id: str = Field(default_factory=lambda: str(uuid.uuid4()))
control_type: str  # preventive, detective, corrective
description: str
effectiveness: int  # 1-5
implementation_status: str  # implemented, planned, not_implemented
class RiskMitigation(BaseModel):
id: str = Field(default_factory=lambda: str(uuid.uuid4()))
action: str
responsible_person: str
target_date: datetime
status: str = "open"
completion_date: Optional[datetime] = None
evidence: Optional[str] = None
class RiskAssessment(BaseModel):
id: str = Field(default_factory=lambda: str(uuid.uuid4()))
risk_no: str
title: str
risk_category: str  # operational, financial, compliance, strategic, safety
department: str
location: Optional[str] = None
risk_source: str
risk_description: str
asset_value: Optional[float] = None
threat_likelihood: int  # 1-5
impact_severity: int  # 1-5
risk_score: int  # auto-calculated
risk_level: str  # auto-calculated: low, medium, high, critical
risk_trend: str = "stable"  # increasing, decreasing, stable
existing_controls: List[RiskControl] = []
residual_likelihood: Optional[int] = None
residual_impact: Optional[int] = None
residual_risk_score: Optional[int] = None
residual_risk_level: Optional[str] = None
mitigation_strategy: str  # accept, avoid, transfer, mitigate
mitigation_actions: List[RiskMitigation] = []
review_date: Optional[datetime] = None
next_review_date: Optional[datetime] = None
owner: str
status: str = "active"  # active, closed, monitoring
revision: int = 1
previous_revisions: List[Dict] = []
file_attachments: List[str] = []
related_capa_ids: List[str] = []
created_by: str
created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
class RiskAssessmentCreate(BaseModel):
title: str
risk_category: str
department: str
location: Optional[str] = None
risk_source: str
risk_description: str
asset_value: Optional[float] = None
threat_likelihood: int
impact_severity: int
owner: str
========== CİHAZ YÖNETİMİ (KALİBRASYON) MODÜLÜ ==========
class CalibrationRecord(BaseModel):
id: str = Field(default_factory=lambda: str(uuid.uuid4()))
calibration_date: datetime
next_calibration_date: datetime
performed_by: str
calibration_type: str  # internal, external
certificate_no: Optional[str] = None
results: str  # pass, fail, conditional
measurements: List[Dict[str, Any]] = []
deviations: Optional[str] = None
corrective_actions: Optional[str] = None
file_attachments: List[str] = []
class MaintenanceRecord(BaseModel):
id: str = Field(default_factory=lambda: str(uuid.uuid4()))
maintenance_date: datetime
maintenance_type: str  # preventive, corrective, predictive
performed_by: str
description: str
parts_replaced: Optional[List[str]] = None
cost: Optional[float] = None
downtime_hours: Optional[float] = None
next_maintenance_date: Optional[datetime] = None
class WorkOrder(BaseModel):
id: str = Field(default_factory=lambda: str(uuid.uuid4()))
work_order_no: str
equipment_id: str
work_type: str  # calibration, maintenance, validation
priority: str  # low, medium, high, critical
status: str = "open"  # open, in_progress, completed, cancelled
scheduled_date: datetime
assigned_to: str
completion_date: Optional[datetime] = None
notes: Optional[str] = None
created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
class Equipment(BaseModel):
id: str = Field(default_factory=lambda: str(uuid.uuid4()))
equipment_no: str
name: str
equipment_type: str  # measuring, testing, production
manufacturer: str
model: str
serial_number: str
department: str
location: str
status: str = "active"  # active, inactive, maintenance, calibration, retired
purchase_date: Optional[datetime] = None
purchase_cost: Optional[float] = None
warranty_expiry: Optional[datetime] = None
calibration_required: bool = True
calibration_frequency_months: Optional[int] = None
last_calibration_date: Optional[datetime] = None
next_calibration_date: Optional[datetime] = None
calibration_records: List[CalibrationRecord] = []
maintenance_frequency_months: Optional[int] = None
last_maintenance_date: Optional[datetime] = None
next_maintenance_date: Optional[datetime] = None
maintenance_records: List[MaintenanceRecord] = []
reference_values: Dict[str, Any] = {}
acceptable_tolerance: Dict[str, Any] = {}
responsible_person: str
work_orders: List[str] = []  # Work Order IDs
file_attachments: List[str] = []
related_capa_ids: List[str] = []
created_by: str
created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
class EquipmentCreate(BaseModel):
name: str
equipment_type: str
manufacturer: str
model: str
serial_number: str
department: str
location: str
purchase_date: Optional[datetime] = None
purchase_cost: Optional[float] = None
calibration_required: bool = True
calibration_frequency_months: Optional[int] = 12
responsible_person: str
========== HELPER FUNCTIONS ==========
async def generate_audit_no() -> str:
count = await db.audits.count_documents({})
return f"AUD-{datetime.now().year}-{count + 1:04d}"
async def generate_risk_no() -> str:
count = await db.risk_assessments.count_documents({})
return f"RISK-{datetime.now().year}-{count + 1:04d}"
async def generate_equipment_no() -> str:
count = await db.equipments.count_documents({})
return f"EQP-{datetime.now().year}-{count + 1:04d}"
async def generate_work_order_no() -> str:
count = await db.work_orders.count_documents({})
return f"WO-{datetime.now().year}-{count + 1:04d}"
def calculate_risk_score(likelihood: int, impact: int) -> tuple[int, str]:
"""Calculate risk score and level"""
score = likelihood * impact
if score <= 4:
level = "low"
elif score <= 9:
level = "medium"
elif score <= 15:
level = "high"
else:
level = "critical"
return score, level
========== AUDIT ROUTES ==========
@api_router.get("/audits", response_model=List[Audit])
async def get_audits(current_user: User = Depends(get_current_user)):
audits = await db.audits.find({}).sort("audit_date", -1).to_list(100)
return [Audit(**audit) for audit in audits]
@api_router.post("/audits", response_model=Audit)
async def create_audit(audit_data: AuditCreate, current_user: User = Depends(get_current_user)):
audit_no = await generate_audit_no()
audit_dict = audit_data.dict()
audit_dict["audit_no"] = audit_no
audit_dict["created_by"] = current_user.id

audit_obj = Audit(**audit_dict)

await db.audits.insert_one(audit_obj.dict())

# Create notification
notification = Notification(
    user_id=current_user.id,
    title="Yeni Denetim Planlandı",
    message=f"#{audit_obj.audit_no} numaralı denetim oluşturuldu",
    type="info"
)
await db.notifications.insert_one(notification.dict())

return audit_obj
@api_router.get("/audits/{audit_id}", response_model=Audit)
async def get_audit(audit_id: str, current_user: User = Depends(get_current_user)):
audit = await db.audits.find_one({"id": audit_id})
if not audit:
raise HTTPException(status_code=404, detail="Audit not found")
return Audit(**audit)
@api_router.put("/audits/{audit_id}/responses")
async def add_audit_responses(
audit_id: str,
responses: List[AuditResponse],
current_user: User = Depends(get_current_user)
):
audit = await db.audits.find_one({"id": audit_id})
if not audit:
raise HTTPException(status_code=404, detail="Audit not found")
await db.audits.update_one(
    {"id": audit_id},
    {
        "$set": {
            "responses": [r.dict() for r in responses],
            "status": "in_progress",
            "updated_at": datetime.now(timezone.utc)
        }
    }
)

return {"message": "Audit responses added successfully"}
@api_router.post("/audits/{audit_id}/findings")
async def add_audit_finding(
audit_id: str,
finding: AuditFinding,
current_user: User = Depends(get_current_user)
):
audit = await db.audits.find_one({"id": audit_id})
if not audit:
raise HTTPException(status_code=404, detail="Audit not found")
# If corrective action required, create CAPA
if finding.corrective_action_required:
    capa_no = await generate_capa_no()
    capa = Capa(
        capa_no=capa_no,
        title=f"Denetim Bulgusu - {audit['audit_no']}",
        source="internal_audit",
        department=audit["department"],
        initiated_by=current_user.id,
        team_leader=audit["lead_auditor"],
        nonconformity_description=finding.description
    )
    await db.capas.insert_one(capa.dict())
    finding.capa_id = capa.id

await db.audits.update_one(
    {"id": audit_id},
    {
        "$push": {"findings": finding.dict()},
        "$set": {"updated_at": datetime.now(timezone.utc)}
    }
)

return {"message": "Finding added successfully", "capa_id": finding.capa_id}
========== RISK ASSESSMENT ROUTES ==========
@api_router.get("/risk-assessments", response_model=List[RiskAssessment])
async def get_risk_assessments(current_user: User = Depends(get_current_user)):
risks = await db.risk_assessments.find({}).sort("risk_score", -1).to_list(100)
return [RiskAssessment(**risk) for risk in risks]
@api_router.post("/risk-assessments", response_model=RiskAssessment)
async def create_risk_assessment(
risk_data: RiskAssessmentCreate,
current_user: User = Depends(get_current_user)
):
risk_no = await generate_risk_no()
risk_dict = risk_data.dict()
risk_dict["risk_no"] = risk_no
risk_dict["created_by"] = current_user.id

# Calculate initial risk score and level
score, level = calculate_risk_score(
    risk_dict["threat_likelihood"],
    risk_dict["impact_severity"]
)
risk_dict["risk_score"] = score
risk_dict["risk_level"] = level

risk_obj = RiskAssessment(**risk_dict)

await db.risk_assessments.insert_one(risk_obj.dict())

# Create notification for high/critical risks
if level in ["high", "critical"]:
    notification = Notification(
        user_id=current_user.id,
        title=f"Yüksek Risk Tespit Edildi",
        message=f"#{risk_obj.risk_no} - {risk_obj.title} ({level.upper()})",
        type="warning"
    )
    await db.notifications.insert_one(notification.dict())

return risk_obj
@api_router.get("/risk-assessments/{risk_id}", response_model=RiskAssessment)
async def get_risk_assessment(risk_id: str, current_user: User = Depends(get_current_user)):
risk = await db.risk_assessments.find_one({"id": risk_id})
if not risk:
raise HTTPException(status_code=404, detail="Risk assessment not found")
return RiskAssessment(**risk)
@api_router.put("/risk-assessments/{risk_id}/controls")
async def add_risk_controls(
risk_id: str,
controls: List[RiskControl],
current_user: User = Depends(get_current_user)
):
risk = await db.risk_assessments.find_one({"id": risk_id})
if not risk:
raise HTTPException(status_code=404, detail="Risk assessment not found")
await db.risk_assessments.update_one(
    {"id": risk_id},
    {
        "$set": {
            "existing_controls": [c.dict() for c in controls],
            "updated_at": datetime.now(timezone.utc)
        }
    }
)

return {"message": "Controls added successfully"}
@api_router.put("/risk-assessments/{risk_id}/mitigation")
async def update_risk_mitigation(
risk_id: str,
strategy: str,
actions: List[RiskMitigation],
residual_likelihood: int,
residual_impact: int,
current_user: User = Depends(get_current_user)
):
risk = await db.risk_assessments.find_one({"id": risk_id})
if not risk:
raise HTTPException(status_code=404, detail="Risk assessment not found")
# Calculate residual risk
residual_score, residual_level = calculate_risk_score(
    residual_likelihood,
    residual_impact
)

await db.risk_assessments.update_one(
    {"id": risk_id},
    {
        "$set": {
            "mitigation_strategy": strategy,
            "mitigation_actions": [a.dict() for a in actions],
            "residual_likelihood": residual_likelihood,
            "residual_impact": residual_impact,
            "residual_risk_score": residual_score,
            "residual_risk_level": residual_level,
            "updated_at": datetime.now(timezone.utc)
        }
    }
)

return {"message": "Mitigation plan updated successfully"}
@api_router.post("/risk-assessments/{risk_id}/create-capa")
async def create_capa_from_risk(
risk_id: str,
current_user: User = Depends(get_current_user)
):
risk = await db.risk_assessments.find_one({"id": risk_id})
if not risk:
raise HTTPException(status_code=404, detail="Risk assessment not found")
capa_no = await generate_capa_no()
capa = Capa(
    capa_no=capa_no,
    title=f"Risk Azaltma - {risk['title']}",
    source="risk_assessment",
    department=risk["department"],
    initiated_by=current_user.id,
    team_leader=risk["owner"],
    nonconformity_description=f"Risk: {risk['risk_description']} (Seviye: {risk['risk_level']})"
)

await db.capas.insert_one(capa.dict())

# Link CAPA to risk
await db.risk_assessments.update_one(
    {"id": risk_id},
    {
        "$push": {"related_capa_ids": capa.id},
        "$set": {"updated_at": datetime.now(timezone.utc)}
    }
)

return {"message": "CAPA created successfully", "capa_id": capa.id}
========== EQUIPMENT MANAGEMENT ROUTES ==========
@api_router.get("/equipment", response_model=List[Equipment])
async def get_equipment_list(current_user: User = Depends(get_current_user)):
equipment = await db.equipments.find({}).sort("next_calibration_date", 1).to_list(100)
return [Equipment(**eq) for eq in equipment]
@api_router.post("/equipment", response_model=Equipment)
async def create_equipment(
equipment_data: EquipmentCreate,
current_user: User = Depends(get_current_user)
):
equipment_no = await generate_equipment_no()
equipment_dict = equipment_data.dict()
equipment_dict["equipment_no"] = equipment_no
equipment_dict["created_by"] = current_user.id

# Calculate next calibration date
if equipment_dict["calibration_required"] and equipment_dict.get("calibration_frequency_months"):
    equipment_dict["next_calibration_date"] = datetime.now(timezone.utc) + timedelta(
        days=30 * equipment_dict["calibration_frequency_months"]
    )

equipment_obj = Equipment(**equipment_dict)

await db.equipments.insert_one(equipment_obj.dict())

# Create initial work order if calibration required
if equipment_obj.calibration_required and equipment_obj.next_calibration_date:
    work_order_no = await generate_work_order_no()
    work_order = WorkOrder(
        work_order_no=work_order_no,
        equipment_id=equipment_obj.id,
        work_type="calibration",
        priority="medium",
        scheduled_date=equipment_obj.next_calibration_date,
        assigned_to=equipment_obj.responsible_person
    )
    await db.work_orders.insert_one(work_order.dict())
    
    # Update equipment with work order
    await db.equipments.update_one(
        {"id": equipment_obj.id},
        {"$push": {"work_orders": work_order.id}}
    )

return equipment_obj
@api_router.get("/equipment/{equipment_id}", response_model=Equipment)
async def get_equipment(equipment_id: str, current_user: User = Depends(get_current_user)):
equipment = await db.equipments.find_one({"id": equipment_id})
if not equipment:
raise HTTPException(status_code=404, detail="Equipment not found")
return Equipment(**equipment)
@api_router.post("/equipment/{equipment_id}/calibration")
async def add_calibration_record(
equipment_id: str,
record: CalibrationRecord,
current_user: User = Depends(get_current_user)
):
equipment = await db.equipments.find_one({"id": equipment_id})
if not equipment:
raise HTTPException(status_code=404, detail="Equipment not found")
# Update equipment
update_data = {
    "$push": {"calibration_records": record.dict()},
    "$set": {
        "last_calibration_date": record.calibration_date,
        "next_calibration_date": record.next_calibration_date,
        "status": "active" if record.results == "pass" else "maintenance",
        "updated_at": datetime.now(timezone.utc)
    }
}

await db.equipments.update_one({"id": equipment_id}, update_data)

# Create CAPA if calibration failed
if record.results == "fail":
    capa_no = await generate_capa_no()
    capa = Capa(
        capa_no=capa_no,
        title=f"Kalibrasyon Hatası - {equipment['name']}",
        source="calibration",
        department=equipment["department"],
        initiated_by=current_user.id,
        team_leader=equipment["responsible_person"],
        nonconformity_description=f"Cihaz kalibrasyonu başarısız: {record.deviations}"
    )
    await db.capas.insert_one(capa.dict())
    
    # Link CAPA to equipment
    await db.equipments.update_one(
        {"id": equipment_id},
        {"$push": {"related_capa_ids": capa.id}}
    )

# Schedule next calibration work order
if record.next_calibration_date:
    work_order_no = await generate_work_order_no()
    work_order = WorkOrder(
        work_order_no=work_order_no,
        equipment_id=equipment_id,
        work_type="calibration",
        priority="medium",
        scheduled_date=record.next_calibration_date,
        assigned_to=equipment["responsible_person"]
    )
    await db.work_orders.insert_one(work_order.dict())

return {"message": "Calibration record added successfully"}
@api_router.get("/work-orders", response_model=List[WorkOrder])
async def get_work_orders(
status: Optional[str] = None,
current_user: User = Depends(get_current_user)
):
query = {}
if status:
query["status"] = status
work_orders = await db.work_orders.find(query).sort("scheduled_date", 1).to_list(100)
return [WorkOrder(**wo) for wo in work_orders]
@api_router.put("/work-orders/{work_order_id}/complete")
async def complete_work_order(
work_order_id: str,
notes: Optional[str] = None,
current_user: User = Depends(get_current_user)
):
await db.work_orders.update_one(
{"id": work_order_id},
{
"$set": {
"status": "completed",
"completion_date": datetime.now(timezone.utc),
"notes": notes
}
}
)
return {"message": "Work order completed successfully"}
========== REPORTING ROUTES ==========
@api_router.get("/reports/dashboard-advanced")
async def get_advanced_dashboard_stats(current_user: User = Depends(get_current_user)):
"""Get comprehensive dashboard statistics"""
# Risk statistics
total_risks = await db.risk_assessments.count_documents({})
high_critical_risks = await db.risk_assessments.count_documents({
    "risk_level": {"$in": ["high", "critical"]},
    "status": "active"
})

# Audit statistics
total_audits = await db.audits.count_documents({})
planned_audits = await db.audits.count_documents({"status": "planned"})
audit_findings = await db.audits.aggregate([
    {"$unwind": "$findings"},
    {"$group": {"_id": "$findings.finding_type", "count": {"$sum": 1}}}
]).to_list(10)

# Equipment statistics
total_equipment = await db.equipments.count_documents({})
calibration_due = await db.equipments.count_documents({
    "next_calibration_date": {"$lte": datetime.now(timezone.utc) + timedelta(days=30)},
    "calibration_required": True
})

# Work order statistics
open_work_orders = await db.work_orders.count_documents({"status": "open"})
overdue_work_orders = await db.work_orders.count_documents({
    "status": {"$in": ["open", "in_progress"]},
    "scheduled_date": {"$lt": datetime.now(timezone.utc)}
})

# Risk heat map data
risk_matrix = await db.risk_assessments.aggregate([
    {"$match": {"status": "active"}},
    {
        "$group": {
            "_id": {
                "likelihood": "$threat_likelihood",
                "impact": "$impact_severity"
            },
            "count": {"$sum": 1},
            "risks": {"$push": {"title": "$title", "risk_no": "$risk_no"}}
        }
    }
]).to_list(25)

# Monthly trend data
monthly_trends = await db.capas.aggregate([
    {
        "$group": {
            "_id": {
                "$dateToString": {"format": "%Y-%m", "date": "$created_at"}
            },
            "capas": {"$sum": 1}
        }
    },
    {"$sort": {"_id": 1}},
    {"$limit": 12}
]).to_list(12)

return {
    "risks": {
        "total": total_risks,
        "high_critical": high_critical_risks,
        "heat_map": risk_matrix
    },
    "audits": {
        "total": total_audits,
        "planned": planned_audits,
        "findings_by_type": audit_findings
    },
    "equipment": {
        "total": total_equipment,
        "calibration_due": calibration_due
    },
    "work_orders": {
        "open": open_work_orders,
        "overdue": overdue_work_orders
    },
    "monthly_trends": monthly_trends,
    "generated_at": datetime.now(timezone.utc)
}
@api_router.get("/reports/risk-matrix")
async def get_risk_matrix_report(current_user: User = Depends(get_current_user)):
"""Generate risk matrix report"""
risks = await db.risk_assessments.find({"status": "active"}).to_list(1000)

matrix = {}
for likelihood in range(1, 6):
    matrix[likelihood] = {}
    for impact in range(1, 6):
        matrix[likelihood][impact] = {
            "count": 0,
            "risks": []
        }

for risk in risks:
    l = risk["threat_likelihood"]
    i = risk["impact_severity"]
    matrix[l][i]["count"] += 1
    matrix[l][i]["risks"].append({
        "risk_no": risk["risk_no"],
        "title": risk["title"],
        "department": risk["department"]
    })

return {
    "matrix": matrix,
    "total_risks": len(risks),
    "generated_at": datetime.now(timezone.utc)
}
@api_router.get("/reports/equipment-calibration-schedule")
async def get_calibration_schedule_report(
months_ahead: int = 3,
current_user: User = Depends(get_current_user)
):
"""Generate calibration schedule report"""
end_date = datetime.now(timezone.utc) + timedelta(days=30 * months_ahead)

equipment_due = await db.equipments.find({
    "calibration_required": True,
    "next_calibration_date": {"$lte": end_date}
}).sort("next_calibration_date", 1).to_list(100)

schedule = []
for eq in equipment_due:
    schedule.append({
        "equipment_no": eq["equipment_no"],
        "name": eq["name"],
        "department": eq["department"],
        "location": eq["location"],
        "next_calibration_date": eq["next_calibration_date"],
        "responsible_person": eq["responsible_person"],
        "days_until_due": (eq["next_calibration_date"] - datetime.now(timezone.utc)).days
    })

return {
    "schedule": schedule,
    "total_equipment": len(schedule),
    "period": f"Next {months_ahead} months",
    "generated_at": datetime.now(timezone.utc)
}
</artifact>
</artifacts>