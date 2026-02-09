import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { CollaborationCard } from '../components/CollaborationCard';
import { PendingReviewsBanner, ReviewDialog } from '../components/ReviewDialog';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Badge } from '../components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../components/ui/dialog';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Calendar } from '../components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '../components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { toast } from 'sonner';
import { format } from 'date-fns';
import {
  Plus, Calendar as CalendarIcon, CheckCircle, XCircle, Clock, Users,
  TrendingUp, Eye, MoreVertical, Trash2, Edit, Crown, Building2, Star
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const BrandDashboard = () => {
  const { t } = useLanguage();
  const { user, getAuthHeaders } = useAuth();
  const navigate = useNavigate();
  const [collaborations, setCollaborations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [selectedCollab, setSelectedCollab] = useState(null);
  const [applications, setApplications] = useState([]);
  const [appsLoading, setAppsLoading] = useState(false);

  // Form state
  const [form, setForm] = useState({
    brand_name: '',
    title: '',
    description: '',
    deliverables: '',
    budget_min: '',
    budget_max: '',
    deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    platform: 'instagram',
    creators_needed: 1,
  });

  useEffect(() => {
    fetchCollaborations();
  }, []);

  const fetchCollaborations = async () => {
    try {
      const response = await fetch(`${API}/collaborations/my`, {
        headers: getAuthHeaders(),
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        setCollaborations(data);
      }
    } catch (error) {
      console.error('Failed to fetch collaborations:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchApplications = async (collabId) => {
    setAppsLoading(true);
    try {
      const response = await fetch(`${API}/applications/collab/${collabId}`, {
        headers: getAuthHeaders(),
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        setApplications(data);
      }
    } catch (error) {
      console.error('Failed to fetch applications:', error);
    } finally {
      setAppsLoading(false);
    }
  };

  const handleCreateCollab = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch(`${API}/collaborations`, {
        method: 'POST',
        headers: getAuthHeaders(),
        credentials: 'include',
        body: JSON.stringify({
          ...form,
          deliverables: form.deliverables.split(',').map((d) => d.trim()),
          budget_min: parseFloat(form.budget_min),
          budget_max: form.budget_max ? parseFloat(form.budget_max) : null,
          deadline: form.deadline.toISOString(),
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to create collaboration');
      }

      toast.success('Colaborare creată cu succes!');
      setCreateDialogOpen(false);
      fetchCollaborations();
      setForm({
        brand_name: '',
        title: '',
        description: '',
        deliverables: '',
        budget_min: '',
        budget_max: '',
        deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        platform: 'instagram',
        creators_needed: 1,
      });
    } catch (error) {
      toast.error(error.message);
    }
  };

  const handleStatusChange = async (collabId, status) => {
    try {
      const response = await fetch(`${API}/collaborations/${collabId}/status`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        credentials: 'include',
        body: JSON.stringify({ status }),
      });

      if (response.ok) {
        toast.success('Status actualizat!');
        fetchCollaborations();
      }
    } catch (error) {
      toast.error('Failed to update status');
    }
  };

  const handleApplicationStatus = async (appId, status) => {
    try {
      const response = await fetch(`${API}/applications/${appId}/status`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        credentials: 'include',
        body: JSON.stringify({ status }),
      });

      if (response.ok) {
        toast.success(status === 'accepted' ? 'Aplicație acceptată!' : 'Aplicație respinsă');
        if (selectedCollab) {
          fetchApplications(selectedCollab.collab_id);
        }
      }
    } catch (error) {
      toast.error('Failed to update application');
    }
  };

  const activeCollabs = collaborations.filter((c) => c.status === 'active');
  const closedCollabs = collaborations.filter((c) => c.status === 'closed' || c.status === 'completed');

  return (
    <div className="min-h-screen bg-muted/30 py-8">
      <div className="max-w-7xl mx-auto px-6">
        {/* Pending Reviews Banner */}
        <PendingReviewsBanner />

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Building2 className="w-8 h-8 text-primary" />
              <h1 className="text-3xl font-heading font-bold">Brand Dashboard</h1>
              {user?.is_pro && (
                <Badge className="badge-pro">
                  <Crown className="w-3 h-3 mr-1" />
                  PRO
                </Badge>
              )}
            </div>
            <p className="text-muted-foreground">Gestionează colaborările și aplicațiile</p>
          </div>

          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-primary text-primary-foreground rounded-full" data-testid="create-collab-btn">
                <Plus className="w-4 h-4 mr-2" />
                {t('collab.create_title')}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="font-heading">{t('collab.create_title')}</DialogTitle>
                <DialogDescription>Completează detaliile colaborării pentru a o publica</DialogDescription>
              </DialogHeader>

              <form onSubmit={handleCreateCollab} className="space-y-6 mt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>{t('collab.brand_name')}</Label>
                    <Input
                      value={form.brand_name}
                      onChange={(e) => setForm({ ...form, brand_name: e.target.value })}
                      placeholder="Numele brandului"
                      required
                      data-testid="collab-brand-name"
                    />
                  </div>
                  <div>
                    <Label>{t('collab.platform')}</Label>
                    <Select value={form.platform} onValueChange={(v) => setForm({ ...form, platform: v })}>
                      <SelectTrigger data-testid="collab-platform">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="instagram">Instagram</SelectItem>
                        <SelectItem value="tiktok">TikTok</SelectItem>
                        <SelectItem value="youtube">YouTube</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label>{t('collab.title')}</Label>
                  <Input
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    placeholder="Titlul campaniei"
                    required
                    data-testid="collab-title"
                  />
                </div>

                <div>
                  <Label>{t('collab.description')}</Label>
                  <Textarea
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    placeholder="Descrierea detaliată a campaniei"
                    rows={3}
                    required
                    data-testid="collab-description"
                  />
                </div>

                <div>
                  <Label>{t('collab.deliverables')}</Label>
                  <Input
                    value={form.deliverables}
                    onChange={(e) => setForm({ ...form, deliverables: e.target.value })}
                    placeholder={t('collab.deliverables_placeholder')}
                    required
                    data-testid="collab-deliverables"
                  />
                  <p className="text-xs text-muted-foreground mt-1">Separă cu virgulă</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>{t('collab.budget_min')} (€)</Label>
                    <Input
                      type="number"
                      value={form.budget_min}
                      onChange={(e) => setForm({ ...form, budget_min: e.target.value })}
                      placeholder="100"
                      required
                      min="1"
                      data-testid="collab-budget-min"
                    />
                  </div>
                  <div>
                    <Label>{t('collab.budget_max')} (€)</Label>
                    <Input
                      type="number"
                      value={form.budget_max}
                      onChange={(e) => setForm({ ...form, budget_max: e.target.value })}
                      placeholder="500"
                      min={form.budget_min || 1}
                      data-testid="collab-budget-max"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>{t('collab.deadline')}</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full justify-start" data-testid="collab-deadline">
                          <CalendarIcon className="w-4 h-4 mr-2" />
                          {format(form.deadline, 'PPP')}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={form.deadline}
                          onSelect={(date) => date && setForm({ ...form, deadline: date })}
                          disabled={(date) => date < new Date()}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div>
                    <Label>{t('collab.creators_needed')}</Label>
                    <Input
                      type="number"
                      value={form.creators_needed}
                      onChange={(e) => setForm({ ...form, creators_needed: parseInt(e.target.value) })}
                      min="1"
                      data-testid="collab-creators-needed"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <Button type="button" variant="outline" onClick={() => setCreateDialogOpen(false)}>
                    {t('common.cancel')}
                  </Button>
                  <Button type="submit" className="bg-primary text-primary-foreground" data-testid="collab-submit">
                    {t('collab.create_btn')}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white border border-border rounded-xl p-6">
            <TrendingUp className="w-6 h-6 text-primary mb-2" />
            <p className="text-2xl font-heading font-bold">{activeCollabs.length}</p>
            <p className="text-sm text-muted-foreground">{t('collab.active')}</p>
          </div>
          <div className="bg-white border border-border rounded-xl p-6">
            <Users className="w-6 h-6 text-secondary mb-2" />
            <p className="text-2xl font-heading font-bold">
              {collaborations.reduce((sum, c) => sum + c.applicants_count, 0)}
            </p>
            <p className="text-sm text-muted-foreground">{t('collab.applications')}</p>
          </div>
          <div className="bg-white border border-border rounded-xl p-6">
            <CheckCircle className="w-6 h-6 text-green-500 mb-2" />
            <p className="text-2xl font-heading font-bold">
              {collaborations.filter((c) => c.status === 'completed').length}
            </p>
            <p className="text-sm text-muted-foreground">{t('collab.completed')}</p>
          </div>
          <div className="bg-white border border-border rounded-xl p-6">
            <Eye className="w-6 h-6 text-muted-foreground mb-2" />
            <p className="text-2xl font-heading font-bold">{collaborations.length}</p>
            <p className="text-sm text-muted-foreground">Total</p>
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="active" className="space-y-6">
          <TabsList>
            <TabsTrigger value="active" data-testid="tab-active">
              {t('collab.active')} ({activeCollabs.length})
            </TabsTrigger>
            <TabsTrigger value="closed" data-testid="tab-closed">
              {t('collab.closed')} ({closedCollabs.length})
            </TabsTrigger>
            {selectedCollab && (
              <TabsTrigger value="applications" data-testid="tab-applications">
                {t('collab.applications')} ({applications.length})
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="active">
            {loading ? (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="bg-white rounded-xl h-72 animate-pulse" />
                ))}
              </div>
            ) : activeCollabs.length > 0 ? (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {activeCollabs.map((collab) => (
                  <div key={collab.collab_id} className="relative">
                    <CollaborationCard
                      collaboration={collab}
                      onClick={() => {
                        setSelectedCollab(collab);
                        fetchApplications(collab.collab_id);
                      }}
                    />
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="absolute top-4 right-16 z-10"
                          data-testid={`collab-menu-${collab.collab_id}`}
                        >
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        <DropdownMenuItem onClick={() => handleStatusChange(collab.collab_id, 'closed')}>
                          <XCircle className="w-4 h-4 mr-2" />
                          Închide colaborarea
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleStatusChange(collab.collab_id, 'completed')}>
                          <CheckCircle className="w-4 h-4 mr-2" />
                          Marchează ca finalizat
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-20 bg-white rounded-2xl border border-border">
                <Clock className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-xl font-semibold mb-2">Nicio colaborare activă</h3>
                <p className="text-muted-foreground mb-6">Creează prima ta colaborare!</p>
                <Button onClick={() => setCreateDialogOpen(true)} className="rounded-full">
                  <Plus className="w-4 h-4 mr-2" />
                  Creează colaborare
                </Button>
              </div>
            )}
          </TabsContent>

          <TabsContent value="closed">
            {closedCollabs.length > 0 ? (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {closedCollabs.map((collab) => (
                  <CollaborationCard
                    key={collab.collab_id}
                    collaboration={collab}
                    onClick={() => {
                      setSelectedCollab(collab);
                      fetchApplications(collab.collab_id);
                    }}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-20 bg-white rounded-2xl border border-border">
                <p className="text-muted-foreground">Nicio colaborare închisă</p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="applications">
            {selectedCollab && (
              <div>
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-heading font-semibold">
                    Aplicații pentru: {selectedCollab.title}
                  </h3>
                  <Button variant="outline" onClick={() => setSelectedCollab(null)}>
                    Înapoi
                  </Button>
                </div>

                {appsLoading ? (
                  <div className="space-y-4">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="bg-white rounded-xl h-32 animate-pulse" />
                    ))}
                  </div>
                ) : applications.length > 0 ? (
                  <div className="space-y-4">
                    {applications.map((app) => (
                      <div
                        key={app.application_id}
                        className="bg-white border border-border rounded-xl p-6"
                        data-testid={`application-${app.application_id}`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-4">
                            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                              {app.influencer_profile?.profile_photo ? (
                                <img
                                  src={app.influencer_profile.profile_photo}
                                  alt=""
                                  className="w-12 h-12 rounded-full object-cover"
                                />
                              ) : (
                                <span className="text-lg font-bold text-primary">
                                  {app.influencer_name?.[0]?.toUpperCase()}
                                </span>
                              )}
                            </div>
                            <div>
                              <h4 className="font-semibold">{app.influencer_name}</h4>
                              <p className="text-sm text-muted-foreground">@{app.influencer_username}</p>
                              <p className="text-sm mt-2">{app.message}</p>
                              {app.proposed_price && (
                                <p className="text-lg font-mono font-bold text-primary mt-2">
                                  €{app.proposed_price}
                                </p>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            {app.status === 'pending' ? (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-destructive"
                                  onClick={() => handleApplicationStatus(app.application_id, 'rejected')}
                                  data-testid={`reject-${app.application_id}`}
                                >
                                  <XCircle className="w-4 h-4 mr-1" />
                                  {t('collab.reject')}
                                </Button>
                                <Button
                                  size="sm"
                                  className="bg-green-500 text-white hover:bg-green-600"
                                  onClick={() => handleApplicationStatus(app.application_id, 'accepted')}
                                  data-testid={`accept-${app.application_id}`}
                                >
                                  <CheckCircle className="w-4 h-4 mr-1" />
                                  {t('collab.accept')}
                                </Button>
                              </>
                            ) : (
                              <Badge
                                className={
                                  app.status === 'accepted'
                                    ? 'bg-green-100 text-green-700'
                                    : 'bg-red-100 text-red-700'
                                }
                              >
                                {app.status === 'accepted' ? t('collab.accepted') : t('collab.rejected')}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-20 bg-white rounded-2xl border border-border">
                    <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">Nicio aplicație încă</p>
                  </div>
                )}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default BrandDashboard;
