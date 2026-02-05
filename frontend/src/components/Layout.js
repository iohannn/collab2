import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { Button } from './ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { Menu, X, User, LogOut, LayoutDashboard, Globe, ChevronDown } from 'lucide-react';

export const Navbar = () => {
  const { user, logout, isAuthenticated } = useAuth();
  const { t, language, toggleLanguage } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const isActive = (path) => location.pathname === path;

  const NavLink = ({ to, children }) => (
    <Link
      to={to}
      className={`px-4 py-2 text-sm font-medium transition-colors ${
        isActive(to)
          ? 'text-primary'
          : 'text-muted-foreground hover:text-foreground'
      }`}
      onClick={() => setMobileMenuOpen(false)}
    >
      {children}
    </Link>
  );

  return (
    <header className="glass-header sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2" data-testid="logo">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-lg">C</span>
            </div>
            <span className="font-heading font-bold text-xl text-foreground hidden sm:block">
              colaboreaza
            </span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-2">
            <NavLink to="/">{t('nav.home')}</NavLink>
            <NavLink to="/collaborations">{t('nav.collaborations')}</NavLink>
            <NavLink to="/influencers">{t('nav.influencers')}</NavLink>
            <NavLink to="/pricing">{t('nav.pricing')}</NavLink>
          </nav>

          {/* Right Side */}
          <div className="flex items-center gap-4">
            {/* Language Toggle */}
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleLanguage}
              className="flex items-center gap-1"
              data-testid="language-toggle"
            >
              <Globe className="w-4 h-4" />
              <span className="uppercase font-medium">{language}</span>
            </Button>

            {/* Auth Buttons / User Menu */}
            {isAuthenticated ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="flex items-center gap-2" data-testid="user-menu">
                    <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center">
                      {user?.picture ? (
                        <img src={user.picture} alt="" className="w-6 h-6 rounded-full" />
                      ) : (
                        <User className="w-4 h-4 text-primary" />
                      )}
                    </div>
                    <span className="hidden sm:inline text-sm">{user?.name?.split(' ')[0]}</span>
                    <ChevronDown className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem onClick={() => navigate('/dashboard')} data-testid="nav-dashboard">
                    <LayoutDashboard className="w-4 h-4 mr-2" />
                    {t('nav.dashboard')}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate('/profile')} data-testid="nav-profile">
                    <User className="w-4 h-4 mr-2" />
                    {t('nav.profile')}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLogout} data-testid="nav-logout">
                    <LogOut className="w-4 h-4 mr-2" />
                    {t('nav.logout')}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <div className="hidden md:flex items-center gap-3">
                <Button
                  variant="ghost"
                  onClick={() => navigate('/login')}
                  data-testid="nav-login"
                >
                  {t('nav.login')}
                </Button>
                <Button
                  onClick={() => navigate('/register')}
                  className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-full"
                  data-testid="nav-register"
                >
                  {t('nav.register')}
                </Button>
              </div>
            )}

            {/* Mobile Menu Button */}
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              data-testid="mobile-menu-toggle"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </Button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden py-4 border-t border-border">
            <nav className="flex flex-col gap-2">
              <NavLink to="/">{t('nav.home')}</NavLink>
              <NavLink to="/collaborations">{t('nav.collaborations')}</NavLink>
              <NavLink to="/influencers">{t('nav.influencers')}</NavLink>
              <NavLink to="/pricing">{t('nav.pricing')}</NavLink>
              {!isAuthenticated && (
                <div className="flex flex-col gap-2 pt-4 border-t border-border mt-2">
                  <Button
                    variant="outline"
                    onClick={() => { navigate('/login'); setMobileMenuOpen(false); }}
                  >
                    {t('nav.login')}
                  </Button>
                  <Button
                    onClick={() => { navigate('/register'); setMobileMenuOpen(false); }}
                    className="bg-primary text-primary-foreground"
                  >
                    {t('nav.register')}
                  </Button>
                </div>
              )}
            </nav>
          </div>
        )}
      </div>
    </header>
  );
};

export const Footer = () => {
  const { t } = useLanguage();
  
  return (
    <footer className="bg-foreground text-muted py-16">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12">
          {/* Logo & Description */}
          <div className="md:col-span-2">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-lg">C</span>
              </div>
              <span className="font-heading font-bold text-xl text-white">
                colaboreaza.ro
              </span>
            </div>
            <p className="text-muted-foreground/70 max-w-sm">
              Piața de colaborări unde brandurile și creatorii se întâlnesc. Transparent. Rapid. Eficient.
            </p>
          </div>

          {/* Links */}
          <div>
            <h4 className="text-white font-semibold mb-4">Links</h4>
            <ul className="space-y-2 text-muted-foreground/70">
              <li><Link to="/collaborations" className="hover:text-white transition-colors">{t('nav.collaborations')}</Link></li>
              <li><Link to="/influencers" className="hover:text-white transition-colors">{t('nav.influencers')}</Link></li>
              <li><Link to="/pricing" className="hover:text-white transition-colors">{t('nav.pricing')}</Link></li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="text-white font-semibold mb-4">Legal</h4>
            <ul className="space-y-2 text-muted-foreground/70">
              <li><a href="#" className="hover:text-white transition-colors">Termeni și Condiții</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Politica de Confidențialitate</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Contact</a></li>
            </ul>
          </div>
        </div>

        <div className="border-t border-white/10 mt-12 pt-8 text-center text-muted-foreground/50 text-sm">
          © {new Date().getFullYear()} colaboreaza.ro. Toate drepturile rezervate.
        </div>
      </div>
    </footer>
  );
};
