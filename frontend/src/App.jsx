import { BrowserRouter as Router, Routes, Route, Navigate, NavLink } from "react-router-dom";
import DashboardModule from "./modules/DashboardModule";
import DocumentsModule from "./modules/DocumentsModule";
import ComplaintsModule from "./modules/ComplaintsModule";
import CapasModule from "./modules/CapasModule";
import RisksModule from "./modules/RisksModule";
import EquipmentModule from "./modules/EquipmentModule";
import AuditsModule from "./modules/AuditsModule";
import { DofModule } from "./modules/DofModule";
import AdminConfigModule from "./modules/AdminConfigModule";
import DeploymentGuideModule from "./modules/DeploymentGuideModule";

const Placeholder = ({ title }) => (
  <div className="page-placeholder">
    <h1>{title}</h1>
    <p>This screen is under development; it will be available soon.</p>
  </div>
);

function App() {
  return (
    <Router>
      <div className="app-shell">
        <aside className="app-sidebar">
          <div className="brand">
            <span className="brand-label">Kalite Portali</span>
          </div>
          <nav>
            <NavLink to="/dashboard">Dashboard</NavLink>
            <NavLink to="/documents">Dokumanlar</NavLink>
            <NavLink to="/complaints">Sikayetler</NavLink>
            <NavLink to="/capas">DOF/CAPA</NavLink>
            <NavLink to="/dof" className="important">
              DOF Gorevleri
            </NavLink>
            <NavLink to="/risks">Risk Yonetimi</NavLink>
            <NavLink to="/equipment">Cihazlar</NavLink>
            <NavLink to="/audits">Denetimler</NavLink>
            <NavLink to="/deployment">Dagitim</NavLink>
            <NavLink to="/admin">Permissions</NavLink>
          </nav>
        </aside>

        <main className="app-content">
          <Routes>
            <Route path="/" element={<Navigate to="/dof" replace />} />
            <Route path="/dashboard" element={<DashboardModule />} />
            <Route path="/documents" element={<DocumentsModule />} />
            <Route path="/complaints" element={<ComplaintsModule />} />
            <Route path="/capas" element={<CapasModule />} />
            <Route path="/dof" element={<DofModule />} />
            <Route path="/risks" element={<RisksModule />} />
            <Route path="/equipment" element={<EquipmentModule />} />
            <Route path="/audits" element={<AuditsModule />} />
            <Route path="/deployment" element={<DeploymentGuideModule />} />
            <Route path="/admin" element={<AdminConfigModule />} />
            <Route path="*" element={<Navigate to="/dof" replace />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
