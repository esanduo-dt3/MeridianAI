import { QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { Toaster } from 'sonner'
import { AuthProvider } from './auth/AuthProvider'
import { RequireAuth } from './auth/RequireAuth'
import { AppShell } from './layouts/AppShell'
import { queryClient } from './lib/queryClient'
import { MembersPage } from './routes/MembersPage'
import { NotFound } from './routes/NotFound'
import { SignIn } from './routes/SignIn'
import { AuditLogPage, PipelineHealthPage, ReviewQueuePage } from './routes/surfaces'
import { AskPage } from './routes/AskPage'
import { AssistantPage } from './routes/AssistantPage'
import { NotesPage } from './routes/NotesPage'
import { DocumentsPage } from './routes/DocumentsPage'
import { DocumentViewer } from './routes/DocumentViewer'
import { TasksPage } from './routes/TasksPage'
import { Welcome } from './routes/Welcome'
import { ThemeProvider, useTheme } from './theme/ThemeProvider'
import { RequireWorkspace } from './workspace/RequireWorkspace'
import { WorkspaceProvider } from './workspace/WorkspaceProvider'

function ThemedToaster() {
  const { resolved } = useTheme()
  return (
    <Toaster
      theme={resolved}
      position="bottom-right"
      closeButton
      toastOptions={{ classNames: { toast: 'font-sans !rounded-(--radius-control) !border-rule !shadow-(--shadow-lift)' } }}
    />
  )
}

export default function App() {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/signin" element={<SignIn />} />
              <Route element={<RequireAuth />}>
                <Route
                  element={
                    <WorkspaceProvider>
                      <Outlet />
                    </WorkspaceProvider>
                  }
                >
                  <Route path="welcome" element={<Welcome />} />
                  <Route element={<RequireWorkspace />}>
                    <Route element={<AppShell />}>
                      <Route index element={<Navigate to="/tasks" replace />} />
                      <Route path="ask" element={<AskPage />} />
                      <Route path="assistant" element={<AssistantPage />} />
                      <Route path="notes" element={<NotesPage />} />
                      <Route path="notes/:noteId" element={<NotesPage />} />
                      <Route path="documents" element={<DocumentsPage />} />
                      <Route path="documents/:documentId" element={<DocumentViewer />} />
                      <Route path="tasks" element={<TasksPage />} />
                      <Route path="members" element={<MembersPage />} />
                      <Route path="admin/review" element={<ReviewQueuePage />} />
                      <Route path="admin/audit" element={<AuditLogPage />} />
                      <Route path="admin/health" element={<PipelineHealthPage />} />
                      <Route path="admin/members" element={<Navigate to="/members" replace />} />
                    </Route>
                  </Route>
                </Route>
              </Route>
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
          <ThemedToaster />
        </AuthProvider>
      </QueryClientProvider>
    </ThemeProvider>
  )
}
