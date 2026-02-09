import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import { CollaborationCard } from '../components/CollaborationCard';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Search, Filter, SlidersHorizontal, X } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const Collaborations = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [collaborations, setCollaborations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [platform, setPlatform] = useState(searchParams.get('platform') || 'all');
  const [search, setSearch] = useState(searchParams.get('q') || '');
  const [searchInput, setSearchInput] = useState(searchParams.get('q') || '');

  const fetchCollaborations = useCallback(async () => {
    setLoading(true);
    try {
      let url = `${API}/collaborations?status=active`;
      if (platform && platform !== 'all') {
        url += `&platform=${platform}`;
      }
      if (search) {
        url += `&search=${encodeURIComponent(search)}`;
      }
      
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        setCollaborations(data);
      }
    } catch (error) {
      console.error('Failed to fetch collaborations:', error);
    } finally {
      setLoading(false);
    }
  }, [platform, search]);

  useEffect(() => {
    fetchCollaborations();
  }, [fetchCollaborations]);

  const handleSearch = (e) => {
    e.preventDefault();
    setSearch(searchInput);
    const params = new URLSearchParams();
    if (searchInput) params.set('q', searchInput);
    if (platform !== 'all') params.set('platform', platform);
    setSearchParams(params);
  };

  const clearSearch = () => {
    setSearch('');
    setSearchInput('');
    setSearchParams({});
  };

  const handlePlatformChange = (value) => {
    setPlatform(value);
    const params = new URLSearchParams(searchParams);
    if (value !== 'all') {
      params.set('platform', value);
    } else {
      params.delete('platform');
    }
    setSearchParams(params);
  };

  return (
    <div className="min-h-screen bg-muted/30 py-8">
      <div className="max-w-7xl mx-auto px-6">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl sm:text-4xl font-heading font-bold text-foreground mb-2">
            {t('nav.collaborations')}
          </h1>
          <p className="text-muted-foreground">
            Descoperă oportunități de colaborare cu branduri
          </p>
        </div>

        {/* Filters */}
        <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-4 mb-8">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              placeholder={`${t('common.search')} (titlu, brand, deliverables...)`}
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="pl-10 pr-10 h-12 rounded-xl"
              data-testid="search-input"
            />
            {searchInput && (
              <button
                type="button"
                onClick={clearSearch}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <Button type="submit" className="h-12 rounded-xl bg-primary text-primary-foreground">
            <Search className="w-4 h-4 mr-2" />
            Caută
          </Button>
          <Select value={platform} onValueChange={handlePlatformChange}>
            <SelectTrigger className="w-full sm:w-48 h-12 rounded-xl" data-testid="platform-filter">
              <SlidersHorizontal className="w-4 h-4 mr-2" />
              <SelectValue placeholder="Platformă" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('common.all')}</SelectItem>
              <SelectItem value="instagram">Instagram</SelectItem>
              <SelectItem value="tiktok">TikTok</SelectItem>
              <SelectItem value="youtube">YouTube</SelectItem>
            </SelectContent>
          </Select>
        </form>

        {/* Active Search Badge */}
        {search && (
          <div className="flex items-center gap-2 mb-6">
            <span className="text-sm text-muted-foreground">Rezultate pentru:</span>
            <span className="bg-primary/10 text-primary px-3 py-1 rounded-full text-sm font-medium">
              "{search}"
            </span>
            <button onClick={clearSearch} className="text-muted-foreground hover:text-foreground">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Results */}
        {loading ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="bg-white rounded-xl h-80 animate-pulse" />
            ))}
          </div>
        ) : collaborations.length > 0 ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {collaborations.map((collab) => (
              <CollaborationCard
                key={collab.collab_id}
                collaboration={collab}
                onClick={() => navigate(`/collaborations/${collab.collab_id}`)}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-20 bg-white rounded-2xl border border-border">
            <Filter className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">Nicio colaborare găsită</h3>
            <p className="text-muted-foreground mb-4">
              {search ? `Nu am găsit rezultate pentru "${search}"` : 'Încearcă să schimbi filtrele'}
            </p>
            {search && (
              <Button variant="outline" onClick={clearSearch}>
                Șterge căutarea
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Collaborations;
