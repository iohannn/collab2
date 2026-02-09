# colaboreaza.ro - Product Requirements Document

## Original Problem Statement
Build a web-based platform called "colaboreaza.ro", a reverse influencer marketplace where brands post public collaboration offers and influencers apply to them. The platform should prioritize speed, transparency, and viral growth.

## Architecture
- **Backend:** FastAPI (Python), MongoDB via Motor, JWT Auth + Emergent Google OAuth
- **Frontend:** React, Tailwind CSS, Shadcn UI, i18next (RO/EN)
- **Database:** MongoDB (test_database)
- **Payments:** Escrow system (MOCK provider, ready for Netopia/Stripe Connect)

## User Roles
- **Brand:** Create/manage collaborations, secure escrow payments, view applicants, review influencers
- **Influencer:** Create public profile, browse/apply for collaborations, manage social posts, review brands
- **Admin:** Moderate users/collaborations, manage commission rates, view reports, manage escrow

## Completed Features

### Phase 1 - Core (Complete)
- [x] JWT email/password authentication
- [x] Google Social Login (Emergent-managed)
- [x] Brand Dashboard (create/manage collaborations, view applicants)
- [x] Influencer Dashboard (profile management, apply for collaborations)
- [x] Public collaboration board with search
- [x] Public shareable influencer profiles
- [x] Landing page with live stats
- [x] Internationalization (RO/EN)

### Phase 2 (Complete)
- [x] Admin panel for moderation
- [x] Full-text search for collaborations
- [x] PRO Analytics dashboard (brand + influencer)
- [x] SMTP Email notifications infrastructure (needs user SMTP credentials)
- [x] Stripe payment integration (test mode) for PRO plans

### Phase 3 (Complete)
- [x] Mutual feedback/rating system with simultaneous reveal
- [x] "Top 10 Influencers" leaderboard based on ratings

### Phase 4 (Complete)
- [x] Social media post embedding (oEmbed for YouTube, TikTok, Instagram)
- [x] SocialPostsEditor in influencer dashboard
- [x] SocialPostsCarousel on public influencer profiles
- [x] Automated commission system (configurable rate, default 10%)
- [x] Admin commission management tab

### Phase 5 - Escrow & Trust System (Complete - Feb 2025)
- [x] Escrow payment flow (create → secure → complete → release)
- [x] Collaboration types: paid (escrow mandatory), barter, free
- [x] Payment status tracking: awaiting_escrow → secured → completed_pending_release → released
- [x] Confirmation window before fund release (completed_pending_release state)
- [x] Escrow refund capability
- [x] Commission auto-calculation on fund release
- [x] Reviews gated behind payment release (paid collabs) or completion (free/barter)
- [x] Mutual review reveal: hidden until both parties submit or 14-day timeout
- [x] Trust UX: "Fonduri securizate", "Colaborare protejată", "Payout garantat"
- [x] Brand dashboard tabs: Active, Eliberare, Finalizate, Închise
- [x] Payment protection banners on collaboration detail pages
- [x] Escrow status badges on collaboration cards

## Pending / Known Issues
- Email notifications: Infrastructure ready, user needs to configure SMTP credentials (EMAIL_ENABLED=false)
- Escrow payment provider: Currently MOCK - needs Netopia API keys for production
- Frontend lint warnings (useEffect dependencies) - cosmetic only

## Backlog / Future Tasks
- **P1: Netopia Payment Integration** - Replace mock provider with Netopia API for real payments (requires API keys)
- **P2: Gamification Badges** - Award badges ("Top Rated", "Verified") to influencer profiles
- **P2: Stripe Connect** - Future migration path for international payments
- **P3: Dispute Resolution** - Workflow for handling payment disputes
- **Refactoring:** Break down server.py monolith into modular structure

## Key API Endpoints
- `/api/auth/{register, login, me, session, logout}`
- `/api/collaborations` (CRUD, search, status management)
- `/api/escrow/create/{collab_id}` - Create escrow for paid collaboration
- `/api/escrow/{escrow_id}/secure` - Secure funds (mock/Netopia)
- `/api/escrow/{escrow_id}/release` - Release funds after confirmation
- `/api/escrow/{escrow_id}/refund` - Refund escrowed funds
- `/api/escrow/collab/{collab_id}` - Get escrow status
- `/api/applications` (create, list, status management)
- `/api/influencers/{profile, top, list, {username}}`
- `/api/reviews` (mutual reveal system)
- `/api/admin/{stats, users, collaborations, reports, commissions}`
- `/api/settings/commission` (GET/PUT, admin only)

## DB Collections
- users, influencer_profiles, brand_profiles, collaborations, applications
- reviews (with is_revealed field), reports, payment_transactions, user_sessions
- escrow_payments, commissions, settings

## Escrow Flow
```
Brand creates paid collab → payment_status: awaiting_escrow
Brand creates escrow → status: pending
Brand secures funds → status: secured, collab payment_status: secured
Brand marks completed → collab status: completed_pending_release (48h window)
Brand releases funds → collab status: completed, payment_status: released
Commission recorded → Reviews unlocked (mutual reveal)
```

## Test Credentials
- Brand: testbrand_new@test.com / TestPass123 (is_pro=true)
- Influencer: testinfluencer_new@test.com / TestPass123 (username: testcreator)
- Admin: admin2@colaboreaza.ro / AdminPass123 (is_admin=true)

## Test Reports
- /app/test_reports/iteration_1.json through iteration_5.json
