# colaboreaza.ro - Product Requirements Document

## Overview
**Product Name:** colaboreaza.ro  
**Type:** Reverse Influencer Marketplace MVP  
**Date Created:** 2026-02-05  
**Last Updated:** 2026-02-09  
**Status:** MVP Complete + Phase 2 Features

---

## Original Problem Statement
Build a web-based platform called "colaboreaza.ro" - a reverse influencer marketplace where:
- Brands post collaboration offers publicly
- Influencers apply to those offers
- Prices, deliverables, and deadlines are transparent
- Collaborations are closed fast (48h max)

**User Choices:**
- Authentication: Both JWT email/password + Google OAuth
- Design Theme: Light/neutral (trust-focused, minimal)
- Language: Romanian default + English with language switcher
- Monetization: Stripe test mode integration

---

## User Personas

### Brand Users
- Marketing managers looking for influencer partnerships
- Small business owners seeking content creators
- Agencies managing multiple campaigns

### Influencer/Creator Users
- Content creators on Instagram, TikTok, YouTube
- Looking for paid brand collaborations
- Want transparent pricing and quick deals

### Admin Users
- Platform moderators
- User management and support
- Report handling

---

## Core Requirements

### Authentication
- [x] Email/password registration and login
- [x] Google OAuth via Emergent Auth
- [x] JWT tokens for session management
- [x] Protected routes for dashboards
- [x] Admin role support

### Brand Features
- [x] Create collaborations with full details
- [x] Set budget (min/max), deadline, platform
- [x] Define deliverables
- [x] View and manage applicants
- [x] Accept/reject applications
- [x] Track active/closed/completed collaborations
- [x] Analytics dashboard (PRO)

### Influencer Features
- [x] Create and edit public profile
- [x] Set pricing (per post, story, bundle)
- [x] Add platforms and niches
- [x] Browse public collaborations
- [x] Apply to collaborations
- [x] Track application status
- [x] Analytics dashboard (PRO)

### Public Features
- [x] View collaborations without login (FOMO)
- [x] SEO-friendly influencer profile URLs
- [x] Countdown timers on collaborations
- [x] Applicant count display
- [x] Platform filtering
- [x] Full-text search (title, brand, description, deliverables)

### Monetization
- [x] Stripe integration in test mode
- [x] PRO plan for brands (€29/month)
- [x] Featured placement for influencers (€9/week)
- [x] Payment status polling

### Admin Features (NEW)
- [x] Admin dashboard with platform stats
- [x] User management (search, filter, ban, give PRO)
- [x] Collaboration moderation (view, delete)
- [x] Report handling system (dismiss, warn, ban)

### Email Notifications (NEW)
- [x] SMTP-based email service (cPanel compatible)
- [x] New application notification to brands
- [x] Application status change notification to influencers
- [x] Configurable via environment variables

### Analytics (NEW)
- [x] PRO-only feature with upgrade prompt
- [x] Brand analytics: views, applicants, conversion rate
- [x] Influencer analytics: success rate, profile views, earnings
- [x] Platform breakdown charts
- [x] Monthly trend visualization
- [x] Application status breakdown

---

## What's Been Implemented

### Phase 1 (2026-02-05)
- Complete REST API with 15+ endpoints
- JWT authentication + Google OAuth
- User, Collaboration, Application, Payment models
- Stripe checkout integration
- Landing page, Auth pages, Dashboards
- Public profiles and collaboration listings
- Romanian/English language switcher

### Phase 2 (2026-02-09)
- Full-text search on collaborations
- Admin panel with moderation tools
- Analytics dashboard for PRO users
- Email notification system (SMTP)
- Report user functionality
- View tracking on collaborations
- **Review/Feedback System**
  - Brands rate influencers after completed collaborations
  - Influencers rate brands
  - Star rating (1-5) with optional comment
  - Average rating calculated and displayed on profiles
- **Top 10 Influencers Leaderboard**
  - Displayed on landing page
  - Sorted by average rating
  - Shows rank, rating, review count, price

---

