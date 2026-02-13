# colaboreaza.ro - Product Requirements Document

## Original Problem Statement
Build a web-based platform called "colaboreaza.ro", a reverse influencer marketplace where brands post public collaboration offers and influencers apply to them. The platform should prioritize speed, transparency, and viral growth.

## Architecture
- **Backend:** Node.js/Express.js (MERN Stack), MongoDB via native driver, JWT Auth + Emergent Google OAuth
- **Frontend:** React, Tailwind CSS, Shadcn UI, i18next (RO/EN)
- **Database:** MongoDB (test_database)
- **Payments:** Escrow system (MOCK provider, ready for Netopia/Stripe Connect)

## Recent Migration (Dec 2025)
- ✅ Complete backend migration from Python/FastAPI to Node.js/Express.js
- ✅ All 58 API endpoints ported and verified
- ✅ 100% test pass rate

## User Roles
- **Brand:** Create/manage collaborations, secure escrow payments, view applicants, review influencers, message creators
- **Influencer:** Create public profile, browse/apply for collaborations, manage social posts, review brands, message brands
- **Admin:** Moderate users/collaborations, manage commission rates, resolve disputes/cancellations

## Completed Features

### Phase 1 - Core
- [x] JWT email/password authentication + Google Social Login
- [x] Brand & Influencer Dashboards
- [x] Public collaboration board with search
- [x] Public shareable influencer profiles
- [x] Landing page with live stats
- [x] Internationalization (RO/EN)

### Phase 2
- [x] Admin panel for moderation
- [x] Full-text search
- [x] PRO Analytics dashboard
- [x] SMTP Email notifications infrastructure (needs SMTP credentials)

### Phase 3
- [x] Mutual feedback/rating system with simultaneous reveal
- [x] "Top 10 Influencers" leaderboard

### Phase 4
- [x] Social media post embedding (oEmbed)
- [x] Automated commission system (configurable, default 10%)

### Phase 5 - Escrow & Trust System
- [x] Escrow payment flow (create → secure → complete → release)
- [x] Collaboration types: paid (escrow mandatory), barter, free
- [x] Confirmation window (completed_pending_release)
- [x] Reviews gated behind payment release
- [x] Mutual review reveal (hidden until both submit or 14-day timeout)

### Phase 6 - Cancellations, Disputes & Messaging
- [x] Cancellation system (before work = instant refund, in_progress = admin review)
- [x] Dispute system (only in completed_pending_release, blocks release, locks messaging)
- [x] Collaboration-based messaging (text only, after acceptance)
- [x] Admin dispute resolution (release/refund/split)
- [x] Admin cancellation resolution (refund/partial/continue)

### Phase 7 - Auth-Gated Collaboration Visibility
- [x] Teaser + lock pattern on collaborations page (first 2 visible, rest locked)
- [x] Collaboration detail teaser (budget, platform, countdown visible; description blurred)
- [x] Auth CTA overlay with "Creează cont gratuit" / "Am deja un cont"
- [x] Post-login redirect to exact collaboration via ?redirect= param
- [x] Homepage and influencer profiles NOT gated

## Pending / Known Issues
- Email notifications: needs SMTP credentials
- Escrow payment provider: MOCK - needs Netopia API keys for production

## Backlog / Future Tasks
- **P1: Netopia Payment Integration** - real payment processing
- **P2: Gamification Badges** - "Top Rated", "Verified" badges
- **P2: Stripe Connect** - international payments
- **P3: Complex Dispute Workflow** - evidence upload, timeline
- **Refactoring:** Modularize server.py

## Key API Endpoints
- `/api/auth/{register, login, me, session, logout}`
- `/api/collaborations` (CRUD, search, status, cancel)
- `/api/escrow/{create, secure, release, refund, collab}`
- `/api/disputes/{create, collab}`
- `/api/messages/{collab_id}` (send, list)
- `/api/applications`, `/api/influencers`, `/api/reviews`
- `/api/admin/{stats, users, collaborations, reports, commissions, disputes, cancellations}`
- `/api/settings/commission`

## DB Collections
users, influencer_profiles, brand_profiles, collaborations, applications,
reviews, reports, payment_transactions, user_sessions,
escrow_payments, commissions, settings, disputes, cancellations, messages

## Test Credentials
- Brand: testbrand_new@test.com / TestPass123
- Influencer: testinfluencer_new@test.com / TestPass123 (username: testcreator)
- Admin: admin2@colaboreaza.ro / AdminPass123

## Test Reports
- /app/test_reports/iteration_1.json through iteration_7.json
