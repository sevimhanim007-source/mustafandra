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

const STATUS_OPTIONS = [
  { value: "identified", label: "Identified" },
  { value: "assessed", label: "Assessed" },
  { value: "mitigating", label: "Mitigating" },
  { value: "monitoring", label: "Monitoring" },
  { value: "closed", label: "Closed" },
];

const LEVEL_BADGES = {
  low: { label: "Low", variant: "success" },
  medium: { label: "Medium", variant: "info" },
  high: { label: "High", variant: "warning" },
  critical: { label: "Critical", variant: "danger" },
};

const STATUS_BADGES = {
  identified: { label: "Identified", variant: "secondary" },
  assessed: { label: "Assessed", variant: "info" },
  mitigating: { label: "Mitigating", variant: "warning" },
  monitoring: { label: "Monitoring", variant: "info" },
  closed: { label: "Closed", variant: "success" },
};

const initialFactorDraft = { name: "", value: "", weight: "" };

const initialCreateForm = {
  title: "",
  category: "",
  process: "",
  owner: "",
  description: "",
  status: "identified",
  likelihood: 3,
  impact: 3,
  detection: 3,
  controls_effectiveness: 0.2,
  linked_capa_ids: "",
  linked_audit_finding_ids: "",
  next_review_date: "",
};

const buildInitialUpdateForm = () => ({
  title: "",
  category: "",
  process: "",
  owner: "",
  description: "",
  status: "identified",
  likelihood: 3,
  impact: 3,
  detection: 3,
  controls_effectiveness: 0.2,
  linked_capa_ids: "",
  linked_audit_finding_ids: "",
  next_review_date: "",
  revision_note: "",
});

