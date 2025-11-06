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
import { Textarea } from "../components/ui/Textarea";
import { useApiConnection } from "./useApiConnection";
import { formatDate, formatDateTime } from "./formatters";

const STATUS_CONFIG = {
  open: { label: "Acik", variant: "info" },
  investigating: { label: "Inceleniyor", variant: "warning" },
  resolved: { label: "Cozumlendi", variant: "success" },
  closed: { label: "Kapandi", variant: "neutral" },
};

const STATUS_OPTIONS = Object.keys(STATUS_CONFIG);

const errorTextStyle = {
  color: "#b42318",
  fontSize: "0.9rem",
};

const successTextStyle = {
  color: "#027a48",
  fontSize: "0.9rem",
};

const PRIORITY_CONFIG = {
  low: { label: "Dusuk", variant: "neutral" },
  medium: { label: "Orta", variant: "info" },
  high: { label: "Yuksek", variant: "warning" },
  critical: { label: "Kritik", variant: "danger" },
};

const ComplaintsModule = () => {
  const { apiUrl, headers, isReady, authDisabled, refresh } = useApiConnection();
  const [complaints, setComplaints] = useState([]);
  const [filters, setFilters] = useState({
    department: "",
    status: "",
    priority: "",
    search: "",
    category: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedComplaint, setSelectedComplaint] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [assignmentForm, setAssignmentForm] = useState({
    assigned_to: "",
    team_leader: "",
    solution_team: "",
    initial_response: "",
  });
  const [assignmentSaving, setAssignmentSaving] = useState(false);
  const [assignmentError, setAssignmentError] = useState("");
  const [assignmentSuccess, setAssignmentSuccess] = useState("");
  const [investigationForm, setInvestigationForm] = useState({
    investigation_report: "",
    related_task_ids: "",
    file_attachments: "",
  });
  const [investigationSaving, setInvestigationSaving] = useState(false);
  const [investigationError, setInvestigationError] = useState("");
  const [investigationSuccess, setInvestigationSuccess] = useState("");
  const [finalForm, setFinalForm] = useState({
    final_report: "",
    final_response: "",
    file_attachments: "",
    mark_resolved: true,
  });
  const [finalSaving, setFinalSaving] = useState(false);
  const [finalError, setFinalError] = useState("");
  const [finalSuccess, setFinalSuccess] = useState("");
  const [statusUpdate, setStatusUpdate] = useState({ status: "", comment: "" });
  const [statusSaving, setStatusSaving] = useState(false);
  const [statusError, setStatusError] = useState("");
  const [statusSuccess, setStatusSuccess] = useState("");
  const [dofForm, setDofForm] = useState({
    title: "",
    description: "",
    department: "",
    responsible_person: "",
    due_date: "",
    team_members: "",
    initial_improvement_report_date: "",
  });
  const [dofSaving, setDofSaving] = useState(false);
  const [dofError, setDofError] = useState("");
  const [dofSuccess, setDofSuccess] = useState("");
  const [capaForm, setCapaForm] = useState({
    title: "",
    source: "customer_complaint",
    department: "",
    team_leader: "",
    target_date: "",
    nonconformity_description: "",
    file_attachments: "",
    team_members: "",
    initial_improvement_report_date: "",
    linked_risk_ids: "",
    linked_equipment_ids: "",
  });
  const [capaSaving, setCapaSaving] = useState(false);
  const [capaError, setCapaError] = useState("");
  const [capaSuccess, setCapaSuccess] = useState("");
  const [attachmentUpload, setAttachmentUpload] = useState({
    uploading: false,
    error: "",
    success: "",
  });
  const [investigationUpload, setInvestigationUpload] = useState({
    uploading: false,
    error: "",
    success: "",
  });
  const [finalUpload, setFinalUpload] = useState({
    uploading: false,
    error: "",
    success: "",
  });
  const [capaUpload, setCapaUpload] = useState({
    uploading: false,
    error: "",
    success: "",
  });
  const [categories, setCategories] = useState([]);
  const [categoriesLoading, setCategoriesLoading] = useState(false);
  const [categoriesError, setCategoriesError] = useState("");
  const [categoryForm, setCategoryForm] = useState({ name: "", description: "" });
  const [categorySaving, setCategorySaving] = useState(false);
  const [categorySuccess, setCategorySuccess] = useState("");
  const [editingCategory, setEditingCategory] = useState(null);
  const [categoryFormError, setCategoryFormError] = useState("");
  const [categoryActionId, setCategoryActionId] = useState("");
  const [categoryReport, setCategoryReport] = useState(null);
  const [categoryReportLoading, setCategoryReportLoading] = useState(false);
  const [categoryReportError, setCategoryReportError] = useState("");
  const [metadataForm, setMetadataForm] = useState({
    complaint_type: "",
    priority: "",
    department: "",
    category_id: "",
  });
  const [metadataSaving, setMetadataSaving] = useState(false);
  const [metadataError, setMetadataError] = useState("");
  const [metadataSuccess, setMetadataSuccess] = useState("");

  const parseListInput = useCallback((value) => {
    if (!value) return [];
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }, []);

  const appendFileId = useCallback((currentValue, fileId) => {
    const trimmed = (currentValue || "").trim();
    if (!trimmed) {
      return fileId;
    }
    return `${trimmed}, ${fileId}`;
  }, []);

  const prepareUploadHeaders = useCallback(() => {
    const uploadHeaders = {};
    if (headers) {
      Object.entries(headers).forEach(([key, value]) => {
        if (key.toLowerCase() === "content-type") {
          return;
        }
        uploadHeaders[key] = value;
      });
    }
    return uploadHeaders;
  }, [headers]);

  const uploadFileToServer = useCallback(
    async (file, moduleId) => {
      if (!file) {
        throw new Error("Dosya seçilmedi.");
      }
      if (!isReady) {
        throw new Error("API bağlantısı hazır değil.");
      }
      const formData = new FormData();
      formData.append("file", file);
      formData.append("module_type", "complaint");
      if (moduleId) {
        formData.append("module_id", moduleId);
      }
      const uploadHeaders = prepareUploadHeaders();
      const { data } = await axios.post(`${apiUrl}/upload`, formData, {
        headers: uploadHeaders,
      });
      return data;
    },
    [apiUrl, prepareUploadHeaders, isReady]
  );

  const fetchCategories = useCallback(async () => {
    if (!isReady) {
      setCategories([]);
      return;
    }
    setCategoriesLoading(true);
    setCategoriesError("");
    try {
      const { data } = await axios.get(`${apiUrl}/complaint-categories`, {
        headers,
      });
      setCategories(data || []);
    } catch (err) {
      const message =
        err?.response?.data?.detail || err?.message || "Kategori listesi yuklenemedi.";
      setCategoriesError(message);
      setCategories([]);
    } finally {
      setCategoriesLoading(false);
    }
  }, [apiUrl, headers, isReady]);

  const fetchCategoryReport = useCallback(async () => {
    if (!isReady) {
      setCategoryReport(null);
      return;
    }
    setCategoryReportLoading(true);
    setCategoryReportError("");
    try {
      const { data } = await axios.get(`${apiUrl}/complaints/report/categories`, {
        headers,
      });
      setCategoryReport(data || null);
    } catch (err) {
      const message =
        err?.response?.data?.detail || err?.message || "Kategori raporu yuklenemedi.";
      setCategoryReport(null);
      setCategoryReportError(message);
    } finally {
      setCategoryReportLoading(false);
    }
  }, [apiUrl, headers, isReady]);

  const fetchComplaints = useCallback(async () => {
    if (!isReady) return;
    setLoading(true);
    setError("");
    try {
      const { data } = await axios.get(`${apiUrl}/complaints`, { headers });
      setComplaints(data || []);
    } catch (err) {
      const message =
        err?.response?.data?.detail || err?.message || "Sikayetler yuklenemedi.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [apiUrl, headers, isReady]);

  useEffect(() => {
    if (!isReady) {
      setComplaints([]);
      setCategories([]);
      setCategoryReport(null);
      return;
    }
    fetchComplaints();
    fetchCategories();
    fetchCategoryReport();
  }, [fetchCategories, fetchCategoryReport, fetchComplaints, isReady]);

  const loadComplaintDetail = useCallback(
    async (complaintId) => {
      if (!complaintId || !isReady) return;
      setDetailLoading(true);
      setDetailError("");
      try {
        const { data } = await axios.get(`${apiUrl}/complaints/${complaintId}`, {
          headers,
        });
        setSelectedComplaint(data || null);
        setAssignmentForm({
          assigned_to: data?.assigned_to || "",
          team_leader: data?.team_leader || "",
          solution_team: (data?.solution_team || []).join(", "),
          initial_response: data?.initial_response || "",
        });
        setAssignmentError("");
        setAssignmentSuccess("");

        setInvestigationForm({
          investigation_report: data?.investigation_report || "",
          related_task_ids: (data?.related_task_ids || []).join(", "),
          file_attachments: "",
        });
        setInvestigationError("");
        setInvestigationSuccess("");

        setFinalForm({
          final_report: data?.final_report || "",
          final_response: data?.final_response || "",
          file_attachments: "",
          mark_resolved: data?.status === "resolved",
        });
        setFinalError("");
        setFinalSuccess("");

        setMetadataForm({
          complaint_type: data?.complaint_type || "",
          priority: data?.priority || "",
          department: data?.department || "",
          category_id: data?.category_id || "",
        });
        setMetadataError("");
        setMetadataSuccess("");

        setStatusUpdate({
          status: data?.status || "",
          comment: "",
        });
        setStatusError("");
        setStatusSuccess("");

        setDofForm({
          title: data?.complaint_no ? `Şikayet ${data.complaint_no}` : "",
          description: data?.description || "",
          department: data?.department || "",
          responsible_person: data?.assigned_to || data?.team_leader || "",
          due_date: "",
          team_members: (data?.solution_team || []).join(", "),
          initial_improvement_report_date: "",
        });
        setDofError("");
        setDofSuccess("");

        setCapaForm({
          title: data?.complaint_no ? `Şikayet ${data.complaint_no} CAPA` : "",
          source: "customer_complaint",
          department: data?.department || "",
          team_leader: data?.team_leader || data?.assigned_to || "",
          target_date: "",
          nonconformity_description: data?.description || "",
          file_attachments: "",
          team_members: (data?.solution_team || []).join(", "),
          initial_improvement_report_date: "",
          linked_risk_ids: "",
          linked_equipment_ids: "",
        });
        setCapaError("");
        setCapaSuccess("");
        setAttachmentUpload({ uploading: false, error: "", success: "" });
        setInvestigationUpload({ uploading: false, error: "", success: "" });
        setFinalUpload({ uploading: false, error: "", success: "" });
        setCapaUpload({ uploading: false, error: "", success: "" });
      } catch (err) {
        const message =
          err?.response?.data?.detail || err?.message || "Sikayet detayi yuklenemedi.";
        setDetailError(message);
      } finally {
        setDetailLoading(false);
      }
    },
    [apiUrl, headers, isReady]
  );

  const handleSelectComplaint = useCallback(
    (complaint) => {
      if (!isReady) return;
      setSelectedComplaint(complaint);
      loadComplaintDetail(complaint.id);
    },
    [isReady, loadComplaintDetail]
  );

  useEffect(() => {
    if (!isReady) {
      setSelectedComplaint(null);
      setAttachmentUpload({ uploading: false, error: "", success: "" });
      setInvestigationUpload({ uploading: false, error: "", success: "" });
      setFinalUpload({ uploading: false, error: "", success: "" });
      setCapaUpload({ uploading: false, error: "", success: "" });
      setMetadataForm({
        complaint_type: "",
        priority: "",
        department: "",
        category_id: "",
      });
      setMetadataError("");
      setMetadataSuccess("");
    }
  }, [isReady]);

  const uniqueDepartments = useMemo(() => {
    const items = new Set();
    complaints.forEach((item) => {
      if (item.department) {
        items.add(item.department);
      }
    });
    return Array.from(items).sort((a, b) => a.localeCompare(b));
  }, [complaints]);

  const activeCategories = useMemo(() => {
    return categories
      .filter((category) => category && category.is_active !== false)
      .sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  }, [categories]);

  const categoryLookup = useMemo(() => {
    const map = {};
    categories.forEach((category) => {
      if (category?.id) {
        map[category.id] = category.name || "";
      }
    });
    return map;
  }, [categories]);

  const selectableCategories = useMemo(() => {
    return [...categories].sort((a, b) =>
      (a?.name || "").localeCompare(b?.name || "")
    );
  }, [categories]);

const filteredComplaints = useMemo(() => {
    return complaints.filter((item) => {
      if (
        filters.department &&
        item.department?.toLowerCase() !== filters.department.toLowerCase()
      ) {
        return false;
      }
      if (filters.status && item.status !== filters.status) {
        return false;
      }
      if (filters.priority && item.priority !== filters.priority) {
        return false;
      }
      if (filters.category) {
        if (filters.category === "__uncategorized") {
          if (item.category_id) {
            return false;
          }
        } else if (item.category_id !== filters.category) {
          return false;
        }
      }
      if (filters.search) {
        const term = filters.search.toLowerCase();
        if (
          !(
            item.complaint_no?.toLowerCase().includes(term) ||
            item.customer_name?.toLowerCase().includes(term) ||
            item.description?.toLowerCase().includes(term)
          )
        ) {
          return false;
        }
      }
      return true;
    });
  }, [complaints, filters]);

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
      priority: "",
      search: "",
      category: "",
    });
  };

  const resetCategoryForm = useCallback(() => {
    setCategoryForm({ name: "", description: "" });
    setEditingCategory(null);
    setCategoryFormError("");
  }, []);

  const handleCategorySubmit = async (event) => {
    event.preventDefault();
    if (!isReady) {
      setCategoryFormError("API baglantisi hazir degil.");
      return;
    }
    const name = categoryForm.name.trim();
    const description = categoryForm.description.trim();
    if (!name) {
      setCategoryFormError("Kategori adi gereklidir.");
      return;
    }
    setCategorySaving(true);
    setCategoryFormError("");
    setCategorySuccess("");
    try {
      if (editingCategory) {
        await axios.patch(
          `${apiUrl}/complaint-categories/${editingCategory.id}`,
          { name, description },
          { headers }
        );
        setCategorySuccess("Kategori guncellendi.");
      } else {
        await axios.post(
          `${apiUrl}/complaint-categories`,
          { name, description },
          { headers }
        );
        setCategorySuccess("Kategori olusturuldu.");
      }
      resetCategoryForm();
      await fetchCategories();
      await fetchCategoryReport();
    } catch (err) {
      const message =
        err?.response?.data?.detail || err?.message || "Kategori kaydedilemedi.";
      setCategoryFormError(message);
    } finally {
      setCategorySaving(false);
    }
  };

  const handleEditCategory = (category) => {
    setEditingCategory(category);
    setCategoryForm({
      name: category.name || "",
      description: category.description || "",
    });
    setCategoryFormError("");
    setCategorySuccess("");
  };

  const handleCancelCategoryEdit = () => {
    resetCategoryForm();
    setCategorySuccess("");
  };

  const handleToggleCategory = async (category) => {
    if (!isReady || !category) return;
    setCategoryActionId(category.id);
    setCategoriesError("");
    try {
      await axios.patch(
        `${apiUrl}/complaint-categories/${category.id}`,
        { is_active: !category.is_active },
        { headers }
      );
      await fetchCategories();
      await fetchCategoryReport();
    } catch (err) {
      const message =
        err?.response?.data?.detail || err?.message || "Kategori guncellenemedi.";
      setCategoriesError(message);
    } finally {
      setCategoryActionId("");
    }
  };

  const handleMetadataChange = (field) => (event) => {
    const value = event.target.value;
    setMetadataForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleMetadataSubmit = async (event) => {
    event.preventDefault();
    if (!selectedComplaint || !isReady) {
      setMetadataError("Aktif sikayet secmediniz.");
      return;
    }
    setMetadataSaving(true);
    setMetadataError("");
    setMetadataSuccess("");
    try {
      const payload = {
        complaint_type: metadataForm.complaint_type.trim(),
        priority: metadataForm.priority.trim(),
        department: metadataForm.department.trim(),
        category_id: metadataForm.category_id,
      };
      if (payload.category_id === "__none") {
        payload.category_id = "";
      }
      if (!payload.category_id) {
        payload.category_id = "";
      }
      await axios.patch(
        `${apiUrl}/complaints/${selectedComplaint.id}/metadata`,
        payload,
        { headers }
      );
      setMetadataSuccess("Temel bilgiler guncellendi.");
      await Promise.all([
        loadComplaintDetail(selectedComplaint.id),
        fetchComplaints(),
        fetchCategoryReport(),
      ]);
    } catch (err) {
      const message =
        err?.response?.data?.detail || err?.message || "Temel bilgiler guncellenemedi.";
      setMetadataError(message);
    } finally {
      setMetadataSaving(false);
    }
  };

  const buildFinalReportTemplate = useCallback(() => {
    if (!selectedComplaint) {
      return "";
    }
    const categoryName =
      selectedComplaint.category_name ||
      categoryLookup[selectedComplaint.category_id] ||
      "Belirlenmedi";
    const lines = [
      "==== SIKAYET OZETI ====",
      `Sikayet No: ${selectedComplaint.complaint_no || "-"}`,
      `Musteri: ${selectedComplaint.customer_name || "-"}`,
      `Iletisim: ${selectedComplaint.customer_contact || "-"}`,
      `Kategori: ${categoryName}`,
      `Oncelik: ${selectedComplaint.priority || "-"}`,
      `Departman: ${selectedComplaint.department || "-"}`,
      "",
      "==== DURUM ====",
      `Mevcut Durum: ${selectedComplaint.status || "-"}`,
      `Ilk Yanıt: ${selectedComplaint.initial_response || "Belirtilmedi"}`,
      "",
      "==== ARASTIRMA BULGULARI ====",
      selectedComplaint.investigation_report || "Arastirma raporu ekleyiniz.",
      "",
      "==== COZUM / NEDEN ====",
      selectedComplaint.final_response || "Cozum ozetini ekleyiniz.",
      "",
      "==== TAKIP AKSIYONLARI ====",
      selectedComplaint.related_capa_ids?.length
        ? `CAPA Kayitlari: ${selectedComplaint.related_capa_ids.join(", ")}`
        : "CAPA kaydi bulunmuyor.",
      selectedComplaint.related_task_ids?.length
        ? `Gorevler: ${selectedComplaint.related_task_ids.join(", ")}`
        : "Gorev bilgisi bulunmuyor.",
      "",
      "==== SON SOZ ====",
      "Bu sablonu musteriye paylasilmaya hazir hale getirmek icin guncelleyiniz.",
    ];
    return lines.join("\n");
  }, [categoryLookup, selectedComplaint]);

  const handleApplyFinalTemplate = () => {
    const template = buildFinalReportTemplate();
    if (!template) {
      return;
    }
    setFinalForm((prev) => ({
      ...prev,
      final_report: template,
    }));
    setFinalSuccess("");
    setFinalError("");
  };

  const handleAssignmentSubmit = async (event) => {
    event.preventDefault();
    if (!selectedComplaint || !isReady) return;
    const complaintId = selectedComplaint.id;
    setAssignmentSaving(true);
    setAssignmentError("");
    setAssignmentSuccess("");
    const payload = {
      assigned_to: assignmentForm.assigned_to.trim(),
      team_leader: assignmentForm.team_leader.trim(),
      solution_team: parseListInput(assignmentForm.solution_team),
      initial_response: assignmentForm.initial_response.trim(),
    };
    try {
      await axios.patch(`${apiUrl}/complaints/${complaintId}/assignment`, payload, {
        headers,
      });
      setAssignmentSuccess("Gorevlendirme guncellendi.");
      await Promise.all([loadComplaintDetail(complaintId), fetchComplaints()]);
    } catch (err) {
      const message =
        err?.response?.data?.detail || err?.message || "Gorevlendirme guncellenemedi.";
      setAssignmentError(message);
    } finally {
      setAssignmentSaving(false);
    }
  };

  const handleInvestigationSubmit = async (event) => {
    event.preventDefault();
    if (!selectedComplaint || !isReady) return;
    const complaintId = selectedComplaint.id;
    const report = investigationForm.investigation_report.trim();
    if (!report) {
      setInvestigationError("Arastirma raporu girilmelidir.");
      setInvestigationSuccess("");
      return;
    }
    setInvestigationSaving(true);
    setInvestigationError("");
    setInvestigationSuccess("");
    const payload = {
      investigation_report: report,
    };
    const relatedTasks = parseListInput(investigationForm.related_task_ids);
    if (relatedTasks.length) {
      payload.related_task_ids = relatedTasks;
    }
    const attachments = parseListInput(investigationForm.file_attachments);
    if (attachments.length) {
      payload.file_attachments = attachments;
    }
    try {
      await axios.patch(`${apiUrl}/complaints/${complaintId}/investigation`, payload, {
        headers,
      });
      setInvestigationSuccess("Arastirma raporu kaydedildi.");
      setInvestigationForm((prev) => ({ ...prev, file_attachments: "" }));
      await Promise.all([loadComplaintDetail(complaintId), fetchComplaints()]);
    } catch (err) {
      const message =
        err?.response?.data?.detail || err?.message || "Arastirma raporu kaydedilemedi.";
      setInvestigationError(message);
    } finally {
      setInvestigationSaving(false);
    }
  };

  const handleFinalSubmit = async (event) => {
    event.preventDefault();
    if (!selectedComplaint || !isReady) return;
    const complaintId = selectedComplaint.id;
    const report = finalForm.final_report.trim();
    if (!report) {
      setFinalError("Nihai rapor metni zorunludur.");
      setFinalSuccess("");
      return;
    }
    setFinalSaving(true);
    setFinalError("");
    setFinalSuccess("");
    const payload = {
      final_report: report,
      mark_resolved: Boolean(finalForm.mark_resolved),
    };
    if (finalForm.final_response.trim()) {
      payload.final_response = finalForm.final_response.trim();
    }
    const attachments = parseListInput(finalForm.file_attachments);
    if (attachments.length) {
      payload.file_attachments = attachments;
    }
    try {
      await axios.patch(`${apiUrl}/complaints/${complaintId}/finalize`, payload, {
        headers,
      });
      setFinalSuccess("Nihai rapor kaydedildi.");
      setFinalForm((prev) => ({ ...prev, file_attachments: "" }));
      await Promise.all([loadComplaintDetail(complaintId), fetchComplaints()]);
    } catch (err) {
      const message =
        err?.response?.data?.detail || err?.message || "Nihai rapor kaydedilemedi.";
      setFinalError(message);
    } finally {
      setFinalSaving(false);
    }
  };

  const handleAttachmentUpload = async (event) => {
    if (!selectedComplaint || !isReady) {
      event.target.value = "";
      return;
    }
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    setAttachmentUpload({ uploading: true, error: "", success: "" });
    try {
      const uploadResult = await uploadFileToServer(file, selectedComplaint.id);
      await axios.post(
        `${apiUrl}/complaints/${selectedComplaint.id}/attachments`,
        { file_ids: [uploadResult.file_id] },
        { headers }
      );
      await loadComplaintDetail(selectedComplaint.id);
      setAttachmentUpload({
        uploading: false,
        error: "",
        success: `${uploadResult.original_filename || uploadResult.filename} eklendi.`,
      });
    } catch (err) {
      const message =
        err?.response?.data?.detail || err?.message || "Dosya yüklenemedi.";
      setAttachmentUpload({ uploading: false, error: message, success: "" });
    } finally {
      event.target.value = "";
    }
  };

  const handleInvestigationFileUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file || !isReady) {
      if (event.target) event.target.value = "";
      return;
    }
    setInvestigationUpload({ uploading: true, error: "", success: "" });
    try {
      const uploadResult = await uploadFileToServer(file, selectedComplaint?.id);
      setInvestigationForm((prev) => ({
        ...prev,
        file_attachments: appendFileId(prev.file_attachments, uploadResult.file_id),
      }));
      setInvestigationUpload({
        uploading: false,
        error: "",
        success: `${
          uploadResult.original_filename || uploadResult.filename
        } yüklendi. Kaydetmek için formu gönderin.`,
      });
    } catch (err) {
      const message =
        err?.response?.data?.detail || err?.message || "Dosya yüklenemedi.";
      setInvestigationUpload({ uploading: false, error: message, success: "" });
    } finally {
      event.target.value = "";
    }
  };

  const handleFinalFileUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file || !isReady) {
      if (event.target) event.target.value = "";
      return;
    }
    setFinalUpload({ uploading: true, error: "", success: "" });
    try {
      const uploadResult = await uploadFileToServer(file, selectedComplaint?.id);
      setFinalForm((prev) => ({
        ...prev,
        file_attachments: appendFileId(prev.file_attachments, uploadResult.file_id),
      }));
      setFinalUpload({
        uploading: false,
        error: "",
        success: `${
          uploadResult.original_filename || uploadResult.filename
        } yüklendi. Kaydetmek için formu gönderin.`,
      });
    } catch (err) {
      const message =
        err?.response?.data?.detail || err?.message || "Dosya yüklenemedi.";
      setFinalUpload({ uploading: false, error: message, success: "" });
    } finally {
      event.target.value = "";
    }
  };

  const handleCapaFileUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file || !isReady) {
      if (event.target) event.target.value = "";
      return;
    }
    setCapaUpload({ uploading: true, error: "", success: "" });
    try {
      const uploadResult = await uploadFileToServer(file, selectedComplaint?.id);
      setCapaForm((prev) => ({
        ...prev,
        file_attachments: appendFileId(prev.file_attachments, uploadResult.file_id),
      }));
      setCapaUpload({
        uploading: false,
        error: "",
        success: `${
          uploadResult.original_filename || uploadResult.filename
        } yüklendi. CAPA formunu göndererek ilişkilendirin.`,
      });
    } catch (err) {
      const message =
        err?.response?.data?.detail || err?.message || "Dosya yüklenemedi.";
      setCapaUpload({ uploading: false, error: message, success: "" });
    } finally {
      event.target.value = "";
    }
  };

  const handleCreateDof = async (event) => {
    event.preventDefault();
    if (!selectedComplaint || !isReady) return;

    setDofSaving(true);
    setDofError("");
    setDofSuccess("");

    const payload = {};
    if (dofForm.title.trim()) {
      payload.title = dofForm.title.trim();
    }
    if (dofForm.description.trim()) {
      payload.description = dofForm.description.trim();
    }
    if (dofForm.department.trim()) {
      payload.department = dofForm.department.trim();
    }
    if (dofForm.responsible_person.trim()) {
      payload.responsible_person = dofForm.responsible_person.trim();
    }
    if (dofForm.due_date) {
      const parsed = new Date(dofForm.due_date);
      if (Number.isNaN(parsed.getTime())) {
        setDofError("Gecerli bir hedef tarih seciniz.");
        setDofSaving(false);
        return;
      }
      payload.due_date = parsed.toISOString();
    }
    if (dofForm.initial_improvement_report_date) {
      const parsedInitial = new Date(dofForm.initial_improvement_report_date);
      if (Number.isNaN(parsedInitial.getTime())) {
        setDofError("Gecerli bir iyilestirme raporu tarihi seciniz.");
        setDofSaving(false);
        return;
      }
      payload.initial_improvement_report_date = parsedInitial.toISOString();
    }
    const teamMembers = parseListInput(dofForm.team_members);
    if (teamMembers.length) {
      payload.team_members = teamMembers;
    }

    try {
      await axios.post(
        `${apiUrl}/complaints/${selectedComplaint.id}/dof`,
        payload,
        { headers },
      );
      setDofSuccess("DÖF kaydı oluşturuldu.");
      await Promise.all([loadComplaintDetail(selectedComplaint.id), fetchComplaints()]);
    } catch (err) {
      const message =
        err?.response?.data?.detail || err?.message || "DÖF kaydı oluşturulamadı.";
      setDofError(message);
    } finally {
      setDofSaving(false);
    }
  };

  const handleCreateCapa = async (event) => {
    event.preventDefault();
    if (!selectedComplaint || !isReady) return;

    setCapaSaving(true);
    setCapaError("");
    setCapaSuccess("");

    const payload = {};
    if (capaForm.title.trim()) {
      payload.title = capaForm.title.trim();
    }
    if (capaForm.source.trim()) {
      payload.source = capaForm.source.trim();
    }
    if (capaForm.department.trim()) {
      payload.department = capaForm.department.trim();
    }
    if (capaForm.team_leader.trim()) {
      payload.team_leader = capaForm.team_leader.trim();
    }
    if (capaForm.nonconformity_description.trim()) {
      payload.nonconformity_description = capaForm.nonconformity_description.trim();
    }
    if (capaForm.target_date) {
      const parsed = new Date(capaForm.target_date);
      if (Number.isNaN(parsed.getTime())) {
        setCapaError("Gecerli bir hedef tarih seciniz.");
        setCapaSaving(false);
        return;
      }
      payload.target_date = parsed.toISOString();
    }
    const attachments = parseListInput(capaForm.file_attachments);
    if (attachments.length) {
      payload.file_attachments = attachments;
    }
    const teamMembersForCapa = parseListInput(capaForm.team_members);
    if (teamMembersForCapa.length) {
      payload.team_members = teamMembersForCapa;
    }
    if (capaForm.initial_improvement_report_date) {
      const parsedInitial = new Date(capaForm.initial_improvement_report_date);
      if (Number.isNaN(parsedInitial.getTime())) {
        setCapaError("Gecerli bir iyilestirme raporu tarihi seciniz.");
        setCapaSaving(false);
        return;
      }
      payload.initial_improvement_report_date = parsedInitial.toISOString();
    }
    const linkedRisks = parseListInput(capaForm.linked_risk_ids);
    if (linkedRisks.length) {
      payload.linked_risk_ids = linkedRisks;
    }
    const linkedEquipment = parseListInput(capaForm.linked_equipment_ids);
    if (linkedEquipment.length) {
      payload.linked_equipment_ids = linkedEquipment;
    }

    try {
      await axios.post(
        `${apiUrl}/complaints/${selectedComplaint.id}/capas`,
        payload,
        { headers },
      );
      setCapaSuccess("CAPA kaydı oluşturuldu.");
      setCapaForm((prev) => ({
        ...prev,
        file_attachments: "",
        team_members: (selectedComplaint?.solution_team || []).join(", "),
        initial_improvement_report_date: "",
        linked_risk_ids: "",
        linked_equipment_ids: "",
      }));
      await Promise.all([loadComplaintDetail(selectedComplaint.id), fetchComplaints()]);
    } catch (err) {
      const message =
        err?.response?.data?.detail || err?.message || "CAPA kaydı oluşturulamadı.";
      setCapaError(message);
    } finally {
      setCapaSaving(false);
    }
  };

  const handleStatusSubmit = async (event) => {
    event.preventDefault();
    if (!selectedComplaint || !isReady) return;
    if (!statusUpdate.status) {
      setStatusError("Durum secmelisiniz.");
      setStatusSuccess("");
      return;
    }
    const complaintId = selectedComplaint.id;
    setStatusSaving(true);
    setStatusError("");
    setStatusSuccess("");
    try {
      await axios.put(`${apiUrl}/complaints/${complaintId}/status`, null, {
        headers,
        params: {
          status: statusUpdate.status,
          comment: statusUpdate.comment?.trim() || undefined,
        },
      });
      setStatusSuccess("Durum guncellendi.");
      setStatusUpdate((prev) => ({ ...prev, comment: "" }));
      await Promise.all([loadComplaintDetail(complaintId), fetchComplaints()]);
    } catch (err) {
      const message =
        err?.response?.data?.detail || err?.message || "Durum guncellenemedi.";
      setStatusError(message);
    } finally {
      setStatusSaving(false);
    }
  };

  const handleDetailRefresh = useCallback(() => {
    if (selectedComplaint?.id) {
      loadComplaintDetail(selectedComplaint.id);
    }
  }, [selectedComplaint, loadComplaintDetail]);

  const connectionWarning = !isReady;

  return (
    <div className="module-wrapper">
      <header className="module-header">
        <div>
          <h1>Musteri Sikayetleri</h1>
          <p>
            Sikayet kayitlarinin durumu, onceligi ve sorumlu departmanlari bu
            ekrandan izlenir.
          </p>
        </div>
        <Button variant="outline" onClick={fetchComplaints}>
          Yenile
        </Button>
      </header>

      {connectionWarning && (
        <Card>
          <CardHeader>
            <CardTitle>Baglanti Gerekli</CardTitle>
            <CardDescription>
              DOF sayfasindan API ve (gerekirse) token kaydi yapildiginda veri otomatik
              yansir.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p>
              {authDisabled
                ? "Kimlik dogrulama kapali. Sadece baglanti adresinin dogru olmasi yeterlidir."
                : "Token olmadan sikayet verileri cekilemez."}
            </p>
            <div className="actions-row" style={{ marginTop: "12px" }}>
              <Button onClick={refresh}>Baglanti Bilgilerini Yenile</Button>
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
          <CardTitle>Filtreler</CardTitle>
          <CardDescription>Departman, durum veya oncelige gore filtreleyin.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid three-cols">
            <div className="form-field">
              <Label htmlFor="complaint-department">Departman</Label>
              <Select
                id="complaint-department"
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
              <Label htmlFor="complaint-status">Durum</Label>
              <Select
                id="complaint-status"
                value={filters.status}
                onChange={handleInput("status")}
              >
                <SelectOption value="">Tum durumlar</SelectOption>
                {Object.keys(STATUS_CONFIG).map((status) => (
                  <SelectOption key={status} value={status}>
                    {STATUS_CONFIG[status].label}
                  </SelectOption>
                ))}
              </Select>
            </div>
          <div className="form-field">
            <Label htmlFor="complaint-priority">Oncelik</Label>
            <Select
              id="complaint-priority"
              value={filters.priority}
              onChange={handleInput("priority")}
            >
              <SelectOption value="">Tum oncelikler</SelectOption>
              {Object.keys(PRIORITY_CONFIG).map((priority) => (
                <SelectOption key={priority} value={priority}>
                  {PRIORITY_CONFIG[priority].label}
                </SelectOption>
              ))}
            </Select>
          </div>
          <div className="form-field">
            <Label htmlFor="complaint-category">Kategori</Label>
            <Select
              id="complaint-category"
              value={filters.category}
              onChange={handleInput("category")}
            >
              <SelectOption value="">Tum kategoriler</SelectOption>
              <SelectOption value="__uncategorized">Kategori yok</SelectOption>
              {selectableCategories.map((category) => (
                <SelectOption key={category.id} value={category.id}>
                  {category.name}
                  {category.is_active === false ? " (Pasif)" : ""}
                </SelectOption>
              ))}
            </Select>
          </div>
          <div className="form-field">
            <Label htmlFor="complaint-search">Arama</Label>
            <Input
              id="complaint-search"
              value={filters.search}
                onChange={handleInput("search")}
                placeholder="Sikayet no, musteri veya aciklama"
              />
            </div>
          </div>
          <div className="actions-row">
            <Button variant="secondary" onClick={fetchComplaints} disabled={loading || !isReady}>
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
          <CardTitle>Kategori Ozeti</CardTitle>
          <CardDescription>Kategori bazli kayit sayilari ve durum dagilimi.</CardDescription>
        </CardHeader>
        <CardContent>
          {categoryReportLoading ? (
            <div className="loading-state">Kategori verileri yukleniyor...</div>
          ) : categoryReportError ? (
            <p style={{ ...errorTextStyle }}>{categoryReportError}</p>
          ) : !categoryReport?.categories?.length ? (
            <div className="empty-state">Kategori dagilimi icin kayit bulunmuyor.</div>
          ) : (
            <div className="table-wrapper detail-table-wrapper">
              <table className="detail-table">
                <thead>
                  <tr>
                    <th>Kategori</th>
                    <th>Toplam</th>
                    {STATUS_OPTIONS.map((status) => (
                      <th key={`category-status-${status}`}>
                        {STATUS_CONFIG[status]?.label || status}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {categoryReport.categories.map((entry) => (
                    <tr key={entry.category_id || "uncategorized"}>
                      <td>{entry.category_name || "Belirlenmedi"}</td>
                      <td>{entry.count}</td>
                      {STATUS_OPTIONS.map((status) => (
                        <td key={`row-${entry.category_id || "none"}-${status}`}>
                          {entry.status_counts?.[status] ?? 0}
                        </td>
                      ))}
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
          <CardTitle>Kategori Yonetimi</CardTitle>
          <CardDescription>Kategorileri olusturun, guncelleyip pasif hale getirin.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCategorySubmit} className="module-grid" style={{ gap: "12px" }}>
            <div className="form-field">
              <Label htmlFor="category-name">Kategori Adi</Label>
              <Input
                id="category-name"
                value={categoryForm.name}
                onChange={(event) =>
                  setCategoryForm((prev) => ({ ...prev, name: event.target.value }))
                }
                placeholder="Kategori adi"
                disabled={categorySaving}
              />
            </div>
            <div className="form-field">
              <Label htmlFor="category-description">Aciklama</Label>
              <Textarea
                id="category-description"
                value={categoryForm.description}
                onChange={(event) =>
                  setCategoryForm((prev) => ({ ...prev, description: event.target.value }))
                }
                rows={2}
                placeholder="Opsiyonel aciklama"
                disabled={categorySaving}
              />
            </div>
            <div className="actions-row">
              <Button type="submit" disabled={categorySaving || !isReady}>
                {categorySaving
                  ? "Kaydediliyor..."
                  : editingCategory
                  ? "Kategoriyi Guncelle"
                  : "Kategori Ekle"}
              </Button>
              {editingCategory && (
                <Button type="button" variant="outline" onClick={handleCancelCategoryEdit}>
                  Iptal
                </Button>
              )}
            </div>
            {categoryFormError && (
              <p style={{ ...errorTextStyle }}>{categoryFormError}</p>
            )}
            {categorySuccess && (
              <p style={{ ...successTextStyle }}>{categorySuccess}</p>
            )}
          </form>

          {categoriesLoading ? (
            <div className="loading-state">Kategoriler yukleniyor...</div>
          ) : categoriesError ? (
            <p style={{ ...errorTextStyle, marginTop: "12px" }}>{categoriesError}</p>
          ) : (
            <div className="table-wrapper detail-table-wrapper" style={{ marginTop: "16px" }}>
              <table className="detail-table">
                <thead>
                  <tr>
                    <th>Kategori</th>
                    <th>Durum</th>
                    <th>Aciklama</th>
                    <th>Islem</th>
                  </tr>
                </thead>
                <tbody>
                  {categories.length === 0 ? (
                    <tr>
                      <td colSpan={4}>Kategori bulunmuyor.</td>
                    </tr>
                  ) : (
                    categories.map((category) => (
                      <tr key={category.id}>
                        <td>{category.name}</td>
                        <td>
                          <Badge variant={category.is_active !== false ? "success" : "neutral"}>
                            {category.is_active !== false ? "Aktif" : "Pasif"}
                          </Badge>
                        </td>
                        <td>{category.description || "-"}</td>
                        <td>
                          <div className="actions-row" style={{ gap: "8px" }}>
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => handleEditCategory(category)}
                              disabled={categorySaving || categoryActionId === category.id}
                            >
                              Duzenle
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => handleToggleCategory(category)}
                              disabled={categoryActionId === category.id}
                            >
                              {category.is_active !== false ? "Pasif Yap" : "Aktif Yap"}
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Sikayet Listesi</CardTitle>
          <CardDescription>
            {filteredComplaints.length} kayit goruntuleniyor (toplam {complaints.length}).
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="loading-state">Veriler yukleniyor...</div>
          ) : filteredComplaints.length === 0 ? (
            <div className="empty-state">Eslesen sikayet kaydi bulunamadi.</div>
          ) : (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>No</th>
                    <th>Musteri</th>
                    <th>Departman</th>
                    <th>Kategori</th>
                    <th>Oncelik</th>
                    <th>Durum</th>
                    <th>Olusturma</th>
                    <th>Guncelleme</th>
                    <th>Islem</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredComplaints.map((item) => {
                    const statusConfig = STATUS_CONFIG[item.status] || STATUS_CONFIG.open;
                    const priorityConfig =
                      PRIORITY_CONFIG[item.priority] || PRIORITY_CONFIG.low;
                    const isSelected = selectedComplaint?.id === item.id;
                    return (
                      <tr
                        key={item.id}
                        style={
                          isSelected ? { backgroundColor: "rgba(0,0,0,0.03)" } : undefined
                        }
                      >
                        <td>{item.complaint_no}</td>
                        <td>
                          <div className="cell-title">{item.customer_name}</div>
                          <div className="cell-muted">{item.customer_contact}</div>
                        </td>
                        <td>{item.department || "-"}</td>
                        <td>
                          {item.category_id
                            ? categoryLookup[item.category_id] || item.category_name || "-"
                            : "Belirlenmedi"}
                        </td>
                        <td>
                          <Badge variant={priorityConfig.variant}>{priorityConfig.label}</Badge>
                        </td>
                        <td>
                          <Badge variant={statusConfig.variant}>{statusConfig.label}</Badge>
                        </td>
                        <td>{formatDate(item.created_at)}</td>
                        <td>{formatDateTime(item.updated_at)}</td>
                        <td>
                          <Button
                            variant={isSelected ? "secondary" : "outline"}
                            onClick={() => handleSelectComplaint(item)}
                            disabled={!isReady}
                          >
                            {isSelected ? "Secildi" : "Detay"}
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

      {selectedComplaint && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Secili Sikayet</CardTitle>
              <CardDescription>
                #{selectedComplaint.complaint_no} �?� {selectedComplaint.customer_name}
              </CardDescription>
              <div className="actions-row" style={{ marginTop: "12px" }}>
                <Button
                  variant="outline"
                  onClick={handleDetailRefresh}
                  disabled={detailLoading || !isReady}
                >
                  Detayi Yenile
                </Button>
                <Button variant="ghost" onClick={() => setSelectedComplaint(null)}>
                  Kapat
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {detailLoading ? (
                <div className="loading-state">Detaylar yukleniyor...</div>
              ) : detailError ? (
                <div>
                  <p style={errorTextStyle}>{detailError}</p>
                  <div className="actions-row" style={{ marginTop: "12px" }}>
                    <Button variant="outline" onClick={handleDetailRefresh}>
                      Tekrar Dene
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="grid three-cols" style={{ gap: "16px" }}>
                    <div>
                      <span className="cell-muted">Durum</span>
                      <div style={{ marginTop: "6px" }}>
                        <Badge
                          variant={
                            (STATUS_CONFIG[selectedComplaint.status] || STATUS_CONFIG.open)
                              .variant
                          }
                        >
                          {
                            (STATUS_CONFIG[selectedComplaint.status] || STATUS_CONFIG.open)
                              .label
                          }
                        </Badge>
                      </div>
                    </div>
                    <div>
                      <span className="cell-muted">Oncelik</span>
                      <div style={{ marginTop: "6px" }}>
                        <Badge
                          variant={
                            (PRIORITY_CONFIG[selectedComplaint.priority] ||
                              PRIORITY_CONFIG.low).variant
                          }
                        >
                          {
                            (PRIORITY_CONFIG[selectedComplaint.priority] ||
                              PRIORITY_CONFIG.low).label
                          }
                        </Badge>
                      </div>
                    </div>
                    <div>
                      <span className="cell-muted">Departman</span>
                      <div style={{ marginTop: "6px" }}>
                        {selectedComplaint.department || "-"}
                      </div>
                    </div>
                    <div>
                      <span className="cell-muted">Kategori</span>
                      <div style={{ marginTop: "6px" }}>
                        {selectedComplaint.category_id
                          ? categoryLookup[selectedComplaint.category_id] ||
                            selectedComplaint.category_name ||
                            "-"
                          : "Belirlenmedi"}
                      </div>
                    </div>
                    <div>
                      <span className="cell-muted">Atanan Kisi</span>
                      <div style={{ marginTop: "6px" }}>
                        {selectedComplaint.assigned_to || "-"}
                      </div>
                    </div>
                    <div>
                      <span className="cell-muted">Takim Lideri</span>
                      <div style={{ marginTop: "6px" }}>
                        {selectedComplaint.team_leader || "-"}
                      </div>
                    </div>
                    <div>
                      <span className="cell-muted">Cozum Ekibi</span>
                      <div style={{ marginTop: "6px" }}>
                        {selectedComplaint.solution_team?.length
                          ? selectedComplaint.solution_team.join(", ")
                          : "-"}
                      </div>
                    </div>
                    <div>
                      <span className="cell-muted">Olusturma</span>
                      <div style={{ marginTop: "6px" }}>
                        {formatDateTime(selectedComplaint.created_at)}
                      </div>
                    </div>
                    <div>
                      <span className="cell-muted">Guncelleme</span>
                      <div style={{ marginTop: "6px" }}>
                        {formatDateTime(selectedComplaint.updated_at)}
                      </div>
                    </div>
                    <div>
                      <span className="cell-muted">Ilgili Gorevler</span>
                      <div style={{ marginTop: "6px" }}>
                        {selectedComplaint.related_task_ids?.length
                          ? selectedComplaint.related_task_ids.join(", ")
                          : "-"}
                      </div>
                    </div>
                    <div>
                      <span className="cell-muted">Ilgili CAPA Kayıtları</span>
                      <div style={{ marginTop: "6px" }}>
                        {selectedComplaint.related_capa_ids?.length
                          ? selectedComplaint.related_capa_ids.join(", ")
                          : "-"}
                      </div>
                    </div>
                  </div>

                  <div style={{ marginTop: "18px" }}>
                    <strong>Ilk Yanit</strong>
                    <p style={{ marginTop: "6px" }}>
                      {selectedComplaint.initial_response || "-"}
                    </p>
                  </div>
                  <div style={{ marginTop: "18px" }}>
                    <strong>Arastirma Raporu</strong>
                    <p style={{ marginTop: "6px" }}>
                      {selectedComplaint.investigation_report || "-"}
                    </p>
                  </div>
                  <div style={{ marginTop: "18px" }}>
                    <strong>Nihai Rapor</strong>
                    <p style={{ marginTop: "6px" }}>
                      {selectedComplaint.final_report || "-"}
                    </p>
                    {selectedComplaint.final_response && (
                      <p style={{ marginTop: "6px", fontStyle: "italic" }}>
                        {selectedComplaint.final_response}
                      </p>
                    )}
                  </div>
                  <div style={{ marginTop: "18px" }}>
                    <strong>Dosya Ekleri</strong>
                    {selectedComplaint.file_attachments?.length ? (
                      <ul className="history-list" style={{ marginTop: "6px" }}>
                        {selectedComplaint.file_attachments.map((attachment) => (
                          <li key={attachment}>{attachment}</li>
                        ))}
                      </ul>
                    ) : (
                      <p style={{ marginTop: "6px" }}>Ekli dosya bulunmuyor.</p>
                    )}
                    <div style={{ marginTop: "12px" }}>
                      <Label htmlFor="complaint-attachment-upload">Dosya Yükle</Label>
                      <input
                        id="complaint-attachment-upload"
                        type="file"
                        onChange={handleAttachmentUpload}
                        disabled={
                          attachmentUpload.uploading || detailLoading || !isReady
                        }
                      />
                      {attachmentUpload.uploading && (
                        <p style={{ marginTop: "6px" }}>Dosya yükleniyor...</p>
                      )}
                      {attachmentUpload.error && (
                        <p style={{ ...errorTextStyle, marginTop: "6px" }}>
                          {attachmentUpload.error}
                        </p>
                      )}
                      {attachmentUpload.success && (
                        <p style={{ ...successTextStyle, marginTop: "6px" }}>
                          {attachmentUpload.success}
                        </p>
                      )}
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Aksiyon Başlat</CardTitle>
              <CardDescription>
                Şikayet kaydından doğrudan DÖF görevi veya CAPA kaydı açabilirsiniz.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid two-cols" style={{ gap: "24px" }}>
                <form onSubmit={handleCreateDof}>
                  <h3>DÖF Görevi</h3>
                  <div className="form-field">
                    <Label htmlFor="dof-title">Başlık</Label>
                    <Input
                      id="dof-title"
                      value={dofForm.title}
                      onChange={(event) =>
                        setDofForm((prev) => ({ ...prev, title: event.target.value }))
                      }
                      placeholder="DÖF başlığı"
                      disabled={dofSaving || detailLoading}
                    />
                  </div>
                  <div className="form-field">
                    <Label htmlFor="final-upload">Dosya yükle</Label>
                    <input
                      id="final-upload"
                      type="file"
                      onChange={handleFinalFileUpload}
                      disabled={
                        finalSaving || finalUpload.uploading || detailLoading
                      }
                    />
                    {finalUpload.uploading && (
                      <p style={{ marginTop: "6px" }}>Dosya yükleniyor...</p>
                    )}
                    {finalUpload.error && (
                      <p style={{ ...errorTextStyle, marginTop: "6px" }}>
                        {finalUpload.error}
                      </p>
                    )}
                    {finalUpload.success && (
                      <p style={{ ...successTextStyle, marginTop: "6px" }}>
                        {finalUpload.success}
                      </p>
                    )}
                  </div>
                  <div className="form-field">
                    <Label htmlFor="dof-department">Departman</Label>
                    <Input
                      id="dof-department"
                      value={dofForm.department}
                      onChange={(event) =>
                        setDofForm((prev) => ({ ...prev, department: event.target.value }))
                      }
                      disabled={dofSaving || detailLoading}
                    />
                  </div>
                  <div className="form-field">
                    <Label htmlFor="dof-responsible">Sorumlu</Label>
                    <Input
                      id="dof-responsible"
                      value={dofForm.responsible_person}
                      onChange={(event) =>
                        setDofForm((prev) => ({
                          ...prev,
                          responsible_person: event.target.value,
                        }))
                      }
                      disabled={dofSaving || detailLoading}
                    />
                  </div>
                  <div className="form-field">
                    <Label htmlFor="dof-due-date">Hedef Tarih</Label>
                    <Input
                      id="dof-due-date"
                      type="datetime-local"
                      value={dofForm.due_date}
                      onChange={(event) =>
                        setDofForm((prev) => ({ ...prev, due_date: event.target.value }))
                      }
                      disabled={dofSaving || detailLoading}
                    />
                  </div>
                  <div className="form-field">
                    <Label htmlFor="dof-team-members">Ekip Uyeleri (virgul ile)</Label>
                    <Input
                      id="dof-team-members"
                      value={dofForm.team_members}
                      onChange={(event) =>
                        setDofForm((prev) => ({
                          ...prev,
                          team_members: event.target.value,
                        }))
                      }
                      placeholder="Orn. Ali Yilmaz, Ayse Kaya"
                      disabled={dofSaving || detailLoading}
                    />
                  </div>
                  <div className="form-field">
                    <Label htmlFor="dof-initial-report">Ilk iyilestirme raporu tarihi</Label>
                    <Input
                      id="dof-initial-report"
                      type="datetime-local"
                      value={dofForm.initial_improvement_report_date}
                      onChange={(event) =>
                        setDofForm((prev) => ({
                          ...prev,
                          initial_improvement_report_date: event.target.value,
                        }))
                      }
                      disabled={dofSaving || detailLoading}
                    />
                  </div>
                  <div className="form-field">
                    <Label htmlFor="dof-description">Açıklama</Label>
                    <Textarea
                      id="dof-description"
                      value={dofForm.description}
                      onChange={(event) =>
                        setDofForm((prev) => ({
                          ...prev,
                          description: event.target.value,
                        }))
                      }
                      rows={3}
                      disabled={dofSaving || detailLoading}
                    />
                  </div>
                  <div className="form-field">
                    <Label htmlFor="capa-upload">Dosya yükle</Label>
                    <input
                      id="capa-upload"
                      type="file"
                      onChange={handleCapaFileUpload}
                      disabled={
                        capaSaving || capaUpload.uploading || detailLoading
                      }
                    />
                    {capaUpload.uploading && (
                      <p style={{ marginTop: "6px" }}>Dosya yükleniyor...</p>
                    )}
                    {capaUpload.error && (
                      <p style={{ ...errorTextStyle, marginTop: "6px" }}>
                        {capaUpload.error}
                      </p>
                    )}
                    {capaUpload.success && (
                      <p style={{ ...successTextStyle, marginTop: "6px" }}>
                        {capaUpload.success}
                      </p>
                    )}
                  </div>
                  <div className="actions-row" style={{ marginTop: "12px" }}>
                    <Button type="submit" disabled={dofSaving || detailLoading || !isReady}>
                      {dofSaving ? "Oluşturuluyor..." : "DÖF Oluştur"}
                    </Button>
                  </div>
                  {dofError && (
                    <p style={{ ...errorTextStyle, marginTop: "8px" }}>{dofError}</p>
                  )}
                  {dofSuccess && (
                    <p style={{ ...successTextStyle, marginTop: "8px" }}>{dofSuccess}</p>
                  )}
                </form>

                <form onSubmit={handleCreateCapa}>
                  <h3>CAPA Kaydı</h3>
                  <div className="form-field">
                    <Label htmlFor="capa-title">Başlık</Label>
                    <Input
                      id="capa-title"
                      value={capaForm.title}
                      onChange={(event) =>
                        setCapaForm((prev) => ({ ...prev, title: event.target.value }))
                      }
                      placeholder="CAPA başlığı"
                      disabled={capaSaving || detailLoading}
                    />
                  </div>
                  <div className="form-field">
                    <Label htmlFor="capa-source">Kaynak</Label>
                    <Input
                      id="capa-source"
                      value={capaForm.source}
                      onChange={(event) =>
                        setCapaForm((prev) => ({ ...prev, source: event.target.value }))
                      }
                      disabled={capaSaving || detailLoading}
                    />
                  </div>
                  <div className="form-field">
                    <Label htmlFor="capa-department">Departman</Label>
                    <Input
                      id="capa-department"
                      value={capaForm.department}
                      onChange={(event) =>
                        setCapaForm((prev) => ({
                          ...prev,
                          department: event.target.value,
                        }))
                      }
                      disabled={capaSaving || detailLoading}
                    />
                  </div>
                  <div className="form-field">
                    <Label htmlFor="capa-leader">Takım Lideri</Label>
                    <Input
                      id="capa-leader"
                      value={capaForm.team_leader}
                      onChange={(event) =>
                        setCapaForm((prev) => ({
                          ...prev,
                          team_leader: event.target.value,
                        }))
                      }
                      disabled={capaSaving || detailLoading}
                    />
                  </div>
                  <div className="form-field">
                    <Label htmlFor="capa-team-members">Ekip Uyeleri (virgul ile)</Label>
                    <Input
                      id="capa-team-members"
                      value={capaForm.team_members}
                      onChange={(event) =>
                        setCapaForm((prev) => ({
                          ...prev,
                          team_members: event.target.value,
                        }))
                      }
                      placeholder="Orn. Ali Yilmaz, Ayse Kaya"
                      disabled={capaSaving || detailLoading}
                    />
                  </div>
                  <div className="form-field">
                    <Label htmlFor="capa-target">Hedef Tarih</Label>
                    <Input
                      id="capa-target"
                      type="datetime-local"
                      value={capaForm.target_date}
                      onChange={(event) =>
                        setCapaForm((prev) => ({
                          ...prev,
                          target_date: event.target.value,
                        }))
                      }
                      disabled={capaSaving || detailLoading}
                    />
                  </div>
                  <div className="form-field">
                    <Label htmlFor="capa-initial-report">Ilk iyilestirme raporu tarihi</Label>
                    <Input
                      id="capa-initial-report"
                      type="datetime-local"
                      value={capaForm.initial_improvement_report_date}
                      onChange={(event) =>
                        setCapaForm((prev) => ({
                          ...prev,
                          initial_improvement_report_date: event.target.value,
                        }))
                      }
                      disabled={capaSaving || detailLoading}
                    />
                  </div>
                  <div className="form-field">
                    <Label htmlFor="capa-description">Uygunsuzluk Açıklaması</Label>
                    <Textarea
                      id="capa-description"
                      value={capaForm.nonconformity_description}
                      onChange={(event) =>
                        setCapaForm((prev) => ({
                          ...prev,
                          nonconformity_description: event.target.value,
                        }))
                      }
                      rows={3}
                      disabled={capaSaving || detailLoading}
                    />
                  </div>
                  <div className="form-field">
                    <Label htmlFor="capa-files">Ek Dosya ID'leri (virgülle)</Label>
                    <Input
                      id="capa-files"
                      value={capaForm.file_attachments}
                      onChange={(event) =>
                        setCapaForm((prev) => ({
                          ...prev,
                          file_attachments: event.target.value,
                        }))
                      }
                      disabled={capaSaving || detailLoading}
                    />
                  </div>
                  <div className="form-field">
                    <Label htmlFor="capa-linked-risks">Bagli Risk ID'leri (virgul ile)</Label>
                    <Input
                      id="capa-linked-risks"
                      value={capaForm.linked_risk_ids}
                      onChange={(event) =>
                        setCapaForm((prev) => ({
                          ...prev,
                          linked_risk_ids: event.target.value,
                        }))
                      }
                      placeholder="Orn. RISK-001, RISK-010"
                      disabled={capaSaving || detailLoading}
                    />
                  </div>
                  <div className="form-field">
                    <Label htmlFor="capa-linked-equipment">Bagli Cihaz ID'leri (virgul ile)</Label>
                    <Input
                      id="capa-linked-equipment"
                      value={capaForm.linked_equipment_ids}
                      onChange={(event) =>
                        setCapaForm((prev) => ({
                          ...prev,
                          linked_equipment_ids: event.target.value,
                        }))
                      }
                      placeholder="Orn. EQ-1001, EQ-2010"
                      disabled={capaSaving || detailLoading}
                    />
                  </div>
                  <div className="actions-row" style={{ marginTop: "12px" }}>
                    <Button type="submit" disabled={capaSaving || detailLoading || !isReady}>
                      {capaSaving ? "Oluşturuluyor..." : "CAPA Oluştur"}
                    </Button>
                  </div>
                  {capaError && (
                    <p style={{ ...errorTextStyle, marginTop: "8px" }}>{capaError}</p>
                  )}
                  {capaSuccess && (
                    <p style={{ ...successTextStyle, marginTop: "8px" }}>{capaSuccess}</p>
                  )}
                </form>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Temel Bilgiler</CardTitle>
              <CardDescription>
                Sikayet kategorisi, oncelik ve departman bilgilerini guncelleyin.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleMetadataSubmit} className="module-grid" style={{ gap: "12px" }}>
                <div className="form-field">
                  <Label htmlFor="metadata-type">Sikayet Tipi</Label>
                  <Input
                    id="metadata-type"
                    value={metadataForm.complaint_type}
                    onChange={handleMetadataChange("complaint_type")}
                    placeholder="Orn. Urun, Hizmet"
                    disabled={metadataSaving || detailLoading}
                  />
                </div>
                <div className="form-field">
                  <Label htmlFor="metadata-priority">Oncelik</Label>
                  <Select
                    id="metadata-priority"
                    value={metadataForm.priority}
                    onChange={handleMetadataChange("priority")}
                    disabled={metadataSaving || detailLoading}
                  >
                    <SelectOption value="">Seciniz</SelectOption>
                    {Object.keys(PRIORITY_CONFIG).map((priority) => (
                      <SelectOption key={`meta-priority-${priority}`} value={priority}>
                        {PRIORITY_CONFIG[priority]?.label || priority}
                      </SelectOption>
                    ))}
                  </Select>
                </div>
                <div className="form-field">
                  <Label htmlFor="metadata-department">Departman</Label>
                  <Input
                    id="metadata-department"
                    value={metadataForm.department}
                    onChange={handleMetadataChange("department")}
                    placeholder="Sorumlu departman"
                    disabled={metadataSaving || detailLoading}
                  />
                </div>
                <div className="form-field">
                  <Label htmlFor="metadata-category">Kategori</Label>
                  <Select
                    id="metadata-category"
                    value={metadataForm.category_id}
                    onChange={handleMetadataChange("category_id")}
                    disabled={metadataSaving || detailLoading}
                  >
                    <SelectOption value="">Kategori secin</SelectOption>
                    <SelectOption value="__none">Kategori yok</SelectOption>
                    {selectableCategories.map((category) => (
                      <SelectOption key={`meta-category-${category.id}`} value={category.id}>
                        {category.name}
                        {category.is_active === false ? " (Pasif)" : ""}
                      </SelectOption>
                    ))}
                  </Select>
                </div>
                <div className="actions-row">
                  <Button type="submit" disabled={metadataSaving || detailLoading || !isReady}>
                    {metadataSaving ? "Kaydediliyor..." : "Temel Bilgileri Kaydet"}
                  </Button>
                </div>
                {metadataError && <p style={{ ...errorTextStyle }}>{metadataError}</p>}
                {metadataSuccess && <p style={{ ...successTextStyle }}>{metadataSuccess}</p>}
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Gorevlendirme</CardTitle>
              <CardDescription>Takim ve ilk geri bildirim bilgilerini guncelleyin.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleAssignmentSubmit}>
                <div className="grid two-cols">
                  <div className="form-field">
                    <Label htmlFor="assignment-assigned">Atanan Kisi</Label>
                    <Input
                      id="assignment-assigned"
                      value={assignmentForm.assigned_to}
                      onChange={(event) =>
                        setAssignmentForm((prev) => ({
                          ...prev,
                          assigned_to: event.target.value,
                        }))
                      }
                      disabled={assignmentSaving || detailLoading}
                    />
                  </div>
                  <div className="form-field">
                    <Label htmlFor="assignment-leader">Takim Lideri</Label>
                    <Input
                      id="assignment-leader"
                      value={assignmentForm.team_leader}
                      onChange={(event) =>
                        setAssignmentForm((prev) => ({
                          ...prev,
                          team_leader: event.target.value,
                        }))
                      }
                      disabled={assignmentSaving || detailLoading}
                    />
                  </div>
                  <div className="form-field">
                    <Label htmlFor="assignment-team">Cozum Ekibi (virgul ile)</Label>
                    <Input
                      id="assignment-team"
                      value={assignmentForm.solution_team}
                      onChange={(event) =>
                        setAssignmentForm((prev) => ({
                          ...prev,
                          solution_team: event.target.value,
                        }))
                      }
                      disabled={assignmentSaving || detailLoading}
                    />
                  </div>
                  <div className="form-field">
                    <Label htmlFor="assignment-initial">Ilk Yanit</Label>
                    <Textarea
                      id="assignment-initial"
                      value={assignmentForm.initial_response}
                      onChange={(event) =>
                        setAssignmentForm((prev) => ({
                          ...prev,
                          initial_response: event.target.value,
                        }))
                      }
                      rows={3}
                      disabled={assignmentSaving || detailLoading}
                    />
                  </div>
                </div>
                <div className="actions-row" style={{ marginTop: "12px" }}>
                  <Button type="submit" disabled={assignmentSaving || detailLoading || !isReady}>
                    {assignmentSaving ? "Kaydediliyor..." : "Gorevlendirmeyi Kaydet"}
                  </Button>
                </div>
                {assignmentError && (
                  <p style={{ ...errorTextStyle, marginTop: "8px" }}>{assignmentError}</p>
                )}
                {assignmentSuccess && (
                  <p style={{ ...successTextStyle, marginTop: "8px" }}>{assignmentSuccess}</p>
                )}
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Arastirma Raporu</CardTitle>
              <CardDescription>
                Ilk arastirma raporunu, iliskili gorevleri ve ekleri kaydedin.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleInvestigationSubmit}>
                <div className="grid two-cols">
                  <div className="form-field" style={{ gridColumn: "1 / -1" }}>
                    <Label htmlFor="investigation-report">Arastirma Raporu</Label>
                    <Textarea
                      id="investigation-report"
                      value={investigationForm.investigation_report}
                      onChange={(event) =>
                        setInvestigationForm((prev) => ({
                          ...prev,
                          investigation_report: event.target.value,
                        }))
                      }
                      rows={4}
                      disabled={investigationSaving || detailLoading}
                      placeholder="Arastirma bulgulari, kok neden analizi vb."
                    />
                  </div>
                  <div className="form-field">
                    <Label htmlFor="investigation-tasks">Ilgili Gorevler (virgul ile)</Label>
                    <Input
                      id="investigation-tasks"
                      value={investigationForm.related_task_ids}
                      onChange={(event) =>
                        setInvestigationForm((prev) => ({
                          ...prev,
                          related_task_ids: event.target.value,
                        }))
                      }
                      disabled={investigationSaving || detailLoading}
                    />
                  </div>
                  <div className="form-field">
                    <Label htmlFor="investigation-files">Ek Dosya ID'leri (virgul ile)</Label>
                    <Input
                      id="investigation-files"
                      value={investigationForm.file_attachments}
                      onChange={(event) =>
                        setInvestigationForm((prev) => ({
                          ...prev,
                          file_attachments: event.target.value,
                        }))
                      }
                      disabled={investigationSaving || detailLoading}
                    />
                  </div>
                  <div className="form-field">
                    <Label htmlFor="investigation-upload">Dosya yükle</Label>
                    <input
                      id="investigation-upload"
                      type="file"
                      onChange={handleInvestigationFileUpload}
                      disabled={
                        investigationSaving ||
                        investigationUpload.uploading ||
                        detailLoading
                      }
                    />
                    {investigationUpload.uploading && (
                      <p style={{ marginTop: "6px" }}>Dosya yükleniyor...</p>
                    )}
                    {investigationUpload.error && (
                      <p style={{ ...errorTextStyle, marginTop: "6px" }}>
                        {investigationUpload.error}
                      </p>
                    )}
                    {investigationUpload.success && (
                      <p style={{ ...successTextStyle, marginTop: "6px" }}>
                        {investigationUpload.success}
                      </p>
                    )}
                  </div>
                </div>
                <div className="actions-row" style={{ marginTop: "12px" }}>
                  <Button type="submit" disabled={investigationSaving || detailLoading || !isReady}>
                    {investigationSaving ? "Kaydediliyor..." : "Arastirma Raporunu Kaydet"}
                  </Button>
                </div>
                {investigationError && (
                  <p style={{ ...errorTextStyle, marginTop: "8px" }}>{investigationError}</p>
                )}
                {investigationSuccess && (
                  <p style={{ ...successTextStyle, marginTop: "8px" }}>{investigationSuccess}</p>
                )}
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Nihai Rapor</CardTitle>
              <CardDescription>Son raporu ve cozum yanitini kaydedin.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleFinalSubmit}>
                <div className="grid two-cols">
                  <div className="form-field" style={{ gridColumn: "1 / -1" }}>
                    <Label htmlFor="final-report">Nihai Rapor</Label>
                    <Textarea
                      id="final-report"
                      value={finalForm.final_report}
                      onChange={(event) =>
                        setFinalForm((prev) => ({
                          ...prev,
                          final_report: event.target.value,
                        }))
                      }
                      rows={4}
                      disabled={finalSaving || detailLoading}
                    />
                  </div>
                  <div className="form-field" style={{ gridColumn: "1 / -1" }}>
                    <Label htmlFor="final-response">Musteriye Yanit / Aksiyon</Label>
                    <Textarea
                      id="final-response"
                      value={finalForm.final_response}
                      onChange={(event) =>
                        setFinalForm((prev) => ({
                          ...prev,
                          final_response: event.target.value,
                        }))
                      }
                      rows={3}
                      disabled={finalSaving || detailLoading}
                    />
                  </div>
                  <div className="form-field">
                    <Label htmlFor="final-files">Ek Dosya ID'leri (virgul ile)</Label>
                    <Input
                      id="final-files"
                      value={finalForm.file_attachments}
                      onChange={(event) =>
                        setFinalForm((prev) => ({
                          ...prev,
                          file_attachments: event.target.value,
                        }))
                      }
                      disabled={finalSaving || detailLoading}
                    />
                  </div>
                  <div className="form-field">
                    <Label htmlFor="final-status">Kaydi C�zumlendi Olarak Isaretle</Label>
                    <Select
                      id="final-status"
                      value={finalForm.mark_resolved ? "true" : "false"}
                      onChange={(event) =>
                        setFinalForm((prev) => ({
                          ...prev,
                          mark_resolved: event.target.value === "true",
                        }))
                      }
                      disabled={finalSaving || detailLoading}
                    >
                      <SelectOption value="true">Evet</SelectOption>
                      <SelectOption value="false">Hayir</SelectOption>
                    </Select>
                  </div>
                </div>
                <div className="actions-row" style={{ marginTop: "12px" }}>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleApplyFinalTemplate}
                    disabled={finalSaving || detailLoading || !selectedComplaint}
                  >
                    Sablon Doldur
                  </Button>
                  <Button type="submit" disabled={finalSaving || detailLoading || !isReady}>
                    {finalSaving ? "Kaydediliyor..." : "Nihai Raporu Kaydet"}
                  </Button>
                </div>
                {finalError && (
                  <p style={{ ...errorTextStyle, marginTop: "8px" }}>{finalError}</p>
                )}
                {finalSuccess && (
                  <p style={{ ...successTextStyle, marginTop: "8px" }}>{finalSuccess}</p>
                )}
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Durum Guncelleme</CardTitle>
              <CardDescription>Kaydin durumunu manuel olarak degistirin.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleStatusSubmit}>
                <div className="grid two-cols">
                  <div className="form-field">
                    <Label htmlFor="status-update">Durum</Label>
                    <Select
                      id="status-update"
                      value={statusUpdate.status}
                      onChange={(event) =>
                        setStatusUpdate((prev) => ({
                          ...prev,
                          status: event.target.value,
                        }))
                      }
                      disabled={statusSaving || detailLoading}
                    >
                      <SelectOption value="">Durum secin</SelectOption>
                      {STATUS_OPTIONS.map((status) => (
                        <SelectOption key={status} value={status}>
                          {STATUS_CONFIG[status]?.label || status}
                        </SelectOption>
                      ))}
                    </Select>
                  </div>
                  <div className="form-field" style={{ gridColumn: "1 / -1" }}>
                    <Label htmlFor="status-comment">Aciklama</Label>
                    <Textarea
                      id="status-comment"
                      value={statusUpdate.comment}
                      onChange={(event) =>
                        setStatusUpdate((prev) => ({
                          ...prev,
                          comment: event.target.value,
                        }))
                      }
                      rows={3}
                      disabled={statusSaving || detailLoading}
                    />
                  </div>
                </div>
                <div className="actions-row" style={{ marginTop: "12px" }}>
                  <Button type="submit" disabled={statusSaving || detailLoading || !isReady}>
                    {statusSaving ? "Guncelleniyor..." : "Durumu Guncelle"}
                  </Button>
                </div>
                {statusError && (
                  <p style={{ ...errorTextStyle, marginTop: "8px" }}>{statusError}</p>
                )}
                {statusSuccess && (
                  <p style={{ ...successTextStyle, marginTop: "8px" }}>{statusSuccess}</p>
                )}
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Durum Gecmisi</CardTitle>
              <CardDescription>Kayit olustugundan beri gecilen durum adimlari.</CardDescription>
            </CardHeader>
            <CardContent>
              {detailLoading ? (
                <div className="loading-state">Detaylar yukleniyor...</div>
              ) : selectedComplaint.status_history?.length ? (
                <ul className="history-list">
                  {selectedComplaint.status_history
                    .slice()
                    .reverse()
                    .map((entry, index) => (
                      <li key={`${entry.status}-${index}`}>
                        <div className="history-header">
                          <Badge
                            variant={
                              (STATUS_CONFIG[entry.status] || STATUS_CONFIG.open).variant
                            }
                          >
                            {(STATUS_CONFIG[entry.status] || STATUS_CONFIG.open).label}
                          </Badge>
                          <span>{formatDateTime(entry.changed_at)}</span>
                        </div>
                        <div className="history-meta">
                          Guncelleyen: {entry.changed_by || "-"}
                          {entry.comment && <span> �?� {entry.comment}</span>}
                        </div>
                      </li>
                    ))}
                </ul>
              ) : (
                <p>Durum gecmisi bulunmuyor.</p>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};

export default ComplaintsModule;
