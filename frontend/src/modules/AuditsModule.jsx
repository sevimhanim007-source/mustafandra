import { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Textarea } from "../components/ui/Textarea";
import { Select, SelectOption } from "../components/ui/Select";
import { Badge } from "../components/ui/Badge";
import { useApiConnection } from "./useApiConnection";
import { formatDate, formatDateTime } from "./formatters";

const AUDIT_STATUS_OPTIONS = [
  { value: "planned", label: "Planned" },
  { value: "in_progress", label: "In Progress" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

const FINDING_TYPE_OPTIONS = [
  { value: "observation", label: "Observation" },
  { value: "minor", label: "Minor" },
  { value: "major", label: "Major" },
  { value: "critical", label: "Critical" },
];

const FINDING_STATUS_OPTIONS = [
  { value: "open", label: "Open" },
  { value: "in_progress", label: "In Progress" },
  { value: "closed", label: "Closed" },
];

const emptyTeamDraft = { user_id: "", role: "", full_name: "" };
const emptyChecklistDraft = { question_id: "", question: "" };

const parseCommaSeparatedList = (value) =>
  (value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

const formatTeamMember = (member) => {
  if (!member) return "";
  const pieces = [member.full_name || member.user_id];
  if (member.role) {
    pieces.push(`(${member.role})`);
  }
  return pieces.join(" ");
};

const buildFindingEditState = (audit) => {
  if (!audit?.findings?.length) {
    return {};
  }
  const edits = {};
  audit.findings.forEach((item) => {
    edits[item.id] = {
      finding_type: item.finding_type || "minor",
      status: item.status || "open",
      description: item.description || "",
      requirement_reference: item.requirement_reference || "",
      related_capa_id: item.related_capa_id || "",
      corrective_action: item.corrective_action || "",
    };
  });
  return edits;
};
const AuditsModule = () => {
  const { apiUrl, headers, isReady, authDisabled, refresh } = useApiConnection();

  const [audits, setAudits] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [filters, setFilters] = useState({
    status: "",
    department: "",
    search: "",
  });

  const [selectedAuditId, setSelectedAuditId] = useState("");
  const [selectedAudit, setSelectedAudit] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");

  const [questions, setQuestions] = useState([]);
  const [questionLoading, setQuestionLoading] = useState(false);
  const [questionError, setQuestionError] = useState("");
  const [questionForm, setQuestionForm] = useState({
    question: "",
    category: "",
    requirement_reference: "",
    tags: "",
    is_active: true,
  });
  const [questionSaving, setQuestionSaving] = useState(false);
  const [editingQuestionId, setEditingQuestionId] = useState("");

  const [capaLookup, setCapaLookup] = useState([]);

  const [auditForm, setAuditForm] = useState({
    audit_type: "",
    scope: "",
    department: "",
    lead_auditor: "",
    start_date: "",
    end_date: "",
    auditee_representative: "",
    objectives: "",
    team: [],
    checklist: [],
  });
  const [teamDraft, setTeamDraft] = useState(emptyTeamDraft);
  const [checklistDraft, setChecklistDraft] = useState(emptyChecklistDraft);
  const [auditSaving, setAuditSaving] = useState(false);
  const [auditError, setAuditError] = useState("");
  const [auditSuccess, setAuditSuccess] = useState("");

  const [statusUpdate, setStatusUpdate] = useState({ status: "", note: "" });
  const [statusSaving, setStatusSaving] = useState(false);
  const [statusError, setStatusError] = useState("");

  const [findingForm, setFindingForm] = useState({
    finding_type: "minor",
    description: "",
    requirement_reference: "",
    related_capa_id: "",
    corrective_action: "",
  });
  const [findingSaving, setFindingSaving] = useState(false);
  const [findingError, setFindingError] = useState("");
  const [findingSuccess, setFindingSuccess] = useState("");
  const [findingEdits, setFindingEdits] = useState({});

  const fetchAudits = useCallback(async () => {
    if (!isReady) return;
    setLoading(true);
    setError("");
    try {
      const params = {};
      if (filters.status) params.status = filters.status;
      if (filters.department) params.department = filters.department;
      if (filters.search) params.search = filters.search;
      const { data } = await axios.get(`${apiUrl}/audits`, {
        headers,
        params,
      });
      const items = Array.isArray(data) ? data : [];
      setAudits(items);
      if (items.length) {
        const exists = items.find((item) => item.id === selectedAuditId);
        const nextId = exists ? selectedAuditId : items[0].id;
        if (nextId !== selectedAuditId) {
          setSelectedAuditId(nextId);
        }
      } else {
        setSelectedAuditId("");
        setSelectedAudit(null);
      }
    } catch (err) {
      const message =
        err?.response?.data?.detail || err?.message || "Audits could not be loaded.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [apiUrl, headers, filters, isReady, selectedAuditId]);

  const loadAuditDetail = useCallback(
    async (auditId) => {
      if (!auditId || !isReady) {
        setSelectedAudit(null);
        setFindingEdits({});
        return;
      }
      setDetailLoading(true);
      setDetailError("");
      try {
        const { data } = await axios.get(`${apiUrl}/audits/${auditId}`, {
          headers,
        });
        setSelectedAudit(data || null);
        setStatusUpdate({ status: data?.status || "", note: "" });
        setFindingEdits(buildFindingEditState(data));
      } catch (err) {
        const message =
          err?.response?.data?.detail || err?.message || "Audit detail could not be loaded.";
        setDetailError(message);
      } finally {
        setDetailLoading(false);
      }
    },
    [apiUrl, headers, isReady]
  );

  const fetchQuestions = useCallback(async () => {
    if (!isReady) return;
    setQuestionLoading(true);
    setQuestionError("");
    try {
      const { data } = await axios.get(`${apiUrl}/audit-questions`, { headers });
      setQuestions(Array.isArray(data) ? data : []);
    } catch (err) {
      const message =
        err?.response?.data?.detail || err?.message || "Question bank could not be loaded.";
      setQuestionError(message);
    } finally {
      setQuestionLoading(false);
    }
  }, [apiUrl, headers, isReady]);

  const fetchCapas = useCallback(async () => {
    if (!isReady) return;
    try {
      const { data } = await axios.get(`${apiUrl}/capas`, { headers });
      setCapaLookup(Array.isArray(data) ? data : []);
    } catch {
      setCapaLookup([]);
    }
  }, [apiUrl, headers, isReady]);

  useEffect(() => {
    fetchAudits();
  }, [fetchAudits]);

  useEffect(() => {
    fetchQuestions();
    fetchCapas();
  }, [fetchQuestions, fetchCapas]);

  useEffect(() => {
    if (selectedAuditId) {
      loadAuditDetail(selectedAuditId);
    }
  }, [selectedAuditId, loadAuditDetail]);
  const handleFilterChange = (field) => (event) => {
    const value = event.target.value;
    setFilters((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSelectAudit = (auditId) => {
    setSelectedAuditId(auditId);
  };

  const handleTeamDraftChange = (field) => (event) => {
    const value = event.target.value;
    setTeamDraft((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleAddTeamMember = () => {
    const userId = teamDraft.user_id.trim();
    const role = teamDraft.role.trim();
    if (!userId || !role) {
      return;
    }
    setAuditForm((prev) => ({
      ...prev,
      team: [
        ...prev.team,
        {
          user_id: userId,
          role,
          full_name: teamDraft.full_name.trim() || undefined,
        },
      ],
    }));
    setTeamDraft(emptyTeamDraft);
  };

  const removeTeamMember = (index) => {
    setAuditForm((prev) => ({
      ...prev,
      team: prev.team.filter((_, idx) => idx !== index),
    }));
  };

  const handleChecklistDraftChange = (field) => (event) => {
    const value = event.target.value;
    setChecklistDraft((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleAddChecklistItem = () => {
    const questionId = checklistDraft.question_id.trim();
    let questionText = checklistDraft.question.trim();
    if (!questionId && !questionText) {
      return;
    }
    if (questionId && !questionText) {
      const referenced = questions.find((item) => item.id === questionId);
      if (referenced?.question) {
        questionText = referenced.question;
      }
    }
    if (!questionText) {
      setAuditError("Checklist question text is required.");
      return;
    }
    setAuditError("");
    setAuditForm((prev) => ({
      ...prev,
      checklist: [
        ...prev.checklist,
        {
          question_id: questionId || undefined,
          question: questionText,
        },
      ],
    }));
    setChecklistDraft(emptyChecklistDraft);
  };

  const removeChecklistItem = (index) => {
    setAuditForm((prev) => ({
      ...prev,
      checklist: prev.checklist.filter((_, idx) => idx !== index),
    }));
  };

  const sanitizeDateInput = (value) => {
    if (!value) {
      return null;
    }
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return null;
    }
    return parsed.toISOString();
  };

  const resetAuditForm = () => {
    setAuditForm({
      audit_type: "",
      scope: "",
      department: "",
      lead_auditor: "",
      start_date: "",
      end_date: "",
      auditee_representative: "",
      objectives: "",
      team: [],
      checklist: [],
    });
    setTeamDraft(emptyTeamDraft);
    setChecklistDraft(emptyChecklistDraft);
  };

  const handleAuditFormChange = (field) => (event) => {
    const value = event.target.value;
    setAuditForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleCreateAudit = async (event) => {
    event.preventDefault();
    if (!isReady) return;
    setAuditSaving(true);
    setAuditError("");
    setAuditSuccess("");

    const startIso = sanitizeDateInput(auditForm.start_date);
    const endIso = sanitizeDateInput(auditForm.end_date);
    if (!startIso || !endIso) {
      setAuditError("Start and end dates must be valid.");
      setAuditSaving(false);
      return;
    }
    if (new Date(endIso) < new Date(startIso)) {
      setAuditError("End date cannot be earlier than start date.");
      setAuditSaving(false);
      return;
    }

    const payload = {
      audit_type: auditForm.audit_type.trim(),
      scope: auditForm.scope.trim(),
      department: auditForm.department.trim(),
      lead_auditor: auditForm.lead_auditor.trim(),
      start_date: startIso,
      end_date: endIso,
    };

    if (!payload.audit_type || !payload.scope || !payload.department || !payload.lead_auditor) {
      setAuditError("Audit type, scope, department, and lead auditor are required.");
      setAuditSaving(false);
      return;
    }

    if (auditForm.auditee_representative.trim()) {
      payload.auditee_representative = auditForm.auditee_representative.trim();
    }
    if (auditForm.objectives.trim()) {
      payload.objectives = auditForm.objectives.trim();
    }
    if (auditForm.team.length) {
      payload.audit_team = auditForm.team.map((member) => ({
        user_id: member.user_id,
        role: member.role,
        full_name: member.full_name || undefined,
      }));
    }
    if (auditForm.checklist.length) {
      payload.checklist = auditForm.checklist.map((item) => ({
        question_id: item.question_id || undefined,
        question: item.question,
      }));
    }

    try {
      await axios.post(`${apiUrl}/audits`, payload, { headers });
      setAuditSuccess("Audit created successfully.");
      resetAuditForm();
      await fetchAudits();
    } catch (err) {
      const message =
        err?.response?.data?.detail || err?.message || "Audit could not be created.";
      setAuditError(message);
    } finally {
      setAuditSaving(false);
    }
  };
  const handleStatusFieldChange = (field) => (event) => {
    const value = event.target.value;
    setStatusUpdate((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleUpdateStatus = async (event) => {
    event.preventDefault();
    if (!selectedAudit?.id || !isReady) return;
    if (!statusUpdate.status) {
      setStatusError("Status selection is required.");
      return;
    }
    setStatusSaving(true);
    setStatusError("");
    try {
      await axios.post(
        `${apiUrl}/audits/${selectedAudit.id}/status`,
        {
          status: statusUpdate.status,
          note: statusUpdate.note?.trim() || undefined,
        },
        { headers }
      );
      await loadAuditDetail(selectedAudit.id);
      await fetchAudits();
    } catch (err) {
      const message =
        err?.response?.data?.detail || err?.message || "Audit status could not be updated.";
      setStatusError(message);
    } finally {
      setStatusSaving(false);
    }
  };

  const handleFindingFormChange = (field) => (event) => {
    const value = event.target.value;
    setFindingForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleAddFinding = async (event) => {
    event.preventDefault();
    if (!selectedAudit?.id || !isReady) return;
    if (!findingForm.description.trim()) {
      setFindingError("Finding description is required.");
      return;
    }
    setFindingSaving(true);
    setFindingError("");
    setFindingSuccess("");
    try {
      const payload = {
        finding_type: findingForm.finding_type || "minor",
        description: findingForm.description.trim(),
      };
      if (findingForm.requirement_reference.trim()) {
        payload.requirement_reference = findingForm.requirement_reference.trim();
      }
      if (findingForm.related_capa_id.trim()) {
        payload.related_capa_id = findingForm.related_capa_id.trim();
      }
      if (findingForm.corrective_action.trim()) {
        payload.corrective_action = findingForm.corrective_action.trim();
      }
      await axios.post(`${apiUrl}/audits/${selectedAudit.id}/findings`, payload, { headers });
      setFindingForm({
        finding_type: "minor",
        description: "",
        requirement_reference: "",
        related_capa_id: "",
        corrective_action: "",
      });
      setFindingSuccess("Finding added.");
      await loadAuditDetail(selectedAudit.id);
      await fetchAudits();
    } catch (err) {
      const message =
        err?.response?.data?.detail || err?.message || "Finding could not be added.";
      setFindingError(message);
    } finally {
      setFindingSaving(false);
    }
  };

  const handleFindingEditChange = (findingId, field) => (event) => {
    const value = event.target.value;
    setFindingEdits((prev) => ({
      ...prev,
      [findingId]: {
        ...prev[findingId],
        [field]: value,
      },
    }));
  };

  const handleUpdateFinding = async (findingId) => {
    if (!selectedAudit?.id || !isReady) return;
    const original = selectedAudit.findings?.find((item) => item.id === findingId);
    const draft = findingEdits[findingId];
    if (!original || !draft) return;
    const payload = {};

    if (draft.finding_type && draft.finding_type !== original.finding_type) {
      payload.finding_type = draft.finding_type;
    }
    if (draft.status && draft.status !== original.status) {
      payload.status = draft.status;
    }
    if (draft.description.trim() !== (original.description || "")) {
      payload.description = draft.description.trim();
    }
    if ((draft.requirement_reference || "").trim() !== (original.requirement_reference || "")) {
      payload.requirement_reference = draft.requirement_reference.trim() || null;
    }
    if ((draft.related_capa_id || "").trim() !== (original.related_capa_id || "")) {
      payload.related_capa_id = draft.related_capa_id.trim() || null;
    }
    if ((draft.corrective_action || "").trim() !== (original.corrective_action || "")) {
      payload.corrective_action = draft.corrective_action.trim() || null;
    }

    if (!Object.keys(payload).length) {
      return;
    }

    try {
      await axios.patch(
        `${apiUrl}/audits/${selectedAudit.id}/findings/${findingId}`,
        payload,
        { headers }
      );
      await loadAuditDetail(selectedAudit.id);
      await fetchAudits();
    } catch (err) {
      const message =
        err?.response?.data?.detail || err?.message || "Finding could not be updated.";
      setFindingError(message);
    }
  };
  const handleQuestionInput = (field) => (event) => {
    const value =
      field === "is_active" ? event.target.checked : event.target.value;
    setQuestionForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const resetQuestionForm = () => {
    setQuestionForm({
      question: "",
      category: "",
      requirement_reference: "",
      tags: "",
      is_active: true,
    });
    setEditingQuestionId("");
  };

  const startEditQuestion = (question) => {
    setEditingQuestionId(question.id);
    setQuestionForm({
      question: question.question || "",
      category: question.category || "",
      requirement_reference: question.requirement_reference || "",
      tags: (question.tags || []).join(", "),
      is_active: question.is_active !== false,
    });
  };

  const handleQuestionSubmit = async (event) => {
    event.preventDefault();
    if (!isReady) return;
    if (!questionForm.question.trim()) {
      setQuestionError("Question text is required.");
      return;
    }
    setQuestionSaving(true);
    setQuestionError("");
    try {
      const payload = {
        question: questionForm.question.trim(),
      };
      if (questionForm.category.trim()) {
        payload.category = questionForm.category.trim();
      }
      if (questionForm.requirement_reference.trim()) {
        payload.requirement_reference = questionForm.requirement_reference.trim();
      }
      const tags = parseCommaSeparatedList(questionForm.tags);
      if (tags.length) {
        payload.tags = tags;
      }
      payload.is_active = !!questionForm.is_active;

      if (editingQuestionId) {
        await axios.patch(
          `${apiUrl}/audit-questions/${editingQuestionId}`,
          payload,
          { headers }
        );
      } else {
        await axios.post(`${apiUrl}/audit-questions`, payload, { headers });
      }
      resetQuestionForm();
      await fetchQuestions();
    } catch (err) {
      const message =
        err?.response?.data?.detail || err?.message || "Question could not be saved.";
      setQuestionError(message);
    } finally {
      setQuestionSaving(false);
    }
  };

  const handleQuestionDelete = async (questionId) => {
    if (!questionId || !isReady) return;
    try {
      await axios.delete(`${apiUrl}/audit-questions/${questionId}`, { headers });
      if (editingQuestionId === questionId) {
        resetQuestionForm();
      }
      await fetchQuestions();
    } catch (err) {
      const message =
        err?.response?.data?.detail || err?.message || "Question could not be deleted.";
      setQuestionError(message);
    }
  };

  const filteredCapas = useMemo(() => capaLookup.slice(0, 10), [capaLookup]);

  const connectionWarning = !isReady;

  return (
    <div className="module-wrapper">
      <header className="module-header">
        <div>
          <h1>Audit Management</h1>
          <p>Plan audits, manage checklists, and link findings to CAPA records.</p>
        </div>
        <Button variant="outline" onClick={fetchAudits}>
          Refresh
        </Button>
      </header>
      {connectionWarning && (
        <Card>
          <CardHeader>
            <CardTitle>Connection Required</CardTitle>
            <CardDescription>
              Configure API endpoint (and token if needed) to fetch audit data.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p>
              {authDisabled
                ? "Authentication is disabled. Ensure the API endpoint is reachable."
                : "Audits cannot be loaded without a valid API token."}
            </p>
            <div className="actions-row" style={{ marginTop: "12px" }}>
              <Button onClick={refresh}>Reload Connection Info</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Audit Filters</CardTitle>
          <CardDescription>Filter audits by status, department, or search term.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="module-grid" style={{ gap: "12px" }}>
            <div className="form-field">
              <Label htmlFor="audit-status-filter">Status</Label>
              <Select
                id="audit-status-filter"
                value={filters.status}
                onChange={handleFilterChange("status")}
                disabled={loading || detailLoading}
              >
                <SelectOption value="">All</SelectOption>
                {AUDIT_STATUS_OPTIONS.map((item) => (
                  <SelectOption key={`status-${item.value}`} value={item.value}>
                    {item.label}
                  </SelectOption>
                ))}
              </Select>
            </div>
            <div className="form-field">
              <Label htmlFor="audit-department-filter">Department</Label>
              <Input
                id="audit-department-filter"
                value={filters.department}
                onChange={handleFilterChange("department")}
                placeholder="Department"
                disabled={loading || detailLoading}
              />
            </div>
            <div className="form-field">
              <Label htmlFor="audit-search-filter">Search</Label>
              <Input
                id="audit-search-filter"
                value={filters.search}
                onChange={handleFilterChange("search")}
                placeholder="Audit code, scope, lead auditor"
                disabled={loading || detailLoading}
              />
            </div>
          </form>
        </CardContent>
      </Card>

      {error && !loading && (
        <Card>
          <CardHeader>
            <CardTitle>Error</CardTitle>
          </CardHeader>
          <CardContent>
            <p>{error}</p>
          </CardContent>
        </Card>
      )}

      <div className="grid two-cols" style={{ gap: "24px", alignItems: "start" }}>
        <Card>
          <CardHeader>
            <CardTitle>Audit List</CardTitle>
            <CardDescription>Select an audit to view and update details.</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="loading-state">Loading audits...</div>
            ) : audits.length === 0 ? (
              <div className="empty-state">No audit records found.</div>
            ) : (
              <div className="list-scroll">
                <ul className="data-list">
                  {audits.map((audit) => (
                    <li
                      key={audit.id}
                      className={
                        audit.id === selectedAuditId ? "data-list-item active" : "data-list-item"
                      }
                      onClick={() => handleSelectAudit(audit.id)}
                    >
                      <div className="cell-title">{audit.audit_code}</div>
                      <div className="cell-muted">{audit.scope}</div>
                      <div className="cell-meta">
                        <Badge variant="info">{audit.status}</Badge>
                        <span>{audit.department}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Audit Detail</CardTitle>
            <CardDescription>
              View core information, checklist items, findings, and status history.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {detailLoading ? (
              <div className="loading-state">Loading audit detail...</div>
            ) : detailError ? (
              <p style={{ color: "#b3261e" }}>{detailError}</p>
            ) : !selectedAudit ? (
              <div className="empty-state">Select an audit from the list.</div>
            ) : (
              <div className="audit-detail">
                <section className="detail-section">
                  <h3>{selectedAudit.audit_code}</h3>
                  <p>
                    <strong>Scope:</strong> {selectedAudit.scope || "-"}
                  </p>
                  <p>
                    <strong>Department:</strong> {selectedAudit.department || "-"}
                  </p>
                  <p>
                    <strong>Lead Auditor:</strong> {selectedAudit.lead_auditor || "-"}
                  </p>
                  <p>
                    <strong>Auditee Representative:</strong>{" "}
                    {selectedAudit.auditee_representative || "-"}
                  </p>
                  <p>
                    <strong>Objectives:</strong> {selectedAudit.objectives || "-"}
                  </p>
                  <p>
                    <strong>Start:</strong>{" "}
                    {selectedAudit.start_date ? formatDate(selectedAudit.start_date) : "-"}
                  </p>
                  <p>
                    <strong>End:</strong>{" "}
                    {selectedAudit.end_date ? formatDate(selectedAudit.end_date) : "-"}
                  </p>
                </section>

                <section className="detail-section">
                  <h4>Team</h4>
                  {selectedAudit.audit_team?.length ? (
                    <ul className="tag-list">
                      {selectedAudit.audit_team.map((member, idx) => (
                        <li key={`team-${member.user_id}-${idx}`}>{formatTeamMember(member)}</li>
                      ))}
                    </ul>
                  ) : (
                    <div className="empty-state">No team members recorded.</div>
                  )}
                </section>

                <section className="detail-section">
                  <h4>Status History</h4>
                  {selectedAudit.status_history?.length ? (
                    <ul className="history-list">
                      {selectedAudit.status_history
                        .slice()
                        .reverse()
                        .map((entry, idx) => (
                          <li key={`status-${idx}`}>
                            <strong>{entry.status}</strong> —{
                              entry.changed_at ? formatDateTime(entry.changed_at) : "-"
                            }
                            {entry.note ? ` (${entry.note})` : ""}
                          </li>
                        ))}
                    </ul>
                  ) : (
                    <div className="empty-state">No status changes recorded.</div>
                  )}
                  <form onSubmit={handleUpdateStatus} style={{ marginTop: "12px" }}>
                    <div className="form-field">
                      <Label htmlFor="audit-status-update">Update Status</Label>
                      <Select
                        id="audit-status-update"
                        value={statusUpdate.status}
                        onChange={handleStatusFieldChange("status")}
                        disabled={statusSaving}
                      >
                        <SelectOption value="">Select</SelectOption>
                        {AUDIT_STATUS_OPTIONS.map((option) => (
                          <SelectOption key={`update-status-${option.value}`} value={option.value}>
                            {option.label}
                          </SelectOption>
                        ))}
                      </Select>
                    </div>
                    <div className="form-field">
                      <Label htmlFor="audit-status-note">Note</Label>
                      <Textarea
                        id="audit-status-note"
                        value={statusUpdate.note}
                        onChange={handleStatusFieldChange("note")}
                        rows={2}
                        disabled={statusSaving}
                      />
                    </div>
                    <div className="actions-row">
                      <Button type="submit" disabled={statusSaving}>
                        {statusSaving ? "Updating..." : "Update Status"}
                      </Button>
                    </div>
                    {statusError && (
                      <p style={{ color: "#b3261e", marginTop: "6px" }}>{statusError}</p>
                    )}
                  </form>
                </section>
                <section className="detail-section">
                  <h4>Checklist</h4>
                  {selectedAudit.checklist?.length ? (
                    <ul className="data-list compact">
                      {selectedAudit.checklist.map((item) => (
                        <li key={item.id} className="data-list-item">
                          <div className="cell-title">{item.question}</div>
                          <div className="cell-muted">
                            Status: <strong>{item.status}</strong>
                            {item.response ? ` — Response: ${item.response}` : ""}
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="empty-state">No checklist items recorded.</div>
                  )}
                </section>

                <section className="detail-section">
                  <h4>Findings</h4>
                  {selectedAudit.findings?.length ? (
                    <div className="findings-list">
                      {selectedAudit.findings.map((finding) => {
                        const draft = findingEdits[finding.id] || {};
                        return (
                          <Card key={finding.id} style={{ marginBottom: "12px" }}>
                            <CardContent>
                              <div className="form-grid" style={{ gap: "8px" }}>
                                <div className="form-field">
                                  <Label>Type</Label>
                                  <Select
                                    value={draft.finding_type || ""}
                                    onChange={handleFindingEditChange(finding.id, "finding_type")}
                                  >
                                    {FINDING_TYPE_OPTIONS.map((option) => (
                                      <SelectOption value={option.value} key={option.value}>
                                        {option.label}
                                      </SelectOption>
                                    ))}
                                  </Select>
                                </div>
                                <div className="form-field">
                                  <Label>Status</Label>
                                  <Select
                                    value={draft.status || ""}
                                    onChange={handleFindingEditChange(finding.id, "status")}
                                  >
                                    {FINDING_STATUS_OPTIONS.map((option) => (
                                      <SelectOption value={option.value} key={option.value}>
                                        {option.label}
                                      </SelectOption>
                                    ))}
                                  </Select>
                                </div>
                              </div>
                              <div className="form-field">
                                <Label>Description</Label>
                                <Textarea
                                  value={draft.description || ""}
                                  onChange={handleFindingEditChange(finding.id, "description")}
                                  rows={2}
                                />
                              </div>
                              <div className="form-field">
                                <Label>Requirement Reference</Label>
                                <Input
                                  value={draft.requirement_reference || ""}
                                  onChange={handleFindingEditChange(
                                    finding.id,
                                    "requirement_reference"
                                  )}
                                />
                              </div>
                              <div className="form-field">
                                <Label>Related CAPA ID</Label>
                                <Input
                                  value={draft.related_capa_id || ""}
                                  onChange={handleFindingEditChange(finding.id, "related_capa_id")}
                                  placeholder="CAPA identifier"
                                />
                              </div>
                              <div className="form-field">
                                <Label>Corrective Action</Label>
                                <Textarea
                                  value={draft.corrective_action || ""}
                                  onChange={handleFindingEditChange(
                                    finding.id,
                                    "corrective_action"
                                  )}
                                  rows={2}
                                />
                              </div>
                              <div className="actions-row">
                                <Button
                                  type="button"
                                  variant="outline"
                                  onClick={() => handleUpdateFinding(finding.id)}
                                >
                                  Save Changes
                                </Button>
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="empty-state">No findings recorded.</div>
                  )}
                  <form onSubmit={handleAddFinding} style={{ marginTop: "16px" }}>
                    <h5>Add Finding</h5>
                    <div className="form-grid" style={{ gap: "8px" }}>
                      <div className="form-field">
                        <Label htmlFor="finding-type">Type</Label>
                        <Select
                          id="finding-type"
                          value={findingForm.finding_type}
                          onChange={handleFindingFormChange("finding_type")}
                        >
                          {FINDING_TYPE_OPTIONS.map((option) => (
                            <SelectOption value={option.value} key={`new-finding-${option.value}`}>
                              {option.label}
                            </SelectOption>
                          ))}
                        </Select>
                      </div>
                      <div className="form-field">
                        <Label htmlFor="finding-description">Description</Label>
                        <Textarea
                          id="finding-description"
                          value={findingForm.description}
                          onChange={handleFindingFormChange("description")}
                          rows={2}
                        />
                      </div>
                      <div className="form-field">
                        <Label htmlFor="finding-reference">Requirement Reference</Label>
                        <Input
                          id="finding-reference"
                          value={findingForm.requirement_reference}
                          onChange={handleFindingFormChange("requirement_reference")}
                        />
                      </div>
                      <div className="form-field">
                        <Label htmlFor="finding-capa">Related CAPA ID</Label>
                        <Input
                          id="finding-capa"
                          value={findingForm.related_capa_id}
                          onChange={handleFindingFormChange("related_capa_id")}
                          placeholder="CAPA identifier"
                        />
                      </div>
                      <div className="form-field">
                        <Label htmlFor="finding-corrective">Corrective Action</Label>
                        <Textarea
                          id="finding-corrective"
                          value={findingForm.corrective_action}
                          onChange={handleFindingFormChange("corrective_action")}
                          rows={2}
                        />
                      </div>
                    </div>
                    <div className="actions-row" style={{ marginTop: "8px" }}>
                      <Button type="submit" disabled={findingSaving}>
                        {findingSaving ? "Saving..." : "Add Finding"}
                      </Button>
                    </div>
                    {findingError && (
                      <p style={{ color: "#b3261e", marginTop: "6px" }}>{findingError}</p>
                    )}
                    {findingSuccess && (
                      <p style={{ color: "#0f6f0f", marginTop: "6px" }}>{findingSuccess}</p>
                    )}
                  </form>
                </section>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Create New Audit</CardTitle>
          <CardDescription>Capture audit plan details, team assignment, and checklist.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreateAudit} className="module-grid" style={{ gap: "12px" }}>
            <div className="form-field">
              <Label htmlFor="audit-type">Audit Type</Label>
              <Input
                id="audit-type"
                value={auditForm.audit_type}
                onChange={handleAuditFormChange("audit_type")}
                placeholder="Internal, Supplier, Certification..."
                disabled={auditSaving}
              />
            </div>
            <div className="form-field">
              <Label htmlFor="audit-scope">Scope</Label>
              <Textarea
                id="audit-scope"
                value={auditForm.scope}
                onChange={handleAuditFormChange("scope")}
                rows={2}
                disabled={auditSaving}
              />
            </div>
            <div className="form-field">
              <Label htmlFor="audit-department">Department</Label>
              <Input
                id="audit-department"
                value={auditForm.department}
                onChange={handleAuditFormChange("department")}
                disabled={auditSaving}
              />
            </div>
            <div className="form-field">
              <Label htmlFor="audit-lead">Lead Auditor</Label>
              <Input
                id="audit-lead"
                value={auditForm.lead_auditor}
                onChange={handleAuditFormChange("lead_auditor")}
                disabled={auditSaving}
              />
            </div>
            <div className="form-grid">
              <div className="form-field">
                <Label htmlFor="audit-start">Start Date</Label>
                <Input
                  id="audit-start"
                  type="datetime-local"
                  value={auditForm.start_date}
                  onChange={handleAuditFormChange("start_date")}
                  disabled={auditSaving}
                />
              </div>
              <div className="form-field">
                <Label htmlFor="audit-end">End Date</Label>
                <Input
                  id="audit-end"
                  type="datetime-local"
                  value={auditForm.end_date}
                  onChange={handleAuditFormChange("end_date")}
                  disabled={auditSaving}
                />
              </div>
            </div>
            <div className="form-field">
              <Label htmlFor="audit-auditee">Auditee Representative</Label>
              <Input
                id="audit-auditee"
                value={auditForm.auditee_representative}
                onChange={handleAuditFormChange("auditee_representative")}
                disabled={auditSaving}
              />
            </div>
            <div className="form-field">
              <Label htmlFor="audit-objectives">Objectives</Label>
              <Textarea
                id="audit-objectives"
                value={auditForm.objectives}
                onChange={handleAuditFormChange("objectives")}
                rows={2}
                disabled={auditSaving}
              />
            </div>

            <div className="form-field">
              <Label>Team Members</Label>
              <div className="form-grid" style={{ gap: "8px" }}>
                <Input
                  placeholder="User ID"
                  value={teamDraft.user_id}
                  onChange={handleTeamDraftChange("user_id")}
                  disabled={auditSaving}
                />
                <Input
                  placeholder="Role"
                  value={teamDraft.role}
                  onChange={handleTeamDraftChange("role")}
                  disabled={auditSaving}
                />
                <Input
                  placeholder="Full Name (optional)"
                  value={teamDraft.full_name}
                  onChange={handleTeamDraftChange("full_name")}
                  disabled={auditSaving}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleAddTeamMember}
                  disabled={auditSaving}
                >
                  Add Member
                </Button>
              </div>
              {auditForm.team.length ? (
                <ul className="tag-list" style={{ marginTop: "8px" }}>
                  {auditForm.team.map((member, idx) => (
                    <li key={`draft-team-${idx}`}>
                      {formatTeamMember(member)}
                      <button
                        type="button"
                        onClick={() => removeTeamMember(idx)}
                        className="tag-remove"
                        disabled={auditSaving}
                      >
                        ×
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="cell-muted" style={{ marginTop: "6px" }}>
                  No team members added yet.
                </p>
              )}
            </div>

            <div className="form-field">
              <Label>Checklist Items</Label>
              <div className="form-grid" style={{ gap: "8px" }}>
                <Select
                  value={checklistDraft.question_id}
                  onChange={handleChecklistDraftChange("question_id")}
                  disabled={auditSaving || questionLoading}
                >
                  <SelectOption value="">Select from question bank</SelectOption>
                  {questions.map((question) => (
                    <SelectOption key={`question-option-${question.id}`} value={question.id}>
                      {question.question}
                    </SelectOption>
                  ))}
                </Select>
                <Input
                  placeholder="Custom question text"
                  value={checklistDraft.question}
                  onChange={handleChecklistDraftChange("question")}
                  disabled={auditSaving}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleAddChecklistItem}
                  disabled={auditSaving}
                >
                  Add Checklist Item
                </Button>
              </div>
              {auditForm.checklist.length ? (
                <ul className="data-list compact" style={{ marginTop: "8px" }}>
                  {auditForm.checklist.map((item, idx) => (
                    <li key={`draft-checklist-${idx}`} className="data-list-item">
                      <div className="cell-title">{item.question}</div>
                      <button
                        type="button"
                        className="tag-remove"
                        onClick={() => removeChecklistItem(idx)}
                        disabled={auditSaving}
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="cell-muted" style={{ marginTop: "6px" }}>
                  No checklist items added yet.
                </p>
              )}
            </div>

            <div className="actions-row" style={{ marginTop: "12px" }}>
              <Button type="submit" disabled={auditSaving}>
                {auditSaving ? "Creating..." : "Create Audit"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={resetAuditForm}
                disabled={auditSaving}
              >
                Reset
              </Button>
            </div>
            {auditError && <p style={{ color: "#b3261e" }}>{auditError}</p>}
            {auditSuccess && <p style={{ color: "#0f6f0f" }}>{auditSuccess}</p>}
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Audit Question Bank</CardTitle>
          <CardDescription>Maintain reusable checklist questions.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleQuestionSubmit} className="module-grid" style={{ gap: "12px" }}>
            <div className="form-field">
              <Label htmlFor="question-text">Question Text</Label>
              <Textarea
                id="question-text"
                value={questionForm.question}
                onChange={handleQuestionInput("question")}
                rows={2}
                disabled={questionSaving}
              />
            </div>
            <div className="form-field">
              <Label htmlFor="question-category">Category</Label>
              <Input
                id="question-category"
                value={questionForm.category}
                onChange={handleQuestionInput("category")}
                disabled={questionSaving}
              />
            </div>
            <div className="form-field">
              <Label htmlFor="question-reference">Requirement Reference</Label>
              <Input
                id="question-reference"
                value={questionForm.requirement_reference}
                onChange={handleQuestionInput("requirement_reference")}
                disabled={questionSaving}
              />
            </div>
            <div className="form-field">
              <Label htmlFor="question-tags">Tags (comma separated)</Label>
              <Input
                id="question-tags"
                value={questionForm.tags}
                onChange={handleQuestionInput("tags")}
                disabled={questionSaving}
              />
            </div>
            <div className="form-field checkbox-field">
              <label>
                <input
                  type="checkbox"
                  checked={questionForm.is_active}
                  onChange={handleQuestionInput("is_active")}
                  disabled={questionSaving}
                />
                Active
              </label>
            </div>
            <div className="actions-row">
              <Button type="submit" disabled={questionSaving}>
                {questionSaving ? "Saving..." : editingQuestionId ? "Update Question" : "Add Question"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={resetQuestionForm}
                disabled={questionSaving}
              >
                Clear
              </Button>
            </div>
            {questionError && <p style={{ color: "#b3261e" }}>{questionError}</p>}
          </form>

          <div style={{ marginTop: "16px" }}>
            {questionLoading ? (
              <div className="loading-state">Loading questions...</div>
            ) : questions.length === 0 ? (
              <div className="empty-state">No questions in the bank.</div>
            ) : (
              <ul className="data-list">
                {questions.map((question) => (
                  <li key={question.id} className="data-list-item">
                    <div className="cell-title">{question.question}</div>
                    <div className="cell-muted">
                      {question.category ? `${question.category} • ` : ""}
                      {question.requirement_reference || "No reference"}
                    </div>
                    <div className="cell-meta">
                      <Badge variant={question.is_active ? "success" : "secondary"}>
                        {question.is_active ? "Active" : "Inactive"}
                      </Badge>
                      <div className="tag-row">
                        {(question.tags || []).map((tag) => (
                          <span key={`${question.id}-${tag}`} className="tag">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="actions-row">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => startEditQuestion(question)}
                      >
                        Edit
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => handleQuestionDelete(question.id)}
                      >
                        Delete
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </CardContent>
      </Card>

      {filteredCapas.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recent CAPA Records</CardTitle>
            <CardDescription>
              Use these identifiers when linking audit findings to CAPA records.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <table>
              <thead>
                <tr>
                  <th>CAPA No</th>
                  <th>Title</th>
                  <th>Status</th>
                  <th>Department</th>
                  <th>Target Date</th>
                </tr>
              </thead>
              <tbody>
                {filteredCapas.map((capa) => (
                  <tr key={capa.id}>
                    <td>{capa.capa_no}</td>
                    <td>{capa.title}</td>
                    <td>{capa.status}</td>
                    <td>{capa.department}</td>
                    <td>{capa.target_date ? formatDate(capa.target_date) : "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

const Label = ({ htmlFor, children }) => (
  <label htmlFor={htmlFor} style={{ fontWeight: 500 }}>
    {children}
  </label>
);

export default AuditsModule;
