import React, { useState, useEffect, useRef } from 'react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import { toast } from 'sonner';
import {
  Instagram, Youtube, Music2, Plus, X, ChevronLeft, ChevronRight,
  ExternalLink, Play, Trash2, Loader2
} from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Detect platform from URL
const detectPlatform = (url) => {
  if (!url) return null;
  if (url.includes('youtube.com') || url.includes('youtu.be')) return 'youtube';
  if (url.includes('tiktok.com')) return 'tiktok';
  if (url.includes('instagram.com')) return 'instagram';
  return null;
};

// Get platform icon
const getPlatformIcon = (platform) => {
  switch (platform) {
    case 'youtube': return <Youtube className="w-5 h-5" />;
    case 'tiktok': return <Music2 className="w-5 h-5" />;
    case 'instagram': return <Instagram className="w-5 h-5" />;
    default: return null;
  }
};

// Get platform color
const getPlatformColor = (platform) => {
  switch (platform) {
    case 'youtube': return 'bg-red-600';
    case 'tiktok': return 'bg-black';
    case 'instagram': return 'bg-gradient-to-r from-purple-500 to-pink-500';
    default: return 'bg-gray-500';
  }
};

// Extract YouTube video ID
const getYouTubeId = (url) => {
  const match = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([^&?\s]+)/);
  return match ? match[1] : null;
};

// Extract TikTok video ID
const getTikTokId = (url) => {
  const match = url.match(/tiktok\.com\/@[^/]+\/video\/(\d+)/);
  return match ? match[1] : null;
};

