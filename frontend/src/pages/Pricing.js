import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { toast } from 'sonner';
import { Check, Crown, Zap, Star, ArrowRight, Loader2 } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const Pricing = () => {
  const { t } = useLanguage();
  const { user, isAuthenticated, getAuthHeaders } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(null);
  const [checkingPayment, setCheckingPayment] = useState(false);

  // Check for payment success
  useEffect(() => {
    const sessionId = searchParams.get('session_id');
    if (sessionId) {
      pollPaymentStatus(sessionId);
    }
  }, [searchParams]);

  const pollPaymentStatus = async (sessionId, attempts = 0) => {
    const maxAttempts = 5;
    const pollInterval = 2000;

    if (attempts >= maxAttempts) {
      toast.error('Verificarea plății a expirat. Te rugăm să verifici emailul.');
      return;
    }

    setCheckingPayment(true);
    try {
      const response = await fetch(`${API}/payments/status/${sessionId}`, {
        headers: getAuthHeaders(),
        credentials: 'include',
      });

      if (!response.ok) throw new Error('Failed to check payment status');

      const data = await response.json();

      if (data.payment_status === 'paid') {
        toast.success('Plată reușită! Acum ești PRO!');
        navigate('/dashboard');
        return;
      } else if (data.status === 'expired') {
        toast.error('Sesiunea de plată a expirat.');
        return;
      }

      // Continue polling
      setTimeout(() => pollPaymentStatus(sessionId, attempts + 1), pollInterval);
    } catch (error) {
      console.error('Error checking payment:', error);
      toast.error('Eroare la verificarea plății.');
    } finally {
      setCheckingPayment(false);
    }
  };

  const handleUpgrade = async (planId) => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }

    setLoading(planId);
    try {
      const response = await fetch(`${API}/payments/checkout`, {
        method: 'POST',
        headers: getAuthHeaders(),
        credentials: 'include',
        body: JSON.stringify({
          plan_id: planId,
          origin_url: window.location.origin,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to create checkout');
      }

      const data = await response.json();
      window.location.href = data.url;
    } catch (error) {
      toast.error(error.message);
      setLoading(null);
    }
  };

  const plans = [
    {
      id: 'free',
      name: t('pricing.free'),
      price: '0',
      period: '',
      description: 'Pentru a începe',
      features: t('pricing.free_features'),
      icon: Zap,
      popular: false,
      buttonText: t('pricing.current_plan'),
      buttonVariant: 'outline',
      disabled: true,
    },
    {
      id: 'pro_monthly',
      name: t('pricing.pro'),
      price: '29',
      period: t('pricing.per_month'),
      description: 'Pentru branduri serioase',
      features: t('pricing.pro_features'),
      icon: Crown,
      popular: true,
      buttonText: user?.is_pro ? t('pricing.current_plan') : t('pricing.upgrade'),
      buttonVariant: 'default',
      disabled: user?.is_pro,
    },
    {
      id: 'featured',
      name: t('pricing.featured'),
      price: '9',
      period: t('pricing.per_week'),
      description: 'Pentru creatori',
      features: t('pricing.featured_features'),
      icon: Star,
      popular: false,
      buttonText: t('pricing.get_featured'),
      buttonVariant: 'outline',
      disabled: false,
    },
  ];

  if (checkingPayment) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Se verifică plata...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30 py-16">
      <div className="max-w-6xl mx-auto px-6">
        {/* Header */}
        <div className="text-center mb-16">
          <Badge className="badge-pro mb-4">
            <Crown className="w-3 h-3 mr-1" />
            Planuri
          </Badge>
          <h1 className="text-4xl sm:text-5xl font-heading font-bold text-foreground mb-4">
            {t('pricing.title')}
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            {t('pricing.subtitle')}
          </p>
        </div>

        {/* Plans Grid */}
        <div className="grid md:grid-cols-3 gap-8">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className={`bg-white rounded-2xl border-2 p-8 relative ${
                plan.popular ? 'border-primary shadow-xl shadow-primary/10' : 'border-border'
              }`}
              data-testid={`plan-${plan.id}`}
            >
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                  <Badge className="bg-primary text-primary-foreground px-4 py-1">
                    Popular
                  </Badge>
                </div>
              )}

              <div className="text-center mb-8">
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4 ${
                  plan.popular ? 'bg-primary text-primary-foreground' : 'bg-muted'
                }`}>
                  <plan.icon className="w-7 h-7" />
                </div>
                <h2 className="text-2xl font-heading font-bold">{plan.name}</h2>
                <p className="text-sm text-muted-foreground">{plan.description}</p>
              </div>

              <div className="text-center mb-8">
                <span className="text-5xl font-heading font-bold">€{plan.price}</span>
                <span className="text-muted-foreground">{plan.period}</span>
              </div>

              <ul className="space-y-4 mb-8">
                {plan.features?.map((feature, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                    <span className="text-muted-foreground">{feature}</span>
                  </li>
                ))}
              </ul>

              <Button
                className={`w-full h-12 rounded-xl ${
                  plan.popular
                    ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                    : ''
                }`}
                variant={plan.buttonVariant}
                disabled={plan.disabled || loading === plan.id}
                onClick={() => !plan.disabled && handleUpgrade(plan.id)}
                data-testid={`plan-btn-${plan.id}`}
              >
                {loading === plan.id ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Se procesează...
                  </>
                ) : (
                  <>
                    {plan.buttonText}
                    {!plan.disabled && <ArrowRight className="w-4 h-4 ml-2" />}
                  </>
                )}
              </Button>
            </div>
          ))}
        </div>

        {/* FAQ or additional info */}
        <div className="mt-16 text-center">
          <p className="text-muted-foreground">
            Toate plățile sunt securizate prin Stripe. Anulezi oricând.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Pricing;
