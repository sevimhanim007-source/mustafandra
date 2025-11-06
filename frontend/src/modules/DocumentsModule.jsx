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
import { Badge } from "../components/ui/Badge";
import { useApiConnection } from "./useApiConnection";
import { Textarea } from "../components/ui/Textarea";
import { formatDate, formatDateTime } from "./formatters";

const makeDistributionRow = () => ({
  id: `dist-${Math.random().toString(36).slice(2, 9)}`,
  principalType: "user",
  principalId: "",
  required: true,
});

const makeApprovalRow = (stageValue = "") => ({
  id: `appr-${Math.random().toString(36).slice(2, 9)}`,
  stage: stageValue,
  approvers: "",
  approvalType: "all",
  deadline: "",
});

const makePermissionRow = () => ({
  id: `perm-${Math.random().toString(36).slice(2, 9)}`,
  principalType: "user",
  principalId: "",
  capabilities: ["read"],
});

const createEmptyForm = () => ({
  folderId: "",
  title: "",
  documentType: "",
  department: "",
  description: "",
  tags: "",
  fileId: "",
  versionNotes: "",
  reviewDate: "",
  expiryDate: "",
  distributionRows: [makeDistributionRow()],
  approvalRows: [makeApprovalRow("1")],
});

const MAX_UPLOAD_SIZE_MB = 25;
const MAX_UPLOAD_SIZE = MAX_UPLOAD_SIZE_MB * 1024 * 1024;

const FOLDER_CAPABILITIES = [
  { value: "read", label: "Oku" },
  { value: "download", label: "Indir" },
  { value: "create", label: "Olustur" },
  { value: "revise", label: "Revize" },
  { value: "approve", label: "Onayla" },
  { value: "cancel", label: "Iptal" },
  { value: "manage", label: "Yonet" },
];

const FOLDER_PRINCIPAL_TYPES = [
  { value: "user", label: "Kullanici" },
  { value: "role", label: "Rol" },
  { value: "department", label: "Departman" },
  { value: "group", label: "Grup" },
];

const NOTIFICATION_BADGE_VARIANTS = {
  error: "danger",
  warning: "warning",
  success: "success",
  info: "info",
};

const STATUS_LABELS = {
  draft: { label: "Taslak", variant: "neutral" },
  review: { label: "Inceleme", variant: "warning" },
  approved: { label: "Onayli", variant: "success" },
  archived: { label: "Arsiv", variant: "info" },
  retired: { label: "Kaldirildi", variant: "neutral" },
};

const VERSION_STATUS_META = {
  draft: { label: "Taslak", variant: "warning" },
  pending_approval: { label: "Onay Bekliyor", variant: "warning" },
  published: { label: "Yayinda", variant: "success" },
  retired: { label: "Kaldirildi", variant: "neutral" },
};

const STAGE_STATUS_META = {
  pending: { label: "Beklemede", variant: "warning" },
  approved: { label: "Onaylandi", variant: "success" },
  rejected: { label: "Reddedildi", variant: "danger" },
};

const READ_STATUS_META = {
  pending: { label: "Beklemede", variant: "warning" },
  read: { label: "Okundu", variant: "success" },
  overdue: { label: "Gecikti", variant: "danger" },
};

const DETAIL_TABS = [
  { key: "revisions", label: "Revizyon Gecmisi" },
  { key: "distribution", label: "Onay & Dagitim" },
  { key: "actions", label: "Aksiyon Gecmisi" },
];

const statusOptions = Object.keys(STATUS_LABELS);

