<artifacts>
<artifact type="application/vnd.ant.code" language="javascript" title="App.js - Tüm Modüllerin Entegrasyonu" id="app_update">
// App.js içinde Navigation komponenti güncellenmesi:
// (mevcut Navigation komponenti içine aşağıdaki linkler eklenir)
<div className="hidden md:flex items-center space-x-6">
  <Link to="/dashboard" className="flex items-center space-x-1 text-gray-700 hover:text-blue-600 transition-colors">
    <BarChart3 className="h-4 w-4" />
    <span>Dashboard</span>
  </Link>
  <Link to="/documents" className="flex items-center space-x-1 text-gray-700 hover:text-blue-600 transition-colors">
    <FileText className="h-4 w-4" />
    <span>Dokümanlar</span>
  </Link>
  <Link to="/complaints" className="flex items-center space-x-1 text-gray-700 hover:text-blue-600 transition-colors">
    <Users className="h-4 w-4" />
    <span>Şikayetler</span>
  </Link>
  <Link to="/capas" className="flex items-center space-x-1 text-gray-700 hover:text-blue-600 transition-colors">
    <Target className="h-4 w-4" />
    <span>DÖF/CAPA</span>
  </Link>
  <Link to="/risks" className="flex items-center space-x-1 text-gray-700 hover:text-blue-600 transition-colors">
    <Shield className="h-4 w-4" />
    <span>Risk</span>
  </Link>
  <Link to="/audits" className="flex items-center space-x-1 text-gray-700 hover:text-blue-600 transition-colors">
    <ClipboardList className="h-4 w-4" />
    <span>Denetim</span>
  </Link>
  <Link to="/equipment" className="flex items-center space-x-1 text-gray-700 hover:text-blue-600 transition-colors">
    <Tool className="h-4 w-4" />
    <span>Cihazlar</span>
  </Link>
