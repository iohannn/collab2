import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { CollaborationCard } from '../components/CollaborationCard';
import { PendingReviewsBanner } from '../components/ReviewDialog';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { toast } from 'sonner';
import {
  UserCircle, Edit2, Save, Instagram, Youtube, Music2,
  Briefcase, TrendingUp, Clock, CheckCircle, XCircle, ExternalLink, Star
} from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const NICHES = ['Fashion', 'Beauty', 'Lifestyle', 'Tech', 'Gaming', 'Food', 'Travel', 'Fitness', 'Business', 'Education'];
const PLATFORMS = ['instagram', 'tiktok', 'youtube'];

const InfluencerDashboard = () => {
  const { t } = useLanguage();
  const { user, getAuthHeaders } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [applications, setApplications] = useState([]);
  const [collaborations, setCollaborations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    username: '',
    bio: '',
    profile_photo: '',
    niches: [],
    platforms: [],
    audience_size: '',
    engagement_rate: '',
    price_per_post: '',
    price_per_story: '',
    price_bundle: '',
    instagram_url: '',
    tiktok_url: '',
    youtube_url: '',
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [profileRes, appsRes, collabsRes] = await Promise.all([
        fetch(`${API}/influencers/profile`, {
          headers: getAuthHeaders(),
          credentials: 'include',
        }),
        fetch(`${API}/applications/my`, {
          headers: getAuthHeaders(),
          credentials: 'include',
        }),
        fetch(`${API}/collaborations?limit=20`),
      ]);

      if (profileRes.ok) {
        const profileData = await profileRes.json();
        if (profileData && Object.keys(profileData).length > 0) {
          setProfile(profileData);
          setForm({
            username: profileData.username || '',
            bio: profileData.bio || '',
            profile_photo: profileData.profile_photo || '',
            niches: profileData.niches || [],
            platforms: profileData.platforms || [],
            audience_size: profileData.audience_size || '',
            engagement_rate: profileData.engagement_rate || '',
            price_per_post: profileData.price_per_post || '',
            price_per_story: profileData.price_per_story || '',
            price_bundle: profileData.price_bundle || '',
            instagram_url: profileData.instagram_url || '',
            tiktok_url: profileData.tiktok_url || '',
            youtube_url: profileData.youtube_url || '',
          });
        }
      }

      if (appsRes.ok) {
        const appsData = await appsRes.json();
        setApplications(appsData);
      }

      if (collabsRes.ok) {
        const collabsData = await collabsRes.json();
        setCollaborations(collabsData);
      }
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!form.username) {
      toast.error('Username este obligatoriu');
      return;
    }

    setSaving(true);
    try {
      const response = await fetch(`${API}/influencers/profile`, {
        method: 'POST',
        headers: getAuthHeaders(),
        credentials: 'include',
        body: JSON.stringify({
          ...form,
          audience_size: form.audience_size ? parseInt(form.audience_size) : null,
          engagement_rate: form.engagement_rate ? parseFloat(form.engagement_rate) : null,
          price_per_post: form.price_per_post ? parseFloat(form.price_per_post) : null,
          price_per_story: form.price_per_story ? parseFloat(form.price_per_story) : null,
          price_bundle: form.price_bundle ? parseFloat(form.price_bundle) : null,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to save profile');
      }

      const data = await response.json();
      setProfile(data);
      setEditing(false);
      toast.success('Profil salvat cu succes!');
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  const toggleNiche = (niche) => {
    setForm((prev) => ({
      ...prev,
      niches: prev.niches.includes(niche)
        ? prev.niches.filter((n) => n !== niche)
        : [...prev.niches, niche],
    }));
  };

  const togglePlatform = (platform) => {
    setForm((prev) => ({
      ...prev,
      platforms: prev.platforms.includes(platform)
        ? prev.platforms.filter((p) => p !== platform)
        : [...prev.platforms, platform],
    }));
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'accepted': return 'bg-green-100 text-green-700';
      case 'rejected': return 'bg-red-100 text-red-700';
      default: return 'bg-yellow-100 text-yellow-700';
    }
  };

  const appliedCollabIds = applications.map((a) => a.collab_id);
  const availableCollabs = collaborations.filter((c) => !appliedCollabIds.includes(c.collab_id));

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30 py-8">
      <div className="max-w-7xl mx-auto px-6">
        {/* Pending Reviews Banner */}
        <PendingReviewsBanner />

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <UserCircle className="w-8 h-8 text-primary" />
              <h1 className="text-3xl font-heading font-bold">{t('influencer.profile_title')}</h1>
              {profile?.avg_rating && (
                <div className="flex items-center gap-1 bg-yellow-100 px-2 py-1 rounded-full">
                  <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                  <span className="font-bold text-sm">{profile.avg_rating.toFixed(1)}</span>
                </div>
              )}
            </div>
            <p className="text-muted-foreground">Gestionează profilul și aplicațiile tale</p>
          </div>

          {profile?.username && (
            <Button
              variant="outline"
              onClick={() => window.open(`/influencers/${profile.username}`, '_blank')}
              data-testid="view-public-profile"
            >
              <ExternalLink className="w-4 h-4 mr-2" />
              Vezi profilul public
            </Button>
          )}
        </div>

        <Tabs defaultValue="profile" className="space-y-6">
          <TabsList>
            <TabsTrigger value="profile" data-testid="tab-profile">
              Profil
            </TabsTrigger>
            <TabsTrigger value="applications" data-testid="tab-applications">
              Aplicații ({applications.length})
            </TabsTrigger>
            <TabsTrigger value="browse" data-testid="tab-browse">
              Explorează ({availableCollabs.length})
            </TabsTrigger>
          </TabsList>

          {/* Profile Tab */}
          <TabsContent value="profile">
            <div className="bg-white border border-border rounded-2xl p-8">
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-xl font-heading font-semibold">Informații profil</h2>
                {!editing ? (
                  <Button variant="outline" onClick={() => setEditing(true)} data-testid="edit-profile-btn">
                    <Edit2 className="w-4 h-4 mr-2" />
                    Editează
                  </Button>
                ) : (
                  <Button
                    onClick={handleSaveProfile}
                    disabled={saving}
                    className="bg-primary text-primary-foreground"
                    data-testid="save-profile-btn"
                  >
                    <Save className="w-4 h-4 mr-2" />
                    {saving ? 'Se salvează...' : 'Salvează'}
                  </Button>
                )}
              </div>

              <div className="grid md:grid-cols-2 gap-8">
                {/* Left Column */}
                <div className="space-y-6">
                  <div>
                    <Label>{t('influencer.username')}</Label>
                    <Input
                      value={form.username}
                      onChange={(e) => setForm({ ...form, username: e.target.value })}
                      disabled={!editing}
                      placeholder="@username"
                      className="mt-2"
                      data-testid="profile-username"
                    />
                  </div>

                  <div>
                    <Label>{t('influencer.bio')}</Label>
                    <Textarea
                      value={form.bio}
                      onChange={(e) => setForm({ ...form, bio: e.target.value })}
                      disabled={!editing}
                      placeholder="Scrie câteva cuvinte despre tine..."
                      rows={4}
                      className="mt-2"
                      data-testid="profile-bio"
                    />
                  </div>

                  <div>
                    <Label>URL Avatar</Label>
                    <Input
                      value={form.profile_photo}
                      onChange={(e) => setForm({ ...form, profile_photo: e.target.value })}
                      disabled={!editing}
                      placeholder="https://..."
                      className="mt-2"
                      data-testid="profile-photo"
                    />
                  </div>

                  <div>
                    <Label className="mb-3 block">{t('influencer.niches')}</Label>
                    <div className="flex flex-wrap gap-2">
                      {NICHES.map((niche) => (
                        <button
                          key={niche}
                          type="button"
                          disabled={!editing}
                          onClick={() => toggleNiche(niche)}
                          className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                            form.niches.includes(niche)
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-muted text-muted-foreground hover:bg-muted/80'
                          } ${!editing ? 'opacity-60 cursor-not-allowed' : ''}`}
                          data-testid={`niche-${niche}`}
                        >
                          {niche}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <Label className="mb-3 block">{t('influencer.platforms')}</Label>
                    <div className="flex gap-3">
                      {PLATFORMS.map((platform) => (
                        <button
                          key={platform}
                          type="button"
                          disabled={!editing}
                          onClick={() => togglePlatform(platform)}
                          className={`flex items-center gap-2 px-4 py-2 rounded-xl border-2 transition-all ${
                            form.platforms.includes(platform)
                              ? 'border-primary bg-primary/5'
                              : 'border-border'
                          } ${!editing ? 'opacity-60 cursor-not-allowed' : ''}`}
                          data-testid={`platform-${platform}`}
                        >
                          {platform === 'instagram' && <Instagram className="w-5 h-5" />}
                          {platform === 'tiktok' && <Music2 className="w-5 h-5" />}
                          {platform === 'youtube' && <Youtube className="w-5 h-5" />}
                          <span className="capitalize">{platform}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Right Column */}
                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>{t('influencer.audience')}</Label>
                      <Input
                        type="number"
                        value={form.audience_size}
                        onChange={(e) => setForm({ ...form, audience_size: e.target.value })}
                        disabled={!editing}
                        placeholder="10000"
                        className="mt-2"
                        data-testid="profile-audience"
                      />
                    </div>
                    <div>
                      <Label>{t('influencer.engagement')} (%)</Label>
                      <Input
                        type="number"
                        step="0.1"
                        value={form.engagement_rate}
                        onChange={(e) => setForm({ ...form, engagement_rate: e.target.value })}
                        disabled={!editing}
                        placeholder="3.5"
                        className="mt-2"
                        data-testid="profile-engagement"
                      />
                    </div>
                  </div>

                  <div className="p-4 bg-muted/50 rounded-xl">
                    <h3 className="font-semibold mb-4">Prețuri</h3>
                    <div className="space-y-4">
                      <div>
                        <Label>{t('influencer.price_post')} (€)</Label>
                        <Input
                          type="number"
                          value={form.price_per_post}
                          onChange={(e) => setForm({ ...form, price_per_post: e.target.value })}
                          disabled={!editing}
                          placeholder="100"
                          className="mt-2"
                          data-testid="profile-price-post"
                        />
                      </div>
                      <div>
                        <Label>{t('influencer.price_story')} (€)</Label>
                        <Input
                          type="number"
                          value={form.price_per_story}
                          onChange={(e) => setForm({ ...form, price_per_story: e.target.value })}
                          disabled={!editing}
                          placeholder="50"
                          className="mt-2"
                          data-testid="profile-price-story"
                        />
                      </div>
                      <div>
                        <Label>{t('influencer.price_bundle')} (€)</Label>
                        <Input
                          type="number"
                          value={form.price_bundle}
                          onChange={(e) => setForm({ ...form, price_bundle: e.target.value })}
                          disabled={!editing}
                          placeholder="200"
                          className="mt-2"
                          data-testid="profile-price-bundle"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="p-4 bg-muted/50 rounded-xl">
                    <h3 className="font-semibold mb-4">Social Links</h3>
                    <div className="space-y-4">
                      <div>
                        <Label>Instagram URL</Label>
                        <Input
                          value={form.instagram_url}
                          onChange={(e) => setForm({ ...form, instagram_url: e.target.value })}
                          disabled={!editing}
                          placeholder="https://instagram.com/..."
                          className="mt-2"
                        />
                      </div>
                      <div>
                        <Label>TikTok URL</Label>
                        <Input
                          value={form.tiktok_url}
                          onChange={(e) => setForm({ ...form, tiktok_url: e.target.value })}
                          disabled={!editing}
                          placeholder="https://tiktok.com/..."
                          className="mt-2"
                        />
                      </div>
                      <div>
                        <Label>YouTube URL</Label>
                        <Input
                          value={form.youtube_url}
                          onChange={(e) => setForm({ ...form, youtube_url: e.target.value })}
                          disabled={!editing}
                          placeholder="https://youtube.com/..."
                          className="mt-2"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Applications Tab */}
          <TabsContent value="applications">
            {applications.length > 0 ? (
              <div className="space-y-4">
                {applications.map((app) => (
                  <div
                    key={app.application_id}
                    className="bg-white border border-border rounded-xl p-6"
                    data-testid={`my-app-${app.application_id}`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-semibold text-lg mb-1">
                          {app.collaboration?.title || 'Colaborare'}
                        </h3>
                        <p className="text-sm text-muted-foreground mb-2">
                          {app.collaboration?.brand_name}
                        </p>
                        <p className="text-sm">{app.message}</p>
                        {app.proposed_price && (
                          <p className="text-lg font-mono font-bold text-primary mt-2">
                            €{app.proposed_price}
                          </p>
                        )}
                      </div>
                      <Badge className={getStatusColor(app.status)}>
                        {app.status === 'pending' && <Clock className="w-3 h-3 mr-1" />}
                        {app.status === 'accepted' && <CheckCircle className="w-3 h-3 mr-1" />}
                        {app.status === 'rejected' && <XCircle className="w-3 h-3 mr-1" />}
                        {t(`collab.${app.status}`)}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-20 bg-white rounded-2xl border border-border">
                <Briefcase className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-xl font-semibold mb-2">Nicio aplicație încă</h3>
                <p className="text-muted-foreground mb-6">Explorează colaborările disponibile și aplică!</p>
              </div>
            )}
          </TabsContent>

          {/* Browse Tab */}
          <TabsContent value="browse">
            {availableCollabs.length > 0 ? (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {availableCollabs.map((collab) => (
                  <CollaborationCard
                    key={collab.collab_id}
                    collaboration={collab}
                    onClick={() => navigate(`/collaborations/${collab.collab_id}`)}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-20 bg-white rounded-2xl border border-border">
                <TrendingUp className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-xl font-semibold mb-2">Nicio colaborare disponibilă</h3>
                <p className="text-muted-foreground">Revino mai târziu pentru oportunități noi!</p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default InfluencerDashboard;