// Social Post Card Component
export const SocialPostCard = ({ url, onRemove, editable = false }) => {
  const [embedData, setEmbedData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showEmbed, setShowEmbed] = useState(false);
  
  const platform = detectPlatform(url);

  useEffect(() => {
    fetchEmbedData();
  }, [url]);

  const fetchEmbedData = async () => {
    try {
      const response = await fetch(`${API}/oembed?url=${encodeURIComponent(url)}`);
      if (response.ok) {
        const data = await response.json();
        setEmbedData(data);
      }
    } catch (error) {
      console.error('Failed to fetch embed:', error);
    } finally {
      setLoading(false);
    }
  };

  // Generate thumbnail for YouTube
  const getThumbnail = () => {
    if (embedData?.thumbnail_url) return embedData.thumbnail_url;
    if (platform === 'youtube') {
      const videoId = getYouTubeId(url);
      if (videoId) return `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;
    }
    return null;
  };

  const thumbnail = getThumbnail();

  return (
    <div className="relative group rounded-xl overflow-hidden bg-muted aspect-[9/16] sm:aspect-video">
      {loading ? (
        <div className="absolute inset-0 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      ) : showEmbed && embedData?.html ? (
        <div 
          className="w-full h-full"
          dangerouslySetInnerHTML={{ __html: embedData.html }}
        />
      ) : (
        <>
          {/* Thumbnail */}
          {thumbnail ? (
            <img 
              src={thumbnail} 
              alt={embedData?.title || 'Post'} 
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-muted">
              {getPlatformIcon(platform)}
            </div>
          )}

          {/* Overlay */}
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <Button
              variant="secondary"
              size="sm"
              className="rounded-full"
              onClick={() => platform === 'youtube' || platform === 'tiktok' ? setShowEmbed(true) : window.open(url, '_blank')}
            >
              <Play className="w-4 h-4 mr-1" />
              {platform === 'instagram' ? 'Vezi pe Instagram' : 'Redă'}
            </Button>
          </div>

          {/* Platform Badge */}
          <div className={`absolute top-2 left-2 ${getPlatformColor(platform)} text-white px-2 py-1 rounded-full text-xs flex items-center gap-1`}>
            {getPlatformIcon(platform)}
            <span className="capitalize hidden sm:inline">{platform}</span>
          </div>

          {/* Title */}
          {embedData?.title && (
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3">
              <p className="text-white text-sm font-medium line-clamp-2">{embedData.title}</p>
              {embedData.author_name && (
                <p className="text-white/70 text-xs">{embedData.author_name}</p>
              )}
            </div>
          )}
        </>
      )}

      {/* Remove Button */}
      {editable && onRemove && (
        <button
          onClick={onRemove}
          className="absolute top-2 right-2 w-8 h-8 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <X className="w-4 h-4" />
        </button>
      )}

      {/* External Link */}
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="absolute top-2 right-2 w-8 h-8 bg-white/90 text-foreground rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
        style={{ display: editable ? 'none' : undefined }}
      >
        <ExternalLink className="w-4 h-4" />
      </a>
    </div>
  );
};

// Social Posts Carousel Component
export const SocialPostsCarousel = ({ posts = [], title = "Postări recente" }) => {
  const scrollRef = useRef(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  useEffect(() => {
    checkScroll();
  }, [posts]);

  const checkScroll = () => {
    if (scrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
      setCanScrollLeft(scrollLeft > 0);
      setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 10);
    }
  };

  const scroll = (direction) => {
    if (scrollRef.current) {
      const scrollAmount = 320;
      scrollRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
      setTimeout(checkScroll, 300);
    }
  };

  if (!posts || posts.length === 0) return null;

  return (
    <div className="mt-8">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Play className="w-5 h-5 text-primary" />
          {title}
        </h3>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8 rounded-full"
            onClick={() => scroll('left')}
            disabled={!canScrollLeft}
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8 rounded-full"
            onClick={() => scroll('right')}
            disabled={!canScrollRight}
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="flex gap-4 overflow-x-auto scrollbar-hide pb-4 -mx-2 px-2"
        onScroll={checkScroll}
        style={{ scrollSnapType: 'x mandatory' }}
      >
        {posts.map((url, index) => (
          <div 
            key={index} 
            className="flex-shrink-0 w-64 sm:w-72"
            style={{ scrollSnapAlign: 'start' }}
          >
            <SocialPostCard url={url} />
          </div>
        ))}
      </div>
    </div>
  );
};

// Social Posts Editor Component (for profile editing)
export const SocialPostsEditor = ({ posts = [], onChange, maxPosts = 6 }) => {
  const [newUrl, setNewUrl] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [validating, setValidating] = useState(false);

  const handleAddPost = async () => {
    if (!newUrl.trim()) return;

    const platform = detectPlatform(newUrl);
    if (!platform) {
      toast.error('URL invalid. Acceptăm doar link-uri de pe YouTube, TikTok sau Instagram.');
      return;
    }

    if (posts.includes(newUrl)) {
      toast.error('Această postare există deja.');
      return;
    }

    if (posts.length >= maxPosts) {
      toast.error(`Poți adăuga maxim ${maxPosts} postări.`);
      return;
    }

    setValidating(true);
    try {
      // Validate URL by fetching oEmbed
      const response = await fetch(`${API}/oembed?url=${encodeURIComponent(newUrl)}`);
      if (response.ok) {
        onChange([...posts, newUrl]);
        setNewUrl('');
        setDialogOpen(false);
        toast.success('Postare adăugată!');
      } else {
        toast.error('Nu am putut valida URL-ul.');
      }
    } catch (error) {
      toast.error('Eroare la validarea URL-ului.');
    } finally {
      setValidating(false);
    }
  };

  const handleRemovePost = (index) => {
    const newPosts = [...posts];
    newPosts.splice(index, 1);
    onChange(newPosts);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label>Postări prezentate ({posts.length}/{maxPosts})</Label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setDialogOpen(true)}
          disabled={posts.length >= maxPosts}
        >
          <Plus className="w-4 h-4 mr-1" />
          Adaugă postare
        </Button>
      </div>

      {posts.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {posts.map((url, index) => (
            <SocialPostCard
              key={index}
              url={url}
              editable
              onRemove={() => handleRemovePost(index)}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-8 bg-muted/30 rounded-xl border-2 border-dashed border-border">
          <Play className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground text-sm">
            Adaugă postări de pe YouTube, TikTok sau Instagram
          </p>
          <p className="text-muted-foreground text-xs mt-1">
            Acestea vor fi afișate pe profilul tău public
          </p>
        </div>
      )}

      {/* Add Post Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Adaugă postare</DialogTitle>
            <DialogDescription>
              Introdu link-ul către o postare de pe YouTube, TikTok sau Instagram
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-4">
            <div>
              <Label>URL postare</Label>
              <Input
                value={newUrl}
                onChange={(e) => setNewUrl(e.target.value)}
                placeholder="https://youtube.com/watch?v=... sau https://tiktok.com/@..."
                className="mt-2"
                data-testid="post-url-input"
              />
            </div>

            <div className="flex gap-2 text-sm text-muted-foreground">
              <Badge variant="outline" className="gap-1">
                <Youtube className="w-3 h-3" /> YouTube
              </Badge>
              <Badge variant="outline" className="gap-1">
                <Music2 className="w-3 h-3" /> TikTok
              </Badge>
              <Badge variant="outline" className="gap-1">
                <Instagram className="w-3 h-3" /> Instagram
              </Badge>
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Anulează
              </Button>
              <Button
                type="button"
                onClick={handleAddPost}
                disabled={validating || !newUrl.trim()}
                className="bg-primary text-primary-foreground"
                data-testid="add-post-btn"
              >
                {validating ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Se validează...
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4 mr-2" />
                    Adaugă
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SocialPostsCarousel;
