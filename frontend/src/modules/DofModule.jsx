import { useEffect, useMemo, useState } from "react";
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

const STATUS_OPTIONS = [
  { value: "open", label: "Acik" },
  { value: "in_progress", label: "Devam Ediyor" },
  { value: "pending_closure", label: "Kapanis Onayi Bekliyor" },
  { value: "closed", label: "Kapandi" },
  { value: "cancelled", label: "Iptal" },
];

const STATUS_STYLES = {
  open: { label: "Acik", variant: "info" },
  in_progress: { label: "Devam Ediyor", variant: "warning" },
  pending_closure: { label: "Kapanis Onayi Bekliyor", variant: "warning" },
  closed: { label: "Kapandi", variant: "success" },
  cancelled: { label: "Iptal", variant: "danger" },
};

const getDefaultApiUrl = () => {
  const envBase =
    (typeof import.meta !== "undefined" && import.meta.env?.VITE_BACKEND_URL) ||
    (typeof process !== "undefined" ? process.env?.REACT_APP_BACKEND_URL : undefined) ||
    "http://localhost:8001";
  return `${envBase.replace(/\/$/, "")}/api`;
};

const storage = {
  api: "dof_api_url",
  token: "dof_token",
};

const DISABLE_AUTH =
  (typeof import.meta !== "undefined" &&
    String(import.meta.env?.VITE_DISABLE_AUTH ?? "false").toLowerCase() === "true") ||
  false;

const AUTO_LOGIN_ENABLED =
  !DISABLE_AUTH &&
  (typeof import.meta !== "undefined" &&
    String(import.meta.env?.VITE_AUTO_LOGIN ?? "false").toLowerCase() === "true");
const AUTO_LOGIN_USERNAME =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_AUTO_LOGIN_USERNAME) || "";
const AUTO_LOGIN_PASSWORD =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_AUTO_LOGIN_PASSWORD) || "";

