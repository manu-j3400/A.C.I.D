import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import DesktopHome from './pages/DesktopHome';
import Features from './pages/Features';
import Scanner from './pages/Scanner';
import About from './pages/About';
import NeuralEngine from './pages/NeuralEngine';
import KnowledgeGraph from './pages/KnowledgeGraph';
import BatchScanner from './pages/BatchScanner';
import Login from './pages/Login';
import Signup from './pages/Signup';
import LandingPage from './pages/LandingPage';
import Changelog from './pages/Changelog';
import AdminLogin from './pages/AdminLogin';
import AdminDashboard from './pages/AdminDashboard';
import GithubCallback from './pages/GithubCallback';
import { AuthProvider } from './context/AuthContext';
import { AdminProvider } from './context/AdminContext';
import { GameProvider } from './context/GameContext';
import ProtectedRoute from './components/ProtectedRoute';
import AdminProtectedRoute from './components/AdminProtectedRoute';

import { Analytics } from '@vercel/analytics/react';

function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  return (
    <Layout>
      {children}
    </Layout>
  );
}

function App() {
  return (
    <>
      <AuthProvider>
        <AdminProvider>
          <GameProvider>
            <Router>
              <Routes>
                {/* PUBLIC ROUTES */}
                <Route path="/" element={<Navigate to="/home" replace />} />
                <Route path="/home" element={<LandingPage />} />
                <Route path="/changelog" element={<Changelog />} />
                <Route path="/login" element={<Login />} />
                <Route path="/signup" element={<Signup />} />

                {/* ADMIN ROUTES */}
                <Route path="/admin/login" element={<AdminLogin />} />
                <Route path="/admin/dashboard" element={
                  <AdminProtectedRoute>
                    <AdminDashboard />
                  </AdminProtectedRoute>
                } />

                {/* PROTECTED ROUTES */}
                <Route path="/dashboard" element={
                  <ProtectedRoute>
                    <AuthenticatedLayout>
                      <DesktopHome />
                    </AuthenticatedLayout>
                  </ProtectedRoute>
                } />

                <Route path="/features" element={
                  <ProtectedRoute>
                    <AuthenticatedLayout>
                      <Features />
                    </AuthenticatedLayout>
                  </ProtectedRoute>
                } />

                <Route path="/scanner" element={
                  <ProtectedRoute>
                    <AuthenticatedLayout>
                      <Scanner />
                    </AuthenticatedLayout>
                  </ProtectedRoute>
                } />

                <Route path="/engine" element={
                  <AdminProtectedRoute>
                    <AuthenticatedLayout>
                      <NeuralEngine />
                    </AuthenticatedLayout>
                  </AdminProtectedRoute>
                } />

                <Route path="/graph" element={
                  <ProtectedRoute>
                    <AuthenticatedLayout>
                      <KnowledgeGraph />
                    </AuthenticatedLayout>
                  </ProtectedRoute>
                } />

                <Route path="/about" element={
                  <ProtectedRoute>
                    <AuthenticatedLayout>
                      <About />
                    </AuthenticatedLayout>
                  </ProtectedRoute>
                } />

                <Route path="/batch" element={
                  <ProtectedRoute>
                    <AuthenticatedLayout>
                      <BatchScanner />
                    </AuthenticatedLayout>
                  </ProtectedRoute>
                } />

                <Route path="/auth/github/callback" element={
                  <ProtectedRoute>
                    <AuthenticatedLayout>
                      <GithubCallback />
                    </AuthenticatedLayout>
                  </ProtectedRoute>
                } />

              </Routes>
            </Router>
          </GameProvider>
        </AdminProvider>
      </AuthProvider>
      <Analytics />
    </>
  );
}

export default App;
