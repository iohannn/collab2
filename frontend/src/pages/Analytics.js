import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { toast } from 'sonner';
import {
  BarChart3, TrendingUp, Eye, Users, DollarSign, CheckCircle, XCircle, Clock,
  Crown, ArrowUpRight, ArrowDownRight, Instagram, Youtube, Music2, Target
} from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const Analytics = () => {
  const { user, getAuthHeaders, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isAuthenticated) {
      fetchAnalytics();
    }
  }, [isAuthenticated, user]);

  const fetchAnalytics = async () => {
    try {
      const endpoint = user?.user_type === 'brand' ? '/analytics/brand' : '/analytics/influencer';
      const response = await fetch(`${API}${endpoint}`, {
        headers: getAuthHeaders(),
        credentials: 'include',
      });

      if (response.ok) {
        setAnalytics(await response.json());
      } else if (response.status === 403) {
        // Not PRO user
        setAnalytics(null);
      }
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const getPlatformIcon = (platform) => {
    switch (platform?.toLowerCase()) {
      case 'instagram': return <Instagram className="w-5 h-5" />;
      case 'youtube': return <Youtube className="w-5 h-5" />;
      case 'tiktok': return <Music2 className="w-5 h-5" />;
      default: return null;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user?.is_pro) {
    return (
      <div className="min-h-screen bg-muted/30 py-16">
        <div className="max-w-2xl mx-auto px-6 text-center">
          <div className="bg-white border border-border rounded-2xl p-12">
            <BarChart3 className="w-16 h-16 text-muted-foreground mx-auto mb-6" />
            <h1 className="text-3xl font-heading font-bold mb-4">Analytics PRO</h1>
            <p className="text-muted-foreground mb-8">
              Obține acces la statistici detaliate despre colaborările tale, performanță și tendințe.
            </p>
            <div className="grid grid-cols-2 gap-4 mb-8 text-left">
              <div className="flex items-center gap-3">
                <CheckCircle className="w-5 h-5 text-green-500" />
                <span>Vizualizări & Aplicații</span>
              </div>
              <div className="flex items-center gap-3">
                <CheckCircle className="w-5 h-5 text-green-500" />
                <span>Rată de conversie</span>
              </div>
              <div className="flex items-center gap-3">
                <CheckCircle className="w-5 h-5 text-green-500" />
                <span>Breakdown pe platforme</span>
              </div>
              <div className="flex items-center gap-3">
                <CheckCircle className="w-5 h-5 text-green-500" />
                <span>Tendințe lunare</span>
              </div>
            </div>
            <Button
              size="lg"
              onClick={() => navigate('/pricing')}
              className="bg-primary text-primary-foreground rounded-full px-8"
              data-testid="upgrade-pro-btn"
            >
              <Crown className="w-5 h-5 mr-2" />
              Upgrade la PRO
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const isBrand = user?.user_type === 'brand';

  return (
    <div className="min-h-screen bg-muted/30 py-8">
      <div className="max-w-7xl mx-auto px-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <BarChart3 className="w-8 h-8 text-primary" />
            <h1 className="text-3xl font-heading font-bold">Analytics</h1>
            <Badge className="badge-pro">
              <Crown className="w-3 h-3 mr-1" />
              PRO
            </Badge>
          </div>
        </div>

        {analytics && (
          <>
            {/* Overview Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              {isBrand ? (
                <>
                  <div className="bg-white border border-border rounded-xl p-6">
                    <div className="flex items-center justify-between mb-4">
                      <TrendingUp className="w-6 h-6 text-primary" />
                      <Badge className="bg-green-100 text-green-700 text-xs">
                        +12%
                      </Badge>
                    </div>
                    <p className="text-3xl font-heading font-bold">{analytics.overview.total_collaborations}</p>
                    <p className="text-sm text-muted-foreground">Colaborări totale</p>
                  </div>
                  <div className="bg-white border border-border rounded-xl p-6">
                    <Eye className="w-6 h-6 text-secondary mb-4" />
                    <p className="text-3xl font-heading font-bold">{analytics.overview.total_views}</p>
                    <p className="text-sm text-muted-foreground">Vizualizări</p>
                  </div>
                  <div className="bg-white border border-border rounded-xl p-6">
                    <Users className="w-6 h-6 text-green-500 mb-4" />
                    <p className="text-3xl font-heading font-bold">{analytics.overview.total_applicants}</p>
                    <p className="text-sm text-muted-foreground">Aplicanți</p>
                  </div>
                  <div className="bg-white border border-border rounded-xl p-6">
                    <Target className="w-6 h-6 text-primary mb-4" />
                    <p className="text-3xl font-heading font-bold">{analytics.overview.conversion_rate}%</p>
                    <p className="text-sm text-muted-foreground">Rată conversie</p>
                  </div>
                </>
              ) : (
                <>
                  <div className="bg-white border border-border rounded-xl p-6">
                    <TrendingUp className="w-6 h-6 text-primary mb-4" />
                    <p className="text-3xl font-heading font-bold">{analytics.overview.total_applications}</p>
                    <p className="text-sm text-muted-foreground">Aplicații trimise</p>
                  </div>
                  <div className="bg-white border border-border rounded-xl p-6">
                    <Target className="w-6 h-6 text-green-500 mb-4" />
                    <p className="text-3xl font-heading font-bold">{analytics.overview.success_rate}%</p>
                    <p className="text-sm text-muted-foreground">Rată succes</p>
                  </div>
                  <div className="bg-white border border-border rounded-xl p-6">
                    <Eye className="w-6 h-6 text-secondary mb-4" />
                    <p className="text-3xl font-heading font-bold">{analytics.overview.profile_views}</p>
                    <p className="text-sm text-muted-foreground">Vizualizări profil</p>
                  </div>
                  <div className="bg-white border border-border rounded-xl p-6">
                    <DollarSign className="w-6 h-6 text-green-600 mb-4" />
                    <p className="text-3xl font-heading font-bold">€{analytics.overview.total_earnings}</p>
                    <p className="text-sm text-muted-foreground">Câștiguri estimate</p>
                  </div>
                </>
              )}
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              {/* Application Stats */}
              <div className="bg-white border border-border rounded-xl p-6">
                <h3 className="text-lg font-semibold mb-6">Status Aplicații</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded-full bg-green-500" />
                      <span>Acceptate</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-2xl font-bold">{analytics.applications.accepted}</span>
                      <CheckCircle className="w-5 h-5 text-green-500" />
                    </div>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div
                      className="bg-green-500 h-2 rounded-full"
                      style={{ width: `${(analytics.applications.accepted / analytics.applications.total) * 100}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded-full bg-yellow-500" />
                      <span>În așteptare</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-2xl font-bold">{analytics.applications.pending}</span>
                      <Clock className="w-5 h-5 text-yellow-500" />
                    </div>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div
                      className="bg-yellow-500 h-2 rounded-full"
                      style={{ width: `${(analytics.applications.pending / analytics.applications.total) * 100}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded-full bg-red-500" />
                      <span>Respinse</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-2xl font-bold">{analytics.applications.rejected}</span>
                      <XCircle className="w-5 h-5 text-red-500" />
                    </div>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div
                      className="bg-red-500 h-2 rounded-full"
                      style={{ width: `${(analytics.applications.rejected / analytics.applications.total) * 100}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Platform Breakdown */}
              <div className="bg-white border border-border rounded-xl p-6">
                <h3 className="text-lg font-semibold mb-6">Per Platformă</h3>
                <div className="space-y-4">
                  {Object.entries(analytics.platform_breakdown).map(([platform, stats]) => (
                    <div key={platform} className="flex items-center justify-between p-4 bg-muted/50 rounded-xl">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-white ${
                          platform === 'instagram' ? 'bg-gradient-to-r from-purple-500 to-pink-500' :
                          platform === 'tiktok' ? 'bg-black' : 'bg-red-600'
                        }`}>
                          {getPlatformIcon(platform)}
                        </div>
                        <span className="font-medium capitalize">{platform}</span>
                      </div>
                      <div className="text-right">
                        {isBrand ? (
                          <>
                            <p className="text-lg font-bold">{stats.collabs} collabs</p>
                            <p className="text-sm text-muted-foreground">{stats.applicants} applicanți</p>
                          </>
                        ) : (
                          <>
                            <p className="text-lg font-bold">{stats.applied} aplicații</p>
                            <p className="text-sm text-muted-foreground">{stats.accepted} acceptate</p>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Monthly Trend */}
              <div className="bg-white border border-border rounded-xl p-6 md:col-span-2">
                <h3 className="text-lg font-semibold mb-6">Tendință Lunară</h3>
                <div className="grid grid-cols-6 gap-4">
                  {analytics.monthly_trend.map((month, index) => (
                    <div key={month.month} className="text-center">
                      <div className="relative h-32 flex items-end justify-center gap-1">
                        <div
                          className="w-6 bg-primary/20 rounded-t"
                          style={{ height: `${Math.max((month.collaborations || month.applications) * 10, 10)}%` }}
                        />
                        <div
                          className="w-6 bg-primary rounded-t"
                          style={{ height: `${Math.max((month.applications || month.accepted) * 10, 5)}%` }}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">{month.month}</p>
                      <p className="text-sm font-medium">
                        {isBrand ? month.applications : month.applications}
                      </p>
                    </div>
                  ))}
                </div>
                <div className="flex justify-center gap-6 mt-4">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded bg-primary/20" />
                    <span className="text-sm text-muted-foreground">{isBrand ? 'Colaborări' : 'Aplicații'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded bg-primary" />
                    <span className="text-sm text-muted-foreground">{isBrand ? 'Aplicații' : 'Acceptate'}</span>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default Analytics;
