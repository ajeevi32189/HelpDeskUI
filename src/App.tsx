import { Navigate, Route, Routes } from 'react-router-dom'
import { ProtectedRoute } from './auth/ProtectedRoute'
import AppLayout from './layout/AppLayout'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import AdminConfigPage from './pages/AdminConfigPage'
import ReportsPage from './pages/ReportsPage'
import TicketDetailPage from './pages/TicketDetailPage'
import TicketFormPage from './pages/TicketFormPage'
import TicketsPage from './pages/TicketsPage'
import UsersPage from './pages/UsersPage'
import RolesPage from './pages/RolesPage'
import FaqPage from './pages/FaqPage'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route index element={<Navigate to="/tickets" replace />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/tickets" element={<TicketsPage />} />
          <Route path="/tickets/new" element={<TicketFormPage />} />
          <Route path="/tickets/:id/edit" element={<TicketFormPage />} />
          <Route path="/tickets/:id" element={<TicketDetailPage />} />
          <Route path="/reports" element={<ReportsPage />} />
          <Route path="/faq" element={<FaqPage />} />
          <Route path="/admin/sla" element={<AdminConfigPage resource="sla" />} />
          <Route path="/admin/escalation" element={<AdminConfigPage resource="escalation" />} />
          <Route path="/admin/work-order-templates" element={<AdminConfigPage resource="workOrderTemplate" />} />
          <Route path="/admin/email-templates" element={<AdminConfigPage resource="emailTemplate" />} />
          <Route path="/admin/users" element={<UsersPage />} />
          <Route path="/admin/roles" element={<RolesPage />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/tickets" replace />} />
    </Routes>
  )
}