const DocumentsModule = () => {
  const { apiUrl, headers, isReady, authDisabled, refresh } = useApiConnection();
  const [documents, setDocuments] = useState([]);
  const [folders, setFolders] = useState([]);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [reportLoading, setReportLoading] = useState(false);
  const [error, setError] = useState("");
  const [reportError, setReportError] = useState("");
  const [filters, setFilters] = useState({
    department: "",
    status: "",
    search: "",
    documentType: "",
    folderId: "",
  });
  const [form, setForm] = useState(() => createEmptyForm());
  const [editingDocument, setEditingDocument] = useState(null);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [submitSuccess, setSubmitSuccess] = useState("");
  const [fileUploadInfo, setFileUploadInfo] = useState({
    uploading: false,
    error: "",
    success: "",
  });
  const [approvalTasks, setApprovalTasks] = useState([]);
  const [approvalLoading, setApprovalLoading] = useState(false);
  const [approvalError, setApprovalError] = useState("");
  const [approvalComments, setApprovalComments] = useState({});
  const [approvalActionId, setApprovalActionId] = useState("");
  const [readTasks, setReadTasks] = useState([]);
  const [readLoading, setReadLoading] = useState(false);
  const [readError, setReadError] = useState("");
  const [readNotes, setReadNotes] = useState({});
  const [readActionId, setReadActionId] = useState("");
  const [notifications, setNotifications] = useState([]);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [notificationsError, setNotificationsError] = useState("");
  const [selectedFolderForPerms, setSelectedFolderForPerms] = useState("");
  const [folderPermissionRows, setFolderPermissionRows] = useState([]);
  const [folderPermissionLoading, setFolderPermissionLoading] = useState(false);
  const [folderPermissionError, setFolderPermissionError] = useState("");
  const [folderPermissionSuccess, setFolderPermissionSuccess] = useState("");
  const [readReceiptDoc, setReadReceiptDoc] = useState(null);
  const [readReceipts, setReadReceipts] = useState([]);
  const [readReceiptsLoading, setReadReceiptsLoading] = useState(false);
  const [readReceiptsError, setReadReceiptsError] = useState("");
  const [preview, setPreview] = useState({
    open: false,
    loading: false,
    error: "",
    mode: "none",
    html: "",
    text: "",
    slides: [],
    blobUrl: "",
    filename: "",
    mimeType: "",
    downloadUrl: "",
    documentId: "",
  });
  const [detailDocument, setDetailDocument] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [detailTab, setDetailTab] = useState("revisions");
  const [exportLoading, setExportLoading] = useState({ xlsx: false, pdf: false });

  const { department, status: statusFilter, search, documentType, folderId } = filters;
  const isEditing = Boolean(editingDocument);

  const selectedFolderName = useMemo(() => {
    const match = folders.find((folder) => folder.id === form.folderId);
    return match ? match.name : "";
  }, [folders, form.folderId]);

  const detailVersionHistory = useMemo(() => {
    if (!detailDocument?.version_history) {
      return [];
    }
    const items = [...detailDocument.version_history];
    items.sort((a, b) => {
      const aTime = a?.created_at ? new Date(a.created_at).getTime() : 0;
      const bTime = b?.created_at ? new Date(b.created_at).getTime() : 0;
      return bTime - aTime;
    });
    return items;
  }, [detailDocument]);

  const detailApprovalStages = useMemo(() => {
    if (!detailDocument?.approval_matrix) {
      return [];
    }
    const stages = [...detailDocument.approval_matrix];
    stages.sort((a, b) => {
      const aStage = typeof a?.stage === "number" ? a.stage : parseInt(a?.stage ?? "0", 10);
      const bStage = typeof b?.stage === "number" ? b.stage : parseInt(b?.stage ?? "0", 10);
      return aStage - bStage;
    });
    return stages;
  }, [detailDocument]);

  const detailDistributionList = detailDocument?.distribution_list || [];

  const detailActionHistory = useMemo(() => {
    if (!detailDocument) {
      return [];
    }
    const events = [];

    (detailDocument.status_history || []).forEach((item, index) => {
      if (!item) return;
      events.push({
        key: `status-${index}-${item.status}`,
        type: "Durum",
        stage: null,
        status: item.status,
        by: item.changed_by,
        comment: item.comment,
        at: item.changed_at,
        order: item.changed_at ? new Date(item.changed_at).getTime() : 0,
      });
    });

    (detailDocument.approval_matrix || []).forEach((stage) => {
      const stageIndex = stage?.stage ?? "-";
      (stage?.decisions || []).forEach((decision, decisionIndex) => {
        events.push({
          key: `decision-${stageIndex}-${decisionIndex}`,
          type: "Onay Karari",
          stage: stageIndex,
          status: decision.decision,
          by: decision.user_id,
          comment: decision.comment,
          at: decision.decided_at,
          order: decision.decided_at ? new Date(decision.decided_at).getTime() : 0,
        });
      });
      if (stage?.decided_at) {
        events.push({
          key: `stage-${stageIndex}`,
          type: "Onay Asamasi",
          stage: stageIndex,
          status: stage.status,
          by: stage.decided_by,
          comment: stage.comment,
          at: stage.decided_at,
          order: stage.decided_at ? new Date(stage.decided_at).getTime() : 0,
        });
      }
    });

    (detailDocument.read_receipts || []).forEach((receipt, index) => {
      if (!receipt) return;
      if (!receipt.read_at) {
        return;
      }
      events.push({
        key: `read-${receipt.user_id || index}`,
        type: receipt.required ? "Okuma (zorunlu)" : "Okuma",
        stage: null,
        status: receipt.status,
        by: receipt.user_id,
        comment: receipt.note,
        at: receipt.read_at,
        order: receipt.read_at ? new Date(receipt.read_at).getTime() : 0,
      });
    });

    events.sort((a, b) => b.order - a.order);
    return events;
  }, [detailDocument]);

  const detailOpen = Boolean(detailDocument);

  const resolveActionStatusMeta = (type, status) => {
    if (!status) {
      return { label: "-", variant: "neutral" };
    }
    if (type === "Durum") {
      return STATUS_LABELS[status] || { label: status, variant: "neutral" };
    }
    if (type.startsWith("Onay")) {
      return STAGE_STATUS_META[status] || { label: status, variant: "neutral" };
    }
    if (type.startsWith("Okuma")) {
      return READ_STATUS_META[status] || { label: status, variant: "neutral" };
    }
    return { label: status, variant: "neutral" };
  };

  const formGridStyle = {
    display: "grid",
    gap: "12px",
  };

  const twoColumnRowStyle = {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "12px",
  };

  const distributionRowStyle = {
    display: "grid",
    gridTemplateColumns: "150px 1fr 140px auto",
    gap: "8px",
    alignItems: "center",
    marginBottom: "8px",
  };

  const approvalRowStyle = {
    display: "grid",
    gridTemplateColumns: "100px 1fr 150px 150px auto",
    gap: "8px",
    alignItems: "center",
    marginBottom: "8px",
  };

  const errorTextStyle = {
    color: "#b00020",
    fontSize: "0.9rem",
  };

  const successTextStyle = {
    color: "#0a8754",
    fontSize: "0.9rem",
  };

  const fetchFolders = useCallback(async () => {
    if (!isReady) {
      return;
    }
    try {
      const { data } = await axios.get(`${apiUrl}/document-folders`, { headers });
      setFolders(data || []);
    } catch (err) {
      const message =
        err?.response?.data?.detail ||
        err?.message ||
        "Klasor listesi alinirken hata olustu.";
      setError((prev) => prev || message);
    }
  }, [apiUrl, headers, isReady]);

  const fetchDocuments = useCallback(async () => {
    if (!isReady) return;
    setLoading(true);
    setError("");
    try {
      const params = {};
      if (department) params.department = department;
      if (statusFilter) params.status_filter = statusFilter;
      if (folderId) params.folder_id = folderId;
      if (documentType) params.document_type = documentType;
      if (search) params.search = search;

      const { data } = await axios.get(`${apiUrl}/documents`, {
        headers,
        params,
      });
      setDocuments(data || []);
    } catch (err) {
      const message =
        err?.response?.data?.detail || err?.message || "Dokumanlar yuklenemedi.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [
    apiUrl,
    headers,
    isReady,
    department,
    statusFilter,
    folderId,
    documentType,
    search,
  ]);

  const fetchReport = useCallback(async () => {
    if (!isReady) {
      return;
    }
    setReportLoading(true);
    setReportError("");
    try {
      const params = {};
      if (department) params.department = department;
      if (documentType) params.document_type = documentType;
      const { data } = await axios.get(`${apiUrl}/documents/report/status`, {
        headers,
        params,
      });
      setReport(data || null);
    } catch (err) {
      const message =
        err?.response?.data?.detail ||
        err?.message ||
        "Dokuman raporu alinamadi.";
      setReport(null);
      setReportError(message);
    } finally {
      setReportLoading(false);
    }
  }, [apiUrl, headers, isReady, department, documentType]);

  const fetchApprovalTasks = useCallback(async () => {
    if (!isReady) {
      setApprovalTasks([]);
      return;
    }
    setApprovalLoading(true);
    setApprovalError("");
    try {
      const { data } = await axios.get(`${apiUrl}/documents/approvals/pending`, {
        headers,
      });
      setApprovalTasks(data || []);
    } catch (err) {
      const message =
        err?.response?.data?.detail ||
        err?.message ||
        "Onay bekleyen dokumanlar yuklenemedi.";
      setApprovalError(message);
    } finally {
      setApprovalLoading(false);
    }
  }, [apiUrl, headers, isReady]);

  const fetchReadTasks = useCallback(async () => {
    if (!isReady) {
      setReadTasks([]);
      return;
    }
    setReadLoading(true);
    setReadError("");
    try {
      const { data } = await axios.get(`${apiUrl}/documents/read-tasks`, {
        headers,
      });
      setReadTasks(data || []);
    } catch (err) {
      const message =
        err?.response?.data?.detail ||
        err?.message ||
        "Okuma onayi gorevleri yuklenemedi.";
      setReadError(message);
    } finally {
      setReadLoading(false);
    }
  }, [apiUrl, headers, isReady]);

  const fetchNotifications = useCallback(async () => {
    if (!isReady) {
      setNotifications([]);
      return;
    }
    setNotificationsLoading(true);
    setNotificationsError("");
    try {
      const { data } = await axios.get(`${apiUrl}/notifications`, {
        headers,
      });
      const items = (data || []).filter((notification) => {
        if (!notification) {
          return false;
        }
        const title = String(notification.title || "").toLowerCase();
        return !notification.is_read && title.includes("dokuman");
      });
      setNotifications(items.slice(0, 10));
    } catch (err) {
      const message =
        err?.response?.data?.detail ||
        err?.message ||
        "Bildirimler yuklenemedi.";
      setNotificationsError(message);
    } finally {
      setNotificationsLoading(false);
    }
  }, [apiUrl, headers, isReady]);

  useEffect(() => {
    if (!isReady) {
      setDocuments([]);
      setFolders([]);
      setReport(null);
      setPreview((prev) => {
        if (prev.mode === "blob" && prev.blobUrl) {
          URL.revokeObjectURL(prev.blobUrl);
        }
        return {
          open: false,
          loading: false,
          error: "",
          mode: "none",
          html: "",
          text: "",
          slides: [],
          blobUrl: "",
          filename: "",
          mimeType: "",
          downloadUrl: "",
          documentId: "",
        };
      });
      setExportLoading({ xlsx: false, pdf: false });
      return;
    }
    fetchFolders();
  }, [fetchFolders, isReady]);

  useEffect(() => {
    if (!isReady) {
      return;
    }
    fetchDocuments();
    fetchReport();
  }, [fetchDocuments, fetchReport, isReady]);

  useEffect(() => {
    if (!isReady) {
      setApprovalTasks([]);
      setReadTasks([]);
      return;
    }
    fetchApprovalTasks();
    fetchReadTasks();
  }, [fetchApprovalTasks, fetchReadTasks, isReady]);

  useEffect(() => {
    if (!isReady) {
      setNotifications([]);
      return;
    }
    fetchNotifications();
  }, [fetchNotifications, isReady]);

  useEffect(
    () => () => {
      if (preview.mode === "blob" && preview.blobUrl) {
        URL.revokeObjectURL(preview.blobUrl);
      }
    },
    [preview.blobUrl, preview.mode]
  );

  useEffect(() => {
    if (!isReady) {
      setSelectedFolderForPerms("");
      setFolderPermissionRows([]);
      setFolderPermissionError("");
      setFolderPermissionSuccess("");
      setReadReceiptDoc(null);
      setReadReceipts([]);
      setReadReceiptsError("");
    }
  }, [isReady]);

  useEffect(() => {
    if (!editingDocument) {
      setForm(createEmptyForm());
      setFileUploadInfo({ uploading: false, error: "", success: "" });
      return;
    }

    const distributionRows =
      (editingDocument.distribution_list || []).map((item) => ({
        id: `dist-${Math.random().toString(36).slice(2, 9)}`,
        principalType: item.principal_type || "user",
        principalId: item.principal_id || "",
        required: item.required_to_read !== false,
      })) || [];

    if (distributionRows.length === 0) {
      distributionRows.push(makeDistributionRow());
    }

    const approvalRows =
      (editingDocument.approval_matrix || []).map((stage) => ({
        id: `appr-${Math.random().toString(36).slice(2, 9)}`,
        stage: stage.stage !== undefined && stage.stage !== null ? String(stage.stage) : "",
        approvers: (stage.approvers || []).join(", "),
        approvalType: stage.approval_type || "all",
        deadline: stage.deadline ? stage.deadline.slice(0, 10) : "",
      })) || [];

    if (approvalRows.length === 0) {
      approvalRows.push(makeApprovalRow("1"));
    }

    setForm({
      folderId: editingDocument.folder_id || "",
      title: editingDocument.title || "",
      documentType: editingDocument.document_type || "",
      department: editingDocument.department || "",
      description: editingDocument.description || "",
      tags: (editingDocument.tags || []).join(", "),
      fileId: "",
      versionNotes: "",
      reviewDate: editingDocument.review_date ? editingDocument.review_date.slice(0, 10) : "",
      expiryDate: editingDocument.expiry_date ? editingDocument.expiry_date.slice(0, 10) : "",
      distributionRows,
      approvalRows,
    });
    setFileUploadInfo({ uploading: false, error: "", success: "" });
  }, [editingDocument]);

  useEffect(() => {
    if (!detailDocument) {
      return;
    }
    const match = documents.find((doc) => doc.id === detailDocument.id);
    if (!match) {
      return;
    }
    setDetailDocument((prev) => {
      if (!prev) {
        return match;
      }
      if (
        prev.updated_at === match.updated_at &&
        prev.status === match.status &&
        prev.version === match.version
      ) {
        return prev;
      }
      return {
        ...prev,
        ...match,
        version_history:
          match.version_history && match.version_history.length > 0
            ? match.version_history
            : prev.version_history || [],
        status_history:
          match.status_history && match.status_history.length > 0
            ? match.status_history
            : prev.status_history || [],
        approval_matrix:
          match.approval_matrix && match.approval_matrix.length > 0
            ? match.approval_matrix
            : prev.approval_matrix || [],
        distribution_list:
          match.distribution_list && match.distribution_list.length > 0
            ? match.distribution_list
            : prev.distribution_list || [],
      };
    });
  }, [documents, detailDocument]);

  const uniqueDepartments = useMemo(() => {
    const items = new Set();
    documents.forEach((doc) => {
      if (doc.department) {
        items.add(doc.department);
      }
    });
    return Array.from(items).sort((a, b) => a.localeCompare(b));
  }, [documents]);

  const uniqueDocumentTypes = useMemo(() => {
    const items = new Set();
    documents.forEach((doc) => {
      if (doc.document_type) {
        items.add(doc.document_type);
      }
    });
    return Array.from(items).sort((a, b) => a.localeCompare(b));
  }, [documents]);

  const filteredDocuments = documents;

  const statusSummary = useMemo(() => {
    if (!report?.status_counts) {
      return [];
    }
    return Object.entries(report.status_counts).sort((a, b) =>
      a[0].localeCompare(b[0])
    );
  }, [report]);

  const departmentSummary = useMemo(() => {
    if (!report?.department_counts) {
      return [];
    }
    return Object.entries(report.department_counts).sort((a, b) =>
      a[0].localeCompare(b[0])
    );
  }, [report]);

  const typeSummary = useMemo(() => {
    if (!report?.type_counts) {
      return [];
    }
    return Object.entries(report.type_counts).sort((a, b) =>
      a[0].localeCompare(b[0])
    );
  }, [report]);

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
      documentType: "",
      folderId: "",
    });
  };

  const handleFormChange = (field) => (event) => {
    const value = event.target.value;
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleFileUpload = async (event) => {
    const selectedFile = event.target?.files?.[0];
    if (!selectedFile) {
      return;
    }
    if (!isReady) {
      setFileUploadInfo({
        uploading: false,
        error: "API baglantisi hazir degil.",
        success: "",
      });
      event.target.value = "";
      return;
    }
    if (selectedFile.size > MAX_UPLOAD_SIZE) {
      setFileUploadInfo({
        uploading: false,
        error: `Dosya boyutu ${MAX_UPLOAD_SIZE_MB} MB sinirini asiyor.`,
        success: "",
      });
      event.target.value = "";
      return;
    }
    setFileUploadInfo({ uploading: true, error: "", success: "" });
    const formData = new FormData();
    formData.append("file", selectedFile);
    formData.append("module_type", "document");
    if (editingDocument?.id) {
      formData.append("module_id", editingDocument.id);
    }
    try {
      const { data } = await axios.post(`${apiUrl}/upload`, formData, {
        headers: { ...headers },
      });
      setForm((prev) => ({
        ...prev,
        fileId: data.file_id,
      }));
      setFileUploadInfo({
        uploading: false,
        error: "",
        success: `${selectedFile.name} yüklendi.`,
      });
    } catch (err) {
      const message =
        err?.response?.data?.detail || err?.message || "Dosya yüklenemedi.";
      setFileUploadInfo({
        uploading: false,
        error: message,
        success: "",
      });
    } finally {
      if (event.target) {
        event.target.value = "";
      }
    }
  };

  const updateDistributionRow = (rowId, field, value) => {
    setForm((prev) => ({
      ...prev,
      distributionRows: prev.distributionRows.map((row) =>
        row.id === rowId ? { ...row, [field]: value } : row
      ),
    }));
  };

  const handleAddDistributionRow = () => {
    setForm((prev) => ({
      ...prev,
      distributionRows: [...prev.distributionRows, makeDistributionRow()],
    }));
  };

  const handleRemoveDistributionRow = (rowId) => {
    setForm((prev) => {
      if (prev.distributionRows.length === 1) {
        return prev;
      }
      return {
        ...prev,
        distributionRows: prev.distributionRows.filter((row) => row.id !== rowId),
      };
    });
  };

  const updateApprovalRow = (rowId, field, value) => {
    setForm((prev) => ({
      ...prev,
      approvalRows: prev.approvalRows.map((row) =>
        row.id === rowId ? { ...row, [field]: value } : row
      ),
    }));
  };

  const handleAddApprovalRow = () => {
    setForm((prev) => ({
      ...prev,
      approvalRows: [...prev.approvalRows, makeApprovalRow(String(prev.approvalRows.length + 1))],
    }));
  };

  const handleRemoveApprovalRow = (rowId) => {
    setForm((prev) => {
      if (prev.approvalRows.length === 1) {
        return prev;
      }
      return {
        ...prev,
        approvalRows: prev.approvalRows.filter((row) => row.id !== rowId),
      };
    });
  };

  const fetchFolderPermissions = useCallback(
    async (folderId) => {
      if (!folderId || !isReady) {
        setFolderPermissionRows(folderId ? [makePermissionRow()] : []);
        return;
      }
      setFolderPermissionLoading(true);
      setFolderPermissionError("");
      setFolderPermissionSuccess("");
      try {
        const { data } = await axios.get(`${apiUrl}/document-folders/${folderId}`, {
          headers,
        });
        const permissions = data?.permissions || [];
        if (!permissions.length) {
          setFolderPermissionRows([makePermissionRow()]);
        } else {
          setFolderPermissionRows(
            permissions.map((perm) => ({
              id: `perm-${Math.random().toString(36).slice(2, 9)}`,
              principalType: perm.principal_type || "user",
              principalId: perm.principal_id || "",
              capabilities:
                Array.isArray(perm.capabilities) && perm.capabilities.length
                  ? perm.capabilities
                  : ["read"],
            }))
          );
        }
      } catch (err) {
        const message =
          err?.response?.data?.detail || err?.message || "Klasor yetkileri yuklenemedi.";
        setFolderPermissionError(message);
        setFolderPermissionRows([makePermissionRow()]);
      } finally {
        setFolderPermissionLoading(false);
      }
    },
    [apiUrl, headers, isReady]
  );

  const handleSelectFolderPermissions = async (event) => {
    const folderId = event.target.value;
    setSelectedFolderForPerms(folderId);
    setFolderPermissionError("");
    setFolderPermissionSuccess("");
    await fetchFolderPermissions(folderId);
  };

  const handlePermissionRowChange = (rowId, field, value) => {
    setFolderPermissionRows((prev) =>
      prev.map((row) => (row.id === rowId ? { ...row, [field]: value } : row))
    );
  };

  const handlePermissionCapabilityToggle = (rowId, capability) => {
    setFolderPermissionRows((prev) =>
      prev.map((row) => {
        if (row.id !== rowId) {
          return row;
        }
        const hasCapability = row.capabilities.includes(capability);
        const nextCapabilities = hasCapability
          ? row.capabilities.filter((item) => item !== capability)
          : [...row.capabilities, capability];
        return {
          ...row,
          capabilities: nextCapabilities,
        };
      })
    );
  };

  const handleAddPermissionRow = () => {
    setFolderPermissionRows((prev) => [...prev, makePermissionRow()]);
  };

  const handleRemovePermissionRow = (rowId) => {
    setFolderPermissionRows((prev) => {
      if (prev.length === 1) {
        return prev;
      }
      return prev.filter((row) => row.id !== rowId);
    });
  };

  const handleSaveFolderPermissions = async () => {
    if (!selectedFolderForPerms) {
      setFolderPermissionError("Yetki kaydetmek icin klasor secmelisiniz.");
      return;
    }
    if (!isReady) {
      setFolderPermissionError("API baglantisi hazir degil.");
      return;
    }
    const payload = folderPermissionRows
      .map((row) => ({
        principal_type: row.principalType,
        principal_id: (row.principalId || "").trim(),
        capabilities: row.capabilities.filter(Boolean),
      }))
      .filter((row) => row.principal_id && row.capabilities.length);

    setFolderPermissionLoading(true);
    setFolderPermissionError("");
    setFolderPermissionSuccess("");

    try {
      await axios.patch(
        `${apiUrl}/document-folders/${selectedFolderForPerms}/permissions`,
        { permissions: payload },
        { headers }
      );
      setFolderPermissionSuccess("Klasor yetkileri guncellendi.");
      await fetchFolderPermissions(selectedFolderForPerms);
    } catch (err) {
      const message =
        err?.response?.data?.detail || err?.message || "Klasor yetkileri kaydedilemedi.";
      setFolderPermissionError(message);
    } finally {
      setFolderPermissionLoading(false);
    }
  };

  const handleApprovalCommentChange = (documentId) => (event) => {
    const value = event.target.value;
    setApprovalComments((prev) => ({ ...prev, [documentId]: value }));
  };

  const fetchReadReceiptsDetails = useCallback(
    async (document) => {
      if (!document || !document.id || !isReady) {
        setReadReceipts([]);
        return;
      }
      setReadReceiptsLoading(true);
      setReadReceiptsError("");
      try {
        const { data } = await axios.get(
          `${apiUrl}/documents/${document.id}/read-receipts`,
          { headers }
        );
        setReadReceipts(data || []);
      } catch (err) {
        const message =
          err?.response?.data?.detail ||
          err?.message ||
          "Okuma detaylari yuklenemedi.";
        setReadReceiptsError(message);
        setReadReceipts([]);
      } finally {
        setReadReceiptsLoading(false);
      }
    },
    [apiUrl, headers, isReady]
  );

  const handleOpenReadReceipts = async (doc) => {
    setReadReceiptDoc(doc);
    await fetchReadReceiptsDetails(doc);
  };

  const handleCloseReadReceipts = () => {
    setReadReceiptDoc(null);
    setReadReceipts([]);
    setReadReceiptsError("");
  };

  const submitApprovalDecision = async (task, decision) => {
    if (!isReady) {
      setApprovalError("API baglantisi hazir degil.");
      return;
    }
    setApprovalError("");
    setApprovalActionId(task.document_id);
    try {
      await axios.post(
        `${apiUrl}/documents/${task.document_id}/approvals/decision`,
        {
          stage: task.stage,
          decision,
          comment: approvalComments[task.document_id] || "",
        },
        { headers }
      );
      setApprovalComments((prev) => ({ ...prev, [task.document_id]: "" }));
      await fetchApprovalTasks();
      await fetchDocuments();
      await fetchReport();
      await fetchReadTasks();
      await fetchNotifications();
      if (readReceiptDoc && readReceiptDoc.id === task.document_id) {
        await fetchReadReceiptsDetails(readReceiptDoc);
      }
    } catch (err) {
      const message =
        err?.response?.data?.detail ||
        err?.message ||
        "Onay karari gonderilemedi.";
      setApprovalError(message);
    } finally {
      setApprovalActionId("");
    }
  };

  const handleReadNoteChange = (documentId) => (event) => {
    const value = event.target.value;
    setReadNotes((prev) => ({ ...prev, [documentId]: value }));
  };

  const closePreview = useCallback(() => {
    setPreview((prev) => {
      if (prev.mode === "blob" && prev.blobUrl) {
        URL.revokeObjectURL(prev.blobUrl);
      }
      return {
        open: false,
        loading: false,
        error: "",
        mode: "none",
        html: "",
        text: "",
        slides: [],
        blobUrl: "",
        filename: "",
        mimeType: "",
        downloadUrl: "",
        documentId: "",
      };
    });
  }, []);

  const handleCloseDetails = useCallback(() => {
    setDetailDocument(null);
    setDetailError("");
    setDetailLoading(false);
    setDetailTab("revisions");
  }, []);

  const handleOpenDetails = useCallback(
    async (doc) => {
      if (!doc) {
        return;
      }
      setDetailTab("revisions");
      setDetailError("");
      setDetailDocument((prev) => {
        if (prev && prev.id === doc.id) {
          return {
            ...prev,
            ...doc,
            version_history: prev.version_history || doc.version_history || [],
            status_history: prev.status_history || doc.status_history || [],
            approval_matrix: prev.approval_matrix || doc.approval_matrix || [],
            distribution_list: prev.distribution_list || doc.distribution_list || [],
          };
        }
        return {
          ...doc,
          version_history: doc.version_history || [],
          status_history: doc.status_history || [],
          approval_matrix: doc.approval_matrix || [],
          distribution_list: doc.distribution_list || [],
        };
      });
      if (!isReady) {
        setDetailError("API baglantisi hazir degil.");
        return;
      }
      setDetailLoading(true);
      try {
        const { data } = await axios.get(`${apiUrl}/documents/${doc.id}`, { headers });
        setDetailDocument(data || doc);
      } catch (err) {
        const message =
          err?.response?.data?.detail ||
          err?.message ||
          "Dokuman detaylari yuklenemedi.";
        setDetailError(message);
      } finally {
        setDetailLoading(false);
      }
    },
    [apiUrl, headers, isReady]
  );

  const toAbsoluteUrl = useCallback(
    (path) => {
      if (!path) return "";
      if (path.startsWith("http://") || path.startsWith("https://")) {
        return path;
      }
      if (path.startsWith("/")) {
        return `${apiUrl}${path}`;
      }
      return `${apiUrl}/${path}`;
    },
    [apiUrl]
  );

  const handlePreviewDocument = useCallback(
    async (doc) => {
      if (!isReady) {
        return;
      }
      if (!doc?.file_id) {
        setPreview({
          open: true,
          loading: false,
          error: "Bu dokumana ait yuklenmis dosya bulunmuyor.",
          mode: "none",
          html: "",
          text: "",
          slides: [],
          blobUrl: "",
          filename: "",
          mimeType: "",
          downloadUrl: "",
          documentId: doc?.id || "",
        });
        return;
      }
      setPreview((prev) => {
        if (prev.mode === "blob" && prev.blobUrl) {
          URL.revokeObjectURL(prev.blobUrl);
        }
        return {
          open: true,
          loading: true,
          error: "",
          mode: "none",
          html: "",
          text: "",
          slides: [],
          blobUrl: "",
          filename: "",
          mimeType: "",
          downloadUrl: "",
          documentId: doc.id,
        };
      });
      try {
        const { data: previewData } = await axios.get(
          `${apiUrl}/documents/${doc.id}/preview`,
          { headers }
        );
        if (previewData.kind === "html") {
          setPreview({
            open: true,
            loading: false,
            error: "",
            mode: "html",
            html: previewData.content || "<p>Onizleme bulunamadi.</p>",
            text: "",
            slides: [],
            blobUrl: "",
            filename: doc.title || doc.code || "dokuman",
            mimeType: previewData.mime_type || "text/html",
            downloadUrl: previewData.download_url || "",
            documentId: doc.id,
          });
          return;
        }
        if (previewData.kind === "slides") {
          setPreview({
            open: true,
            loading: false,
            error: "",
            mode: "slides",
            html: "",
            text: "",
            slides: previewData.slides || [],
            blobUrl: "",
            filename: doc.title || doc.code || "sunum",
            mimeType: previewData.mime_type || "text/plain",
            downloadUrl: previewData.download_url || "",
            documentId: doc.id,
          });
          return;
        }
        if (previewData.kind === "text") {
          setPreview({
            open: true,
            loading: false,
            error: "",
            mode: "text",
            html: "",
            text: previewData.content || "",
            slides: [],
            blobUrl: "",
            filename: doc.title || doc.code || "dokuman",
            mimeType: previewData.mime_type || "text/plain",
            downloadUrl: previewData.download_url || "",
            documentId: doc.id,
          });
          return;
        }
        // fallback to binary download
        const { data: metadata } = await axios.get(
          `${apiUrl}/documents/${doc.id}/file`,
          { headers }
        );
        const downloadPath =
          previewData.download_url ||
          metadata?.download_url ||
          `/download/${metadata?.id || doc.file_id}`;
        const absoluteUrl = toAbsoluteUrl(downloadPath);
        const response = await axios.get(absoluteUrl, {
          headers,
          responseType: "blob",
        });
        const mimeType =
          response.headers["content-type"] ||
          metadata?.mime_type ||
          previewData.mime_type ||
          "application/octet-stream";
        const blob = new Blob([response.data], { type: mimeType });
        const objectUrl = URL.createObjectURL(blob);
        setPreview({
          open: true,
          loading: false,
          error: "",
          mode: "blob",
          html: "",
          text: "",
          slides: [],
          blobUrl: objectUrl,
          filename:
            metadata?.original_filename || doc.title || doc.code || "dosya",
          mimeType,
          downloadUrl: downloadPath,
          documentId: doc.id,
        });
      } catch (err) {
        const message =
          err?.response?.data?.detail ||
          err?.message ||
          "Onizleme olusturulamadi.";
        setPreview({
          open: true,
          loading: false,
          error: message,
          mode: "none",
          html: "",
          text: "",
          slides: [],
          blobUrl: "",
          filename: "",
          mimeType: "",
          downloadUrl: "",
          documentId: doc.id,
        });
      }
    },
    [apiUrl, headers, isReady, toAbsoluteUrl]
  );

  const handleDownloadPreview = useCallback(() => {
    if (preview.mode === "blob" && preview.blobUrl) {
      const link = document.createElement("a");
      link.href = preview.blobUrl;
      link.download = preview.filename || "dokuman";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      return;
    }
    if (preview.downloadUrl) {
      const link = document.createElement("a");
      link.href = toAbsoluteUrl(preview.downloadUrl);
      link.download = preview.filename || "dokuman";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      return;
    }
    if (preview.mode === "html" && preview.html) {
      const blob = new Blob([preview.html], { type: "text/html" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${preview.filename || "dokuman"}.html`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      return;
    }
    if (preview.mode === "text" && preview.text) {
      const blob = new Blob([preview.text], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${preview.filename || "dokuman"}.txt`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      return;
    }
    if (preview.mode === "slides" && preview.slides.length) {
      const content = preview.slides
        .map((slide, index) => `Slayt ${index + 1}\n${slide}`)
        .join("\n\n-----------------------------\n\n");
      const blob = new Blob([content], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${preview.filename || "sunum"}.txt`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }
  }, [preview, toAbsoluteUrl]);

  const handleExportReport = useCallback(
    async (format) => {
      if (!isReady) {
        return;
      }
      setExportLoading((prev) => ({ ...prev, [format]: true }));
      setReportError("");
      try {
        const params = { format };
        if (department) params.department = department;
        if (documentType) params.document_type = documentType;
        const response = await axios.get(
          `${apiUrl}/documents/report/status/export`,
          {
            headers,
            params,
            responseType: "blob",
          }
        );
        const mimeType =
          format === "pdf"
            ? "application/pdf"
            : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
        const blob = new Blob([response.data], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download =
          format === "pdf"
            ? "dokuman-durum-raporu.pdf"
            : "dokuman-durum-raporu.xlsx";
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);
        setTimeout(() => URL.revokeObjectURL(url), 0);
      } catch (err) {
        const message =
          err?.response?.data?.detail ||
          err?.message ||
          "Rapor indirilemedi.";
        setReportError(message);
      } finally {
        setExportLoading((prev) => ({ ...prev, [format]: false }));
      }
    },
    [apiUrl, headers, isReady, department, documentType]
  );

  const acknowledgeReadTask = async (task) => {
    if (!isReady) {
      setReadError("API baglantisi hazir degil.");
      return;
    }
    setReadError("");
    setReadActionId(task.document_id);
    try {
      await axios.post(
        `${apiUrl}/documents/${task.document_id}/acknowledge`,
        {
          note: readNotes[task.document_id] || "",
        },
        { headers }
      );
      setReadNotes((prev) => ({ ...prev, [task.document_id]: "" }));
      await fetchReadTasks();
      await fetchDocuments();
      await fetchReport();
      await fetchNotifications();
      if (readReceiptDoc && readReceiptDoc.id === task.document_id) {
        await fetchReadReceiptsDetails(readReceiptDoc);
      }
    } catch (err) {
      const message =
        err?.response?.data?.detail ||
        err?.message ||
        "Okuma onayi bildirilemedi.";
      setReadError(message);
    } finally {
      setReadActionId("");
    }
  };

  const handleStartEdit = (doc) => {
    setEditingDocument(doc);
    setSubmitError("");
    setSubmitSuccess("");
  };

  const resetFormState = (clearMessages = false) => {
    setEditingDocument(null);
    setForm(createEmptyForm());
    setSubmitError("");
    if (clearMessages) {
      setSubmitSuccess("");
    }
    setFileUploadInfo({ uploading: false, error: "", success: "" });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitError("");
    setSubmitSuccess("");

    if (!isReady) {
      setSubmitError("API baglantisi hazir degil.");
      return;
    }

    if (!form.title.trim()) {
      setSubmitError("Baslik alanini doldurmalisiniz.");
      return;
    }

    if (!form.documentType.trim()) {
      setSubmitError("Dokuman turunu doldurmalisiniz.");
      return;
    }

    if (!isEditing && !form.folderId) {
      setSubmitError("Yeni dokuman icin klasor secmelisiniz.");
      return;
    }

    const distributionPayload = form.distributionRows
      .map((row) => ({
        principal_type: row.principalType,
        principal_id: row.principalId.trim(),
        required_to_read: row.required,
      }))
      .filter((item) => item.principal_id);

    const approvalPayload = form.approvalRows
      .map((row, index) => {
        const approverList = row.approvers
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean);
        if (approverList.length === 0) {
          return null;
        }
        return {
          stage: row.stage ? Number(row.stage) : index + 1,
          approvers: approverList,
          approval_type: row.approvalType || "all",
          deadline: row.deadline ? new Date(`${row.deadline}T00:00:00Z`).toISOString() : undefined,
        };
      })
      .filter(Boolean);

    const tagList = form.tags
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);

    const reviewDateIso = form.reviewDate
      ? new Date(`${form.reviewDate}T00:00:00Z`).toISOString()
      : undefined;
    const expiryDateIso = form.expiryDate
      ? new Date(`${form.expiryDate}T00:00:00Z`).toISOString()
      : undefined;

    const basePayload = {
      title: form.title.trim(),
      document_type: form.documentType.trim(),
      distribution_list: distributionPayload,
      approval_matrix: approvalPayload,
      tags: tagList,
    };

    if (form.department.trim()) {
      basePayload.department = form.department.trim();
    }
    if (form.description.trim()) {
      basePayload.description = form.description.trim();
    }
    if (reviewDateIso) {
      basePayload.review_date = reviewDateIso;
    }
    if (expiryDateIso) {
      basePayload.expiry_date = expiryDateIso;
    }

    setSubmitLoading(true);
    try {
      if (isEditing && editingDocument) {
        const updatePayload = { ...basePayload };
        await axios.patch(`${apiUrl}/documents/${editingDocument.id}`, updatePayload, {
          headers,
        });
        setSubmitSuccess("Dokuman basariyla guncellendi.");
        setEditingDocument(null);
        setForm(createEmptyForm());
      } else {
        const createPayload = {
          ...basePayload,
          folder_id: form.folderId,
        };
        if (form.fileId.trim()) {
          createPayload.file_id = form.fileId.trim();
        }
        if (form.versionNotes.trim()) {
          createPayload.version_notes = form.versionNotes.trim();
        }
        await axios.post(`${apiUrl}/documents`, createPayload, { headers });
        setSubmitSuccess("Dokuman basariyla olusturuldu.");
        resetFormState();
      }

      await fetchDocuments();
      await fetchReport();
      await fetchApprovalTasks();
      await fetchReadTasks();
      await fetchNotifications();
    } catch (err) {
      const message =
        err?.response?.data?.detail ||
        err?.message ||
        "Dokuman kaydedilirken hata olustu.";
      setSubmitError(message);
    } finally {
      setSubmitLoading(false);
    }
  };

  const connectionWarning = !isReady;

  const canDownloadPreview =
    preview.open &&
    !preview.loading &&
    !preview.error &&
    (preview.mode === "blob"
      ? Boolean(preview.blobUrl)
      : preview.mode === "html" ||
        preview.mode === "text" ||
        preview.mode === "slides" ||
        Boolean(preview.downloadUrl));

  return (
    <div className="module-wrapper">
      <header className="module-header">
        <div>
          <h1>Dokuman Yonetimi</h1>
          <p>
            Klasor yapisina gore dokumanlari listeleyin, durum dagilim raporunu
            inceleyin ve filtreler ile arama yapin.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => {
            fetchDocuments();
            fetchReport();
            fetchApprovalTasks();
            fetchReadTasks();
            fetchNotifications();
          }}
        >
          Yenile
        </Button>
      </header>

      {connectionWarning && (
        <Card>
          <CardHeader>
            <CardTitle>Baglanti Gerekli</CardTitle>
            <CardDescription>
              Bu modulu kullanmak icin DOF modulu uzerinden API ayarlarini kaydedin.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p>
              {authDisabled
                ? "Kimlik dogrulama kapali. Sadece API adresinin hazir olmasi yeterlidir."
                : "Token olmadan dokuman listesi getirilemez."}
            </p>
            <div className="actions-row" style={{ marginTop: "12px" }}>
              <Button onClick={refresh}>Baglantiyi Yeniden Oku</Button>
            </div>
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
          <CardTitle>{isEditing ? "Dokuman Duzenle" : "Yeni Dokuman Olustur"}</CardTitle>
          <CardDescription>
            Dagitim listesi ve onay matrisi ile dokuman bilgilerini kaydedin.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {submitError && (
            <p style={{ ...errorTextStyle, marginBottom: "12px" }}>{submitError}</p>
          )}
          {submitSuccess && (
            <p style={{ ...successTextStyle, marginBottom: "12px" }}>{submitSuccess}</p>
          )}
          <form onSubmit={handleSubmit} style={formGridStyle}>
            <div style={twoColumnRowStyle}>
              <div className="form-field">
                <Label htmlFor="form-folder">Klasor</Label>
                <Select
                  id="form-folder"
                  value={form.folderId}
                  onChange={handleFormChange("folderId")}
                  disabled={isEditing}
                >
                  <SelectOption value="">Klasor secin</SelectOption>
                  {folders.map((folder) => (
                    <SelectOption key={folder.id} value={folder.id}>
                      {folder.name}
                    </SelectOption>
                  ))}
                </Select>
              </div>
              <div className="form-field">
                <Label htmlFor="form-department">Departman</Label>
                <Input
                  id="form-department"
                  value={form.department}
                  onChange={handleFormChange("department")}
                  placeholder="Opsiyonel"
                />
              </div>
            </div>

            <div style={twoColumnRowStyle}>
              <div className="form-field">
                <Label htmlFor="form-title">Baslik</Label>
                <Input
                  id="form-title"
                  value={form.title}
                  onChange={handleFormChange("title")}
                  placeholder="Dokuman basligi"
                  required
                />
              </div>
              <div className="form-field">
                <Label htmlFor="form-type">Dokuman Turu</Label>
                <Input
                  id="form-type"
                  value={form.documentType}
                  onChange={handleFormChange("documentType")}
                  placeholder="Orn. SOP, Prosedur"
                  required
                />
              </div>
            </div>

            <div className="form-field">
              <Label htmlFor="form-description">Aciklama</Label>
              <Textarea
                id="form-description"
                value={form.description}
                onChange={handleFormChange("description")}
                placeholder="Kisa aciklama"
                rows={3}
              />
            </div>

            <div style={twoColumnRowStyle}>
              <div className="form-field">
                <Label htmlFor="form-tags">Etiketler</Label>
                <Input
                  id="form-tags"
                  value={form.tags}
                  onChange={handleFormChange("tags")}
                  placeholder="Etiketleri virgulle ayirin"
                />
              </div>
              <div className="form-field">
                <Label htmlFor="form-file">Dosya ID</Label>
                <Input
                  id="form-file"
                  value={form.fileId}
                  onChange={handleFormChange("fileId")}
                  placeholder="Opsiyonel (upload sonucunda)"
                />
                <div style={{ marginTop: "8px", display: "flex", gap: "8px", alignItems: "center" }}>
                  <input
                    type="file"
                    onChange={handleFileUpload}
                    disabled={fileUploadInfo.uploading || !isReady}
                  />
                  {fileUploadInfo.uploading && <span>Yukleniyor...</span>}
                </div>
                {fileUploadInfo.error && (
                  <p style={{ ...errorTextStyle, marginTop: "6px" }}>{fileUploadInfo.error}</p>
                )}
                <div style={{ marginTop: "8px", display: "flex", gap: "8px", alignItems: "center" }}>
                  <input
                    type="file"
                    onChange={handleFileUpload}
                    disabled={fileUploadInfo.uploading || !isReady}
                  />
                  {fileUploadInfo.uploading && <span>Yukleniyor...</span>}
                </div>
                {fileUploadInfo.error && (
                  <p style={{ ...errorTextStyle, marginTop: "6px" }}>{fileUploadInfo.error}</p>
                )}
                {fileUploadInfo.success && (
                  <p style={{ ...successTextStyle, marginTop: "6px" }}>{fileUploadInfo.success}</p>
                )}
              </div>
            </div>

            <div style={twoColumnRowStyle}>
              <div className="form-field">
                <Label htmlFor="form-version-notes">Versiyon Notu</Label>
                <Input
                  id="form-version-notes"
                  value={form.versionNotes}
                  onChange={handleFormChange("versionNotes")}
                  placeholder="Ilk surum icin not"
                  disabled={isEditing}
                />
              </div>
              <div className="form-field" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                <div>
                  <Label htmlFor="form-review-date">Gozden Gecirme Tarihi</Label>
                  <Input
                    id="form-review-date"
                    type="date"
                    value={form.reviewDate}
                    onChange={handleFormChange("reviewDate")}
                  />
                </div>
                <div>
                  <Label htmlFor="form-expiry-date">Gecerlilik Tarihi</Label>
                  <Input
                    id="form-expiry-date"
                    type="date"
                    value={form.expiryDate}
                    onChange={handleFormChange("expiryDate")}
                  />
                </div>
              </div>
            </div>

            <div className="form-field">
              <Label>Dagitim Listesi</Label>
              <p style={{ fontSize: "0.85rem", marginBottom: "8px" }}>
                Okuma zorunlulugu olan kullanici/rol/departman gibi hedefleri ekleyin.
              </p>
              {form.distributionRows.map((row) => (
                <div key={row.id} style={distributionRowStyle}>
                  <Select
                    value={row.principalType}
                    onChange={(event) =>
                      updateDistributionRow(row.id, "principalType", event.target.value)
                    }
                  >
                    <SelectOption value="user">Kullanici</SelectOption>
                    <SelectOption value="role">Rol</SelectOption>
                    <SelectOption value="department">Departman</SelectOption>
                    <SelectOption value="group">Grup</SelectOption>
                  </Select>
                  <Input
                    value={row.principalId}
                    onChange={(event) =>
                      updateDistributionRow(row.id, "principalId", event.target.value)
                    }
                    placeholder="Kimlik veya kod"
                  />
                  <label style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <input
                      type="checkbox"
                      checked={row.required}
                      onChange={(event) =>
                        updateDistributionRow(row.id, "required", event.target.checked)
                      }
                    />
                    <span style={{ fontSize: "0.85rem" }}>Zorunlu okuma</span>
                  </label>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => handleRemoveDistributionRow(row.id)}
                    disabled={form.distributionRows.length === 1}
                  >
                    Sil
                  </Button>
                </div>
              ))}
              <Button type="button" variant="outline" onClick={handleAddDistributionRow}>
                Kisi Ekle
              </Button>
            </div>

            <div className="form-field">
              <Label>Onay Matrisi</Label>
              <p style={{ fontSize: "0.85rem", marginBottom: "8px" }}>
                Onay asamalarini ve ilgili onaylayicilari belirleyin. Onaylayicilari virgulle ayirin.
              </p>
              {form.approvalRows.map((row) => (
                <div key={row.id} style={approvalRowStyle}>
                  <Input
                    type="number"
                    min="1"
                    value={row.stage}
                    onChange={(event) =>
                      updateApprovalRow(row.id, "stage", event.target.value)
                    }
                    placeholder="Asama"
                  />
                  <Input
                    value={row.approvers}
                    onChange={(event) =>
                      updateApprovalRow(row.id, "approvers", event.target.value)
                    }
                    placeholder="Onaylayici kimlikleri"
                  />
                  <Select
                    value={row.approvalType}
                    onChange={(event) =>
                      updateApprovalRow(row.id, "approvalType", event.target.value)
                    }
                  >
                    <SelectOption value="all">Hepsi onaylasin</SelectOption>
                    <SelectOption value="any">Herhangi biri onaylasin</SelectOption>
                  </Select>
                  <Input
                    type="date"
                    value={row.deadline}
                    onChange={(event) =>
                      updateApprovalRow(row.id, "deadline", event.target.value)
                    }
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => handleRemoveApprovalRow(row.id)}
                    disabled={form.approvalRows.length === 1}
                  >
                    Sil
                  </Button>
                </div>
              ))}
              <Button type="button" variant="outline" onClick={handleAddApprovalRow}>
                Asama Ekle
              </Button>
            </div>

            {isEditing && selectedFolderName && (
              <div className="form-field" style={{ fontSize: "0.85rem" }}>
                <strong>Klasor:</strong> {selectedFolderName}
              </div>
            )}

            <div className="actions-row">
              <Button type="submit" disabled={submitLoading || !isReady}>
                {submitLoading
                  ? "Kaydediliyor..."
                  : isEditing
                  ? "Dokumani Guncelle"
                  : "Dokuman Olustur"}
              </Button>
              <Button type="button" variant="outline" onClick={() => resetFormState(true)}>
                {isEditing ? "Yeni Kayit Baslat" : "Formu Temizle"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {reportLoading && (
        <Card>
          <CardHeader>
            <CardTitle>Rapor hazirlaniyor</CardTitle>
          </CardHeader>
          <CardContent>
            <p>Lutfen bekleyin, dokuman ozet verileri yukleniyor.</p>
          </CardContent>
        </Card>
      )}

      {reportError && !reportLoading && (
        <Card>
          <CardHeader>
            <CardTitle>Rapor Hatasi</CardTitle>
          </CardHeader>
          <CardContent>
            <p>{reportError}</p>
          </CardContent>
        </Card>
      )}

      {report && !reportLoading && (
        <Card>
          <CardHeader>
            <CardTitle>Dokuman Ozeti</CardTitle>
            <CardDescription>
              Secili filtrelere gore toplam {report.total} kayit bulundu.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div
              className="actions-row"
              style={{ gap: "8px", marginBottom: "16px", flexWrap: "wrap" }}
            >
              <Button
                variant="outline"
                onClick={() => handleExportReport("xlsx")}
                disabled={
                  !isReady || exportLoading.xlsx || !report || report.total === 0
                }
              >
                {exportLoading.xlsx ? "Excel hazirlaniyor..." : "Excel'e aktar"}
              </Button>
              <Button
                variant="outline"
                onClick={() => handleExportReport("pdf")}
                disabled={
                  !isReady || exportLoading.pdf || !report || report.total === 0
                }
              >
                {exportLoading.pdf ? "PDF hazirlaniyor..." : "PDF olarak indir"}
              </Button>
            </div>
            <div className="grid three-cols">
              <div>
                <strong>Durumlar</strong>
                <ul className="history-list" style={{ marginTop: "8px" }}>
                  {statusSummary.length === 0 ? (
                    <li>Kayit bulunamadi.</li>
                  ) : (
                    statusSummary.map(([statusKey, count]) => {
                      const badgeConfig = STATUS_LABELS[statusKey] || {
                        label: statusKey,
                        variant: "neutral",
                      };
                      return (
                        <li key={statusKey} className="history-item">
                          <Badge variant={badgeConfig.variant}>
                            {badgeConfig.label}
                          </Badge>
                          <span style={{ marginLeft: "8px" }}>{count}</span>
                        </li>
                      );
                    })
                  )}
                </ul>
              </div>
              <div>
                <strong>Departmanlar</strong>
                <ul className="history-list" style={{ marginTop: "8px" }}>
                  {departmentSummary.length === 0 ? (
                    <li>Kayit bulunamadi.</li>
                  ) : (
                    departmentSummary.map(([name, count]) => (
                      <li key={name}>
                        {name}: <span>{count}</span>
                      </li>
                    ))
                  )}
                </ul>
              </div>
              <div>
                <strong>Dokuman Turleri</strong>
                <ul className="history-list" style={{ marginTop: "8px" }}>
                  {typeSummary.length === 0 ? (
                    <li>Kayit bulunamadi.</li>
                  ) : (
                    typeSummary.map(([name, count]) => (
                      <li key={name}>
                        {name}: <span>{count}</span>
                      </li>
                    ))
                  )}
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {detailOpen && (
        <Card>
          <CardHeader>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: "12px",
                flexWrap: "wrap",
              }}
            >
              <div>
                <div className="detail-header-row">
                  <CardTitle>{detailDocument.title || detailDocument.code || "Dokuman"}</CardTitle>
                  <Badge
                    variant={
                      (STATUS_LABELS[detailDocument.status]?.variant ??
                        "neutral")
                    }
                  >
                    {STATUS_LABELS[detailDocument.status]?.label ||
                      detailDocument.status ||
                      "-"}
                  </Badge>
                </div>
                <CardDescription>
                  {(detailDocument.code && `Kod: ${detailDocument.code}`) || "Kod: -"}{" "}
                  | Versiyon {detailDocument.version || "-"} | Son guncelleme{" "}
                  {detailDocument.updated_at
                    ? formatDateTime(detailDocument.updated_at)
                    : "-"}
                </CardDescription>
              </div>
              <div className="actions-row" style={{ gap: "8px" }}>
                <Button
                  variant="outline"
                  onClick={() => handleOpenDetails(detailDocument)}
                  disabled={!isReady || detailLoading}
                >
                  Detaylari Yenile
                </Button>
                <Button variant="ghost" onClick={handleCloseDetails}>
                  Kapat
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {detailError && (
              <div className="error-box" style={{ marginBottom: "12px" }}>
                {detailError}
              </div>
            )}
            {detailLoading ? (
              <div className="loading-state">Detaylar yukleniyor...</div>
            ) : (
              <>
                <div className="document-detail-tabs">
                  {DETAIL_TABS.map((tab) => (
                    <button
                      key={tab.key}
                      type="button"
                      className={`detail-tab-button${
                        detailTab === tab.key ? " active" : ""
                      }`}
                      onClick={() => setDetailTab(tab.key)}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                <div className="document-detail-panel">
                  {detailTab === "revisions" && (
                    <>
                      {detailVersionHistory.length === 0 ? (
                        <div className="empty-state">
                          Revizyon kaydi bulunmuyor.
                        </div>
                      ) : (
                        <div className="table-wrapper detail-table-wrapper">
                          <table className="detail-table">
                            <thead>
                              <tr>
                                <th>Versiyon</th>
                                <th>Durum</th>
                                <th>Degisiklik</th>
                                <th>Olusturan</th>
                                <th>Tarih</th>
                              </tr>
                            </thead>
                            <tbody>
                              {detailVersionHistory.map((version) => {
                                const meta =
                                  VERSION_STATUS_META[version.status] || {
                                    label: version.status,
                                    variant: "neutral",
                                  };
                                return (
                                  <tr key={version.id}>
                                    <td>{version.version || "-"}</td>
                                    <td>
                                      <Badge variant={meta.variant}>
                                        {meta.label}
                                      </Badge>
                                    </td>
                                    <td>
                                      {version.changes ||
                                        version.notes ||
                                        "-"}
                                    </td>
                                    <td>{version.created_by || "-"}</td>
                                    <td>
                                      {version.created_at
                                        ? formatDateTime(version.created_at)
                                        : "-"}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </>
                  )}

                  {detailTab === "distribution" && (
                    <div className="detail-grid">
                      <section className="detail-section">
                        <h3>Onay Asamalari</h3>
                        {detailApprovalStages.length === 0 ? (
                          <p className="muted-text">
                            Onay asamasi bulunmuyor.
                          </p>
                        ) : (
                          <div className="detail-stage-list">
                            {detailApprovalStages.map((stage) => {
                              const meta =
                                STAGE_STATUS_META[stage.status] || {
                                  label: stage.status,
                                  variant: "neutral",
                                };
                              return (
                                <div
                                  key={`stage-${stage.stage}`}
                                  className="detail-stage-card"
                                >
                                  <div className="detail-stage-header">
                                    <span>
                                      Asama {stage.stage ?? "-"}
                                    </span>
                                    <Badge variant={meta.variant}>
                                      {meta.label}
                                    </Badge>
                                  </div>
                                  <div className="detail-stage-row">
                                    <span>Onaylayicilar</span>
                                    <span>
                                      {(stage.approvers || []).length > 0
                                        ? stage.approvers.join(", ")
                                        : "-"}
                                    </span>
                                  </div>
                                  <div className="detail-stage-row">
                                    <span>Onay Tipi</span>
                                    <span>
                                      {stage.approval_type === "any"
                                        ? "Herhangi biri"
                                        : "Tum onaylayicilar"}
                                    </span>
                                  </div>
                                  <div className="detail-stage-row">
                                    <span>Son Tarih</span>
                                    <span>
                                      {stage.deadline
                                        ? formatDate(stage.deadline)
                                        : "-"}
                                    </span>
                                  </div>
                                  {(stage.decisions || []).length > 0 && (
                                    <div className="detail-stage-decisions">
                                      <strong>Kararlar</strong>
                                      <ul className="history-list">
                                        {stage.decisions.map((decision, index) => {
                                          const decisionMeta =
                                            STAGE_STATUS_META[
                                              decision.decision
                                            ] || {
                                              label: decision.decision,
                                              variant: "neutral",
                                            };
                                          return (
                                            <li
                                              key={`decision-${stage.stage}-${index}`}
                                            >
                                              <Badge
                                                variant={decisionMeta.variant}
                                              >
                                                {decisionMeta.label}
                                              </Badge>
                                              <span style={{ marginLeft: "8px" }}>
                                                {decision.user_id || "-"}
                                              </span>
                                              <span style={{ marginLeft: "8px" }}>
                                                {decision.decided_at
                                                  ? formatDateTime(
                                                      decision.decided_at
                                                    )
                                                  : "-"}
                                              </span>
                                              {decision.comment && (
                                                <div className="muted-text">
                                                  {decision.comment}
                                                </div>
                                              )}
                                            </li>
                                          );
                                        })}
                                      </ul>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </section>
                      <section className="detail-section">
                        <h3>Dagitim Listesi</h3>
                        {detailDistributionList.length === 0 ? (
                          <p className="muted-text">Dagitim hedefi eklenmemis.</p>
                        ) : (
                          <div className="table-wrapper detail-table-wrapper">
                            <table className="detail-table">
                              <thead>
                                <tr>
                                  <th>Tip</th>
                                  <th>Kod</th>
                                  <th>Zorunlu</th>
                                </tr>
                              </thead>
                              <tbody>
                                {detailDistributionList.map((item, index) => (
                                  <tr key={`${item.principal_id}-${index}`}>
                                    <td>{item.principal_type || "-"}</td>
                                    <td>{item.principal_id || "-"}</td>
                                    <td>{item.required_to_read === false ? "Hayir" : "Evet"}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </section>
                    </div>
                  )}

                  {detailTab === "actions" && (
                    <>
                      {detailActionHistory.length === 0 ? (
                        <div className="empty-state">
                          Aksiyon kaydi bulunmuyor.
                        </div>
                      ) : (
                        <ul className="history-list detail-action-list">
                          {detailActionHistory.map((event) => {
                            const statusMeta = resolveActionStatusMeta(
                              event.type,
                              event.status
                            );
                            return (
                              <li key={event.key} className="detail-action-item">
                                <div className="detail-action-header">
                                  <Badge variant="info">{event.type}</Badge>
                                  {event.stage !== null && (
                                    <span>Asama {event.stage}</span>
                                  )}
                                  <span>
                                    {event.at
                                      ? formatDateTime(event.at)
                                      : "-"}
                                  </span>
                                </div>
                                <div className="detail-action-body">
                                  <div>
                                    <strong>Durum:</strong>{" "}
                                    <Badge variant={statusMeta.variant}>
                                      {statusMeta.label}
                                    </Badge>
                                  </div>
                                  {event.by && (
                                    <div>
                                      <strong>Kisi:</strong>{" "}
                                      <span>{event.by}</span>
                                    </div>
                                  )}
                                  {event.comment && (
                                    <p className="detail-action-comment">
                                      {event.comment}
                                    </p>
                                  )}
                                </div>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {preview.open && (
        <Card>
          <CardHeader>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: "12px",
                flexWrap: "wrap",
              }}
            >
              <div>
                <CardTitle>Dosya Onizleme</CardTitle>
                <CardDescription>
                  {preview.filename || "Dosya bilgisi"}
                </CardDescription>
              </div>
              <div className="actions-row" style={{ gap: "8px" }}>
                <Button
                  variant="outline"
                  onClick={handleDownloadPreview}
                  disabled={!canDownloadPreview}
                >
                  Indir
                </Button>
                <Button variant="ghost" onClick={closePreview}>
                  Kapat
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {preview.loading ? (
              <div className="loading-state">Dosya yukleniyor...</div>
            ) : preview.error ? (
              <p style={{ ...errorTextStyle }}>{preview.error}</p>
            ) : preview.mode === "html" ? (
              <div
                style={{
                  border: "1px solid #d1d5db",
                  borderRadius: "8px",
                  padding: "16px",
                  maxHeight: "520px",
                  overflowY: "auto",
                  backgroundColor: "#fff",
                }}
                dangerouslySetInnerHTML={{ __html: preview.html }}
              />
            ) : preview.mode === "slides" ? (
              <ol className="history-list">
                {preview.slides.map((slide, index) => (
                  <li key={`${preview.documentId}-slide-${index}`}>
                    <strong>Slayt {index + 1}</strong>
                    <p style={{ marginTop: "4px", whiteSpace: "pre-line" }}>{slide}</p>
                  </li>
                ))}
              </ol>
            ) : preview.mode === "text" ? (
              <pre
                style={{
                  background: "#f8fafc",
                  padding: "16px",
                  borderRadius: "8px",
                  maxHeight: "520px",
                  overflow: "auto",
                }}
              >
                {preview.text}
              </pre>
            ) : preview.mode === "blob" && preview.blobUrl ? (
              preview.mimeType.startsWith("image/") ? (
                <img
                  src={preview.blobUrl}
                  alt={preview.filename || "Dokuman"}
                  style={{ maxWidth: "100%", maxHeight: "520px" }}
                />
              ) : preview.mimeType === "application/pdf" ? (
                <iframe
                  src={preview.blobUrl}
                  title="PDF Onizleme"
                  style={{ width: "100%", height: "520px", border: "1px solid #ccc" }}
                />
              ) : preview.mimeType.startsWith("text/") ? (
                <iframe
                  src={preview.blobUrl}
                  title="Metin Onizleme"
                  style={{ width: "100%", height: "520px", border: "1px solid #ccc" }}
                />
              ) : (
                <p>
                  Bu dosya turu icin yerlesik onizleme bulunmamaktadir. Indirebilirsiniz.
                </p>
              )
            ) : (
              <p>Onizleme icin veri bulunamadi.</p>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Onay Bekleyen Dokumanlar</CardTitle>
          <CardDescription>
            Onay ak��s��nda size atanan dokumanlar listelenir.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {approvalLoading ? (
            <div className="loading-state">Veriler yukleniyor...</div>
          ) : approvalError ? (
            <p style={errorTextStyle}>{approvalError}</p>
          ) : approvalTasks.length === 0 ? (
            <div className="empty-state">Bekleyen onay goreviniz bulunmuyor.</div>
          ) : (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Kod</th>
                    <th>Baslik</th>
                    <th>Asama</th>
                    <th>Tip</th>
                    <th>Son Tarih</th>
                    <th>Not</th>
                    <th>Islem</th>
                  </tr>
                </thead>
                <tbody>
                  {approvalTasks.map((task) => (
                    <tr key={task.document_id}>
                      <td>{task.document_code}</td>
                      <td>
                        <div className="cell-title">{task.title}</div>
                        <div className="cell-muted">Versiyon {task.version}</div>
                      </td>
                      <td>{task.stage}</td>
                      <td>{task.approval_type === "any" ? "Herhangi biri" : "Hepsi"}</td>
                      <td>{task.deadline ? formatDate(task.deadline) : "-"}</td>
                      <td>
                        <Textarea
                          value={approvalComments[task.document_id] || ""}
                          onChange={handleApprovalCommentChange(task.document_id)}
                          placeholder="Opsiyonel yorum"
                          rows={2}
                        />
                      </td>
                      <td>
                        <div className="actions-row" style={{ gap: "8px" }}>
                          <Button
                            variant="outline"
                            onClick={() => submitApprovalDecision(task, "rejected")}
                            disabled={approvalActionId === task.document_id}
                          >
                            Reddet
                          </Button>
                          <Button
                            onClick={() => submitApprovalDecision(task, "approved")}
                            disabled={approvalActionId === task.document_id}
                          >
                            Onayla
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Okuma Onayi Bekleyen Dokumanlar</CardTitle>
          <CardDescription>
            Dagitim listesinde yer aldiginiz ve okuma onayi beklenen kayitlar.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {readLoading ? (
            <div className="loading-state">Veriler yukleniyor...</div>
          ) : readError ? (
            <p style={errorTextStyle}>{readError}</p>
          ) : readTasks.length === 0 ? (
            <div className="empty-state">Okuma onayi bekleyen kayit bulunmuyor.</div>
          ) : (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Kod</th>
                    <th>Baslik</th>
                    <th>Durum</th>
                    <th>Zorunlu</th>
                    <th>Not</th>
                    <th>Islem</th>
                  </tr>
                </thead>
                <tbody>
                  {readTasks.map((task) => (
                    <tr key={task.document_id}>
                      <td>{task.document_code}</td>
                      <td>
                        <div className="cell-title">{task.title}</div>
                        <div className="cell-muted">Versiyon {task.version}</div>
                      </td>
                      <td>{task.status}</td>
                      <td>{task.required ? "Evet" : "Hayir"}</td>
                      <td>
                        <Textarea
                          value={readNotes[task.document_id] || ""}
                          onChange={handleReadNoteChange(task.document_id)}
                          placeholder="Opsiyonel not"
                          rows={2}
                        />
                      </td>
                      <td>
                        <Button
                          onClick={() => acknowledgeReadTask(task)}
                          disabled={readActionId === task.document_id}
                        >
                          Okudum
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

      <Card>
        <CardHeader>
          <CardTitle>Dokuman Bildirimleri</CardTitle>
          <CardDescription>
            Okunmamis son bildirimler gosterilir (en fazla 10 kayit).
          </CardDescription>
        </CardHeader>
        <CardContent>
          {notificationsLoading ? (
            <div className="loading-state">Veriler yukleniyor...</div>
          ) : notificationsError ? (
            <p style={errorTextStyle}>{notificationsError}</p>
          ) : notifications.length === 0 ? (
            <div className="empty-state">Yeni dokuman bildirimi bulunmuyor.</div>
          ) : (
            <ul className="history-list">
              {notifications.map((notification) => (
                <li key={notification.id} className="history-item">
                  <Badge
                    variant={
                      NOTIFICATION_BADGE_VARIANTS[notification.type] || "neutral"
                    }
                  >
                    {notification.type || "info"}
                  </Badge>
                  <div style={{ marginLeft: "8px" }}>
                    <div style={{ fontWeight: 600 }}>{notification.title}</div>
                    <div className="cell-muted">{notification.message}</div>
                    <small>{formatDateTime(notification.created_at)}</small>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Filtreler</CardTitle>
          <CardDescription>
            Klasor, departman, durum veya anahtar kelimeye gore listeyi daraltin.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid three-cols">
            <div className="form-field">
              <Label htmlFor="doc-folder">Klasor</Label>
              <Select
                id="doc-folder"
                value={filters.folderId}
                onChange={handleInput("folderId")}
              >
                <SelectOption value="">Tum klasorler</SelectOption>
                {folders.map((folder) => (
                  <SelectOption key={folder.id} value={folder.id}>
                    {folder.name}
                  </SelectOption>
                ))}
              </Select>
            </div>
            <div className="form-field">
              <Label htmlFor="doc-department">Departman</Label>
              <Select
                id="doc-department"
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
              <Label htmlFor="doc-status">Durum</Label>
              <Select
                id="doc-status"
                value={filters.status}
                onChange={handleInput("status")}
              >
                <SelectOption value="">Tum durumlar</SelectOption>
                {statusOptions.map((status) => (
                  <SelectOption key={status} value={status}>
                    {STATUS_LABELS[status].label}
                  </SelectOption>
                ))}
              </Select>
            </div>
            <div className="form-field">
              <Label htmlFor="doc-type">Dokuman Turu</Label>
              <Select
                id="doc-type"
                value={filters.documentType}
                onChange={handleInput("documentType")}
              >
                <SelectOption value="">Tum turler</SelectOption>
                {uniqueDocumentTypes.map((type) => (
                  <SelectOption key={type} value={type}>
                    {type}
                  </SelectOption>
                ))}
              </Select>
            </div>
            <div className="form-field">
              <Label htmlFor="doc-search">Arama</Label>
              <Input
                id="doc-search"
                value={filters.search}
                onChange={handleInput("search")}
                placeholder="Baslik, kod veya anahtar kelime"
              />
            </div>
          </div>
          <div className="actions-row">
            <Button
              variant="secondary"
              onClick={() => {
                fetchDocuments();
                fetchReport();
                fetchApprovalTasks();
                fetchReadTasks();
                fetchNotifications();
              }}
              disabled={loading || !isReady}
            >
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
          <CardTitle>Dokuman Listesi</CardTitle>
          <CardDescription>
            Guncel {filteredDocuments.length} kayit listeleniyor. Rapor toplam{" "}
            {report?.total ?? filteredDocuments.length} kayit gosteriyor.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="loading-state">Veriler yukleniyor...</div>
          ) : filteredDocuments.length === 0 ? (
            <div className="empty-state">Eslesen dokuman bulunamadi.</div>
          ) : (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Kod</th>
                    <th>Baslik</th>
                    <th>Departman</th>
                    <th>Durum</th>
                    <th>Versiyon</th>
                    <th>Guncelleyen</th>
                    <th>Guncelleme Tarihi</th>
                    <th>Islem</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDocuments.map((doc) => {
                    const badgeConfig = STATUS_LABELS[doc.status] || STATUS_LABELS.draft;
                    const hasFile = Boolean(doc.file_id);
                    const isPreviewing =
                      preview.open && preview.documentId === doc.id && !preview.loading && !preview.error;
                    const previewBusy = preview.loading && preview.documentId === doc.id;
                    return (
                      <tr key={doc.id}>
                        <td>{doc.code}</td>
                        <td>
                          <div className="cell-title">{doc.title}</div>
                          <div className="cell-muted">{doc.document_type}</div>
                        </td>
                        <td>{doc.department || "-"}</td>
                        <td>
                          <Badge variant={badgeConfig.variant}>{badgeConfig.label}</Badge>
                        </td>
                        <td>{doc.version}</td>
                        <td>{doc.author_id || "-"}</td>
                        <td>{formatDateTime(doc.updated_at)}</td>
                        <td>
                          <div className="actions-row" style={{ gap: "8px" }}>
                            <Button
                              variant={isPreviewing ? "secondary" : "outline"}
                              onClick={() => handlePreviewDocument(doc)}
                              disabled={!isReady || !hasFile || previewBusy}
                            >
                              {previewBusy ? "Yukleniyor..." : "Onizle"}
                            </Button>
                            <Button
                              variant="outline"
                              onClick={() => handleOpenDetails(doc)}
                              disabled={detailLoading && detailDocument?.id === doc.id}
                            >
                              Detay
                            </Button>
                            <Button
                              variant="outline"
                              onClick={() => handleStartEdit(doc)}
                              disabled={submitLoading}
                            >
                              Duzenle
                            </Button>
                          </div>
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
    </div>
  );
};

export default DocumentsModule;
