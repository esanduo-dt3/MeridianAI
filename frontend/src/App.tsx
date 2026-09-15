import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './auth/AuthProvider'
import { RequireAuth } from './auth/RequireAuth'
import { AppShell } from './layouts/AppShell'
import { NotFound } from './routes/NotFound'
import { SignIn } from './routes/SignIn'
import {
  AskPage,
  AuditLogPage,
  DocumentsPage,
  MembersPage,
  NotesPage,
  PipelineHealthPage,
  ReviewQueuePage,
  TasksPage,
} from './routes/surfaces'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/signin" element={<SignIn />} />
          <Route element={<RequireAuth />}>
            <Route element={<AppShell />}>
              <Route index element={<Navigate to="/ask" replace />} />
              <Route path="ask" element={<AskPage />} />
              <Route path="notes" element={<NotesPage />} />
              <Route path="documents" element={<DocumentsPage />} />
              <Route path="tasks" element={<TasksPage />} />
              <Route path="admin/review" element={<ReviewQueuePage />} />
              <Route path="admin/audit" element={<AuditLogPage />} />
              <Route path="admin/health" element={<PipelineHealthPage />} />
              <Route path="admin/members" element={<MembersPage />} />
            </Route>
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
