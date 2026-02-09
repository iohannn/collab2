import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { CollaborationCard, BrandMarquee, StatsCard } from '../components/CollaborationCard';
import { TopInfluencers } from '../components/TopInfluencers';
import { Button } from '../components/ui/button';
import { ArrowRight, Zap, Users, Clock, TrendingUp, CheckCircle } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const Landing = () => {
  const { t } = useLanguage();
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [collaborations, setCollaborations] = useState([]);
  const [stats, setStats] = useState({ active_collaborations: 0, registered_influencers: 0, total_applications: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [collabRes, statsRes] = await Promise.all([
          fetch(`${API}/collaborations?limit=6`),
          fetch(`${API}/stats/public`)
        ]);
        
        if (collabRes.ok) {
          const collabs = await collabRes.json();
          setCollaborations(collabs);
        }
        
        if (statsRes.ok) {
          const statsData = await statsRes.json();
          setStats(statsData);
        }
      } catch (error) {
        console.error('Failed to fetch data:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, []);

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-b from-muted/50 to-background py-20 lg:py-32">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Left Content */}
            <div className="animate-fade-in-up">
              <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full text-sm font-medium mb-6">
                <Zap className="w-4 h-4" />
                <span>Live Collaboration Board</span>
              </div>
              
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-heading font-bold text-foreground leading-tight mb-6">
                {t('landing.hero_title')}
              </h1>
              
              <p className="text-lg text-muted-foreground max-w-lg mb-8">
                {t('landing.hero_subtitle')}
              </p>
              
              <div className="flex flex-wrap gap-4">
                <Button
                  size="lg"
                  onClick={() => navigate(isAuthenticated ? '/dashboard' : '/register?type=brand')}
                  className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-full px-8 h-14 text-lg font-semibold shadow-lg shadow-primary/25 transition-all hover:scale-105"
                  data-testid="cta-brand"
                >
                  {t('landing.cta_brand')}
                  <ArrowRight className="ml-2 w-5 h-5" />
                </Button>
                
                <Button
                  size="lg"
                  variant="outline"
                  onClick={() => navigate(isAuthenticated ? '/dashboard' : '/register?type=influencer')}
                  className="rounded-full px-8 h-14 text-lg font-semibold border-2 hover:bg-foreground hover:text-background transition-all"
                  data-testid="cta-influencer"
                >
                  {t('landing.cta_influencer')}
                </Button>
              </div>
            </div>

            {/* Right - Stats Cards */}
            <div className="grid grid-cols-2 gap-4 animate-fade-in-up animation-delay-200">
              <StatsCard 
                value={stats.active_collaborations || '50+'} 
                label={t('landing.stats_collabs')} 
                icon={TrendingUp}
              />
              <StatsCard 
                value={stats.registered_influencers || '200+'} 
                label={t('landing.stats_influencers')} 
                icon={Users}
              />
              <div className="col-span-2">
                <StatsCard 
                  value={stats.total_applications || '500+'} 
                  label={t('landing.stats_apps')} 
                  icon={CheckCircle}
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Brand Marquee */}
      <BrandMarquee />

      {/* Active Collaborations */}
      <section className="py-20 lg:py-32">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-12">
            <div>
              <h2 className="text-3xl sm:text-4xl font-heading font-bold text-foreground">
                {t('nav.collaborations')}
              </h2>
              <p className="text-muted-foreground mt-2">Oportunități active pentru creatori</p>
            </div>
            <Button
              variant="outline"
              onClick={() => navigate('/collaborations')}
              className="rounded-full"
              data-testid="view-all-collabs"
            >
              {t('landing.view_all')}
              <ArrowRight className="ml-2 w-4 h-4" />
            </Button>
          </div>

          {loading ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-muted rounded-xl h-80 animate-pulse" />
              ))}
            </div>
          ) : collaborations.length > 0 ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {collaborations.map((collab, index) => (
                <div key={collab.collab_id} className={`animate-fade-in-up animation-delay-${(index + 1) * 100}`}>
                  <CollaborationCard
                    collaboration={collab}
                    onClick={() => navigate(`/collaborations/${collab.collab_id}`)}
                  />
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-20 bg-muted/30 rounded-2xl">
              <Clock className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">Nu sunt colaborări active</h3>
              <p className="text-muted-foreground mb-6">Fii primul brand care postează o colaborare!</p>
              <Button onClick={() => navigate('/register?type=brand')} className="rounded-full">
                Postează o colaborare
              </Button>
            </div>
          )}
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 lg:py-32 bg-foreground text-background">
        <div className="max-w-7xl mx-auto px-6">
          <h2 className="text-3xl sm:text-4xl font-heading font-bold text-center mb-16">
            {t('landing.how_it_works')}
          </h2>

          <div className="grid md:grid-cols-3 gap-8 lg:gap-12">
            {[
              { num: '01', title: t('landing.step1_title'), desc: t('landing.step1_desc'), icon: '📋' },
              { num: '02', title: t('landing.step2_title'), desc: t('landing.step2_desc'), icon: '✋' },
              { num: '03', title: t('landing.step3_title'), desc: t('landing.step3_desc'), icon: '🤝' },
            ].map((step, index) => (
              <div key={step.num} className={`text-center animate-fade-in-up animation-delay-${(index + 1) * 100}`}>
                <div className="w-20 h-20 bg-primary rounded-2xl flex items-center justify-center mx-auto mb-6 text-4xl">
                  {step.icon}
                </div>
                <span className="text-primary font-mono font-bold text-sm">{step.num}</span>
                <h3 className="text-2xl font-heading font-semibold mt-2 mb-3">{step.title}</h3>
                <p className="text-muted-foreground/70">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 lg:py-32">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-heading font-bold text-foreground mb-6">
            Gata să începi?
          </h2>
          <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
            Alătură-te platformei și începe să colaborezi cu branduri sau creatori în mai puțin de 5 minute.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Button
              size="lg"
              onClick={() => navigate('/register')}
              className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-full px-8 h-14 text-lg font-semibold shadow-lg shadow-primary/25"
              data-testid="cta-register"
            >
              Creează cont gratuit
              <ArrowRight className="ml-2 w-5 h-5" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={() => navigate('/collaborations')}
              className="rounded-full px-8 h-14 text-lg font-semibold border-2"
            >
              {t('landing.browse_collabs')}
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Landing;
