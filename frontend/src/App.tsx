import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import DesktopHome from './pages/DesktopHome';
import Scanner from './pages/Scanner';
import About from './pages/About';
import NeuralEngine from './pages/NeuralEngine';
import KnowledgeGraph from './pages/KnowledgeGraph';
import BatchScanner from './pages/BatchScanner';
import Login from './pages/Login';
import Signup from './pages/Signup';
import LandingPage from './pages/LandingPage';
import FeaturesPage from './pages/FeaturesPage';
import HowItWorks from './pages/HowItWorks';
import Changelog from './pages/Changelog';
import ForgotPassword from './pages/ForgotPassword';
import GithubCallback from './pages/GithubCallback';
import { AuthProvider } from './context/AuthContext';
import { GameProvider } from './context/GameContext';
import { ThemeProvider } from './context/ThemeContext';
import ProtectedRoute from './components/ProtectedRoute';

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
      <ThemeProvider>
      <AuthProvider>
          <GameProvider>
            <Router>
              <Routes>
                {/* PUBLIC ROUTES */}
                <Route path="/" element={<Navigate to="/home" replace />} />
                <Route path="/home" element={<LandingPage />} />
                <Route path="/features" element={<FeaturesPage />} />
                <Route path="/how-it-works" element={<HowItWorks />} />
                <Route path="/changelog" element={<Changelog />} />
                <Route path="/login" element={<Login />} />
                <Route path="/signup" element={<Signup />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />

                {/* PROTECTED ROUTES */}
                <Route path="/dashboard" element={
                  <ProtectedRoute>
                    <AuthenticatedLayout>
                      <DesktopHome />
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
                  <ProtectedRoute>
                    <AuthenticatedLayout>
                      <NeuralEngine />
                    </AuthenticatedLayout>
                  </ProtectedRoute>
                } />

                <Route path="/graph" element={
                  <ProtectedRoute>
                    <AuthenticatedLayout>
                      <KnowledgeGraph />
                    </AuthenticatedLayout>
                  </ProtectedRoute>
                } />

                <Route path="/about" element={<About />} />

                <Route path="/batch" element={
                  <ProtectedRoute>
                    <AuthenticatedLayout>
                      <BatchScanner />
                    </AuthenticatedLayout>
                  </ProtectedRoute>
                } />

                <Route path="/auth/github/callback" element={<GithubCallback />} />

              </Routes>
            </Router>
          </GameProvider>
      </AuthProvider>
      </ThemeProvider>
      <Analytics />
    </>
  );
}

export default App;