## Technical Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 19, Tailwind CSS, Shadcn/UI |
| Backend | FastAPI, Python |
| Database | MongoDB |
| Auth | JWT + Emergent Google OAuth |
| Payments | Stripe (test mode) |
| Email | SMTP (cPanel compatible) |
| Hosting | Kubernetes (Emergent) |

---

## API Endpoints Summary

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/auth/register | Register new user |
| POST | /api/auth/login | Login with email/password |
| POST | /api/auth/session | Exchange Google OAuth session |
| GET | /api/auth/me | Get current user |
| POST | /api/auth/logout | Logout |

### Profiles
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET/POST | /api/brands/profile | Brand profile |
| GET/POST | /api/influencers/profile | Influencer profile |
| GET | /api/influencers/{username} | Public profile |
| GET | /api/influencers | List influencers |

### Collaborations
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/collaborations | Create collaboration |
| GET | /api/collaborations | List (with search) |
| GET | /api/collaborations/my | User's collaborations |
| GET | /api/collaborations/{id} | Single collaboration |
| PATCH | /api/collaborations/{id}/status | Update status |

### Applications
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/applications | Apply to collaboration |
| GET | /api/applications/my | My applications |
| GET | /api/applications/collab/{id} | Collaboration applications |
| PATCH | /api/applications/{id}/status | Accept/reject |

### Payments
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/payments/checkout | Create Stripe checkout |
| GET | /api/payments/status/{id} | Check payment status |

### Admin (NEW)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/admin/stats | Platform statistics |
| GET | /api/admin/users | List all users |
| PATCH | /api/admin/users/{id} | Update user |
| GET | /api/admin/collaborations | List all collaborations |
| DELETE | /api/admin/collaborations/{id} | Delete collaboration |
| GET | /api/admin/reports | List reports |
| PATCH | /api/admin/reports/{id} | Resolve report |

### Analytics (NEW)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/analytics/brand | Brand analytics (PRO) |
| GET | /api/analytics/influencer | Influencer analytics (PRO) |

### Reviews (NEW)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/reviews | Create a review |
| GET | /api/reviews/user/{id} | Get reviews for a user |
| GET | /api/reviews/application/{id} | Get reviews for application |
| GET | /api/reviews/pending | Get pending reviews |
| GET | /api/influencers/top | Top 10 influencers by rating |

### Other
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/reports | Report a user |
| GET | /api/stats/public | Public stats |

---

## Environment Configuration

```env
# Database
MONGO_URL=mongodb://localhost:27017
DB_NAME=test_database

# Auth
JWT_SECRET=your-secret-key
ADMIN_EMAILS=admin@colaboreaza.ro

# Payments
STRIPE_API_KEY=sk_test_xxx

# Email (cPanel SMTP)
SMTP_HOST=localhost
SMTP_PORT=587
SMTP_USER=your-email@domain.com
SMTP_PASSWORD=your-password
SMTP_FROM_EMAIL=noreply@colaboreaza.ro
SMTP_FROM_NAME=colaboreaza.ro
EMAIL_ENABLED=true
```

---

## Prioritized Backlog

### P0 - Next Sprint
- [ ] Social media verification (connect accounts)
- [ ] Direct messaging between brands and influencers
- [ ] Webhook for real-time payment updates

### P1 - High Priority
- [ ] Advanced filtering (budget range, audience size)
- [ ] Saved collaborations/bookmarks
- [ ] Export data to CSV

### P2 - Medium Priority
- [ ] Portfolio/media uploads
- [ ] Review/rating system after collaboration
- [ ] Campaign templates for brands

### P3 - Nice to Have
- [ ] Mobile app (React Native)
- [ ] AI-powered matching suggestions
- [ ] Bulk collaboration management

---

## Next Actions

1. **Enable email notifications** - Configure SMTP settings in .env for cPanel
2. **Add social verification** - Allow influencers to verify their social accounts
3. **Direct messaging** - Enable communication between brands and influencers
4. **Advanced filters** - Budget range slider, audience size filters
5. **Webhook integration** - Real-time payment status updates
