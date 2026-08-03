import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import Toast from './components/Toast';
import HomePage from './pages/HomePage';
import ViewPage from './pages/ViewPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import AuthCallbackPage from './pages/AuthCallbackPage';
import UpgradePage from './pages/UpgradePage';
import SettingsPage from './pages/SettingsPage';
import FilesPage from './pages/FilesPage';
import './styles.css';

function App() {
  return (
    <AuthProvider>
      <Toast />
      <Router>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/view/:filename" element={<ViewPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/auth/callback" element={<AuthCallbackPage />} />
          <Route path="/upgrade" element={<UpgradePage />} />
          <Route path="/pricing" element={<UpgradePage />} />
          <Route path="/files" element={<FilesPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
