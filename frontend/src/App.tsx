import { Navigate, Route, Routes } from 'react-router';
import { AppLayout } from '@/components/layout/AppLayout';
import { RequireAdmin, RequireAuth } from '@/components/auth/RequireAuth';
import { useSessionGuard } from '@/hooks/useSessionGuard';
import { useApplyTheme } from '@/hooks/useTheme';
import { ForgotPasswordPage } from '@/pages/auth/ForgotPasswordPage';
import { LoginPage } from '@/pages/auth/LoginPage';
import { ResetPasswordPage } from '@/pages/auth/ResetPasswordPage';
import { AdminPage } from '@/pages/admin/AdminPage';
import { LeadsPage } from '@/pages/leads/LeadsPage';
import { AutomationsPage, CampaignsPage, ChatPage, DashboardPage, KanbanPage } from '@/pages/placeholders';

export function App() {
  useSessionGuard();
  useApplyTheme();

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/esqueci-senha" element={<ForgotPasswordPage />} />
      <Route path="/redefinir-senha" element={<ResetPasswordPage />} />
      <Route element={<RequireAuth />}>
        <Route element={<AppLayout />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/leads" element={<LeadsPage />} />
          <Route path="/kanban" element={<KanbanPage />} />
          <Route path="/chat/:leadId?" element={<ChatPage />} />
          <Route path="/disparos" element={<CampaignsPage />} />
          <Route path="/automacoes" element={<AutomationsPage />} />
          <Route element={<RequireAdmin />}>
            <Route path="/admin" element={<AdminPage />} />
          </Route>
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
