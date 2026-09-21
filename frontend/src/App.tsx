import { QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { Toaster } from 'sonner'
import { AuthProvider } from './auth/AuthProvider'
import { RequireAuth } from './auth/RequireAuth'
import { AppShell } from './layouts/AppShell'
import { PageFrame } from './layouts/PageFrame'
import { queryClient } from './lib/queryClient'
import { MembersPage } from './routes/MembersPage'
import { NotFound } from './routes/NotFound'
import { SignIn } from './routes/SignIn'
import { AuditLogPage } from './routes/admin/AuditLogPage'
import { PipelineHealthPage } from './routes/admin/PipelineHealthPage'
import { ReviewQueuePage } from './routes/admin/ReviewQueuePage'
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
                      <Route path="ask" element={<Navigate to="/assistant" replace />} />
                      <Route
                        path="assistant"
                        element={
                          <PageFrame mode="reading">
                            <AssistantPage />
                          </PageFrame>
                        }
                      />
                      <Route
                        path="notes"
                        element={
                          <PageFrame mode="split">
                            <NotesPage />
                          </PageFrame>
                        }
                      />
                      <Route
                        path="notes/:noteId"
                        element={
                          <PageFrame mode="split">
                            <NotesPage />
                          </PageFrame>
                        }
                      />
                      <Route
                        path="documents"
                        element={
                          <PageFrame mode="operational">
                            <DocumentsPage />
                          </PageFrame>
                        }
                      />
                      <Route
                        path="documents/:documentId"
                        element={
                          <PageFrame mode="split">
                            <DocumentViewer />
                          </PageFrame>
                        }
                      />
                      <Route
                        path="tasks"
                        element={
                          <PageFrame mode="operational">
                            <TasksPage />
                          </PageFrame>
                        }
                      />
                      <Route
                        path="members"
                        element={
                          <PageFrame mode="operational">
                            <MembersPage />
                          </PageFrame>
                        }
                      />
                      <Route
                        path="admin/review"
                        element={
                          <PageFrame mode="operational">
                            <ReviewQueuePage />
                          </PageFrame>
                        }
                      />
                      <Route
                        path="admin/audit"
                        element={
                          <PageFrame mode="operational">
                            <AuditLogPage />
                          </PageFrame>
                        }
                      />
                      <Route
                        path="admin/health"
                        element={
                          <PageFrame mode="operational">
                            <PipelineHealthPage />
                          </PageFrame>
                        }
                      />
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
