import { Routes, Route, Navigate } from 'react-router-dom';
import { LoginPage } from './pages/LoginPage';
import { ProtectedRoute } from './router/ProtectedRoute';
import { LicenseGate } from './router/LicenseGate';
import { LicensePage } from './pages/LicensePage';
import { AsistenteContainer } from './components/AsistenteContainer';
import { BatchMIPRES } from './components/BatchMIPRES';
import { DireccionamientoPage } from './pages/DireccionamientoPage';
import { ProgramacionPage } from './pages/ProgramacionPage';
import { EntregaPage } from './pages/EntregaPage';
import { ReportePage } from './pages/ReportePage';
import { AdminLicensesPage } from './pages/AdminLicensesPage';
import { FacturacionPage } from './pages/FacturacionPage';
import { FacturacionMasivaPage } from './pages/FacturacionMasivaPage';
import { Toaster } from 'sonner';

function App() {
  return (
    <>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/activate" element={<LicensePage />} />
        <Route path="/admin" element={<AdminLicensesPage />} />
        
        {/* El Guardián protege toda la app post-login de expiraciones/falsificaciones */}
        <Route element={<LicenseGate />}>
          {/* Rutas nativas protegidas que usarán el Layout */}
          <Route element={<ProtectedRoute />}>
            <Route path="/" element={<Navigate to="/asistente" replace />} />
            <Route path="/asistente" element={<AsistenteContainer mode="standard" />} />
            <Route path="/asistente-no-entrega" element={<AsistenteContainer mode="no-entrega" />} />
            <Route path="/direccionamiento" element={<DireccionamientoPage />} />
            <Route path="/programacion" element={<ProgramacionPage />} />
            <Route path="/entrega" element={<EntregaPage />} />
            <Route path="/reporte" element={<ReportePage />} />
            <Route path="/facturacion" element={<FacturacionPage />} />
            <Route path="/facturacion-masiva" element={<FacturacionMasivaPage />} />
            <Route path="/batch" element={<BatchMIPRES />} />
          </Route>
        </Route>
        
        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Toaster position="top-right" richColors closeButton />
    </>
  );
}

export default App;
