import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Seo from '../components/Seo';
import { useAuth } from '../context/AuthContext';

export default function AuthCallbackPage() {
  const { login } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    if (token) {
      login(token);
    }
    navigate('/', { replace: true });
  }, [login, navigate]);

  return (
    <Seo
      title="Signing In"
      description="Completing FileLinker authentication."
      path="/auth/callback"
      noindex
    />
  );
}