const formatDate = (value) => {
  if (!value) return "-";
  try {
    return new Intl.DateTimeFormat("tr-TR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(value));
  } catch (error) {
    return value;
  }
};

const formatDateTime = (value) => {
  if (!value) return "-";
  try {
    return new Intl.DateTimeFormat("tr-TR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  } catch (error) {
    return value;
  }
};

export const DofModule = () => {
  const [apiUrl, setApiUrl] = useState(() => localStorage.getItem(storage.api) || getDefaultApiUrl());
  const [token, setToken] = useState(() => localStorage.getItem(storage.token) || "");
  const [filters, setFilters] = useState({ department: "", status: "", search: "" });
  const [departments, setDepartments] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [savingConnection, setSavingConnection] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [createError, setCreateError] = useState("");
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    department: "",
    responsible_person: "",
    due_date: "",
    team_members: "",
    initial_improvement_report_date: "",
  });
  const [selectedTask, setSelectedTask] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [statusUpdate, setStatusUpdate] = useState({ status: "", note: "" });
  const [autoLoginAttempted, setAutoLoginAttempted] = useState(false);
  const [teamForm, setTeamForm] = useState({
    team_members: "",
    initial_improvement_report_date: "",
  });
  const [teamSaving, setTeamSaving] = useState(false);
  const [teamError, setTeamError] = useState("");
  const [teamSuccess, setTeamSuccess] = useState("");
  const [closureRequestNote, setClosureRequestNote] = useState("");
  const [closureDecisionNote, setClosureDecisionNote] = useState("");
  const [closureSaving, setClosureSaving] = useState(false);

  const isConfigured = useMemo(
    () => Boolean(apiUrl && (DISABLE_AUTH || token)),
    [apiUrl, token]
  );

  const authHeaders = useMemo(() => {
    if (DISABLE_AUTH) {
      return {};
    }
    const trimmed = token.trim();
    if (!trimmed) {
      return {};
    }
    return { Authorization: `Bearer ${trimmed}` };
  }, [token, DISABLE_AUTH]);

  const endpoint = useMemo(() => apiUrl.replace(/\/$/, ""), [apiUrl]);

  const handleSaveConnection = async () => {
    try {
      setSavingConnection(true);
      localStorage.setItem(storage.api, endpoint);
      localStorage.setItem(storage.token, token.trim());
      await loadInitialData(endpoint, token.trim());
      setErrorMessage("");
    } catch (error) {
      setErrorMessage(
        error.response?.data?.detail ||
          error.message ||
          "Bağlantı doğrulanırken bir hata oluştu."
      );
    } finally {
      setSavingConnection(false);
    }
  };

  const loadDepartments = async (base, authToken) => {
    if (!base) return;
    if (!DISABLE_AUTH && !authToken) return;
    const { data } = await axios.get(`${base}/dof-tasks/departments`, {
      headers: DISABLE_AUTH ? {} : { Authorization: `Bearer ${authToken}` },
    });
    setDepartments(data);
  };

  const loadTasks = async (base, authToken, currentFilters = filters) => {
    if (!base) return;
    if (!DISABLE_AUTH && !authToken) return;
    setLoading(true);
    setErrorMessage("");

    const params = {};
    if (currentFilters.department) params.department = currentFilters.department;
    if (currentFilters.status) params.status = currentFilters.status;
    if (currentFilters.search) params.search = currentFilters.search;

    try {
      const { data } = await axios.get(`${base}/dof-tasks`, {
        headers: DISABLE_AUTH ? {} : { Authorization: `Bearer ${authToken}` },
        params,
      });
      setTasks(data.items);
    } catch (error) {
      setErrorMessage(
        error.response?.data?.detail ||
          error.message ||
          "DÖF listesi alınırken bir hata oluştu."
      );
    } finally {
      setLoading(false);
    }
  };

  const loadSummary = async (base, authToken, currentFilters = filters) => {
    if (!base) return;
    if (!DISABLE_AUTH && !authToken) return;

    const params = {};
    if (currentFilters.department) params.department = currentFilters.department;
    if (currentFilters.status) params.status = currentFilters.status;

    try {
      const { data } = await axios.get(`${base}/dof-tasks/report/summary`, {
        headers: DISABLE_AUTH ? {} : { Authorization: `Bearer ${authToken}` },
        params,
      });
      setSummary(data);
    } catch (error) {
      setSummary(null);
    }
  };

  const loadInitialData = async (base, authToken) => {
    const normalizedToken = (authToken || "").trim();
    await Promise.all([
      loadDepartments(base, normalizedToken),
      loadTasks(base, normalizedToken),
      loadSummary(base, normalizedToken),
    ]);
  };

  useEffect(() => {
    if (isConfigured) {
      loadInitialData(endpoint, token);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endpoint, token]);

  useEffect(() => {
    if (!AUTO_LOGIN_ENABLED) {
      return;
    }
    if (autoLoginAttempted) {
      return;
    }
    if (!endpoint || !AUTO_LOGIN_USERNAME || !AUTO_LOGIN_PASSWORD) {
      return;
    }
    const storedToken = (token || "").trim();
    if (storedToken) {
      setAutoLoginAttempted(true);
      return;
    }

    const performAutoLogin = async () => {
      setAutoLoginAttempted(true);
      try {
        const { data } = await axios.post(`${endpoint}/auth/login`, {
          username: AUTO_LOGIN_USERNAME,
          password: AUTO_LOGIN_PASSWORD,
        });
        const nextToken = data?.access_token;
        if (nextToken) {
          localStorage.setItem(storage.token, nextToken);
          setToken(nextToken);
          setErrorMessage("");
        } else {
          setErrorMessage("Otomatik giriş yanıtında token bulunamadı.");
        }
      } catch (error) {
        setErrorMessage(
          `Otomatik giriş başarısız: ${
            error.response?.data?.detail || error.message || "bilinmeyen hata"
          }`
        );
      }
    };

    performAutoLogin();
  }, [endpoint, token, autoLoginAttempted, AUTO_LOGIN_ENABLED]);

  const handleFilterChange = (field, value) => {
    setFilters((prev) => ({ ...prev, [field]: value }));
  };

  const applyFilters = async () => {
    const normalizedToken = (token || "").trim();
    await Promise.all([
      loadTasks(endpoint, normalizedToken, filters),
      loadSummary(endpoint, normalizedToken, filters),
    ]);
  };

  const clearFilters = async () => {
    const reset = { department: "", status: "", search: "" };
    setFilters(reset);
    const normalizedToken = (token || "").trim();
    await Promise.all([
      loadTasks(endpoint, normalizedToken, reset),
      loadSummary(endpoint, normalizedToken, reset),
    ]);
  };

  const handleFormChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleCreateTask = async (event) => {
    event.preventDefault();
    setCreateError("");

    if (!formData.due_date) {
      setCreateError("Hedef tarihi seçmelisiniz.");
      return;
    }

    try {
      const payload = {
        title: formData.title.trim(),
        description: formData.description.trim() || undefined,
        department: formData.department,
        responsible_person: formData.responsible_person.trim(),
        due_date: new Date(`${formData.due_date}T00:00:00`).toISOString(),
      };
      const teamMembers = formData.team_members
        .split(",")
        .map((item) => item.trim())
        .filter((item) => item.length > 0);
      if (teamMembers.length) {
        payload.team_members = teamMembers;
      }
      if (formData.initial_improvement_report_date) {
        payload.initial_improvement_report_date = new Date(
          formData.initial_improvement_report_date
        ).toISOString();
      }

      await axios.post(`${endpoint}/dof-tasks`, payload, {
        headers: { ...authHeaders },
      });
      setFormData({
        title: "",
        description: "",
        department: "",
        responsible_person: "",
        due_date: "",
        team_members: "",
        initial_improvement_report_date: "",
      });
      const normalizedToken = (token || "").trim();
      await Promise.all([
        loadTasks(endpoint, normalizedToken, filters),
        loadSummary(endpoint, normalizedToken, filters),
      ]);
    } catch (error) {
      setCreateError(
        error.response?.data?.detail || error.message || "DÖF kaydedilemedi."
      );
    }
  };

  const handleSelectTask = async (task) => {
    setDetailLoading(true);
    try {
      const { data } = await axios.get(`${endpoint}/dof-tasks/${task.id}`, {
        headers: { ...authHeaders },
      });
      setSelectedTask(data);
      setStatusUpdate({ status: data.status, note: "" });
      setTeamForm({
        team_members: (data?.team_members || []).join(", \n"),
        initial_improvement_report_date: data?.initial_improvement_report_date
          ? data.initial_improvement_report_date.slice(0, 16)
          : "",
      });
      setTeamError("");
      setTeamSuccess("");
      setClosureRequestNote("");
      setClosureDecisionNote("");
    } catch (error) {
      setErrorMessage(
        error.response?.data?.detail ||
          error.message ||
          "DÖF detayları alınamadı."
      );
    } finally {
      setDetailLoading(false);
    }
  };

  const handleStatusUpdate = async () => {
    if (!selectedTask) return;
    try {
      await axios.patch(
        `${endpoint}/dof-tasks/${selectedTask.id}/status`,
        {
          status: statusUpdate.status,
          note: statusUpdate.note.trim() || undefined,
        },
        { headers: { ...authHeaders } }
      );

      const freshDetail = await axios.get(`${endpoint}/dof-tasks/${selectedTask.id}`, {
        headers: { ...authHeaders },
      });
      setSelectedTask(freshDetail.data);
      setStatusUpdate((prev) => ({ ...prev, note: "" }));

      const normalizedToken = (token || "").trim();
      await Promise.all([
        loadTasks(endpoint, normalizedToken, filters),
        loadSummary(endpoint, normalizedToken, filters),
      ]);
    } catch (error) {
      setErrorMessage(
        error.response?.data?.detail ||
          error.message ||
          "Durum güncellenirken hata oluştu."
      );
    }
  };

  const handleTeamUpdate = async () => {
    if (!selectedTask) return;
    setTeamSaving(true);
    setTeamError("");
    setTeamSuccess("");
    try {
      const payload = {};
      const members = teamForm.team_members
        .split(",")
        .map((item) => item.trim())
        .filter((item) => item.length > 0);
      if (members.length || (selectedTask?.team_members?.length ?? 0) > 0) {
        payload.team_members = members;
      }
      if (teamForm.initial_improvement_report_date) {
        payload.initial_improvement_report_date = new Date(
          teamForm.initial_improvement_report_date
        ).toISOString();
      } else if (selectedTask?.initial_improvement_report_date) {
        payload.initial_improvement_report_date = null;
      }

      if (!Object.keys(payload).length) {
        setTeamError("Guncellenecek alan seciniz.");
        setTeamSaving(false);
        return;
      }

      await axios.put(`${endpoint}/dof-tasks/${selectedTask.id}`, payload, {
        headers: { ...authHeaders },
      });
      const freshDetail = await axios.get(`${endpoint}/dof-tasks/${selectedTask.id}`, {
        headers: { ...authHeaders },
      });
      setSelectedTask(freshDetail.data);
      setTeamForm({
        team_members: (freshDetail.data.team_members || []).join(", "),
        initial_improvement_report_date: freshDetail.data.initial_improvement_report_date
          ? freshDetail.data.initial_improvement_report_date.slice(0, 16)
          : "",
      });
      setTeamSuccess("Takim bilgileri guncellendi.");
      const normalizedToken = (token || "").trim();
      await Promise.all([
        loadTasks(endpoint, normalizedToken, filters),
        loadSummary(endpoint, normalizedToken, filters),
      ]);
    } catch (error) {
      setTeamError(
        error.response?.data?.detail ||
          error.message ||
          "Takim bilgileri guncellenemedi."
      );
    } finally {
      setTeamSaving(false);
    }
  };

  const handleClosureRequest = async () => {
    if (!selectedTask) return;
    setClosureSaving(true);
    try {
      await axios.post(
        `${endpoint}/dof-tasks/${selectedTask.id}/closure/request`,
        { note: closureRequestNote.trim() || undefined },
        { headers: { ...authHeaders } }
      );
      setClosureRequestNote("");
      const normalizedToken = (token || "").trim();
      const [detailResp] = await Promise.all([
        axios.get(`${endpoint}/dof-tasks/${selectedTask.id}`, { headers: { ...authHeaders } }),
        loadTasks(endpoint, normalizedToken, filters),
        loadSummary(endpoint, normalizedToken, filters),
      ]);
      setSelectedTask(detailResp.data);
    } catch (error) {
      setErrorMessage(
        error.response?.data?.detail ||
          error.message ||
          "Kapanis talebi gonderilemedi."
      );
    } finally {
      setClosureSaving(false);
    }
  };

  const handleClosureDecision = async (approve) => {
    if (!selectedTask) return;
    setClosureSaving(true);
    try {
      await axios.post(
        `${endpoint}/dof-tasks/${selectedTask.id}/closure/decision`,
        {
          approve,
          note: closureDecisionNote.trim() || undefined,
        },
        { headers: { ...authHeaders } }
      );
      setClosureDecisionNote("");
      const normalizedToken = (token || "").trim();
      const [detailResp] = await Promise.all([
        axios.get(`${endpoint}/dof-tasks/${selectedTask.id}`, { headers: { ...authHeaders } }),
        loadTasks(endpoint, normalizedToken, filters),
        loadSummary(endpoint, normalizedToken, filters),
      ]);
      setSelectedTask(detailResp.data);
    } catch (error) {
      setErrorMessage(
        error.response?.data?.detail ||
          error.message ||
          "Kapanis karari kaydedilemedi."
      );
    } finally {
      setClosureSaving(false);
    }
  };


  const statusBadge = (status) => {
    const config = STATUS_STYLES[status] || STATUS_STYLES.open;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  return (
    <div className="module-wrapper">
      <header className="module-header">
        <div>
          <h1>Düzeltici Önleyici Faaliyet (DÖF) Takibi</h1>
          <p>
            Departman bazlı DÖF görevlerini oluşturun, filtreleyin ve durum geçmişini izleyin.
          </p>
        </div>
      </header>

      <div className="module-grid">
        <Card>
          <CardHeader>
            <CardTitle>API Bağlantısı</CardTitle>
            <CardDescription>
              DÖF servislerine erişmek için backend URL ve yetkilendirme token bilgilerini giriniz.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid two-cols">
              <div className="form-field">
                <Label htmlFor="api-url">API URL</Label>
                <Input
                  id="api-url"
                  value={apiUrl}
                  onChange={(event) => setApiUrl(event.target.value)}
                  placeholder="https://sunucu-adresi/api"
                />
              </div>
              {!DISABLE_AUTH && (
                <div className="form-field">
                  <Label htmlFor="token">Bearer Token</Label>
                  <Input
                    id="token"
                    value={token}
                    onChange={(event) => setToken(event.target.value)}
                    placeholder="JWT token"
                  />
                </div>
              )}
            </div>
            <div className="actions-row">
              <Button onClick={handleSaveConnection} disabled={savingConnection}>
                {savingConnection ? "Kontrol ediliyor..." : "Bağlantıyı Kaydet"}
              </Button>
              {DISABLE_AUTH ? (
                <span className="muted-text">
                  Kimlik doğrulama devre dışı. Yalnızca geliştirme ortamında kullanın.
                </span>
              ) : (
                !isConfigured && (
                  <span className="muted-text">Token girmeden DÖF verileri görüntülenemez.</span>
                )
              )}
            </div>
            {errorMessage && <div className="error-box">{errorMessage}</div>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Filtreler</CardTitle>
            <CardDescription>Departman, durum ve serbest metin aramasıyla kayıtları daraltın.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid three-cols">
              <div className="form-field">
                <Label htmlFor="filter-department">Departman</Label>
                <Select
                  id="filter-department"
                  value={filters.department}
                  onChange={(event) => handleFilterChange("department", event.target.value)}
                >
                  <SelectOption value="">Tümü</SelectOption>
                  {departments.map((department) => (
                    <SelectOption key={department} value={department}>
                      {department}
                    </SelectOption>
                  ))}
                </Select>
              </div>
              <div className="form-field">
                <Label htmlFor="filter-status">Durum</Label>
                <Select
                  id="filter-status"
                  value={filters.status}
                  onChange={(event) => handleFilterChange("status", event.target.value)}
                >
                  <SelectOption value="">Tümü</SelectOption>
                  {STATUS_OPTIONS.map((option) => (
                    <SelectOption key={option.value} value={option.value}>
                      {option.label}
                    </SelectOption>
                  ))}
                </Select>
              </div>
              <div className="form-field">
                <Label htmlFor="search">Serbest Arama</Label>
                <Input
                  id="search"
                  placeholder="Başlık, sorumlu, numara..."
                  value={filters.search}
                  onChange={(event) => handleFilterChange("search", event.target.value)}
                />
              </div>
            </div>
            <div className="actions-row">
              <Button variant="secondary" onClick={applyFilters} disabled={!isConfigured}>
                Filtrele
              </Button>
              <Button variant="outline" onClick={clearFilters} disabled={!isConfigured}>
                Temizle
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Yeni DÖF Oluştur</CardTitle>
            <CardDescription>Departman hedef tarih ve sorumlu ile yeni görev kaydedin.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="grid two-cols" onSubmit={handleCreateTask}>
              <div className="form-field">
                <Label htmlFor="dof-title">Başlık</Label>
                <Input
                  id="dof-title"
                  value={formData.title}
                  onChange={(event) => handleFormChange("title", event.target.value)}
                  required
                />
              </div>
              <div className="form-field">
                <Label htmlFor="dof-department">Departman</Label>
                <Select
                  id="dof-department"
                  value={formData.department}
                  onChange={(event) => handleFormChange("department", event.target.value)}
                  required
                >
                  <SelectOption value="">Seçiniz</SelectOption>
                  {departments.map((department) => (
                    <SelectOption key={department} value={department}>
                      {department}
                    </SelectOption>
                  ))}
                </Select>
              </div>
              <div className="form-field">
                <Label htmlFor="dof-responsible">Sorumlu Kişi</Label>
                <Input
                  id="dof-responsible"
                  value={formData.responsible_person}
                  onChange={(event) =>
                    handleFormChange("responsible_person", event.target.value)
                  }
                  required
                />
              </div>
              <div className="form-field">
                <Label htmlFor="dof-due-date">Hedef Tarih</Label>
                <Input
                  id="dof-due-date"
                  type="date"
                  value={formData.due_date}
                  onChange={(event) => handleFormChange("due_date", event.target.value)}
                  required
                />
              </div>
              <div className="form-field">
                <Label htmlFor="dof-team-members">Takim Uyeleri (virgul ile)</Label>
                <Textarea
                  id="dof-team-members"
                  rows={2}
                  value={formData.team_members}
                  onChange={(event) => handleFormChange("team_members", event.target.value)}
                  placeholder="Ekip uyelerini virgulle ayirin"
                />
              </div>
              <div className="form-field">
                <Label htmlFor="dof-initial-report">Ilk Iyilestirme Rapor Tarihi</Label>
                <Input
                  id="dof-initial-report"
                  type="datetime-local"
                  value={formData.initial_improvement_report_date}
                  onChange={(event) =>
                    handleFormChange("initial_improvement_report_date", event.target.value)
                  }
                />
              </div>
              <div className="form-field full-span">
                <Label htmlFor="dof-description">Açıklama</Label>
                <Textarea
                  id="dof-description"
                  value={formData.description}
                  onChange={(event) =>
                    handleFormChange("description", event.target.value)
                  }
                  placeholder="Faaliyet detayını yazınız"
                />
              </div>
              {createError && <div className="error-box full-span">{createError}</div>}
              <div className="actions-row full-span">
                <Button type="submit" disabled={!isConfigured}>
                  DÖF Kaydet
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {summary && (
          <Card>
            <CardHeader>
              <CardTitle>Özet İstatistikler</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="stats-grid">
                <div className="stat-card">
                  <span>Toplam DÖF</span>
                  <strong>{summary.total}</strong>
                </div>
                <div className="stat-card">
                  <span>Açık / Devam</span>
                  <strong>
                    {(summary.status_counts?.open || 0) +
                      (summary.status_counts?.in_progress || 0) +
                      (summary.status_counts?.pending_closure || 0)}
                  </strong>
                </div>
                <div className="stat-card">
                  <span>Kapalı</span>
                  <strong>{summary.status_counts?.closed || 0}</strong>
                </div>
                <div className="stat-card">
                  <span>Geciken</span>
                  <strong>{summary.overdue}</strong>
                </div>
              </div>
              {summary.upcoming_deadlines?.length > 0 && (
                <div className="upcoming-list">
                  <h3>Yaklaşan Son Tarihler</h3>
                  <ul>
                    {summary.upcoming_deadlines.map((item) => (
                      <li key={item.id}>
                        <div>
                          <strong>{item.dof_no}</strong> - {item.title}
                        </div>
                        <div>
                          {item.department} • {item.responsible_person} • {formatDate(item.due_date)}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>


          </>
        )}

        <Card className="full-span">
          <CardHeader>
            <CardTitle>DÖF Listesi</CardTitle>
            <CardDescription>
              Kayıt satırına tıklayarak detay ve durum geçmişine ulaşabilirsiniz.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="loading-state">Yükleniyor...</div>
            ) : tasks.length === 0 ? (
              <div className="empty-state">Gösterilecek DÖF kaydı bulunamadı.</div>
            ) : (
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>DÖF No</th>
                      <th>Başlık</th>
                      <th>Departman</th>
                      <th>Sorumlu</th>
                      <th>Hedef Tarih</th>
                      <th>Durum</th>
                      <th>İşlemler</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tasks.map((task) => (
                      <tr key={task.id}>
                        <td>{task.dof_no}</td>
                        <td>
                          <div className="cell-title">{task.title}</div>
                          {task.description && (
                            <div className="cell-muted">{task.description}</div>
                          )}
                        </td>
                        <td>{task.department}</td>
                        <td>{task.responsible_person}</td>
                        <td>{formatDate(task.due_date)}</td>
                        <td>{statusBadge(task.status)}</td>
                        <td>
                          <Button
                            variant="outline"
                            onClick={() => handleSelectTask(task)}
                          >
                            Detay
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {selectedTask && (
          <>
            <Card className="full-span">
              <CardHeader>
                <CardTitle>
                  {selectedTask.dof_no} - {selectedTask.title}
                </CardTitle>
                <CardDescription>
                  {selectedTask.department} / {selectedTask.responsible_person} / Hedef:{" "}
                  {formatDate(selectedTask.due_date)}
                </CardDescription>
                <div className="actions-row" style={{ marginTop: "8px" }}>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setSelectedTask(null);
                      setStatusUpdate({ status: "", note: "" });
                      setTeamForm({ team_members: "", initial_improvement_report_date: "" });
                      setTeamError("");
                      setTeamSuccess("");
                      setClosureRequestNote("");
                      setClosureDecisionNote("");
                    }}
                  >
                    Kapat
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {detailLoading ? (
                  <div className="loading-state">Detay yukleniyor...</div>
                ) : (
                  <div className="detail-layout">
                    <section>
                      <h3>Temel Bilgiler</h3>
                      <ul className="history-list">
                        <li>
                          <strong>Departman:</strong> {selectedTask.department || "-"}
                        </li>
                        <li>
                          <strong>Sorumlu Kisi:</strong> {selectedTask.responsible_person || "-"}
                        </li>
                        <li>
                          <strong>Takim Uyeleri:</strong>{" "}
                          {selectedTask.team_members?.length
                            ? selectedTask.team_members.join(", ")
                            : "-"}
                        </li>
                        <li>
                          <strong>Ilk Rapor Tarihi:</strong>{" "}
                          {selectedTask.initial_improvement_report_date
                            ? formatDateTime(selectedTask.initial_improvement_report_date)
                            : "-"}
                        </li>
                        <li>
                          <strong>Olusturan:</strong> {selectedTask.created_by || "-"}
                        </li>
                        <li>
                          <strong>Son Guncelleme:</strong> {formatDateTime(selectedTask.updated_at)}
                        </li>
                      </ul>
                    </section>
                    <section>
                      <h3>Durum Guncelle</h3>
                      <div className="form-field">
                        <Label htmlFor="status-select">Durum</Label>
                        <Select
                          id="status-select"
                          value={statusUpdate.status}
                          onChange={(event) =>
                            setStatusUpdate((prev) => ({
                              ...prev,
                              status: event.target.value,
                            }))
                          }
                        >
                          {STATUS_OPTIONS.map((option) => (
                            <SelectOption key={option.value} value={option.value}>
                              {option.label}
                            </SelectOption>
                          ))}
                        </Select>
                      </div>
                      <div className="form-field">
                        <Label htmlFor="status-note">Not</Label>
                        <Textarea
                          id="status-note"
                          placeholder="Durum degisikligi notu"
                          value={statusUpdate.note}
                          onChange={(event) =>
                            setStatusUpdate((prev) => ({
                              ...prev,
                              note: event.target.value,
                            }))
                          }
                        />
                      </div>
                      <div className="actions-row">
                        <Button variant="secondary" onClick={handleStatusUpdate}>
                          Durumu Guncelle
                        </Button>
                      </div>
                    </section>
                    <section>
                      <h3>Durum Gecmisi</h3>
                      <ul className="history-list">
                        {selectedTask.status_history
                          .slice()
                          .reverse()
                          .map((entry, index) => (
                            <li key={`${entry.status}-${index}`}>
                              <div className="history-header">
                                {statusBadge(entry.status)}
                                <span>{formatDateTime(entry.changed_at)}</span>
                              </div>
                              <div className="history-meta">
                                Guncelleyen: {entry.changed_by}
                                {entry.note && <span> - Not: {entry.note}</span>}
                              </div>
                            </li>
                          ))}
                      </ul>
                    </section>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="full-span">
              <CardHeader>
                <CardTitle>Takim Bilgileri</CardTitle>
                <CardDescription>Takim uyelerini ve ilk rapor tarihini guncelleyin.</CardDescription>
              </CardHeader>
              <CardContent>
                <p>
                  Mevcut takim: {selectedTask.team_members?.length
                    ? selectedTask.team_members.join(", ")
                    : "Belirlenmedi"}
                </p>
                <p>
                  Ilk rapor tarihi:{" "}
                  {selectedTask.initial_improvement_report_date
                    ? formatDateTime(selectedTask.initial_improvement_report_date)
                    : "Belirtilmedi"}
                </p>
                <div className="grid two-cols">
                  <div className="form-field">
                    <Label htmlFor="team-members-update">Takim Uyeleri (virgul ile)</Label>
                    <Textarea
                      id="team-members-update"
                      rows={2}
                      value={teamForm.team_members}
                      onChange={(event) =>
                        setTeamForm((prev) => ({
                          ...prev,
                          team_members: event.target.value,
                        }))
                      }
                      disabled={teamSaving || closureSaving}
                    />
                  </div>
                  <div className="form-field">
                    <Label htmlFor="team-initial-report">Ilk Iyilestirme Rapor Tarihi</Label>
                    <Input
                      id="team-initial-report"
                      type="datetime-local"
                      value={teamForm.initial_improvement_report_date}
                      onChange={(event) =>
                        setTeamForm((prev) => ({
                          ...prev,
                          initial_improvement_report_date: event.target.value,
                        }))
                      }
                      disabled={teamSaving || closureSaving}
                    />
                  </div>
                </div>
                {teamError && <p style={{ color: "#b42318" }}>{teamError}</p>}
                {teamSuccess && <p style={{ color: "#0a8754" }}>{teamSuccess}</p>}
                <div className="actions-row">
                  <Button
                    variant="outline"
                    onClick={handleTeamUpdate}
                    disabled={teamSaving || closureSaving || !isConfigured}
                  >
                    Takim Bilgilerini Kaydet
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="full-span">
              <CardHeader>
                <CardTitle>Kapanis Onayi</CardTitle>
                <CardDescription>Kapanis onayi talep edin veya gelen talepleri yanitlayin.</CardDescription>
              </CardHeader>
              <CardContent>
                <p>
                  Mevcut durum: {STATUS_STYLES[selectedTask.status]?.label || selectedTask.status}
                </p>
                {selectedTask.closure_requested_at && (
                  <p>
                    Talep tarihi: {formatDateTime(selectedTask.closure_requested_at)}
                    {selectedTask.closure_requested_by
                      ? ` • Talep eden: ${selectedTask.closure_requested_by}`
                      : ""}
                  </p>
                )}
                {selectedTask.closure_request_note && (
                  <p>Talep notu: {selectedTask.closure_request_note}</p>
                )}
                {selectedTask.status === "pending_closure" ? (
                  <>
                    <Textarea
                      rows={3}
                      placeholder="Onay/ret notu"
                      value={closureDecisionNote}
                      onChange={(event) => setClosureDecisionNote(event.target.value)}
                      disabled={closureSaving || teamSaving}
                    />
                    <div className="actions-row" style={{ marginTop: "12px" }}>
                      <Button
                        variant="outline"
                        onClick={() => handleClosureDecision(false)}
                        disabled={closureSaving || !isConfigured}
                      >
                        Reddet
                      </Button>
                      <Button
                        onClick={() => handleClosureDecision(true)}
                        disabled={closureSaving || !isConfigured}
                      >
                        Onayla
                      </Button>
                    </div>
                  </>
                ) : selectedTask.status !== "closed" && selectedTask.status !== "cancelled" ? (
                  <>
                    <Textarea
                      rows={3}
                      placeholder="Kapanis talebi notu"
                      value={closureRequestNote}
                      onChange={(event) => setClosureRequestNote(event.target.value)}
                      disabled={closureSaving || teamSaving}
                    />
                    <div className="actions-row" style={{ marginTop: "12px" }}>
                      <Button
                        onClick={handleClosureRequest}
                        disabled={closureSaving || !isConfigured}
                      >
                        Kapanis Talep Et
                      </Button>
                    </div>
                  </>
                ) : (
                  <p>
                    {selectedTask.closed_at
                      ? `Kapanis ${formatDateTime(selectedTask.closed_at)} tarihinde tamamlandi.`
                      : "Kayit kapanmis."}
                  </p>
                )}
              </CardContent>
            </Card>
          </>
        )}'
      </div>
    </div>
  );
};
