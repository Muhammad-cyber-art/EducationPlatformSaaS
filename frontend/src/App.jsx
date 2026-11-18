import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import PreApp from './preApp';
import TenantAccessGate from './components/Safety/TenantAccessGate';
import { attendanceOfflineService } from './services/attendanceOfflineService';
import { financeOfflineService } from './services/financeOfflineService';
import { runFullCleanup } from './db/db';

function AdmittedApp() {
  const queryClient = useQueryClient();
  useEffect(() => {
    attendanceOfflineService.init(queryClient);
    financeOfflineService.init(queryClient);
    const cleanup = setTimeout(() => { runFullCleanup().catch(() => {}); }, 5000);
    return () => {
      clearTimeout(cleanup);
      attendanceOfflineService.destroy();
      financeOfflineService.destroy();
    };
  }, [queryClient]);
  return <PreApp />;
}

export default function App() {
  return <TenantAccessGate><AdmittedApp /></TenantAccessGate>;
}
