import React, { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { toast } from 'sonner';
import { Mail, Lock, User, ArrowRight, Building2, UserCircle } from 'lucide-react';

export const Login = () => {
  const { t } = useLanguage();
  const { login, loginWithGoogle } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ email: '', password: '' });
  const redirectTo = searchParams.get('redirect') || '/dashboard';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(form.email, form.password);
      toast.success('Autentificare reușită!');
      navigate(redirectTo);
    } catch (error) {
      toast.error(error.message || 'Autentificarea a eșuat');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center py-12 px-6 bg-muted/30">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-xl p-8 border border-border">
          {/* Header */}
          <div className="text-center mb-8">
            <Link to="/" className="inline-flex items-center gap-2 mb-6">
              <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center">
                <span className="text-white font-bold text-xl">C</span>
              </div>
            </Link>
            <h1 className="text-2xl font-heading font-bold text-foreground">
              {t('auth.login_title')}
            </h1>
            <p className="text-muted-foreground mt-2">{t('auth.login_subtitle')}</p>
          </div>

          {/* Google Login */}
          <Button
            variant="outline"
            className="w-full h-12 mb-6 rounded-xl"
            onClick={loginWithGoogle}
            data-testid="google-login-btn"
          >
            <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            {t('auth.google_login')}
          </Button>

          {/* Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-white text-muted-foreground">{t('auth.or')}</span>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <Label htmlFor="email">{t('auth.email')}</Label>
              <div className="relative mt-2">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="pl-11 h-12 rounded-xl"
                  placeholder="email@example.com"
                  required
                  data-testid="login-email"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="password">{t('auth.password')}</Label>
              <div className="relative mt-2">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  className="pl-11 h-12 rounded-xl"
                  placeholder="••••••••"
                  required
                  data-testid="login-password"
                />
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-12 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90"
              data-testid="login-submit"
            >
              {loading ? t('common.loading') : t('auth.login_btn')}
              <ArrowRight className="ml-2 w-4 h-4" />
            </Button>
          </form>

          {/* Register Link */}
          <p className="text-center text-sm text-muted-foreground mt-6">
            {t('auth.no_account')}{' '}
            <Link to="/register" className="text-primary font-medium hover:underline">
              {t('nav.register')}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export const Register = () => {
  const { t } = useLanguage();
  const { register, loginWithGoogle } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [userType, setUserType] = useState(searchParams.get('type') || 'influencer');
  const [form, setForm] = useState({ email: '', password: '', name: '' });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await register(form.email, form.password, form.name, userType);
      toast.success('Cont creat cu succes!');
      navigate('/dashboard');
    } catch (error) {
      toast.error(error.message || 'Înregistrarea a eșuat');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center py-12 px-6 bg-muted/30">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-xl p-8 border border-border">
          {/* Header */}
          <div className="text-center mb-8">
            <Link to="/" className="inline-flex items-center gap-2 mb-6">
              <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center">
                <span className="text-white font-bold text-xl">C</span>
              </div>
            </Link>
            <h1 className="text-2xl font-heading font-bold text-foreground">
              {t('auth.register_title')}
            </h1>
            <p className="text-muted-foreground mt-2">{t('auth.register_subtitle')}</p>
          </div>

          {/* User Type Selection */}
          <div className="grid grid-cols-2 gap-3 mb-6">
            <button
              type="button"
              onClick={() => setUserType('influencer')}
              className={`p-4 rounded-xl border-2 transition-all ${
                userType === 'influencer'
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-primary/50'
              }`}
              data-testid="register-type-influencer"
            >
              <UserCircle className={`w-8 h-8 mx-auto mb-2 ${userType === 'influencer' ? 'text-primary' : 'text-muted-foreground'}`} />
              <span className={`text-sm font-medium ${userType === 'influencer' ? 'text-foreground' : 'text-muted-foreground'}`}>
                Creator
              </span>
            </button>
            <button
              type="button"
              onClick={() => setUserType('brand')}
              className={`p-4 rounded-xl border-2 transition-all ${
                userType === 'brand'
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-primary/50'
              }`}
              data-testid="register-type-brand"
            >
              <Building2 className={`w-8 h-8 mx-auto mb-2 ${userType === 'brand' ? 'text-primary' : 'text-muted-foreground'}`} />
              <span className={`text-sm font-medium ${userType === 'brand' ? 'text-foreground' : 'text-muted-foreground'}`}>
                Brand
              </span>
            </button>
          </div>

          {/* Google Register */}
          <Button
            variant="outline"
            className="w-full h-12 mb-6 rounded-xl"
            onClick={loginWithGoogle}
            data-testid="google-register-btn"
          >
            <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            {t('auth.google_login')}
          </Button>

          {/* Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-white text-muted-foreground">{t('auth.or')}</span>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <Label htmlFor="name">{t('auth.name')}</Label>
              <div className="relative mt-2">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  id="name"
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="pl-11 h-12 rounded-xl"
                  placeholder="Numele tău"
                  required
                  data-testid="register-name"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="email">{t('auth.email')}</Label>
              <div className="relative mt-2">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="pl-11 h-12 rounded-xl"
                  placeholder="email@example.com"
                  required
                  data-testid="register-email"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="password">{t('auth.password')}</Label>
              <div className="relative mt-2">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  className="pl-11 h-12 rounded-xl"
                  placeholder="••••••••"
                  required
                  minLength={6}
                  data-testid="register-password"
                />
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-12 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90"
              data-testid="register-submit"
            >
              {loading ? t('common.loading') : t('auth.register_btn')}
              <ArrowRight className="ml-2 w-4 h-4" />
            </Button>
          </form>

          {/* Login Link */}
          <p className="text-center text-sm text-muted-foreground mt-6">
            {t('auth.has_account')}{' '}
            <Link to="/login" className="text-primary font-medium hover:underline">
              {t('nav.login')}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export const AuthCallback = () => {
  const { processGoogleCallback } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState(null);
  const hasProcessed = React.useRef(false);

  React.useEffect(() => {
    if (hasProcessed.current) return;
    hasProcessed.current = true;

    const hash = window.location.hash;
    const sessionId = new URLSearchParams(hash.substring(1)).get('session_id');

    if (sessionId) {
      processGoogleCallback(sessionId)
        .then((user) => {
          navigate('/dashboard', { state: { user } });
        })
        .catch((err) => {
          setError(err.message);
        });
    } else {
      setError('No session ID found');
    }
  }, [processGoogleCallback, navigate]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-destructive mb-2">Authentication Failed</h2>
          <p className="text-muted-foreground mb-4">{error}</p>
          <Button onClick={() => navigate('/login')}>Back to Login</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-muted-foreground">Authenticating...</p>
      </div>
    </div>
  );
};
