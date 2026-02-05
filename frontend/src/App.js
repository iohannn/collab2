import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Toaster } from './components/ui/sonner';
import { LanguageProvider } from './context/LanguageContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Navbar, Footer } from './components/Layout';
import './index.css';

// Pages
import Landing from './pages/Landing';
import { Login, Register, AuthCallback } from './pages/Auth';
import BrandDashboard from './pages/BrandDashboard';
import InfluencerDashboard from './pages/InfluencerDashboard';
import Collaborations from './pages/Collaborations';
import CollaborationDetail from './pages/CollaborationDetail';
import Influencers from './pages/Influencers';
import PublicInfluencerProfile from './pages/PublicInfluencerProfile';
import Pricing from './pages/Pricing';

// Protected Route Component
const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading, user } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
};

// Dashboard Router - routes to correct dashboard based on user type
const DashboardRouter = () => {
  const { user } = useAuth();
  
  if (user?.user_type === 'brand') {
    return <BrandDashboard />;
  }
  
  return <InfluencerDashboard />;
};

// App Router with session_id detection
const AppRouter = () => {
  const location = useLocation();

  // Synchronously check for session_id in URL hash before rendering routes
  // This prevents race conditions with ProtectedRoute
  if (location.hash?.includes('session_id=')) {
    return <AuthCallback />;
  }

  return (
    <>
      <Navbar />
      <main className="min-h-screen">
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="/collaborations" element={<Collaborations />} />
          <Route path="/collaborations/:id" element={<CollaborationDetail />} />
          <Route path="/influencers" element={<Influencers />} />
          <Route path="/influencers/:username" element={<PublicInfluencerProfile />} />
          <Route path="/pricing" element={<Pricing />} />
          <Route path="/payment/success" element={<Pricing />} />

          {/* Protected Routes */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <DashboardRouter />
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <InfluencerDashboard />
              </ProtectedRoute>
            }
          />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <Footer />
    </>
  );
};

function App() {
  return (
    <BrowserRouter>
      <LanguageProvider>
        <AuthProvider>
          <div className="App">
            {/* Subtle noise texture overlay */}
            <div className="noise-overlay" />
            
            <AppRouter />
            
            {/* Toast notifications */}
            <Toaster position="top-right" richColors />
          </div>
        </AuthProvider>
      </LanguageProvider>
    </BrowserRouter>
  );
}

export default App;
