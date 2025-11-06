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
import { Label } from "../components/ui/Label";
import { Select, SelectOption } from "../components/ui/Select";
import { Textarea } from "../components/ui/Textarea";
import { Badge } from "../components/ui/Badge";
import { useApiConnection } from "./useApiConnection";
import { formatDate, formatDateTime } from "./formatters";

const STATUS_CONFIG = {
  open: { label: "Acik", variant: "info" },
  investigating: { label: "Analiz", variant: "warning" },
  implementing: { label: "Uygulama", variant: "warning" },
  pending_closure: { label: "Kapanis Onayi Bekliyor", variant: "warning" },
  closed: { label: "Kapandi", variant: "success" },
  cancelled: { label: "Iptal", variant: "danger" },
};

const ACTION_STATUS_OPTIONS = [
  { value: "open", label: "Acik" },
  { value: "in_progress", label: "Devam ediyor" },
  { value: "completed", label: "Tamamlandi" },
];

const CapasModule = () => {
  const { apiUrl, headers, isReady, authDisabled, refresh } = useApiConnection();
  const [capas, setCapas] = useState([]);
  const [filters, setFilters] = useState({
    department: "",
    status: "",
    search: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [selectedCapa, setSelectedCapa] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");

  const [updateForm, setUpdateForm] = useState({
    status: "",
    root_cause_analysis: "",
    immediate_action: "",
    effectiveness_review: "",
    file_attachments: "",
    target_date: "",
    team_members: "",
    initial_improvement_report_date: "",
    linked_risk_ids: "",
    linked_equipment_ids: "",
  });
  const [updateSaving, setUpdateSaving] = useState(false);
  const [updateError, setUpdateError] = useState("");
  const [updateSuccess, setUpdateSuccess] = useState("");

  const [actionForm, setActionForm] = useState({
    action_type: "corrective",
    action_description: "",
    responsible_person: "",
    due_date: "",
    status: "open",
    evidence: "",
  });
  const [actionSaving, setActionSaving] = useState(false);
  const [actionError, setActionError] = useState("");
  const [actionSuccess, setActionSuccess] = useState("");
  const [actionUpdates, setActionUpdates] = useState({});
  const [closureRequestNote, setClosureRequestNote] = useState("");
  const [closureDecisionNote, setClosureDecisionNote] = useState("");
  const [closureSaving, setClosureSaving] = useState(false);

  const resetDetailState = useCallback(() => {
    setSelectedCapa(null);
    setDetailError("");
    setUpdateError("");
    setUpdateSuccess("");
    setActionError("");
    setActionSuccess("");
    setActionUpdates({});
    setClosureRequestNote("");
    setClosureDecisionNote("");
  }, []);

  const fetchCapas = useCallback(async () => {
    if (!isReady) return;
    setLoading(true);
    setError("");
    try {
      const { data } = await axios.get(`${apiUrl}/capas`, { headers });
      setCapas(data || []);
    } catch (err) {
      const message =
        err?.response?.data?.detail || err?.message || "CAPA listesi yuklenemedi.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [apiUrl, headers, isReady]);

  useEffect(() => {
    if (!isReady) {
      setCapas([]);
      resetDetailState();
      return;
    }
    fetchCapas();
  }, [fetchCapas, isReady, resetDetailState]);

  const uniqueDepartments = useMemo(() => {
    const items = new Set();
    capas.forEach((item) => {
      if (item.department) {
        items.add(item.department);
      }
    });
    return Array.from(items).sort((a, b) => a.localeCompare(b));
  }, [capas]);

  const filteredCapas = useMemo(() => {
    return capas.filter((item) => {
      if (
        filters.department &&
        item.department?.toLowerCase() !== filters.department.toLowerCase()
      ) {
        return false;
      }
      if (filters.status && item.status !== filters.status) {
        return false;
      }
      if (filters.search) {
        const term = filters.search.toLowerCase();
        if (
          !(
            item.capa_no?.toLowerCase().includes(term) ||
            item.title?.toLowerCase().includes(term) ||
            item.team_leader?.toLowerCase().includes(term)
          )
        ) {
          return false;
        }
      }
      return true;
    });
  }, [capas, filters]);

  const handleInput = (field) => (event) => {
    setFilters((prev) => ({
      ...prev,
      [field]: event.target.value,
    }));
  };

  const resetFilters = () => {
    setFilters({
      department: "",
      status: "",
      search: "",
    });
  };

  const loadCapaDetail = useCallback(
    async (capaId) => {
      if (!capaId || !isReady) return;
      setDetailLoading(true);
      setDetailError("");
      try {
        const { data } = await axios.get(`${apiUrl}/capas/${capaId}`, { headers });
        setSelectedCapa(data || null);
        setUpdateForm({
          status: data?.status || "",
          root_cause_analysis: data?.root_cause_analysis || "",
          immediate_action: data?.immediate_action || "",
          effectiveness_review: data?.effectiveness_review || "",
          file_attachments: (data?.file_attachments || []).join(", "),
          target_date: data?.target_date ? data.target_date.slice(0, 16) : "",
          team_members: (data?.team_members || []).join(", "),
          initial_improvement_report_date: data?.initial_improvement_report_date
            ? data.initial_improvement_report_date.slice(0, 16)
            : "",
          linked_risk_ids: (data?.linked_risk_ids || []).join(", "),
          linked_equipment_ids: (data?.linked_equipment_ids || []).join(", "),
        });
        setUpdateError("");
        setUpdateSuccess("");
        setActionForm({
          action_type: "corrective",
          action_description: "",
          responsible_person: "",
          due_date: "",
          status: "open",
          evidence: "",
        });
        setActionError("");
        setActionSuccess("");
        setActionUpdates({});
        setClosureRequestNote("");
        setClosureDecisionNote("");
      } catch (err) {
        const message =
          err?.response?.data?.detail || err?.message || "CAPA detayi alinamiadi.";
        setDetailError(message);
      } finally {
        setDetailLoading(false);
      }
    },
    [apiUrl, headers, isReady]
  );

  const handleSelectCapa = useCallback(
    (capa) => {
      if (!isReady) return;
      setSelectedCapa(capa);
      loadCapaDetail(capa.id);
    },
    [isReady, loadCapaDetail]
  );

  const handleCloseDetail = () => {
    resetDetailState();
  };

  const connectionWarning = !isReady;

  const renderActionList = (actions, title) => {
    if (!actions?.length) {
      return <p>{title} tanımlanmamış.</p>;
    }
    return (
      <ul className="history-list">
        {actions.map((action) => {
          const original = action;
          const localState = actionUpdates[action.id] || {
            status: original.status,
            evidence: original.evidence || "",
            completion_date: original.completion_date
              ? original.completion_date.slice(0, 16)
              : "",
          };
          return (
            <li key={action.id}>
              <div className="history-header">
                <div>
                  <strong>{action.action_description}</strong>
                  <div className="history-meta">
                    Sorumlu: {action.responsible_person || "-"} | Hedef:{" "}
                    {formatDate(action.due_date)}
                  </div>
                </div>
                <Badge variant={action.status === "completed" ? "success" : "warning"}>
                  {action.status}
                </Badge>
              </div>
              <div className="history-meta">
                {action.evidence && <span>Kanıt: {action.evidence}</span>}
                {action.completion_date && (
                  <span> | Tamamlama: {formatDateTime(action.completion_date)}</span>
                )}
              </div>
              <div className="grid two-cols" style={{ marginTop: "12px", gap: "12px" }}>
                <Select
                  value={localState.status}
                  onChange={(event) =>
                    setActionUpdates((prev) => ({
                      ...prev,
                      [action.id]: {
                        ...localState,
                        status: event.target.value,
                      },
                    }))
                  }
                >
                  {ACTION_STATUS_OPTIONS.map((option) => (
                    <SelectOption key={option.value} value={option.value}>
                      {option.label}
                    </SelectOption>
                  ))}
                </Select>
                <Input
                  type="datetime-local"
                  value={localState.completion_date}
                  onChange={(event) =>
                    setActionUpdates((prev) => ({
                      ...prev,
                      [action.id]: {
                        ...localState,
                        completion_date: event.target.value,
                      },
                    }))
                  }
                />
                <Input
                  placeholder="Kanıt"
                  value={localState.evidence}
                  onChange={(event) =>
                    setActionUpdates((prev) => ({
                      ...prev,
                      [action.id]: {
                        ...localState,
                        evidence: event.target.value,
                      },
                    }))
                  }
                />
              </div>
              <div className="actions-row" style={{ marginTop: "8px" }}>
                <Button
                  variant="outline"
                  onClick={async () => {
                    if (!isReady || !selectedCapa) return;
                    const payload = {};
                    if (localState.status && localState.status !== action.status) {
                      payload.status = localState.status;
                    }
                    if (
                      localState.evidence !== undefined &&
                      localState.evidence !== (action.evidence || "")
                    ) {
                      payload.evidence = localState.evidence;
                    }
                    if (localState.completion_date) {
                      const iso = new Date(localState.completion_date).toISOString();
                      if (iso !== action.completion_date) {
                        payload.completion_date = iso;
                      }
                    } else if (action.completion_date) {
                      payload.completion_date = null;
                    }
                    if (!Object.keys(payload).length) {
                      setActionSuccess("Degisiklik bulunmuyor.");
                      return;
                    }
                    try {
                      await axios.patch(
                        `${apiUrl}/capas/${selectedCapa.id}/actions/${action.id}`,
                        payload,
                        { headers }
                      );
                      setActionSuccess("Aksiyon guncellendi.");
                      await loadCapaDetail(selectedCapa.id);
                    } catch (err) {
                      const message =
                        err?.response?.data?.detail ||
                        err?.message ||
                        "Aksiyon guncellenemedi.";
                      setActionError(message);
                    }
                  }}
                  disabled={!isReady}
                >
                  Kaydet
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
    );
  };

  return (
    <div className="module-wrapper">
      <header className="module-header">
        <div>
          <h1>CAPA / Duzeltici Onleyici Faaliyetler</h1>
          <p>
            CAPA kayitlarinin durumu, sorumlulari ve hedef tarihleri bu ekranda
            listelenir.
          </p>
        </div>
        <Button variant="outline" onClick={fetchCapas}>
          Yenile
        </Button>
      </header>

      {connectionWarning && (
        <Card>
          <CardHeader>
            <CardTitle>Baglanti Gerekli</CardTitle>
            <CardDescription>
              DOF sayfasindan API ve gerekirse token girildiginde veriler otomatik
              yansir.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={refresh}>Baglanti Bilgilerini Yenile</Button>
          </CardContent>
        </Card>
      )}

      {error && !loading && (
        <Card>
          <CardHeader>
            <CardTitle>Hata</CardTitle>
          </CardHeader>
          <CardContent>
            <p>{error}</p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Filtreler</CardTitle>
          <CardDescription>
            Departman, durum veya anahtar kelimeyle arama yapin.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid three-cols">
            <div className="form-field">
              <Label htmlFor="capa-department">Departman</Label>
              <Select
                id="capa-department"
                value={filters.department}
                onChange={handleInput("department")}
              >
                <SelectOption value="">Tum departmanlar</SelectOption>
                {uniqueDepartments.map((department) => (
                  <SelectOption key={department} value={department}>
                    {department}
                  </SelectOption>
                ))}
              </Select>
            </div>
            <div className="form-field">
              <Label htmlFor="capa-status">Durum</Label>
              <Select id="capa-status" value={filters.status} onChange={handleInput("status")}>
                <SelectOption value="">Tum durumlar</SelectOption>
                {Object.keys(STATUS_CONFIG).map((status) => (
                  <SelectOption key={status} value={status}>
                    {STATUS_CONFIG[status].label}
                  </SelectOption>
                ))}
              </Select>
            </div>
            <div className="form-field">
              <Label htmlFor="capa-search">Arama</Label>
              <Input
                id="capa-search"
                value={filters.search}
                onChange={handleInput("search")}
                placeholder="CAPA no, baslik veya sorumlu"
              />
            </div>
          </div>
          <div className="actions-row">
            <Button variant="secondary" onClick={fetchCapas} disabled={loading || !isReady}>
              Listeyi Yenile
            </Button>
            <Button variant="outline" onClick={resetFilters}>
              Temizle
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>CAPA Listesi</CardTitle>
          <CardDescription>
            {filteredCapas.length} kayit gosteriliyor (toplam {capas.length} kayit).
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="loading-state">Veriler yukleniyor...</div>
          ) : filteredCapas.length === 0 ? (
            <div className="empty-state">Eslesen CAPA kaydi bulunamadi.</div>
          ) : (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>No</th>
                    <th>Baslik</th>
                    <th>Departman</th>
                    <th>Durum</th>
                    <th>Hedef Tarih</th>
                    <th>Takim Lideri</th>
                    <th>Guncelleme</th>
                    <th>Islem</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCapas.map((item) => {
                    const statusConfig = STATUS_CONFIG[item.status] || STATUS_CONFIG.open;
                    return (
                      <tr key={item.id}>
                        <td>{item.capa_no}</td>
                        <td>
                          <div className="cell-title">{item.title}</div>
                          <div className="cell-muted">{item.source}</div>
                        </td>
                        <td>{item.department || "-"}</td>
                        <td>
                          <Badge variant={statusConfig.variant}>{statusConfig.label}</Badge>
                        </td>
                        <td>{item.target_date ? formatDate(item.target_date) : "-"}</td>
                        <td>{item.team_leader || "-"}</td>
                        <td>{formatDateTime(item.updated_at)}</td>
                        <td>
                          <Button
                            variant="outline"
                            onClick={() => handleSelectCapa(item)}
                            disabled={!isReady}
                          >
                            Detay
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {selectedCapa && (
        <>
          <Card>
            <CardHeader>
              <div className="module-header">
                <div>
                  <h2>
                    {selectedCapa.capa_no} - {selectedCapa.title}
                  </h2>
                  <p>
                    Durum: {STATUS_CONFIG[selectedCapa.status]?.label || selectedCapa.status}
                  </p>
                </div>
                <div className="actions-row">
                  <Button variant="outline" onClick={() => loadCapaDetail(selectedCapa.id)}>
                    Yenile
                  </Button>
                  <Button variant="ghost" onClick={handleCloseDetail}>
                    Kapat
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {detailLoading ? (
                <div className="loading-state">CAPA detayi yukleniyor...</div>
              ) : detailError ? (
                <p>{detailError}</p>
              ) : (
                <div className="detail-layout">
                  <section>
                    <h3>Temel Bilgiler</h3>
                    <ul className="history-list">
                      <li>
                        <strong>Kaynak:</strong> {selectedCapa.source || "-"}
                      </li>
                      <li>
                        <strong>Departman:</strong> {selectedCapa.department || "-"}
                      </li>
                      <li>
                        <strong>Takim Lideri:</strong> {selectedCapa.team_leader || "-"}
                      </li>
                      <li>
                        <strong>Takim Uyeleri:</strong>{" "}
                        {selectedCapa.team_members?.length
                          ? selectedCapa.team_members.join(", ")
                          : "-"}
                      </li>
                      <li>
                        <strong>Hedef Tarih:</strong>{" "}
                        {selectedCapa.target_date ? formatDate(selectedCapa.target_date) : "-"}
                      </li>
                      <li>
                        <strong>Ilk Iyilestirme Raporu:</strong>{" "}
                        {selectedCapa.initial_improvement_report_date
                          ? formatDateTime(selectedCapa.initial_improvement_report_date)
                          : "-"}
                      </li>
                      <li>
                        <strong>Olusturan:</strong> {selectedCapa.initiated_by || "-"}
                      </li>
                      <li>
                        <strong>Olusturma:</strong> {formatDateTime(selectedCapa.created_at)}
                      </li>
                      <li>
                        <strong>Son Guncelleme:</strong>{" "}
                        {formatDateTime(selectedCapa.updated_at)}
                      </li>
                    </ul>
                  </section>
                  <section>
                    <h3>Uygunsuzluk Tanımı</h3>
                    <p>{selectedCapa.nonconformity_description || "-"}</p>
                  </section>
                  <section>
                    <h3>Kök Neden Analizi</h3>
                    <p>{selectedCapa.root_cause_analysis || "-"}</p>
                  </section>
                  <section>
                    <h3>Acil Aksiyonlar</h3>
                    <p>{selectedCapa.immediate_action || "-"}</p>
                  </section>
                  <section>
                    <h3>Etkinlik Degerlendirmesi</h3>
                    <p>{selectedCapa.effectiveness_review || "-"}</p>
                  </section>
                  <section>
                    <h3>Dosya Ekleri</h3>
                    {selectedCapa.file_attachments?.length ? (
                      <ul className="history-list">
                        {selectedCapa.file_attachments.map((file) => (
                          <li key={file}>{file}</li>
                        ))}
                      </ul>
                    ) : (
                      <p>Ekli dosya yok.</p>
                    )}
                  </section>
                  <section>
                    <h3>Bagli Risk Kayitlari</h3>
                    {selectedCapa.linked_risk_ids?.length ? (
                      <ul className="history-list">
                        {selectedCapa.linked_risk_ids.map((riskId) => (
                          <li key={riskId}>{riskId}</li>
                        ))}
                      </ul>
                    ) : (
                      <p>Ilgili risk kaydi yok.</p>
                    )}
                  </section>
                  <section>
                    <h3>Bagli Cihaz Kayitlari</h3>
                    {selectedCapa.linked_equipment_ids?.length ? (
                      <ul className="history-list">
                        {selectedCapa.linked_equipment_ids.map((equipmentId) => (
                          <li key={equipmentId}>{equipmentId}</li>
                        ))}
                      </ul>
                    ) : (
                      <p>Ilgili cihaz kaydi yok.</p>
                    )}
                  </section>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>CAPA Bilgilerini Guncelle</CardTitle>
              <CardDescription>Kök neden, aksiyonlar ve dosya eklerini girin.</CardDescription>
            </CardHeader>
            <CardContent>
              <form
                onSubmit={async (event) => {
                  event.preventDefault();
                  if (!selectedCapa || !isReady) return;
                  setUpdateSaving(true);
                  setUpdateError("");
                  setUpdateSuccess("");
                  try {
                    const payload = {};
                    if (updateForm.status) payload.status = updateForm.status;
                    if (updateForm.root_cause_analysis.trim()) {
                      payload.root_cause_analysis = updateForm.root_cause_analysis.trim();
                    }
                    if (updateForm.immediate_action.trim()) {
                      payload.immediate_action = updateForm.immediate_action.trim();
                    }
                    if (updateForm.effectiveness_review.trim()) {
                      payload.effectiveness_review = updateForm.effectiveness_review.trim();
                    }
                    const fileList = updateForm.file_attachments
                      .split(",")
                      .map((item) => item.trim())
                      .filter(Boolean);
                    if (fileList.length) {
                      payload.file_attachments = fileList;
                    } else if (selectedCapa?.file_attachments?.length) {
                      payload.file_attachments = [];
                    }
                    if (updateForm.target_date) {
                      payload.target_date = new Date(updateForm.target_date).toISOString();
                    }
                    const teamMembers = updateForm.team_members
                      .split(",")
                      .map((item) => item.trim())
                      .filter((item) => item.length > 0);
                    if (teamMembers.length || selectedCapa?.team_members?.length) {
                      payload.team_members = teamMembers;
                    }
                    if (updateForm.initial_improvement_report_date) {
                      payload.initial_improvement_report_date = new Date(
                        updateForm.initial_improvement_report_date
                      ).toISOString();
                    } else if (selectedCapa?.initial_improvement_report_date) {
                      payload.initial_improvement_report_date = null;
                    }
                    const linkedRisks = updateForm.linked_risk_ids
                      .split(",")
                      .map((item) => item.trim())
                      .filter((item) => item.length > 0);
                    if (linkedRisks.length || selectedCapa?.linked_risk_ids?.length) {
                      payload.linked_risk_ids = linkedRisks;
                    }
                    const linkedEquipment = updateForm.linked_equipment_ids
                      .split(",")
                      .map((item) => item.trim())
                      .filter((item) => item.length > 0);
                    if (linkedEquipment.length || selectedCapa?.linked_equipment_ids?.length) {
                      payload.linked_equipment_ids = linkedEquipment;
                    }
                    if (!Object.keys(payload).length) {
                      setUpdateError("Guncellenecek alan seciniz.");
                      setUpdateSaving(false);
                      return;
                    }
                    await axios.patch(`${apiUrl}/capas/${selectedCapa.id}`, payload, { headers });
                    setUpdateSuccess("CAPA bilgileri guncellendi.");
                    await Promise.all([loadCapaDetail(selectedCapa.id), fetchCapas()]);
                  } catch (err) {
                    const message =
                      err?.response?.data?.detail ||
                      err?.message ||
                      "CAPA bilgileri guncellenemedi.";
                    setUpdateError(message);
                  } finally {
                    setUpdateSaving(false);
                  }
                }}
              >
                <div className="grid two-cols">
                  <div className="form-field">
                    <Label htmlFor="capa-status-select">Durum</Label>
                    <Select
                      id="capa-status-select"
                      value={updateForm.status}
                      onChange={(event) =>
                        setUpdateForm((prev) => ({ ...prev, status: event.target.value }))
                      }
                      disabled={updateSaving || detailLoading}
                    >
                      <SelectOption value="">Durum secin</SelectOption>
                      {Object.entries(STATUS_CONFIG).map(([key, config]) => (
                        <SelectOption key={key} value={key}>
                          {config.label}
                        </SelectOption>
                      ))}
                    </Select>
                  </div>
                  <div className="form-field">
                    <Label htmlFor="capa-target-date">Hedef Tarih</Label>
                    <Input
                      id="capa-target-date"
                      type="datetime-local"
                      value={updateForm.target_date}
                      onChange={(event) =>
                        setUpdateForm((prev) => ({
                          ...prev,
                          target_date: event.target.value,
                        }))
                      }
                      disabled={updateSaving || detailLoading}
                    />
                  </div>
                  <div className="form-field">
                    <Label htmlFor="capa-root-cause">Kok Neden Analizi</Label>
                    <Textarea
                      id="capa-root-cause"
                      rows={4}
                      value={updateForm.root_cause_analysis}
                      onChange={(event) =>
                        setUpdateForm((prev) => ({
                          ...prev,
                          root_cause_analysis: event.target.value,
                        }))
                      }
                      disabled={updateSaving || detailLoading}
                    />
                  </div>
                  <div className="form-field">
                    <Label htmlFor="capa-immediate-action">Acil Aksiyonlar</Label>
                    <Textarea
                      id="capa-immediate-action"
                      rows={3}
                      value={updateForm.immediate_action}
                      onChange={(event) =>
                        setUpdateForm((prev) => ({
                          ...prev,
                          immediate_action: event.target.value,
                        }))
                      }
                      disabled={updateSaving || detailLoading}
                    />
                  </div>
                  <div className="form-field">
                    <Label htmlFor="capa-effectiveness">Etkinlik Degerlendirmesi</Label>
                    <Textarea
                      id="capa-effectiveness"
                      rows={3}
                      value={updateForm.effectiveness_review}
                      onChange={(event) =>
                        setUpdateForm((prev) => ({
                          ...prev,
                          effectiveness_review: event.target.value,
                        }))
                      }
                      disabled={updateSaving || detailLoading}
                    />
                  </div>
                  <div className="form-field">
                    <Label htmlFor="capa-files-input">Dosya ID'leri (virgul ile)</Label>
                    <Input
                      id="capa-files-input"
                      value={updateForm.file_attachments}
                      onChange={(event) =>
                        setUpdateForm((prev) => ({
                          ...prev,
                          file_attachments: event.target.value,
                        }))
                      }
                      disabled={updateSaving || detailLoading}
                    />
                  </div>
                  <div className="form-field">
                    <Label htmlFor="capa-team-members">Takim Uyeleri (virgul ile)</Label>
                    <Textarea
                      id="capa-team-members"
                      rows={2}
                      value={updateForm.team_members}
                      onChange={(event) =>
                        setUpdateForm((prev) => ({
                          ...prev,
                          team_members: event.target.value,
                        }))
                      }
                      disabled={updateSaving || detailLoading}
                    />
                  </div>
                  <div className="form-field">
                    <Label htmlFor="capa-initial-report">Ilk Iyilestirme Rapor Tarihi</Label>
                    <Input
                      id="capa-initial-report"
                      type="datetime-local"
                      value={updateForm.initial_improvement_report_date}
                      onChange={(event) =>
                        setUpdateForm((prev) => ({
                          ...prev,
                          initial_improvement_report_date: event.target.value,
                        }))
                      }
                      disabled={updateSaving || detailLoading}
                    />
                  </div>
                  <div className="form-field">
                    <Label htmlFor="capa-risk-links">Bagli Risk Kayitlari (virgul ile)</Label>
                    <Input
                      id="capa-risk-links"
                      value={updateForm.linked_risk_ids}
                      onChange={(event) =>
                        setUpdateForm((prev) => ({
                          ...prev,
                          linked_risk_ids: event.target.value,
                        }))
                      }
                      disabled={updateSaving || detailLoading}
                    />
                  </div>
                  <div className="form-field">
                    <Label htmlFor="capa-equipment-links">Bagli Cihaz Kayitlari (virgul ile)</Label>
                    <Input
                      id="capa-equipment-links"
                      value={updateForm.linked_equipment_ids}
                      onChange={(event) =>
                        setUpdateForm((prev) => ({
                          ...prev,
                          linked_equipment_ids: event.target.value,
                        }))
                      }
                      disabled={updateSaving || detailLoading}
                    />
                  </div>
                </div>
                <div className="actions-row" style={{ marginTop: "12px" }}>
                  <Button type="submit" disabled={updateSaving || detailLoading || !isReady}>
                    {updateSaving ? "Guncelleniyor..." : "CAPA Bilgilerini Kaydet"}
                  </Button>
                </div>
                {updateError && (
                  <p style={{ color: "#b00020", marginTop: "8px" }}>{updateError}</p>
                )}
                {updateSuccess && (
                  <p style={{ color: "#0a8754", marginTop: "8px" }}>{updateSuccess}</p>
                )}
              </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Kapanis Onayi</CardTitle>
            <CardDescription>CAPA kaydini kapatmadan once onay surecini yonetin.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="detail-layout" style={{ gap: "16px" }}>
              <section>
                <h3>Durum</h3>
                <p>
                  Mevcut Durum: {STATUS_CONFIG[selectedCapa.status]?.label || selectedCapa.status}
                </p>
                <p>
                  {selectedCapa.closure_requested_at
                    ? `Kapanis talebi ${formatDateTime(selectedCapa.closure_requested_at)} tarihinde ` +
                      (selectedCapa.closure_requested_by || "") + " tarafindan gonderildi."
                    : "Kapanis talebi bulunmuyor."}
                </p>
                {selectedCapa.closure_decision_note && (
                  <p>Son karar notu: {selectedCapa.closure_decision_note}</p>
                )}
              </section>
              {selectedCapa.status === "pending_closure" ? (
                <section>
                  <h3>Onay Karari</h3>
                  <Textarea
                    rows={3}
                    placeholder="Onay/ret notu"
                    value={closureDecisionNote}
                    onChange={(event) => setClosureDecisionNote(event.target.value)}
                    disabled={closureSaving || detailLoading || updateSaving}
                  />
                  <div className="actions-row" style={{ marginTop: "12px" }}>
                    <Button
                      variant="outline"
                      onClick={async () => {
                        try {
                          setClosureSaving(true);
                          await axios.post(
                            `${apiUrl}/capas/${selectedCapa.id}/closure/decision`,
                            {
                              approve: false,
                              note: closureDecisionNote.trim() || undefined,
                            },
                            { headers }
                          );
                          setClosureDecisionNote("");
                          await loadCapaDetail(selectedCapa.id);
                          await fetchCapas();
                        } catch (err) {
                          const message =
                            err?.response?.data?.detail || err?.message || "Kapanis reddi gonderilemedi.";
                          setUpdateError(message);
                        } finally {
                          setClosureSaving(false);
                        }
                      }}
                      disabled={closureSaving || !isReady}
                    >
                      Reddet
                    </Button>
                    <Button
                      onClick={async () => {
                        try {
                          setClosureSaving(true);
                          await axios.post(
                            `${apiUrl}/capas/${selectedCapa.id}/closure/decision`,
                            {
                              approve: true,
                              note: closureDecisionNote.trim() || undefined,
                            },
                            { headers }
                          );
                          setClosureDecisionNote("");
                          await loadCapaDetail(selectedCapa.id);
                          await fetchCapas();
                        } catch (err) {
                          const message =
                            err?.response?.data?.detail || err?.message || "Kapanis onayi verilemedi.";
                          setUpdateError(message);
                        } finally {
                          setClosureSaving(false);
                        }
                      }}
                      disabled={closureSaving || !isReady}
                    >
                      Onayla
                    </Button>
                  </div>
                </section>
              ) : selectedCapa.status !== "closed" && selectedCapa.status !== "cancelled" ? (
                <section>
                  <h3>Kapanis Talebi</h3>
                  <Textarea
                    rows={3}
                    placeholder="Kapanis talebi notu"
                    value={closureRequestNote}
                    onChange={(event) => setClosureRequestNote(event.target.value)}
                    disabled={closureSaving || detailLoading || updateSaving}
                  />
                  <div className="actions-row" style={{ marginTop: "12px" }}>
                    <Button
                      onClick={async () => {
                        try {
                          setClosureSaving(true);
                          await axios.post(
                            `${apiUrl}/capas/${selectedCapa.id}/closure/request`,
                            { note: closureRequestNote.trim() || undefined },
                            { headers }
                          );
                          setClosureRequestNote("");
                          await loadCapaDetail(selectedCapa.id);
                          await fetchCapas();
                        } catch (err) {
                          const message =
                            err?.response?.data?.detail || err?.message || "Kapanis talebi gonderilemedi.";
                          setUpdateError(message);
                        } finally {
                          setClosureSaving(false);
                        }
                      }}
                      disabled={closureSaving || !isReady}
                    >
                      Kapanis Talep Et
                    </Button>
                  </div>
                </section>
              ) : (
                <section>
                  <h3>Kapanis Bilgileri</h3>
                  <p>
                    {selectedCapa.closed_at
                      ? `Kapanis ${formatDateTime(selectedCapa.closed_at)} tarihinde tamamlandi.`
                      : "Kayit kapanmis."}
                  </p>
                </section>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>CAPA Aksiyonlari</CardTitle>
              <CardDescription>Düzeltici ve önleyici aksiyonları yönetin.</CardDescription>
            </CardHeader>
            <CardContent>
              {detailLoading ? (
                <div className="loading-state">Aksiyonlar yukleniyor...</div>
              ) : (
                <>
                  <h3>Düzeltici Aksiyonlar</h3>
                  {renderActionList(selectedCapa.corrective_actions, "Düzeltici aksiyon")}
                  <h3 style={{ marginTop: "24px" }}>Önleyici Aksiyonlar</h3>
                  {renderActionList(selectedCapa.preventive_actions, "Önleyici aksiyon")}
                  {actionError && (
                    <p style={{ color: "#b00020", marginTop: "12px" }}>{actionError}</p>
                  )}
                  {actionSuccess && (
                    <p style={{ color: "#0a8754", marginTop: "12px" }}>{actionSuccess}</p>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Yeni Aksiyon Ekle</CardTitle>
            </CardHeader>
            <CardContent>
              <form
                onSubmit={async (event) => {
                  event.preventDefault();
                  if (!selectedCapa || !isReady) return;
                  setActionSaving(true);
                  setActionError("");
                  setActionSuccess("");
                  try {
                    if (!actionForm.action_description.trim()) {
                      setActionError("Aksiyon açıklaması zorunludur.");
                      setActionSaving(false);
                      return;
                    }
                    if (!actionForm.responsible_person.trim()) {
                      setActionError("Sorumlu kişi zorunludur.");
                      setActionSaving(false);
                      return;
                    }
                    if (!actionForm.due_date) {
                      setActionError("Hedef tarih seçmelisiniz.");
                      setActionSaving(false);
                      return;
                    }
                    const payload = {
                      action_type: actionForm.action_type,
                      action_description: actionForm.action_description.trim(),
                      responsible_person: actionForm.responsible_person.trim(),
                      due_date: new Date(actionForm.due_date).toISOString(),
                      status: actionForm.status,
                    };
                    if (actionForm.evidence.trim()) {
                      payload.evidence = actionForm.evidence.trim();
                    }
                    await axios.post(
                      `${apiUrl}/capas/${selectedCapa.id}/actions`,
                      payload,
                      { headers }
                    );
                    setActionSuccess("Yeni aksiyon oluşturuldu.");
                    setActionForm({
                      action_type: "corrective",
                      action_description: "",
                      responsible_person: "",
                      due_date: "",
                      status: "open",
                      evidence: "",
                    });
                    await loadCapaDetail(selectedCapa.id);
                  } catch (err) {
                    const message =
                      err?.response?.data?.detail ||
                      err?.message ||
                      "Aksiyon eklenemedi.";
                    setActionError(message);
                  } finally {
                    setActionSaving(false);
                  }
                }}
              >
                <div className="grid two-cols">
                  <div className="form-field">
                    <Label htmlFor="action-type">Tür</Label>
                    <Select
                      id="action-type"
                      value={actionForm.action_type}
                      onChange={(event) =>
                        setActionForm((prev) => ({
                          ...prev,
                          action_type: event.target.value,
                        }))
                      }
                      disabled={actionSaving}
                    >
                      <SelectOption value="corrective">Düzeltici</SelectOption>
                      <SelectOption value="preventive">Önleyici</SelectOption>
                    </Select>
                  </div>
                  <div className="form-field">
                    <Label htmlFor="action-status">Durum</Label>
                    <Select
                      id="action-status"
                      value={actionForm.status}
                      onChange={(event) =>
                        setActionForm((prev) => ({
                          ...prev,
                          status: event.target.value,
                        }))
                      }
                      disabled={actionSaving}
                    >
                      {ACTION_STATUS_OPTIONS.map((option) => (
                        <SelectOption key={option.value} value={option.value}>
                          {option.label}
                        </SelectOption>
                      ))}
                    </Select>
                  </div>
                  <div className="form-field" style={{ gridColumn: "1 / -1" }}>
                    <Label htmlFor="action-description">Aksiyon Açıklaması</Label>
                    <Textarea
                      id="action-description"
                      rows={3}
                      value={actionForm.action_description}
                      onChange={(event) =>
                        setActionForm((prev) => ({
                          ...prev,
                          action_description: event.target.value,
                        }))
                      }
                      disabled={actionSaving}
                    />
                  </div>
                  <div className="form-field">
                    <Label htmlFor="action-responsible">Sorumlu</Label>
                    <Input
                      id="action-responsible"
                      value={actionForm.responsible_person}
                      onChange={(event) =>
                        setActionForm((prev) => ({
                          ...prev,
                          responsible_person: event.target.value,
                        }))
                      }
                      disabled={actionSaving}
                    />
                  </div>
                  <div className="form-field">
                    <Label htmlFor="action-due-date">Hedef Tarih</Label>
                    <Input
                      id="action-due-date"
                      type="datetime-local"
                      value={actionForm.due_date}
                      onChange={(event) =>
                        setActionForm((prev) => ({
                          ...prev,
                          due_date: event.target.value,
                        }))
                      }
                      disabled={actionSaving}
                    />
                  </div>
                  <div className="form-field" style={{ gridColumn: "1 / -1" }}>
                    <Label htmlFor="action-evidence">Kanıt / Not</Label>
                    <Input
                      id="action-evidence"
                      value={actionForm.evidence}
                      onChange={(event) =>
                        setActionForm((prev) => ({
                          ...prev,
                          evidence: event.target.value,
                        }))
                      }
                      disabled={actionSaving}
                    />
                  </div>
                </div>
                <div className="actions-row" style={{ marginTop: "12px" }}>
                  <Button type="submit" disabled={actionSaving || !isReady}>
                    {actionSaving ? "Kaydediliyor..." : "Aksiyon Ekle"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};

export default CapasModule;
