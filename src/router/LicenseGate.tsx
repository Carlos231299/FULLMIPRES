import { Outlet } from 'react-router-dom';

/**
 * LicenseGate anteriormente verificaba licencias offline por hardware (Electron).
 * En la versión Web, el control de acceso se delega al inicio de sesión (Login)
 * y al backend. Este componente es transparente y solo pasa el outlet.
 */
export const LicenseGate = () => {
  return <Outlet />;
};
