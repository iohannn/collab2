import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Star, Trophy, Crown, ArrowRight, Instagram, Youtube, Music2 } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export const TopInfluencers = () => {
  const { t, language } = useLanguage();
  const navigate = useNavigate();
  const [influencers, setInfluencers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTopInfluencers();
  }, []);

  const fetchTopInfluencers = async () => {
    try {
      const response = await fetch(`${API}/influencers/top?limit=10`);
      if (response.ok) {
        const data = await response.json();
        setInfluencers(data);
      }
    } catch (error) {
      console.error('Failed to fetch top influencers:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatAudience = (size) => {
    if (!size) return '-';
    if (size >= 1000000) return `${(size / 1000000).toFixed(1)}M`;
    if (size >= 1000) return `${(size / 1000).toFixed(1)}K`;
    return size;
  };

  const getRankStyle = (index) => {
    if (index === 0) return 'bg-yellow-500 text-white';
    if (index === 1) return 'bg-gray-400 text-white';
    if (index === 2) return 'bg-amber-600 text-white';
    return 'bg-muted text-muted-foreground';
  };

  const getRankIcon = (index) => {
    if (index < 3) return <Trophy className="w-4 h-4" />;
    return null;
  };

  if (loading) {
    return (
      <section className="py-16 bg-muted/30">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex items-center justify-center">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        </div>
      </section>
    );
  }

  if (influencers.length === 0) {
    return null;
  }

  return (
    <section className="py-16 lg:py-24 bg-gradient-to-b from-muted/50 to-background">
      <div className="max-w-7xl mx-auto px-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-12">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-yellow-500 rounded-xl flex items-center justify-center">
              <Trophy className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-3xl font-heading font-bold text-foreground">
                Top 10 {language === 'ro' ? 'Creatori' : 'Creators'}
              </h2>
              <p className="text-muted-foreground">
                {language === 'ro' ? 'Cei mai bine cotați influenceri' : 'Highest rated influencers'}
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            onClick={() => navigate('/influencers')}
            className="rounded-full"
            data-testid="view-all-influencers"
          >
            {t('landing.view_all')}
            <ArrowRight className="ml-2 w-4 h-4" />
          </Button>
        </div>

        {/* Leaderboard */}
        <div className="grid gap-4">
          {influencers.map((inf, index) => (
            <div
              key={inf.user_id}
              onClick={() => navigate(`/influencers/${inf.username}`)}
              className={`bg-white border border-border rounded-xl p-4 sm:p-6 cursor-pointer transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5 flex items-center gap-4 ${
                index < 3 ? 'border-l-4' : ''
              } ${index === 0 ? 'border-l-yellow-500' : index === 1 ? 'border-l-gray-400' : index === 2 ? 'border-l-amber-600' : ''}`}
              data-testid={`top-influencer-${index + 1}`}
            >
              {/* Rank */}
              <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg flex-shrink-0 ${getRankStyle(index)}`}>
                {getRankIcon(index) || (index + 1)}
              </div>

              {/* Avatar */}
              <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-muted overflow-hidden flex-shrink-0">
                {inf.profile_photo ? (
                  <img src={inf.profile_photo} alt={inf.username} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white text-xl font-bold">
                    {inf.username?.[0]?.toUpperCase()}
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-semibold text-lg truncate">@{inf.username}</h3>
                  {inf.badges?.includes('Top Rated') && (
                    <Badge className="badge-pro text-xs">
                      <Crown className="w-3 h-3 mr-1" />
                      Top Rated
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                  <span>{formatAudience(inf.audience_size)} followers</span>
                  <span className="hidden sm:inline">•</span>
                  <span className="hidden sm:flex items-center gap-1">
                    {inf.platforms?.slice(0, 2).map((p) => (
                      <span key={p} className="capitalize">{p}</span>
                    ))}
                  </span>
                </div>
              </div>

              {/* Rating */}
              <div className="text-right flex-shrink-0">
                <div className="flex items-center gap-1 justify-end">
                  <Star className="w-5 h-5 text-yellow-500 fill-yellow-500" />
                  <span className="text-2xl font-bold">{inf.avg_rating?.toFixed(1) || '-'}</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {inf.review_count || 0} {language === 'ro' ? 'recenzii' : 'reviews'}
                </p>
              </div>

              {/* Price */}
              {inf.price_per_post && (
                <div className="hidden md:block text-right flex-shrink-0 pl-4 border-l border-border">
                  <p className="text-lg font-mono font-bold text-primary">€{inf.price_per_post}</p>
                  <p className="text-xs text-muted-foreground">/post</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export const StarRating = ({ rating, size = 'md', showValue = true }) => {
  const sizeClass = size === 'sm' ? 'w-4 h-4' : size === 'lg' ? 'w-6 h-6' : 'w-5 h-5';
  
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={`${sizeClass} ${
            star <= rating
              ? 'text-yellow-500 fill-yellow-500'
              : 'text-gray-300'
          }`}
        />
      ))}
      {showValue && (
        <span className="ml-1 font-semibold">{rating?.toFixed(1) || '-'}</span>
      )}
    </div>
  );
};

export const ReviewCard = ({ review }) => {
  return (
    <div className="bg-muted/30 rounded-xl p-4" data-testid={`review-${review.review_id}`}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="font-medium">{review.reviewer_name}</p>
          <p className="text-sm text-muted-foreground">{review.collab_title}</p>
        </div>
        <StarRating rating={review.rating} size="sm" showValue={false} />
      </div>
      {review.comment && (
        <p className="text-sm text-muted-foreground italic">"{review.comment}"</p>
      )}
      <p className="text-xs text-muted-foreground mt-2">
        {new Date(review.created_at).toLocaleDateString('ro-RO')}
      </p>
    </div>
  );
};

export const InteractiveStarRating = ({ value, onChange, disabled = false }) => {
  const [hoverValue, setHoverValue] = useState(0);

  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={disabled}
          onMouseEnter={() => !disabled && setHoverValue(star)}
          onMouseLeave={() => setHoverValue(0)}
          onClick={() => !disabled && onChange(star)}
          className={`transition-transform ${!disabled ? 'hover:scale-110 cursor-pointer' : 'cursor-not-allowed'}`}
          data-testid={`star-${star}`}
        >
          <Star
            className={`w-8 h-8 ${
              star <= (hoverValue || value)
                ? 'text-yellow-500 fill-yellow-500'
                : 'text-gray-300'
            }`}
          />
        </button>
      ))}
    </div>
  );
};

export default TopInfluencers;