</div>
// Routes içine eklenmesi gereken yeni route'lar:
<Routes>
<Route path="/" element={<Navigate to="/dashboard" replace />} />
<Route path="/dashboard" element={<Dashboard />} />
<Route path="/documents" element={<Documents />} />
<Route path="/complaints" element={<ComplaintsModule />} />
<Route path="/capas" element={<CapaModule />} />
<Route path="/risks" element={<RiskAssessmentModule />} />
<Route path="/audits" element={<AuditModule />} />
<Route path="/equipment" element={<EquipmentModule />} />
</Routes>
// Import listesine eklenmesi gerekenler:
import { ComplaintsModule, CapaModule, RiskAssessmentModule, AuditModule, EquipmentModule } from './modules/QDMSModules';
import { Target, Shield, Tool, ClipboardList } from 'lucide-react';
</artifact>
</artifacts>
📊 Gelişmiş Raporlama Sistemi
<artifacts>
<artifact type="application/vnd.ant.code" language="javascript" title="Raporlama Modülü" id="reporting_module">
// ReportingModule.js - Kapsamlı raporlama sistemi
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './components/ui/card';
import { Button } from './components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './components/ui/select';
import { DatePicker } from './components/ui/date-picker';
import { FileDown, BarChart, PieChart, TrendingUp } from 'lucide-react';
import { LineChart, Line, BarChart as RechartsBar, Bar, PieChart as RechartsPie, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import axios from 'axios';
const API = ${process.env.REACT_APP_BACKEND_URL}/api;
export const ReportingModule = () => {
const [reportType, setReportType] = useState('dashboard');
const [dateRange, setDateRange] = useState({ start: null, end: null });
const [reportData, setReportData] = useState(null);
const [loading, setLoading] = useState(false);
const generateReport = async () => {
setLoading(true);
try {
let endpoint = '';
switch (reportType) {
case 'dashboard':
endpoint = '/reports/dashboard-advanced';
break;
case 'risk-matrix':
endpoint = '/reports/risk-matrix';
break;
case 'calibration-schedule':
endpoint = '/reports/equipment-calibration-schedule?months_ahead=6';
break;
default:
endpoint = '/reports/dashboard-advanced';
}
  const response = await axios.get(`${API}${endpoint}`);
  setReportData(response.data);
} catch (error) {
  console.error('Report generation failed:', error);
} finally {
  setLoading(false);
}
};
const exportToExcel = () => {
// Excel export implementation
const dataStr = JSON.stringify(reportData, null, 2);
const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
const exportFileDefaultName = report_${reportType}_${Date.now()}.json;
const linkElement = document.createElement('a');
linkElement.setAttribute('href', dataUri);
linkElement.setAttribute('download', exportFileDefaultName);
linkElement.click();
};
const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];
return (
<div className="space-y-6">
<div className="flex justify-between items-center">
<h1 className="text-2xl font-bold">Raporlama Merkezi</h1>
<div className="flex gap-4">
<Select value={reportType} onValueChange={setReportType}>
<SelectTrigger className="w-48">
<SelectValue placeholder="Rapor Tipi" />
</SelectTrigger>
<SelectContent>
<SelectItem value="dashboard">Genel Dashboard</SelectItem>
<SelectItem value="risk-matrix">Risk Matrisi</SelectItem>
<SelectItem value="calibration-schedule">Kalibrasyon Takvimi</SelectItem>
<SelectItem value="compliance">Uyumluluk Raporu</SelectItem>
<SelectItem value="audit-summary">Denetim Özeti</SelectItem>
</SelectContent>
</Select>
<Button onClick={generateReport} disabled={loading}>
{loading ? 'Oluşturuluyor...' : 'Rapor Oluştur'}
</Button>
{reportData && (
<Button variant="outline" onClick={exportToExcel}>
<FileDown className="h-4 w-4 mr-2" />
Excel'e Aktar
</Button>
)}
</div>
</div>
  {reportData && (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Risk Distribution Chart */}
      {reportData.risks && (
        <Card>
          <CardHeader>
            <CardTitle>Risk Dağılımı</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <RechartsPie>
                <Pie
                  data={[
                    { name: 'Düşük', value: reportData.risks.total - reportData.risks.high_critical },
                    { name: 'Yüksek/Kritik', value: reportData.risks.high_critical }
                  ]}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {[0, 1].map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </RechartsPie>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Monthly Trends Chart */}
      {reportData.monthly_trends && (
        <Card>
          <CardHeader>
            <CardTitle>Aylık CAPA Trendi</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={reportData.monthly_trends}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="_id" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="capas" stroke="#8884d8" name="CAPA Sayısı" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Equipment Status */}
      {reportData.equipment && (
        <Card>
          <CardHeader>
            <CardTitle>Cihaz Durumu</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <RechartsBar data={[
                { name: 'Toplam', value: reportData.equipment.total },
                { name: 'Kalibrasyon Bekleyen', value: reportData.equipment.calibration_due }
              ]}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="value" fill="#82ca9d" />
              </RechartsBar>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Audit Findings */}
      {reportData.audits?.findings_by_type && (
        <Card>
          <CardHeader>
            <CardTitle>Denetim Bulguları</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <RechartsPie>
                <Pie
                  data={reportData.audits.findings_by_type}
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="count"
                  label={({ _id, count }) => `${_id}: ${count}`}
                >
                  {reportData.audits.findings_by_type.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </RechartsPie>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  )}

  {/* Summary Statistics */}
  {reportData && (
    <Card>
      <CardHeader>
        <CardTitle>Özet İstatistikler</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {reportData.risks && (
            <>
              <div className="text-center">
                <p className="text-2xl font-bold text-red-600">{reportData.risks.high_critical}</p>
                <p className="text-sm text-gray-600">Yüksek/Kritik Risk</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-blue-600">{reportData.risks.total}</p>
                <p className="text-sm text-gray-600">Toplam Risk</p>
              </div>
            </>
          )}
          {reportData.work_orders && (
            <>
              <div className="text-center">
                <p className="text-2xl font-bold text-orange-600">{reportData.work_orders.open}</p>
                <p className="text-sm text-gray-600">Açık İş Emri</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-red-600">{reportData.work_orders.overdue}</p>
                <p className="text-sm text-gray-600">Gecikmiş İş Emri</p>
              </div>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  )}
</div>
);
};
</artifact>
</artifacts>