import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { CountdownTimer } from '../components/CollaborationCard';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Badge } from '../components/ui/badge';
import { Checkbox } from '../components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../components/ui/dialog';
import { toast } from 'sonner';
import {
  ArrowLeft, Instagram, Youtube, Music2, Users, Calendar, DollarSign,
  Clock, CheckCircle, Send, Shield, Lock
} from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const CollaborationDetail = () => {
  const { id } = useParams();
  const { t } = useLanguage();
  const { user, isAuthenticated, getAuthHeaders } = useAuth();
  const navigate = useNavigate();
  const [collaboration, setCollaboration] = useState(null);
  const [loading, setLoading] = useState(true);
  const [applyDialogOpen, setApplyDialogOpen] = useState(false);
  const [applying, setApplying] = useState(false);
  const [hasApplied, setHasApplied] = useState(false);

  const [applicationForm, setApplicationForm] = useState({
    message: '',
    selected_deliverables: [],
    proposed_price: '',
  });

  useEffect(() => {
    fetchCollaboration();
    if (isAuthenticated) {
      checkIfApplied();
    }
  }, [id, isAuthenticated]);

  const fetchCollaboration = async () => {
    try {
      const response = await fetch(`${API}/collaborations/${id}`);
      if (response.ok) {
        const data = await response.json();
        setCollaboration(data);
      } else {
        navigate('/collaborations');
      }
    } catch (error) {
      console.error('Failed to fetch collaboration:', error);
    } finally {
      setLoading(false);
    }
  };

  const checkIfApplied = async () => {
    try {
      const response = await fetch(`${API}/applications/my`, {
        headers: getAuthHeaders(),
        credentials: 'include',
      });
      if (response.ok) {
        const apps = await response.json();
        setHasApplied(apps.some((a) => a.collab_id === id));
      }
    } catch (error) {
      console.error('Failed to check applications:', error);
    }
  };

  const handleApply = async (e) => {
    e.preventDefault();
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }

    setApplying(true);
    try {
      const response = await fetch(`${API}/applications`, {
        method: 'POST',
        headers: getAuthHeaders(),
        credentials: 'include',
        body: JSON.stringify({
          collab_id: id,
          message: applicationForm.message,
          selected_deliverables: applicationForm.selected_deliverables,
          proposed_price: applicationForm.proposed_price ? parseFloat(applicationForm.proposed_price) : null,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to apply');
      }

      toast.success('Aplicație trimisă cu succes!');
      setApplyDialogOpen(false);
      setHasApplied(true);
      fetchCollaboration();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setApplying(false);
    }
  };

  const toggleDeliverable = (deliverable) => {
    setApplicationForm((prev) => ({
      ...prev,
      selected_deliverables: prev.selected_deliverables.includes(deliverable)
        ? prev.selected_deliverables.filter((d) => d !== deliverable)
        : [...prev.selected_deliverables, deliverable],
    }));
  };

  const getPlatformIcon = (platform) => {
    switch (platform?.toLowerCase()) {
      case 'instagram': return <Instagram className="w-6 h-6" />;
      case 'youtube': return <Youtube className="w-6 h-6" />;
      case 'tiktok': return <Music2 className="w-6 h-6" />;
      default: return null;
    }
  };

  const getPlatformColor = (platform) => {
    switch (platform?.toLowerCase()) {
      case 'instagram': return 'from-purple-500 to-pink-500';
      case 'youtube': return 'from-red-500 to-red-600';
      case 'tiktok': return 'from-gray-800 to-black';
      default: return 'from-gray-500 to-gray-600';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!collaboration) {
    return null;
  }

  // Auth gate - show teaser for non-authenticated users
  if (!isAuthenticated) {
    const redirectPath = `/collaborations/${id}`;
    return (
      <div className="min-h-screen bg-muted/30 py-12 px-6" data-testid="collab-detail-locked">
        <div className="max-w-4xl mx-auto">
          <Button variant="ghost" onClick={() => navigate('/collaborations')} className="mb-8">
            <ArrowLeft className="w-4 h-4 mr-2" />
            {t('collab.back')}
          </Button>

          {/* Teaser Header */}
          <div className="bg-white rounded-2xl border border-border overflow-hidden">
            <div className={`bg-gradient-to-r ${getPlatformColor(collaboration.platform)} p-8 text-white`}>
              <div className="flex items-center gap-3 mb-4">
                {getPlatformIcon(collaboration.platform)}
                <Badge className="bg-white/20 text-white border-0 text-sm">{collaboration.platform}</Badge>
                {collaboration.collaboration_type === 'paid' && (
                  <Badge className="bg-white/20 text-white border-0 gap-1">
                    <Shield className="w-3 h-3" /> Colaborare protejată
                  </Badge>
                )}
              </div>
              <h1 className="text-3xl font-heading font-bold">{collaboration.title}</h1>
              <p className="text-white/80 mt-2">{collaboration.brand_name}</p>
            </div>

            <div className="p-8">
              {/* Visible teaser info */}
              <div className="grid grid-cols-3 gap-6 mb-8">
                <div className="text-center p-4 bg-primary/5 rounded-xl">
                  <p className="text-xs text-muted-foreground uppercase mb-1">{t('collab.budget')}</p>
                  <p className="text-2xl font-mono font-bold text-primary">
                    {collaboration.budget_max && collaboration.budget_max !== collaboration.budget_min
                      ? `€${collaboration.budget_min} - €${collaboration.budget_max}`
                      : `€${collaboration.budget_min}`}
                  </p>
                </div>
                <div className="text-center p-4 bg-muted/50 rounded-xl">
                  <p className="text-xs text-muted-foreground uppercase mb-1">{t('collab.applicants')}</p>
                  <p className="text-2xl font-bold">{collaboration.applicants_count || 0}</p>
                </div>
                <div className="text-center p-4 bg-muted/50 rounded-xl">
                  <p className="text-xs text-muted-foreground uppercase mb-1">{t('collab.creators_needed')}</p>
                  <p className="text-2xl font-bold">{collaboration.creators_needed || 1}</p>
                </div>
              </div>

              {/* Countdown visible */}
              {collaboration.status === 'active' && (
                <div className="bg-foreground text-background rounded-xl p-6 mb-8">
                  <p className="text-sm text-muted-foreground/70 mb-4">{t('collab.time_left')}</p>
                  <CountdownTimer deadline={collaboration.deadline} />
                </div>
              )}

              {/* Lock overlay over description area */}
              <div className="relative">
                <div className="blur-[4px] select-none pointer-events-none">
                  <h2 className="text-lg font-semibold mb-3">Descriere</h2>
                  <p className="text-muted-foreground leading-relaxed">
                    {collaboration.description?.substring(0, 120)}{'...'.repeat(3)}
                  </p>
                  <div className="mt-6">
                    <h3 className="font-medium mb-2">Deliverables</h3>
                    <div className="flex gap-2 flex-wrap">
                      {(collaboration.deliverables || []).slice(0, 2).map((d, i) => (
                        <span key={i} className="bg-muted rounded-lg px-3 py-1 text-sm">██████</span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Auth CTA overlay */}
                <div className="absolute inset-0 flex items-center justify-center" data-testid="detail-auth-gate">
                  <div className="bg-white/95 border border-border rounded-2xl p-8 shadow-xl text-center max-w-sm">
                    <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                      <Lock className="w-6 h-6 text-primary" />
                    </div>
                    <h3 className="text-lg font-bold mb-2">Autentifică-te pentru a vedea detaliile</h3>
                    <p className="text-sm text-muted-foreground mb-6">
                      Creează un cont gratuit pentru a vedea descrierea completă, deliverables și pentru a aplica.
                    </p>
                    <div className="flex flex-col gap-3">
                      <Button onClick={() => navigate(`/register?redirect=${encodeURIComponent(redirectPath)}`)} className="w-full" data-testid="detail-register-btn">
                        Creează cont gratuit
                      </Button>
                      <Button variant="outline" onClick={() => navigate(`/login?redirect=${encodeURIComponent(redirectPath)}`)} className="w-full" data-testid="detail-login-btn">
                        Am deja un cont
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const formatBudget = () => {
    if (collaboration.budget_max && collaboration.budget_max !== collaboration.budget_min) {
      return `€${collaboration.budget_min} - €${collaboration.budget_max}`;
    }
    return `€${collaboration.budget_min}`;
  };

  const deadline = new Date(collaboration.deadline);
  const isExpired = deadline < new Date();

  return (
    <div className="min-h-screen bg-muted/30 py-8">
      <div className="max-w-4xl mx-auto px-6">
        {/* Back Button */}
        <Button
          variant="ghost"
          onClick={() => navigate(-1)}
          className="mb-6"
          data-testid="back-btn"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Înapoi
        </Button>

        {/* Main Card */}
        <div className="bg-white border border-border rounded-2xl overflow-hidden">
          {/* Header with Platform */}
          <div className={`bg-gradient-to-r ${getPlatformColor(collaboration.platform)} p-6 text-white`}>
            <div className="flex items-center gap-3 mb-4">
              {getPlatformIcon(collaboration.platform)}
              <span className="text-lg font-medium capitalize">{collaboration.platform}</span>
              {collaboration.status !== 'active' && (
                <Badge className="bg-white/20 text-white">
                  {collaboration.status === 'closed' ? 'Închis' : 'Finalizat'}
                </Badge>
              )}
            </div>
            <p className="text-white/80 text-sm uppercase tracking-wider mb-2">
              {collaboration.brand_name}
            </p>
            <h1 className="text-3xl font-heading font-bold">{collaboration.title}</h1>
          </div>

          {/* Content */}
          <div className="p-8">
            {/* Stats Row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <div className="bg-muted/50 rounded-xl p-4 text-center">
                <DollarSign className="w-6 h-6 text-primary mx-auto mb-2" />
                <p className="text-2xl font-mono font-bold text-primary">{formatBudget()}</p>
                <p className="text-xs text-muted-foreground uppercase">{t('collab.budget')}</p>
              </div>
              <div className="bg-muted/50 rounded-xl p-4 text-center">
                <Users className="w-6 h-6 text-secondary mx-auto mb-2" />
                <p className="text-2xl font-mono font-bold">{collaboration.creators_needed}</p>
                <p className="text-xs text-muted-foreground uppercase">{t('collab.creators_needed')}</p>
              </div>
              <div className="bg-muted/50 rounded-xl p-4 text-center">
                <Users className="w-6 h-6 text-muted-foreground mx-auto mb-2" />
                <p className="text-2xl font-mono font-bold">{collaboration.applicants_count}</p>
                <p className="text-xs text-muted-foreground uppercase">{t('landing.applicants')}</p>
              </div>
              <div className="bg-muted/50 rounded-xl p-4 text-center">
                <Calendar className="w-6 h-6 text-muted-foreground mx-auto mb-2" />
                <p className="text-lg font-mono font-bold">
                  {deadline.toLocaleDateString('ro-RO', { day: 'numeric', month: 'short' })}
                </p>
                <p className="text-xs text-muted-foreground uppercase">{t('collab.deadline')}</p>
              </div>
            </div>

            {/* Countdown */}
            {!isExpired && collaboration.status === 'active' && (
              <div className="bg-foreground text-background rounded-xl p-6 mb-8">
                <p className="text-sm text-muted-foreground/70 mb-4">{t('collab.time_left')}</p>
                <CountdownTimer deadline={collaboration.deadline} />
              </div>
            )}

            {/* Payment Protection Banner */}
            {collaboration.collaboration_type === 'paid' && (
              <div className="bg-green-50 border border-green-200 rounded-xl p-5 mb-8 flex items-start gap-3" data-testid="escrow-trust-banner">
                <Shield className="w-6 h-6 text-green-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-semibold text-green-800">Colaborare protejată</p>
                  <p className="text-sm text-green-600">
                    {collaboration.payment_status === 'secured' 
                      ? 'Fondurile sunt securizate. Plata creatorului este garantată la finalizare.'
                      : collaboration.payment_status === 'released'
                      ? 'Fondurile au fost eliberate cu succes.'
                      : 'Fondurile vor fi securizate de brand înainte de începerea colaborării.'}
                  </p>
                </div>
                {collaboration.payment_status === 'secured' && (
                  <Badge className="bg-green-600 text-white ml-auto flex-shrink-0">Securizat</Badge>
                )}
              </div>
            )}

            {/* Description */}
            <div className="mb-8">
              <h2 className="text-xl font-heading font-semibold mb-4">{t('collab.description')}</h2>
              <p className="text-muted-foreground whitespace-pre-wrap">{collaboration.description}</p>
            </div>

            {/* Deliverables */}
            <div className="mb-8">
              <h2 className="text-xl font-heading font-semibold mb-4">{t('collab.deliverables')}</h2>
              <div className="flex flex-wrap gap-3">
                {collaboration.deliverables?.map((d, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 bg-muted px-4 py-2 rounded-lg"
                  >
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    <span>{d}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Apply Button */}
            {collaboration.status === 'active' && !isExpired && (
              <div className="pt-6 border-t border-border">
                {hasApplied ? (
                  <div className="flex items-center gap-3 text-green-600 bg-green-50 px-6 py-4 rounded-xl">
                    <CheckCircle className="w-5 h-5" />
                    <span className="font-medium">{t('collab.applied')}</span>
                  </div>
                ) : (
                  <Dialog open={applyDialogOpen} onOpenChange={setApplyDialogOpen}>
                    <DialogTrigger asChild>
                      <Button
                        size="lg"
                        className="w-full bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl h-14 text-lg font-semibold"
                        data-testid="apply-btn"
                      >
                        <Send className="w-5 h-5 mr-2" />
                        {t('collab.apply')}
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-lg">
                      <DialogHeader>
                        <DialogTitle className="font-heading">{t('collab.apply')}</DialogTitle>
                        <DialogDescription>
                          Trimite aplicația ta pentru această colaborare
                        </DialogDescription>
                      </DialogHeader>

                      <form onSubmit={handleApply} className="space-y-6 mt-4">
                        <div>
                          <Label>{t('collab.message')}</Label>
                          <Textarea
                            value={applicationForm.message}
                            onChange={(e) =>
                              setApplicationForm({ ...applicationForm, message: e.target.value })
                            }
                            placeholder="De ce ești potrivit pentru această colaborare?"
                            rows={4}
                            required
                            className="mt-2"
                            data-testid="apply-message"
                          />
                        </div>

                        <div>
                          <Label className="mb-3 block">{t('collab.select_deliverables')}</Label>
                          <div className="space-y-3">
                            {collaboration.deliverables?.map((d, i) => (
                              <div key={i} className="flex items-center gap-3">
                                <Checkbox
                                  id={`del-${i}`}
                                  checked={applicationForm.selected_deliverables.includes(d)}
                                  onCheckedChange={() => toggleDeliverable(d)}
                                  data-testid={`deliverable-${i}`}
                                />
                                <Label htmlFor={`del-${i}`} className="cursor-pointer">
                                  {d}
                                </Label>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div>
                          <Label>{t('collab.your_price')} (€)</Label>
                          <Input
                            type="number"
                            value={applicationForm.proposed_price}
                            onChange={(e) =>
                              setApplicationForm({ ...applicationForm, proposed_price: e.target.value })
                            }
                            placeholder="Prețul tău"
                            className="mt-2"
                            data-testid="apply-price"
                          />
                        </div>

                        <div className="flex justify-end gap-3 pt-4">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => setApplyDialogOpen(false)}
                          >
                            {t('common.cancel')}
                          </Button>
                          <Button
                            type="submit"
                            disabled={applying}
                            className="bg-primary text-primary-foreground"
                            data-testid="submit-application"
                          >
                            {applying ? t('common.loading') : t('collab.send_application')}
                          </Button>
                        </div>
                      </form>
                    </DialogContent>
                  </Dialog>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CollaborationDetail;
