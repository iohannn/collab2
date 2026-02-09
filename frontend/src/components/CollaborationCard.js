import React, { useState, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { Clock, Users, ArrowRight, Instagram, Youtube, Music2, Shield, Lock } from 'lucide-react';
import { Badge } from '../components/ui/badge';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

export const CollaborationCard = ({ collaboration, onClick, locked = false }) => {
  const { t } = useLanguage();
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0 });

  useEffect(() => {
    const calculateTimeLeft = () => {
      const deadline = new Date(collaboration.deadline);
      const now = new Date();
      const diff = deadline - now;

      if (diff > 0) {
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        setTimeLeft({ days, hours, minutes });
      } else {
        setTimeLeft({ days: 0, hours: 0, minutes: 0 });
      }
    };

    calculateTimeLeft();
    const interval = setInterval(calculateTimeLeft, 60000);
    return () => clearInterval(interval);
  }, [collaboration.deadline]);

  const getPlatformIcon = (platform) => {
    switch (platform?.toLowerCase()) {
      case 'instagram': return <Instagram className="w-4 h-4" />;
      case 'youtube': return <Youtube className="w-4 h-4" />;
      case 'tiktok': return <Music2 className="w-4 h-4" />;
      default: return null;
    }
  };

  const getPlatformColor = (platform) => {
    switch (platform?.toLowerCase()) {
      case 'instagram': return 'bg-gradient-to-r from-purple-500 to-pink-500';
      case 'youtube': return 'bg-red-600';
      case 'tiktok': return 'bg-black';
      default: return 'bg-gray-500';
    }
  };

  const isClosingSoon = timeLeft.days < 2;
  const formatBudget = () => {
    if (collaboration.budget_max && collaboration.budget_max !== collaboration.budget_min) {
      return `€${collaboration.budget_min} - €${collaboration.budget_max}`;
    }
    return `€${collaboration.budget_min}`;
  };

  return (
    <div 
      onClick={onClick}
      className="ticket-card bg-white border border-border hover:border-primary/50 rounded-xl p-6 cursor-pointer transition-all duration-300 hover:shadow-xl hover:-translate-y-1 group relative"
      data-testid={`collab-card-${collaboration.collab_id}`}
    >
      {/* Platform Badge */}
      <div className={`absolute top-4 right-4 ${getPlatformColor(collaboration.platform)} text-white px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1`}>
        {getPlatformIcon(collaboration.platform)}
        {collaboration.platform}
      </div>

      {/* Closing Soon Badge */}
      {isClosingSoon && (
        <Badge className="absolute top-4 left-4 badge-urgent urgency-badge" data-testid="closing-soon-badge">
          {t('landing.closing_soon')}
        </Badge>
      )}

      {/* Brand Name */}
      <p className="text-sm text-muted-foreground font-medium uppercase tracking-wider mb-2 mt-6">
        {collaboration.brand_name}
      </p>

      {/* Title */}
      <h3 className="text-xl font-heading font-semibold text-foreground mb-3 line-clamp-2 group-hover:text-primary transition-colors">
        {collaboration.title}
      </h3>

      {/* Deliverables */}
      <div className="flex flex-wrap gap-2 mb-4">
        {collaboration.deliverables?.slice(0, 3).map((d, i) => (
          <span key={i} className="bg-muted text-muted-foreground px-2 py-1 rounded text-xs">
            {d}
          </span>
        ))}
      </div>

      {/* Budget */}
      <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 mb-4">
        <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">{t('collab.budget')}</p>
        <p className="text-2xl font-mono font-bold text-primary">{formatBudget()}</p>
        {collaboration.collaboration_type === 'paid' && collaboration.payment_status === 'secured' && (
          <div className="flex items-center gap-1.5 mt-2 text-xs text-green-600 font-medium">
            <Shield className="w-3.5 h-3.5" />
            <span>Fonduri securizate</span>
          </div>
        )}
        {collaboration.collaboration_type === 'barter' && (
          <span className="text-xs text-muted-foreground">Barter</span>
        )}
        {collaboration.collaboration_type === 'free' && (
          <span className="text-xs text-muted-foreground">Gratuită</span>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-4 border-t border-border">
        {/* Timer */}
        <div className="flex items-center gap-2 text-sm">
          <Clock className={`w-4 h-4 ${isClosingSoon ? 'text-primary' : 'text-muted-foreground'}`} />
          <span className={`font-mono ${isClosingSoon ? 'countdown-timer' : 'text-muted-foreground'}`}>
            {timeLeft.days}d {timeLeft.hours}h {timeLeft.minutes}m
          </span>
        </div>

        {/* Applicants */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Users className="w-4 h-4" />
          <span>{collaboration.applicants_count} {t('landing.applicants')}</span>
        </div>

        {/* Arrow */}
        <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
      </div>
    </div>
  );
};

export const InfluencerCard = ({ profile, onClick }) => {
  const formatAudience = (size) => {
    if (!size) return '-';
    if (size >= 1000000) return `${(size / 1000000).toFixed(1)}M`;
    if (size >= 1000) return `${(size / 1000).toFixed(1)}K`;
    return size;
  };

  return (
    <div 
      onClick={onClick}
      className="bg-white border border-border hover:border-primary/50 rounded-xl p-6 cursor-pointer transition-all duration-300 hover:shadow-xl hover:-translate-y-1 group"
      data-testid={`influencer-card-${profile.username}`}
    >
      {/* Avatar & Basic Info */}
      <div className="flex items-start gap-4 mb-4">
        <div className="w-16 h-16 rounded-full bg-muted overflow-hidden flex-shrink-0">
          {profile.profile_photo ? (
            <img src={profile.profile_photo} alt={profile.username} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white text-xl font-bold">
              {profile.username?.[0]?.toUpperCase()}
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-heading font-semibold text-lg truncate group-hover:text-primary transition-colors">
            @{profile.username}
          </h3>
          <p className="text-sm text-muted-foreground line-clamp-2">{profile.bio || 'No bio'}</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wider">Followers</p>
          <p className="text-xl font-mono font-bold">{formatAudience(profile.audience_size)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wider">Engagement</p>
          <p className="text-xl font-mono font-bold">{profile.engagement_rate ? `${profile.engagement_rate}%` : '-'}</p>
        </div>
      </div>

      {/* Platforms */}
      <div className="flex gap-2 mb-4">
        {profile.platforms?.map((p) => (
          <span key={p} className={`${p === 'instagram' ? 'platform-instagram' : p === 'tiktok' ? 'platform-tiktok' : 'platform-youtube'} text-white px-2 py-1 rounded text-xs`}>
            {p}
          </span>
        ))}
      </div>

      {/* Pricing */}
      {profile.price_per_post && (
        <div className="pt-4 border-t border-border">
          <p className="text-xs text-muted-foreground">Starting from</p>
          <p className="text-lg font-mono font-bold text-primary">€{profile.price_per_post}/post</p>
        </div>
      )}

      {/* Badges */}
      {profile.badges?.length > 0 && (
        <div className="flex gap-2 mt-3">
          {profile.badges.map((badge) => (
            <Badge key={badge} className="badge-pro">{badge}</Badge>
          ))}
        </div>
      )}

      {/* Available Badge */}
      {profile.available && (
        <div className="mt-3 flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-xs text-green-600 font-medium">Available</span>
        </div>
      )}
    </div>
  );
};

export const CountdownTimer = ({ deadline }) => {
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });

  useEffect(() => {
    const calculateTimeLeft = () => {
      const deadlineDate = new Date(deadline);
      const now = new Date();
      const diff = deadlineDate - now;

      if (diff > 0) {
        setTimeLeft({
          days: Math.floor(diff / (1000 * 60 * 60 * 24)),
          hours: Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
          minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
          seconds: Math.floor((diff % (1000 * 60)) / 1000),
        });
      }
    };

    calculateTimeLeft();
    const interval = setInterval(calculateTimeLeft, 1000);
    return () => clearInterval(interval);
  }, [deadline]);

  return (
    <div className="flex gap-4" data-testid="countdown-timer">
      {[
        { value: timeLeft.days, label: 'DAYS' },
        { value: timeLeft.hours, label: 'HRS' },
        { value: timeLeft.minutes, label: 'MIN' },
        { value: timeLeft.seconds, label: 'SEC' },
      ].map(({ value, label }) => (
        <div key={label} className="text-center">
          <div className="bg-foreground text-background font-mono text-3xl font-bold px-4 py-3 rounded-lg">
            {String(value).padStart(2, '0')}
          </div>
          <p className="text-xs text-muted-foreground mt-1 tracking-wider">{label}</p>
        </div>
      ))}
    </div>
  );
};

export const BrandMarquee = () => {
  const brands = ['NIKE', 'ADIDAS', 'ZARA', 'H&M', 'EMAG', 'ELEFANT', 'FASHIONDAYS', 'ABOUT YOU', 'ORANGE', 'VODAFONE'];
  
  return (
    <div className="marquee-container py-8 border-y border-border bg-muted/30">
      <div className="marquee-content">
        {[...brands, ...brands].map((brand, i) => (
          <span key={i} className="inline-block mx-12 text-2xl font-heading font-bold text-muted-foreground/50 uppercase tracking-widest">
            {brand}
          </span>
        ))}
      </div>
    </div>
  );
};

export const StatsCard = ({ value, label, icon: Icon }) => (
  <div className="bg-white border border-border rounded-xl p-6 text-center">
    {Icon && <Icon className="w-8 h-8 text-primary mx-auto mb-3" />}
    <p className="text-4xl font-heading font-bold text-foreground mb-1">{value}</p>
    <p className="text-sm text-muted-foreground">{label}</p>
  </div>
);
