import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { ReviewsSection } from '../components/ReviewDialog';
import { StarRating } from '../components/TopInfluencers';
import {
  Instagram, Youtube, Music2, Users, TrendingUp, DollarSign,
  ExternalLink, ArrowLeft, Share2, CheckCircle, Star
} from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const PublicInfluencerProfile = () => {
  const { username } = useParams();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProfile();
  }, [username]);

  const fetchProfile = async () => {
    try {
      const response = await fetch(`${API}/influencers/${username}`);
      if (response.ok) {
        const data = await response.json();
        setProfile(data);
      } else {
        navigate('/influencers');
      }
    } catch (error) {
      console.error('Failed to fetch profile:', error);
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

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    alert('Link copiat!');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!profile) {
    return null;
  }

  return (
    <div className="min-h-screen bg-muted/30 py-8">
      <div className="max-w-4xl mx-auto px-6">
        {/* Back Button */}
        <div className="flex items-center justify-between mb-6">
          <Button variant="ghost" onClick={() => navigate(-1)} data-testid="back-btn">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Înapoi
          </Button>
          <Button variant="outline" onClick={handleShare} data-testid="share-btn">
            <Share2 className="w-4 h-4 mr-2" />
            Share
          </Button>
        </div>

        {/* Profile Card */}
        <div className="bg-white border border-border rounded-2xl overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-primary to-secondary p-8 text-white text-center">
            <div className="w-24 h-24 rounded-full bg-white/20 mx-auto mb-4 overflow-hidden">
              {profile.profile_photo ? (
                <img src={profile.profile_photo} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-4xl font-bold">
                  {profile.username?.[0]?.toUpperCase()}
                </div>
              )}
            </div>
            <h1 className="text-3xl font-heading font-bold mb-2">@{profile.username}</h1>
            {profile.user?.name && (
              <p className="text-white/80">{profile.user.name}</p>
            )}
            
            {/* Rating Badge */}
            {profile.avg_rating && (
              <div className="inline-flex items-center gap-2 mt-4 bg-white/20 px-4 py-2 rounded-full">
                <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                <span className="font-bold">{profile.avg_rating.toFixed(1)}</span>
                <span className="text-white/70">({profile.review_count} recenzii)</span>
              </div>
            )}
            
            {/* Available Badge */}
            {profile.available && (
              <div className="inline-flex items-center gap-2 mt-3 bg-white/20 px-4 py-2 rounded-full">
                <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                <span className="text-sm font-medium">Disponibil pentru colaborări</span>
              </div>
            )}
          </div>

          {/* Content */}
          <div className="p-8">
            {/* Bio */}
            {profile.bio && (
              <div className="mb-8">
                <p className="text-muted-foreground text-lg">{profile.bio}</p>
              </div>
            )}

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <div className="bg-muted/50 rounded-xl p-4 text-center">
                <Users className="w-6 h-6 text-primary mx-auto mb-2" />
                <p className="text-2xl font-mono font-bold">{formatAudience(profile.audience_size)}</p>
                <p className="text-xs text-muted-foreground uppercase">Followers</p>
              </div>
              <div className="bg-muted/50 rounded-xl p-4 text-center">
                <TrendingUp className="w-6 h-6 text-secondary mx-auto mb-2" />
                <p className="text-2xl font-mono font-bold">
                  {profile.engagement_rate ? `${profile.engagement_rate}%` : '-'}
                </p>
                <p className="text-xs text-muted-foreground uppercase">Engagement</p>
              </div>
              <div className="bg-muted/50 rounded-xl p-4 text-center">
                <DollarSign className="w-6 h-6 text-green-500 mx-auto mb-2" />
                <p className="text-2xl font-mono font-bold">
                  {profile.price_per_post ? `€${profile.price_per_post}` : '-'}
                </p>
                <p className="text-xs text-muted-foreground uppercase">Per Post</p>
              </div>
              <div className="bg-muted/50 rounded-xl p-4 text-center">
                <DollarSign className="w-6 h-6 text-green-500 mx-auto mb-2" />
                <p className="text-2xl font-mono font-bold">
                  {profile.price_per_story ? `€${profile.price_per_story}` : '-'}
                </p>
                <p className="text-xs text-muted-foreground uppercase">Per Story</p>
              </div>
            </div>

            {/* Platforms */}
            <div className="mb-8">
              <h3 className="text-lg font-semibold mb-4">Platforme</h3>
              <div className="flex flex-wrap gap-3">
                {profile.platforms?.map((p) => (
                  <div
                    key={p}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl ${
                      p === 'instagram'
                        ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white'
                        : p === 'tiktok'
                        ? 'bg-black text-white'
                        : 'bg-red-600 text-white'
                    }`}
                  >
                    {p === 'instagram' && <Instagram className="w-5 h-5" />}
                    {p === 'tiktok' && <Music2 className="w-5 h-5" />}
                    {p === 'youtube' && <Youtube className="w-5 h-5" />}
                    <span className="capitalize font-medium">{p}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Niches */}
            {profile.niches?.length > 0 && (
              <div className="mb-8">
                <h3 className="text-lg font-semibold mb-4">Nișe</h3>
                <div className="flex flex-wrap gap-2">
                  {profile.niches.map((niche) => (
                    <Badge key={niche} variant="secondary" className="px-3 py-1">
                      {niche}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Social Links */}
            <div className="mb-8">
              <h3 className="text-lg font-semibold mb-4">Social Media</h3>
              <div className="flex flex-wrap gap-3">
                {profile.instagram_url && (
                  <a
                    href={profile.instagram_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 bg-muted px-4 py-2 rounded-lg hover:bg-muted/80 transition-colors"
                  >
                    <Instagram className="w-5 h-5" />
                    <span>Instagram</span>
                    <ExternalLink className="w-4 h-4" />
                  </a>
                )}
                {profile.tiktok_url && (
                  <a
                    href={profile.tiktok_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 bg-muted px-4 py-2 rounded-lg hover:bg-muted/80 transition-colors"
                  >
                    <Music2 className="w-5 h-5" />
                    <span>TikTok</span>
                    <ExternalLink className="w-4 h-4" />
                  </a>
                )}
                {profile.youtube_url && (
                  <a
                    href={profile.youtube_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 bg-muted px-4 py-2 rounded-lg hover:bg-muted/80 transition-colors"
                  >
                    <Youtube className="w-5 h-5" />
                    <span>YouTube</span>
                    <ExternalLink className="w-4 h-4" />
                  </a>
                )}
              </div>
            </div>

            {/* Badges */}
            {profile.badges?.length > 0 && (
              <div className="mb-8">
                <h3 className="text-lg font-semibold mb-4">Badges</h3>
                <div className="flex flex-wrap gap-2">
                  {profile.badges.map((badge) => (
                    <Badge key={badge} className="badge-pro">
                      <CheckCircle className="w-3 h-3 mr-1" />
                      {badge}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Previous Collaborations */}
            {profile.previous_collaborations?.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold mb-4">Colaborări anterioare</h3>
                <div className="flex flex-wrap gap-2">
                  {profile.previous_collaborations.map((collab, i) => (
                    <Badge key={i} variant="outline">
                      {collab}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Reviews Section */}
            {profile.reviews?.length > 0 && (
              <ReviewsSection 
                reviews={profile.reviews} 
                avgRating={profile.avg_rating}
                reviewCount={profile.review_count}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PublicInfluencerProfile;