const parseCommaSeparated = (value) =>
  (value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

const toNumberOrNull = (value) => {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
};

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const formatScore = (value) =>
  value === null || value === undefined || Number.isNaN(Number(value))
    ? "-"
    : Number(value).toFixed(2);
const RisksModule = () => {
  const { apiUrl, headers, isReady, authDisabled, refresh } = useApiConnection();
  const [risks, setRisks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [filters, setFilters] = useState({ status: "", category: "", search: "" });

  const [matrixSummary, setMatrixSummary] = useState({ matrix: [], palette: {} });
  const [matrixLoading, setMatrixLoading] = useState(false);
  const [settings, setSettings] = useState(null);
  const [globalTrend, setGlobalTrend] = useState([]);

  const [selectedRiskId, setSelectedRiskId] = useState("");
  const [selectedRisk, setSelectedRisk] = useState(null);
  const [riskLoading, setRiskLoading] = useState(false);
  const [riskError, setRiskError] = useState("");

  const [revisions, setRevisions] = useState([]);
  const [compareSelection, setCompareSelection] = useState({ base: "", target: "" });
  const [compareResult, setCompareResult] = useState(null);

  const [trendPoints, setTrendPoints] = useState([]);

  const [createForm, setCreateForm] = useState(initialCreateForm);
  const [createFactors, setCreateFactors] = useState([]);
  const [createFactorDraft, setCreateFactorDraft] = useState(initialFactorDraft);
  const [createSaving, setCreateSaving] = useState(false);
  const [createError, setCreateError] = useState("");
  const [createSuccess, setCreateSuccess] = useState("");

  const [updateForm, setUpdateForm] = useState(buildInitialUpdateForm());
  const [updateFactors, setUpdateFactors] = useState([]);
  const [updateFactorDraft, setUpdateFactorDraft] = useState(initialFactorDraft);
  const [updateSaving, setUpdateSaving] = useState(false);
  const [updateError, setUpdateError] = useState("");
  const [updateSuccess, setUpdateSuccess] = useState("");

  const [reportPreview, setReportPreview] = useState(null);
  const loadRiskSettings = useCallback(async () => {
    if (!isReady) return;
    try {
      const { data } = await axios.get(`${apiUrl}/risk/settings`, { headers });
      setSettings(data || null);
    } catch (err) {
      console.error("Failed to load risk settings", err);
    }
  }, [apiUrl, headers, isReady]);

  const loadRiskMatrix = useCallback(async () => {
    if (!isReady) return;
    setMatrixLoading(true);
    try {
      const { data } = await axios.get(`${apiUrl}/risks/matrix`, { headers });
      setMatrixSummary({
        matrix: Array.isArray(data?.matrix) ? data.matrix : [],
        palette: data?.palette || {},
      });
    } catch (err) {
      console.error("Failed to load risk matrix", err);
    } finally {
      setMatrixLoading(false);
    }
  }, [apiUrl, headers, isReady]);

  const loadGlobalTrend = useCallback(async () => {
    if (!isReady) return;
    try {
      const { data } = await axios.get(`${apiUrl}/risks/trends`, {
        headers,
        params: { limit: 20 },
      });
      setGlobalTrend(Array.isArray(data?.points) ? data.points : []);
    } catch (err) {
      console.error("Failed to load risk trends", err);
    }
  }, [apiUrl, headers, isReady]);
  const fetchRisks = useCallback(async () => {
    if (!isReady) return;
    setLoading(true);
    setError("");
    try {
      const params = {};
      if (filters.status) params.status = filters.status;
      if (filters.category) params.category = filters.category;
      if (filters.search) params.search = filters.search;
      const { data } = await axios.get(`${apiUrl}/risks`, {
        headers,
        params,
      });
      const list = Array.isArray(data) ? data : [];
      setRisks(list);
      if (list.length) {
        const existing = list.find((item) => item.id === selectedRiskId);
        if (!existing) {
          setSelectedRiskId(list[0].id);
        }
      } else {
        setSelectedRiskId("");
        setSelectedRisk(null);
        setTrendPoints([]);
        setRevisions([]);
        setCompareSelection({ base: "", target: "" });
        setCompareResult(null);
      }
    } catch (err) {
      const message =
        err?.response?.data?.detail || err?.message || "Risk register could not be loaded.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [apiUrl, headers, filters, isReady, selectedRiskId]);
  const loadRiskDetail = useCallback(
    async (riskId) => {
      if (!riskId || !isReady) {
        setSelectedRisk(null);
        setTrendPoints([]);
        setRevisions([]);
        setCompareSelection({ base: "", target: "" });
        setCompareResult(null);
        return;
      }
      setRiskLoading(true);
      setRiskError("");
      try {
        const { data } = await axios.get(`${apiUrl}/risks/${riskId}`, {
          headers,
          params: { include_trend: true },
        });
        setSelectedRisk(data || null);
        setTrendPoints(Array.isArray(data?.trend) ? data.trend : []);

        const form = buildInitialUpdateForm();
        form.title = data?.title || "";
        form.category = data?.category || "";
        form.process = data?.process || "";
        form.owner = data?.owner || "";
        form.description = data?.description || "";
        form.status = data?.status || "identified";
        form.likelihood = data?.likelihood ?? 3;
        form.impact = data?.impact ?? 3;
        form.detection = data?.detection ?? 3;
        form.controls_effectiveness = data?.controls_effectiveness ?? 0;
        form.linked_capa_ids = (data?.linked_capa_ids || []).join(", ");
        form.linked_audit_finding_ids = (data?.linked_audit_finding_ids || []).join(", ");
        form.next_review_date = data?.next_review_date
          ? data.next_review_date.slice(0, 16)
          : "";
        setUpdateForm(form);
        setUpdateFactors(Array.isArray(data?.custom_factors) ? data.custom_factors : []);
        setUpdateFactorDraft(initialFactorDraft);
        setUpdateError("");
        setUpdateSuccess("");

        const revisionsResponse = await axios.get(`${apiUrl}/risks/${riskId}/revisions`, {
          headers,
        });
        const revisionList = Array.isArray(revisionsResponse.data) ? revisionsResponse.data : [];
        setRevisions(revisionList);
        if (revisionList.length >= 2) {
          setCompareSelection({
            base: String(revisionList[revisionList.length - 2].revision_no),
            target: String(revisionList[revisionList.length - 1].revision_no),
          });
        } else {
          setCompareSelection({ base: "", target: "" });
        }
        setCompareResult(null);
        setReportPreview(null);
      } catch (err) {
        const message =
          err?.response?.data?.detail || err?.message || "Risk detail could not be loaded.";
        setRiskError(message);
      } finally {
        setRiskLoading(false);
      }
    },
    [apiUrl, headers, isReady]
  );
  const handleFilterChange = (field) => (event) => {
    const value = event.target.value;
    setFilters((prev) => ({ ...prev, [field]: value }));
  };

  const handleSelectRisk = (riskId) => {
    setSelectedRiskId(riskId);
  };

  const handleCreateInputChange = (field) => (event) => {
    const value = event.target.value;
    setCreateForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleCreateFactorDraftChange = (field) => (event) => {
    const value = event.target.value;
    setCreateFactorDraft((prev) => ({ ...prev, [field]: value }));
  };

  const addCreateFactor = () => {
    const name = createFactorDraft.name.trim();
    if (!name) return;
    const value = toNumberOrNull(createFactorDraft.value);
    if (value === null) return;
    const weight = toNumberOrNull(createFactorDraft.weight) ?? 1;
    setCreateFactors((prev) => [
      ...prev,
      {
        name,
        value,
        weight,
      },
    ]);
    setCreateFactorDraft(initialFactorDraft);
  };

  const removeCreateFactor = (index) => {
    setCreateFactors((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleUpdateInputChange = (field) => (event) => {
    const value = event.target.value;
    setUpdateForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleUpdateFactorDraftChange = (field) => (event) => {
    const value = event.target.value;
    setUpdateFactorDraft((prev) => ({ ...prev, [field]: value }));
  };

  const addUpdateFactor = () => {
    const name = updateFactorDraft.name.trim();
    if (!name) return;
    const value = toNumberOrNull(updateFactorDraft.value);
    if (value === null) return;
    const weight = toNumberOrNull(updateFactorDraft.weight) ?? 1;
    setUpdateFactors((prev) => [
      ...prev,
      {
        name,
        value,
        weight,
      },
    ]);
    setUpdateFactorDraft(initialFactorDraft);
  };

  const removeUpdateFactor = (index) => {
    setUpdateFactors((prev) => prev.filter((_, idx) => idx !== index));
  };

  const normalizeFactorsForPayload = (factors) =>
    factors.map((factor) => ({
      name: factor.name,
      value: Number(factor.value),
      weight: Number(factor.weight ?? 1),
    }));
  const handleCreateSubmit = async (event) => {
    event.preventDefault();
    if (!isReady) return;
    setCreateSaving(true);
    setCreateError("");
    setCreateSuccess("");
    try {
      const payload = {
        title: createForm.title.trim(),
        category: createForm.category.trim(),
        process: createForm.process.trim() || undefined,
        owner: createForm.owner.trim(),
        description: createForm.description.trim() || undefined,
        status: createForm.status || "identified",
        likelihood: clamp(Number(createForm.likelihood) || 3, 1, 5),
        impact: clamp(Number(createForm.impact) || 3, 1, 5),
        detection: toNumberOrNull(createForm.detection),
        controls_effectiveness: toNumberOrNull(createForm.controls_effectiveness),
        custom_factors: normalizeFactorsForPayload(createFactors),
        linked_capa_ids: parseCommaSeparated(createForm.linked_capa_ids),
        linked_audit_finding_ids: parseCommaSeparated(createForm.linked_audit_finding_ids),
      };
      if (createForm.next_review_date) {
        payload.next_review_date = new Date(createForm.next_review_date).toISOString();
      }
      await axios.post(`${apiUrl}/risks`, payload, { headers });
      setCreateSuccess("Risk created successfully.");
      setCreateForm(initialCreateForm);
      setCreateFactors([]);
      setCreateFactorDraft(initialFactorDraft);
      await fetchRisks();
      await loadRiskMatrix();
      await loadRiskSettings();
    } catch (err) {
      const message =
        err?.response?.data?.detail || err?.message || "Risk could not be created.";
      setCreateError(message);
    } finally {
      setCreateSaving(false);
    }
  };
  const handleUpdateSubmit = async (event) => {
    event.preventDefault();
    if (!isReady || !selectedRiskId) return;
    setUpdateSaving(true);
    setUpdateError("");
    setUpdateSuccess("");
    try {
      const payload = {
        title: updateForm.title.trim(),
        category: updateForm.category.trim(),
        process: updateForm.process.trim() || null,
        owner: updateForm.owner.trim(),
        description: updateForm.description.trim() || null,
        status: updateForm.status || "identified",
        likelihood: clamp(Number(updateForm.likelihood) || 3, 1, 5),
        impact: clamp(Number(updateForm.impact) || 3, 1, 5),
        detection: toNumberOrNull(updateForm.detection),
        controls_effectiveness: toNumberOrNull(updateForm.controls_effectiveness),
        custom_factors: normalizeFactorsForPayload(updateFactors),
        linked_capa_ids: parseCommaSeparated(updateForm.linked_capa_ids),
        linked_audit_finding_ids: parseCommaSeparated(updateForm.linked_audit_finding_ids),
        next_review_date: updateForm.next_review_date
          ? new Date(updateForm.next_review_date).toISOString()
          : null,
        revision_note: updateForm.revision_note.trim() || undefined,
      };
      await axios.patch(`${apiUrl}/risks/${selectedRiskId}`, payload, { headers });
      setUpdateSuccess("Risk updated successfully.");
      await fetchRisks();
      await loadRiskDetail(selectedRiskId);
      await loadRiskMatrix();
    } catch (err) {
      const message =
        err?.response?.data?.detail || err?.message || "Risk could not be updated.";
      setUpdateError(message);
    } finally {
      setUpdateSaving(false);
    }
  };
  const handleCompareSelectionChange = (field) => (event) => {
    const value = event.target.value;
    setCompareSelection((prev) => ({ ...prev, [field]: value }));
  };

  const handleCompareRevisions = async () => {
    if (!isReady || !selectedRiskId) return;
    if (!compareSelection.base || !compareSelection.target) return;
    try {
      const { data } = await axios.get(`${apiUrl}/risks/${selectedRiskId}/compare`, {
        headers,
        params: {
          rev_a: Number(compareSelection.base),
          rev_b: Number(compareSelection.target),
        },
      });
      setCompareResult(data || null);
    } catch (err) {
      const message =
        err?.response?.data?.detail || err?.message || "Revision comparison failed.";
      setUpdateError(message);
    }
  };

  const handleGenerateReport = async () => {
    if (!isReady || !selectedRiskId) return;
    try {
      const { data } = await axios.get(`${apiUrl}/risks/reports/custom`, {
        headers,
        params: { risk_id: selectedRiskId },
      });
      setReportPreview(data || null);
    } catch (err) {
      const message =
        err?.response?.data?.detail || err?.message || "Report could not be generated.";
      setUpdateError(message);
    }
  };

  const handleRefreshRisk = () => {
    if (selectedRiskId) {
      loadRiskDetail(selectedRiskId);
    }
  };
  useEffect(() => {
    if (!isReady) return;
    loadRiskSettings();
    loadRiskMatrix();
    loadGlobalTrend();
  }, [isReady, loadRiskSettings, loadRiskMatrix, loadGlobalTrend]);

  useEffect(() => {
    if (!isReady) return;
    fetchRisks();
  }, [isReady, fetchRisks]);

  useEffect(() => {
    if (!selectedRiskId) {
      setSelectedRisk(null);
      setTrendPoints([]);
      setRevisions([]);
      return;
    }
    loadRiskDetail(selectedRiskId);
  }, [selectedRiskId, loadRiskDetail]);

  const connectionWarning = !isReady;

  const statusSummary = useMemo(() => {
    const counts = risks.reduce((acc, item) => {
      const key = item?.status || "identified";
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
    const total = risks.length;
    const open = total - (counts.closed || 0);
    const averageResidual = total
      ? risks.reduce(
          (sum, item) => sum + (item?.risk_score?.residual || 0),
          0
        ) / total
      : 0;
    return { counts, total, open, averageResidual };
  }, [risks]);

  const palette = matrixSummary.palette || {};
  const matrixRows = Array.isArray(matrixSummary.matrix) ? matrixSummary.matrix : [];
  const selectedRiskFactors = Array.isArray(selectedRisk?.custom_factors)
    ? selectedRisk.custom_factors
    : [];
  return (
    <div className="module-wrapper">
      <header className="module-header">
        <div>
          <h1>Risk Register</h1>
          <p>Model risks, evaluate scores, and monitor trends across the organisation.</p>
        </div>
        <Button variant="outline" onClick={fetchRisks} disabled={loading}>
          Refresh
        </Button>
      </header>

      {connectionWarning && (
        <Card>
          <CardHeader>
            <CardTitle>Connection Required</CardTitle>
            <CardDescription>
              Configure the API endpoint (and token if needed) to load risk information.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p>
              {authDisabled
                ? "Authentication is disabled. Ensure the API endpoint is reachable."
                : "Risk data cannot be loaded without a valid API token."}
            </p>
            <div className="actions-row" style={{ marginTop: "12px" }}>
              <Button onClick={refresh}>Reload Connection</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Risk Overview</CardTitle>
          <CardDescription>
            Snapshot of current risk posture based on residual scores and open items.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="stats-grid">
            <div className="stat-card">
              <span>Total Risks</span>
              <strong>{statusSummary.total}</strong>
            </div>
            <div className="stat-card">
              <span>Active Risks</span>
              <strong>{statusSummary.open}</strong>
            </div>
            <div className="stat-card">
              <span>Average Residual Score</span>
              <strong>{formatScore(statusSummary.averageResidual)}</strong>
            </div>
            <div className="stat-card">
              <span>Formula</span>
              <strong>{settings?.formula || "likelihood * impact"}</strong>
            </div>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Risk Matrix</CardTitle>
          <CardDescription>Residual risk distribution across likelihood and impact.</CardDescription>
        </CardHeader>
        <CardContent>
          {matrixLoading ? (
            <div className="loading-state">Loading matrix...</div>
          ) : matrixRows.length === 0 ? (
            <div className="empty-state">Matrix data not available yet.</div>
          ) : (
            <div className="table-wrapper">
              <table className="risk-matrix">
                <thead>
                  <tr>
                    <th>Likelihood \ Impact</th>
                    {[1, 2, 3, 4, 5].map((col) => (
                      <th key={`impact-${col}`}>{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {matrixRows.map((row, rowIdx) => (
                    <tr key={`matrix-row-${rowIdx}`}>
                      <th>{rowIdx + 1}</th>
                      {row.map((cell, colIdx) => {
                        const color = cell.color || palette[cell.level] || "#dddddd";
                        return (
                          <td
                            key={`matrix-cell-${rowIdx}-${colIdx}`}
                            style={{ backgroundColor: color }}
                            title={`${cell.label} (${cell.count || 0})`}
                          >
                            <div className="matrix-cell">
                              <span>{cell.label}</span>
                              <strong>{cell.count || 0}</strong>
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
      <div className="grid two-cols" style={{ gap: "24px", alignItems: "stretch" }}>
        <Card>
          <CardHeader>
            <CardTitle>Risk Register</CardTitle>
            <CardDescription>Filter, browse and select a risk entry.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="module-grid" style={{ gap: "8px", marginBottom: "12px" }}>
              <div className="form-field">
                <Label htmlFor="risk-status-filter">Status</Label>
                <Select
                  id="risk-status-filter"
                  value={filters.status}
                  onChange={handleFilterChange("status")}
                  disabled={loading}
                >
                  <SelectOption value="">All</SelectOption>
                  {STATUS_OPTIONS.map((option) => (
                    <SelectOption value={option.value} key={`status-${option.value}`}>
                      {option.label}
                    </SelectOption>
                  ))}
                </Select>
              </div>
              <div className="form-field">
                <Label htmlFor="risk-category-filter">Category</Label>
                <Input
                  id="risk-category-filter"
                  value={filters.category}
                  onChange={handleFilterChange("category")}
                  placeholder="Category"
                  disabled={loading}
                />
              </div>
              <div className="form-field">
                <Label htmlFor="risk-search-filter">Search</Label>
                <Input
                  id="risk-search-filter"
                  value={filters.search}
                  onChange={handleFilterChange("search")}
                  placeholder="Risk code, title or process"
                  disabled={loading}
                />
              </div>
            </form>

            {loading ? (
              <div className="loading-state">Loading risks...</div>
            ) : error ? (
              <p style={{ color: "#b3261e" }}>{error}</p>
            ) : risks.length === 0 ? (
              <div className="empty-state">No risks registered yet.</div>
            ) : (
              <div className="list-scroll">
                <ul className="data-list">
                  {risks.map((risk) => {
                    const badge = STATUS_BADGES[risk.status] || STATUS_BADGES.identified;
                    const isActive = risk.id === selectedRiskId;
                    return (
                      <li
                        key={risk.id}
                        className={isActive ? "data-list-item active" : "data-list-item"}
                        onClick={() => handleSelectRisk(risk.id)}
                      >
                        <div className="cell-title">{risk.risk_code}</div>
                        <div className="cell-muted">{risk.title}</div>
                        <div className="cell-meta">
                          <Badge variant={badge.variant}>{badge.label}</Badge>
                          <span>{risk.owner}</span>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Risk Detail</CardTitle>
            <CardDescription>Scores, controls, history and linked records.</CardDescription>
          </CardHeader>
          <CardContent>
            {riskLoading ? (
              <div className="loading-state">Loading risk detail...</div>
            ) : riskError ? (
              <p style={{ color: "#b3261e" }}>{riskError}</p>
            ) : !selectedRisk ? (
              <div className="empty-state">Select a risk to view its detail.</div>
            ) : (
              <div className="risk-detail">
                <div className="stats-grid">
                  <div className="stat-card">
                    <span>Inherent Score</span>
                    <strong>{formatScore(selectedRisk.risk_score?.inherent)}</strong>
                    <Badge variant={
                      LEVEL_BADGES[selectedRisk.risk_score?.inherent_level]?.variant || "secondary"
                    }>
                      {LEVEL_BADGES[selectedRisk.risk_score?.inherent_level]?.label || "-"}
                    </Badge>
                  </div>
                  <div className="stat-card">
                    <span>Residual Score</span>
                    <strong>{formatScore(selectedRisk.risk_score?.residual)}</strong>
                    <Badge variant={
                      LEVEL_BADGES[selectedRisk.risk_score?.residual_level]?.variant || "secondary"
                    }>
                      {LEVEL_BADGES[selectedRisk.risk_score?.residual_level]?.label || "-"}
                    </Badge>
                  </div>
                  <div className="stat-card">
                    <span>Status</span>
                    <strong>
                      <Badge variant={
                        STATUS_BADGES[selectedRisk.status]?.variant || "secondary"
                      }>
                        {STATUS_BADGES[selectedRisk.status]?.label || selectedRisk.status}
                      </Badge>
                    </strong>
                  </div>
                  <div className="stat-card">
                    <span>Next Review</span>
                    <strong>
                      {selectedRisk.next_review_date
                        ? formatDate(selectedRisk.next_review_date)
                        : "-"}
                    </strong>
                  </div>
                </div>

                <section className="detail-section">
                  <h3>{selectedRisk.title}</h3>
                  <p style={{ marginBottom: "6px" }}>{selectedRisk.description || "No description."}</p>
                  <ul className="history-list">
                    <li>
                      <strong>Risk Code:</strong> {selectedRisk.risk_code}
                    </li>
                    <li>
                      <strong>Category:</strong> {selectedRisk.category || "-"}
                    </li>
                    <li>
                      <strong>Process:</strong> {selectedRisk.process || "-"}
                    </li>
                    <li>
                      <strong>Owner:</strong> {selectedRisk.owner || "-"}
                    </li>
                    <li>
                      <strong>Controls Effectiveness:</strong> {formatScore(selectedRisk.controls_effectiveness)}
                    </li>
                  </ul>
                </section>

                <section className="detail-section">
                  <h4>Custom Factors</h4>
                  {selectedRiskFactors.length === 0 ? (
                    <div className="empty-state">No additional factors recorded.</div>
                  ) : (
                    <ul className="history-list">
                      {selectedRiskFactors.map((factor, idx) => (
                        <li key={`factor-${idx}`}>
                          <strong>{factor.name}</strong> — value: {factor.value} weight: {factor.weight}
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
                <section className="detail-section">
                  <h4>Linked Records</h4>
                  <div className="tag-row">
                    {(selectedRisk.linked_capa_ids || []).map((id) => (
                      <span key={`risk-capa-${id}`} className="tag">
                        CAPA: {id}
                      </span>
                    ))}
                    {(selectedRisk.linked_audit_finding_ids || []).map((id) => (
                      <span key={`risk-finding-${id}`} className="tag">
                        Finding: {id}
                      </span>
                    ))}
                    {selectedRisk.linked_capa_ids?.length || selectedRisk.linked_audit_finding_ids?.length ? null : (
                      <span className="cell-muted">No linked records.</span>
                    )}
                  </div>
                </section>

                <section className="detail-section">
                  <h4>Trend</h4>
                  {trendPoints.length === 0 ? (
                    <div className="empty-state">Trend data not available.</div>
                  ) : (
                    <ul className="history-list">
                      {trendPoints.map((point, idx) => (
                        <li key={`trend-${idx}`}>
                          <div className="history-header">
                            <strong>{formatDateTime(point.recorded_at)}</strong>
                            <span>{point.status}</span>
                          </div>
                          <div className="history-meta">
                            Inherent: {formatScore(point.inherent_score)} — Residual: {formatScore(point.residual_score)}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>

                <section className="detail-section">
                  <h4>Revisions</h4>
                  {revisions.length === 0 ? (
                    <div className="empty-state">No revisions captured yet.</div>
                  ) : (
                    <div className="table-wrapper">
                      <table>
                        <thead>
                          <tr>
                            <th>#</th>
                            <th>Changed At</th>
                            <th>Changed By</th>
                            <th>Note</th>
                          </tr>
                        </thead>
                        <tbody>
                          {revisions.map((revision) => (
                            <tr key={`revision-${revision.revision_no}`}>
                              <td>{revision.revision_no}</td>
                              <td>{formatDateTime(revision.changed_at)}</td>
                              <td>{revision.changed_by}</td>
                              <td>{revision.note || "-"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {revisions.length >= 2 && (
                    <div className="form-grid" style={{ gap: "8px", marginTop: "12px" }}>
                      <div className="form-field">
                        <Label htmlFor="compare-base">Base Revision</Label>
                        <Select
                          id="compare-base"
                          value={compareSelection.base}
                          onChange={handleCompareSelectionChange("base")}
                        >
                          <SelectOption value="">Select</SelectOption>
                          {revisions.map((revision) => (
                            <SelectOption
                              value={String(revision.revision_no)}
                              key={`compare-base-${revision.revision_no}`}
                            >
                              {revision.revision_no}
                            </SelectOption>
                          ))}
                        </Select>
                      </div>
                      <div className="form-field">
                        <Label htmlFor="compare-target">Target Revision</Label>
                        <Select
                          id="compare-target"
                          value={compareSelection.target}
                          onChange={handleCompareSelectionChange("target")}
                        >
                          <SelectOption value="">Select</SelectOption>
                          {revisions.map((revision) => (
                            <SelectOption
                              value={String(revision.revision_no)}
                              key={`compare-target-${revision.revision_no}`}
                            >
                              {revision.revision_no}
                            </SelectOption>
                          ))}
                        </Select>
                      </div>
                      <div className="form-field" style={{ alignSelf: "flex-end" }}>
                        <Button type="button" variant="outline" onClick={handleCompareRevisions}>
                          Compare
                        </Button>
                      </div>
                    </div>
                  )}

                  {compareResult && (
                    <div className="compare-result" style={{ marginTop: "12px" }}>
                      <h5>
                        Difference between revisions {compareResult.base_revision} and {compareResult.target_revision}
                      </h5>
                      {Object.keys(compareResult.diff || {}).length === 0 ? (
                        <div className="empty-state">No changes detected.</div>
                      ) : (
                        <div className="table-wrapper">
                          <table>
                            <thead>
                              <tr>
                                <th>Field</th>
                                <th>Previous</th>
                                <th>Current</th>
                              </tr>
                            </thead>
                            <tbody>
                              {Object.entries(compareResult.diff).map(([field, value]) => (
                                <tr key={`diff-${field}`}>
                                  <td>{field}</td>
                                  <td>{String(value.from ?? "-")}</td>
                                  <td>{String(value.to ?? "-")}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}
                </section>

                <section className="detail-section" style={{ display: "flex", gap: "8px" }}>
                  <Button type="button" variant="outline" onClick={handleGenerateReport}>
                    Generate Report
                  </Button>
                  <Button type="button" variant="outline" onClick={handleRefreshRisk}>
                    Refresh Detail
                  </Button>
                </section>

                {reportPreview && (
                  <section className="detail-section">
                    <h4>{reportPreview.title}</h4>
                    <div
                      className="report-preview"
                      dangerouslySetInnerHTML={{ __html: reportPreview.body || "" }}
                    />
                    <p className="cell-muted" style={{ marginTop: "8px" }}>
                      Generated at {formatDateTime(reportPreview.generated_at)}
                    </p>
                  </section>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Create Risk</CardTitle>
          <CardDescription>Register a new risk item and calculate its scores.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreateSubmit} className="module-grid" style={{ gap: "10px" }}>
            <div className="form-field">
              <Label htmlFor="create-title">Title</Label>
              <Input
                id="create-title"
                value={createForm.title}
                onChange={handleCreateInputChange("title")}
                required
              />
            </div>
            <div className="form-field">
              <Label htmlFor="create-category">Category</Label>
              <Input
                id="create-category"
                value={createForm.category}
                onChange={handleCreateInputChange("category")}
                required
              />
            </div>
            <div className="form-grid">
              <div className="form-field">
                <Label htmlFor="create-process">Process</Label>
                <Input
                  id="create-process"
                  value={createForm.process}
                  onChange={handleCreateInputChange("process")}
                />
              </div>
              <div className="form-field">
                <Label htmlFor="create-owner">Owner</Label>
                <Input
                  id="create-owner"
                  value={createForm.owner}
                  onChange={handleCreateInputChange("owner")}
                  required
                />
              </div>
            </div>
            <div className="form-field">
              <Label htmlFor="create-description">Description</Label>
              <Textarea
                id="create-description"
                value={createForm.description}
                onChange={handleCreateInputChange("description")}
                rows={2}
              />
            </div>
            <div className="form-grid">
              <div className="form-field">
                <Label htmlFor="create-status">Status</Label>
                <Select
                  id="create-status"
                  value={createForm.status}
                  onChange={handleCreateInputChange("status")}
                >
                  {STATUS_OPTIONS.map((option) => (
                    <SelectOption key={`create-status-${option.value}`} value={option.value}>
                      {option.label}
                    </SelectOption>
                  ))}
                </Select>
              </div>
              <div className="form-field">
                <Label htmlFor="create-next-review">Next Review</Label>
                <Input
                  id="create-next-review"
                  type="datetime-local"
                  value={createForm.next_review_date}
                  onChange={handleCreateInputChange("next_review_date")}
                />
              </div>
            </div>
            <div className="form-grid">
              <div className="form-field">
                <Label htmlFor="create-likelihood">Likelihood (1-5)</Label>
                <Input
                  id="create-likelihood"
                  type="number"
                  min={1}
                  max={5}
                  step={1}
                  value={createForm.likelihood}
                  onChange={handleCreateInputChange("likelihood")}
                />
              </div>
              <div className="form-field">
                <Label htmlFor="create-impact">Impact (1-5)</Label>
                <Input
                  id="create-impact"
                  type="number"
                  min={1}
                  max={5}
                  step={1}
                  value={createForm.impact}
                  onChange={handleCreateInputChange("impact")}
                />
              </div>
              <div className="form-field">
                <Label htmlFor="create-detection">Detection (optional)</Label>
                <Input
                  id="create-detection"
                  type="number"
                  min={0}
                  max={5}
                  step={0.1}
                  value={createForm.detection}
                  onChange={handleCreateInputChange("detection")}
                />
              </div>
              <div className="form-field">
                <Label htmlFor="create-controls">Controls Effectiveness (0-1)</Label>
                <Input
                  id="create-controls"
                  type="number"
                  min={0}
                  max={1}
                  step={0.05}
                  value={createForm.controls_effectiveness}
                  onChange={handleCreateInputChange("controls_effectiveness")}
                />
              </div>
            </div>

            <div className="form-field">
              <Label>Custom Factors</Label>
              <div className="form-grid" style={{ gap: "6px" }}>
                <Input
                  placeholder="Name"
                  value={createFactorDraft.name}
                  onChange={handleCreateFactorDraftChange("name")}
                />
                <Input
                  placeholder="Value"
                  value={createFactorDraft.value}
                  onChange={handleCreateFactorDraftChange("value")}
                  type="number"
                />
                <Input
                  placeholder="Weight"
                  value={createFactorDraft.weight}
                  onChange={handleCreateFactorDraftChange("weight")}
                  type="number"
                />
                <Button type="button" variant="outline" onClick={addCreateFactor}>
                  Add
                </Button>
              </div>
              {createFactors.length > 0 && (
                <ul className="tag-list" style={{ marginTop: "6px" }}>
                  {createFactors.map((factor, idx) => (
                    <li key={`create-factor-${idx}`}>
                      {factor.name} ({factor.value} × {factor.weight})
                      <button
                        type="button"
                        className="tag-remove"
                        onClick={() => removeCreateFactor(idx)}
                      >
                        ×
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="form-grid">
              <div className="form-field">
                <Label htmlFor="create-linked-capa">Linked CAPA IDs</Label>
                <Input
                  id="create-linked-capa"
                  value={createForm.linked_capa_ids}
                  onChange={handleCreateInputChange("linked_capa_ids")}
                  placeholder="Comma separated"
                />
              </div>
              <div className="form-field">
                <Label htmlFor="create-linked-findings">Linked Findings</Label>
                <Input
                  id="create-linked-findings"
                  value={createForm.linked_audit_finding_ids}
                  onChange={handleCreateInputChange("linked_audit_finding_ids")}
                  placeholder="Comma separated"
                />
              </div>
            </div>

            <div className="actions-row" style={{ marginTop: "12px" }}>
              <Button type="submit" disabled={createSaving}>
                {createSaving ? "Creating..." : "Create Risk"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setCreateForm(initialCreateForm);
                  setCreateFactors([]);
                  setCreateFactorDraft(initialFactorDraft);
                  setCreateError("");
                  setCreateSuccess("");
                }}
              >
                Reset
              </Button>
            </div>
            {createError && <p style={{ color: "#b3261e" }}>{createError}</p>}
            {createSuccess && <p style={{ color: "#0f6f0f" }}>{createSuccess}</p>}
          </form>
        </CardContent>
      </Card>
      {selectedRisk && (
        <Card>
          <CardHeader>
            <CardTitle>Update Risk</CardTitle>
            <CardDescription>Adjust ratings, status or linked records.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleUpdateSubmit} className="module-grid" style={{ gap: "10px" }}>
              <div className="form-field">
                <Label htmlFor="update-title">Title</Label>
                <Input
                  id="update-title"
                  value={updateForm.title}
                  onChange={handleUpdateInputChange("title")}
                  required
                />
              </div>
              <div className="form-field">
                <Label htmlFor="update-category">Category</Label>
                <Input
                  id="update-category"
                  value={updateForm.category}
                  onChange={handleUpdateInputChange("category")}
                  required
                />
              </div>
              <div className="form-grid">
                <div className="form-field">
                  <Label htmlFor="update-process">Process</Label>
                  <Input
                    id="update-process"
                    value={updateForm.process}
                    onChange={handleUpdateInputChange("process")}
                  />
                </div>
                <div className="form-field">
                  <Label htmlFor="update-owner">Owner</Label>
                  <Input
                    id="update-owner"
                    value={updateForm.owner}
                    onChange={handleUpdateInputChange("owner")}
                    required
                  />
                </div>
              </div>
              <div className="form-field">
                <Label htmlFor="update-description">Description</Label>
                <Textarea
                  id="update-description"
                  value={updateForm.description}
                  onChange={handleUpdateInputChange("description")}
                  rows={2}
                />
              </div>
              <div className="form-grid">
                <div className="form-field">
                  <Label htmlFor="update-status">Status</Label>
                  <Select
                    id="update-status"
                    value={updateForm.status}
                    onChange={handleUpdateInputChange("status")}
                  >
                    {STATUS_OPTIONS.map((option) => (
                      <SelectOption key={`update-status-${option.value}`} value={option.value}>
                        {option.label}
                      </SelectOption>
                    ))}
                  </Select>
                </div>
                <div className="form-field">
                  <Label htmlFor="update-next-review">Next Review</Label>
                  <Input
                    id="update-next-review"
                    type="datetime-local"
                    value={updateForm.next_review_date}
                    onChange={handleUpdateInputChange("next_review_date")}
                  />
                </div>
                <div className="form-field">
                  <Label htmlFor="update-revision-note">Revision Note</Label>
                  <Input
                    id="update-revision-note"
                    value={updateForm.revision_note}
                    onChange={handleUpdateInputChange("revision_note")}
                    placeholder="Optional note"
                  />
                </div>
              </div>
              <div className="form-grid">
                <div className="form-field">
                  <Label htmlFor="update-likelihood">Likelihood</Label>
                  <Input
                    id="update-likelihood"
                    type="number"
                    min={1}
                    max={5}
                    step={1}
                    value={updateForm.likelihood}
                    onChange={handleUpdateInputChange("likelihood")}
                  />
                </div>
                <div className="form-field">
                  <Label htmlFor="update-impact">Impact</Label>
                  <Input
                    id="update-impact"
                    type="number"
                    min={1}
                    max={5}
                    step={1}
                    value={updateForm.impact}
                    onChange={handleUpdateInputChange("impact")}
                  />
                </div>
                <div className="form-field">
                  <Label htmlFor="update-detection">Detection</Label>
                  <Input
                    id="update-detection"
                    type="number"
                    min={0}
                    max={5}
                    step={0.1}
                    value={updateForm.detection}
                    onChange={handleUpdateInputChange("detection")}
                  />
                </div>
                <div className="form-field">
                  <Label htmlFor="update-controls">Controls Effectiveness</Label>
                  <Input
                    id="update-controls"
                    type="number"
                    min={0}
                    max={1}
                    step={0.05}
                    value={updateForm.controls_effectiveness}
                    onChange={handleUpdateInputChange("controls_effectiveness")}
                  />
                </div>
              </div>

              <div className="form-field">
                <Label>Custom Factors</Label>
                <div className="form-grid" style={{ gap: "6px" }}>
                  <Input
                    placeholder="Name"
                    value={updateFactorDraft.name}
                    onChange={handleUpdateFactorDraftChange("name")}
                  />
                  <Input
                    placeholder="Value"
                    type="number"
                    value={updateFactorDraft.value}
                    onChange={handleUpdateFactorDraftChange("value")}
                  />
                  <Input
                    placeholder="Weight"
                    type="number"
                    value={updateFactorDraft.weight}
                    onChange={handleUpdateFactorDraftChange("weight")}
                  />
                  <Button type="button" variant="outline" onClick={addUpdateFactor}>
                    Add
                  </Button>
                </div>
                {updateFactors.length > 0 && (
                  <ul className="tag-list" style={{ marginTop: "6px" }}>
                    {updateFactors.map((factor, idx) => (
                      <li key={`update-factor-${idx}`}>
                        {factor.name} ({factor.value} × {factor.weight})
                        <button
                          type="button"
                          className="tag-remove"
                          onClick={() => removeUpdateFactor(idx)}
                        >
                          ×
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="form-grid">
                <div className="form-field">
                  <Label htmlFor="update-linked-capa">Linked CAPA IDs</Label>
                  <Input
                    id="update-linked-capa"
                    value={updateForm.linked_capa_ids}
                    onChange={handleUpdateInputChange("linked_capa_ids")}
                  />
                </div>
                <div className="form-field">
                  <Label htmlFor="update-linked-findings">Linked Findings</Label>
                  <Input
                    id="update-linked-findings"
                    value={updateForm.linked_audit_finding_ids}
                    onChange={handleUpdateInputChange("linked_audit_finding_ids")}
                  />
                </div>
              </div>

              <div className="actions-row" style={{ marginTop: "12px" }}>
                <Button type="submit" disabled={updateSaving}>
                  {updateSaving ? "Saving..." : "Update Risk"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    if (selectedRiskId) {
                      loadRiskDetail(selectedRiskId);
                    }
                  }}
                >
                  Reset Changes
                </Button>
              </div>
              {updateError && <p style={{ color: "#b3261e" }}>{updateError}</p>}
              {updateSuccess && <p style={{ color: "#0f6f0f" }}>{updateSuccess}</p>}
            </form>
          </CardContent>
        </Card>
      )}
      <Card>
        <CardHeader>
          <CardTitle>Risk Settings</CardTitle>
          <CardDescription>Current scoring formula, thresholds and colour palette.</CardDescription>
        </CardHeader>
        <CardContent>
          {settings ? (
            <div className="settings-grid">
              <div>
                <h5>Formulas</h5>
                <p><strong>Inherent:</strong> {settings.formula}</p>
                <p><strong>Residual:</strong> {settings.residual_formula || settings.formula}</p>
              </div>
              <div>
                <h5>Thresholds</h5>
                <ul className="history-list">
                  {Object.entries(settings.thresholds || {}).map(([level, limit]) => (
                    <li key={`threshold-${level}`}>
                      <Badge variant={LEVEL_BADGES[level]?.variant || "secondary"}>
                        {LEVEL_BADGES[level]?.label || level}
                      </Badge>
                      <span style={{ marginLeft: "6px" }}>{`<= ${limit ?? "Infinity"}`}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h5>Palette</h5>
                <div className="palette-row">
                  {Object.entries(settings.palette || {}).map(([level, colour]) => (
                    <div key={`palette-${level}`} className="palette-chip">
                      <span
                        className="palette-swatch"
                        style={{ backgroundColor: colour }}
                      />
                      <span>{LEVEL_BADGES[level]?.label || level}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="empty-state">Settings not loaded.</div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent Residual Trend</CardTitle>
          <CardDescription>Latest residual scores recorded across the register.</CardDescription>
        </CardHeader>
        <CardContent>
          {globalTrend.length === 0 ? (
            <div className="empty-state">Trend data not available.</div>
          ) : (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Recorded</th>
                    <th>Status</th>
                    <th>Inherent</th>
                    <th>Residual</th>
                  </tr>
                </thead>
                <tbody>
                  {globalTrend.map((point, idx) => (
                    <tr key={`global-trend-${idx}`}>
                      <td>{formatDateTime(point.recorded_at)}</td>
                      <td>{point.status}</td>
                      <td>{formatScore(point.inherent_score)}</td>
                      <td>{formatScore(point.residual_score)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

const Label = ({ htmlFor, children }) => (
  <label htmlFor={htmlFor} style={{ fontWeight: 500 }}>
    {children}
  </label>
);

export default RisksModule;
