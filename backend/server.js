require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const { MongoClient } = require('mongodb');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const axios = require('axios');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 8001;

// Config
const MONGO_URL = process.env.MONGO_URL;
const DB_NAME = process.env.DB_NAME;
const JWT_SECRET = process.env.JWT_SECRET || 'colaboreaza-secret-key-2024';
const JWT_ALGORITHM = 'HS256';
const JWT_EXPIRY_DAYS = 7;
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '').split(',');
const DEFAULT_COMMISSION_RATE = 10.0;
const EMAIL_ENABLED = (process.env.EMAIL_ENABLED || 'false') === 'true';
const REVIEW_REVEAL_TIMEOUT_DAYS = 14;

// Middleware
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(cookieParser());

// MongoDB
let db;
const mongoClient = new MongoClient(MONGO_URL);

async function connectDB() {
  await mongoClient.connect();
  db = mongoClient.db(DB_NAME);
  console.log('Connected to MongoDB');
}

// ============ HELPERS ============

function genId(prefix) { return `${prefix}_${uuidv4().replace(/-/g, '').slice(0, 12)}`; }
function now() { return new Date().toISOString(); }
function hashPassword(password) { return bcrypt.hashSync(password, 10); }
function verifyPassword(password, hash) { return bcrypt.compareSync(password, hash); }

function createJwtToken(userId, email) {
  return jwt.sign({ user_id: userId, email }, JWT_SECRET, { expiresIn: `${JWT_EXPIRY_DAYS}d` });
}

function decodeJwtToken(token) {
  try { return jwt.verify(token, JWT_SECRET); }
  catch { return null; }
}

async function getCurrentUser(req) {
  const sessionToken = req.cookies?.session_token;
  if (sessionToken) {
    const session = await db.collection('user_sessions').findOne({ session_token: sessionToken }, { projection: { _id: 0 } });
    if (session && new Date(session.expires_at) > new Date()) {
      return await db.collection('users').findOne({ user_id: session.user_id }, { projection: { _id: 0 } });
    }
  }
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    const session = await db.collection('user_sessions').findOne({ session_token: token }, { projection: { _id: 0 } });
    if (session) {
      return await db.collection('users').findOne({ user_id: session.user_id }, { projection: { _id: 0 } });
    }
    const payload = decodeJwtToken(token);
    if (payload) {
      return await db.collection('users').findOne({ user_id: payload.user_id }, { projection: { _id: 0 } });
    }
  }
  return null;
}

async function requireAuth(req, res) {
  const user = await getCurrentUser(req);
  if (!user) { res.status(401).json({ detail: 'Not authenticated' }); return null; }
  return user;
}

async function requireAdmin(req, res) {
  const user = await requireAuth(req, res);
  if (!user) return null;
  if (!user.is_admin && !ADMIN_EMAILS.includes(user.email)) {
    res.status(403).json({ detail: 'Admin access required' }); return null;
  }
  return user;
}

function cleanUser(user) {
  if (!user) return user;
  const { password_hash, _id, ...rest } = user;
  return rest;
}

async function getCommissionRate() {
  const settings = await db.collection('settings').findOne({ key: 'commission_rate' }, { projection: { _id: 0 } });
  return settings ? settings.value : DEFAULT_COMMISSION_RATE;
}

// ============ ROUTER ============
const router = express.Router();

// Health
router.get('/health', (req, res) => res.json({ status: 'healthy' }));

// ============ AUTH ============

router.post('/auth/register', async (req, res) => {
  try {
    const { email, password, name, user_type = 'influencer' } = req.body;
    const existing = await db.collection('users').findOne({ email });
    if (existing) return res.status(400).json({ detail: 'Email already registered' });

    const user_id = genId('user');
    const is_admin = ADMIN_EMAILS.includes(email);
    const userDoc = {
      user_id, email, name, password_hash: hashPassword(password),
      user_type, picture: null, is_pro: false, pro_expires_at: null,
      is_admin, created_at: now()
    };
    await db.collection('users').insertOne(userDoc);
    const token = createJwtToken(user_id, email);
    res.json({ token, user: cleanUser(userDoc) });
  } catch (e) { res.status(500).json({ detail: e.message }); }
});

router.post('/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await db.collection('users').findOne({ email });
    if (!user || !verifyPassword(password, user.password_hash || '')) {
      return res.status(401).json({ detail: 'Invalid credentials' });
    }
    const token = createJwtToken(user.user_id, user.email);
    res.json({ token, user: cleanUser(user) });
  } catch (e) { res.status(500).json({ detail: e.message }); }
});

router.post('/auth/session', async (req, res) => {
  try {
    const { session_id } = req.body;
    if (!session_id) return res.status(400).json({ detail: 'session_id required' });

    const authResponse = await axios.get(
      'https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data',
      { headers: { 'X-Session-ID': session_id } }
    );
    const authData = authResponse.data;
    const email = authData.email;
    const name = authData.name || email.split('@')[0];
    const picture = authData.picture;
    const session_token = authData.session_token || `session_${uuidv4().replace(/-/g, '')}`;

    let user = await db.collection('users').findOne({ email });
    const is_admin = ADMIN_EMAILS.includes(email);
    let user_id;

    if (!user) {
      user_id = genId('user');
      user = { user_id, email, name, picture, user_type: 'influencer', is_pro: false, pro_expires_at: null, is_admin, created_at: now() };
      await db.collection('users').insertOne(user);
    } else {
      user_id = user.user_id;
      await db.collection('users').updateOne({ user_id }, { $set: { picture, name, is_admin } });
      user.picture = picture; user.name = name; user.is_admin = is_admin;
    }

    const expires_at = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    await db.collection('user_sessions').deleteMany({ user_id });
    await db.collection('user_sessions').insertOne({ user_id, session_token, expires_at, created_at: now() });

    res.cookie('session_token', session_token, {
      httpOnly: true, secure: true, sameSite: 'none', path: '/', maxAge: 7 * 24 * 60 * 60 * 1000
    });
    res.json({ user: cleanUser(user), session_token });
  } catch (e) { res.status(500).json({ detail: e.message }); }
});

router.get('/auth/me', async (req, res) => {
  const user = await getCurrentUser(req);
  if (!user) return res.status(401).json({ detail: 'Not authenticated' });
  res.json(cleanUser(user));
});

router.post('/auth/logout', async (req, res) => {
  const sessionToken = req.cookies?.session_token;
  if (sessionToken) await db.collection('user_sessions').deleteOne({ session_token: sessionToken });
  res.clearCookie('session_token', { path: '/' });
  res.json({ success: true });
});

// ============ BRAND PROFILE ============

router.get('/brands/profile', async (req, res) => {
  const user = await requireAuth(req, res); if (!user) return;
  const profile = await db.collection('brand_profiles').findOne({ user_id: user.user_id }, { projection: { _id: 0 } });
  res.json(profile || {});
});

router.post('/brands/profile', async (req, res) => {
  const user = await requireAuth(req, res); if (!user) return;
  const profileDict = { ...req.body, user_id: user.user_id };
  const existing = await db.collection('brand_profiles').findOne({ user_id: user.user_id });
  if (existing) await db.collection('brand_profiles').updateOne({ user_id: user.user_id }, { $set: profileDict });
  else await db.collection('brand_profiles').insertOne(profileDict);
  await db.collection('users').updateOne({ user_id: user.user_id }, { $set: { user_type: 'brand' } });
  const { _id, ...clean } = profileDict;
  res.json(clean);
});

// ============ INFLUENCER PROFILE ============

router.get('/influencers/profile', async (req, res) => {
  const user = await requireAuth(req, res); if (!user) return;
  const profile = await db.collection('influencer_profiles').findOne({ user_id: user.user_id }, { projection: { _id: 0 } });
  res.json(profile || {});
});

router.post('/influencers/profile', async (req, res) => {
  try {
    const user = await requireAuth(req, res); if (!user) return;
    const data = req.body;
    const profileDict = { ...data, user_id: user.user_id, badges: [], available: true, previous_collaborations: [] };
    const existing = await db.collection('influencer_profiles').findOne({ user_id: user.user_id });
    if (existing) {
      await db.collection('influencer_profiles').updateOne({ user_id: user.user_id }, { $set: profileDict });
    } else {
      const usernameExists = await db.collection('influencer_profiles').findOne({ username: data.username });
      if (usernameExists) return res.status(400).json({ detail: 'Username already taken' });
      await db.collection('influencer_profiles').insertOne(profileDict);
    }
    await db.collection('users').updateOne({ user_id: user.user_id }, { $set: { user_type: 'influencer' } });
    const { _id, ...clean } = profileDict;
    res.json(clean);
  } catch (e) { res.status(500).json({ detail: e.message }); }
});

router.get('/influencers/top', async (req, res) => {
  const limit = parseInt(req.query.limit) || 10;
  const influencers = await db.collection('influencer_profiles')
    .find({ avg_rating: { $exists: true, $gt: 0 } }, { projection: { _id: 0 } })
    .sort({ avg_rating: -1 }).limit(limit).toArray();
  for (const inf of influencers) {
    inf.user = await db.collection('users').findOne({ user_id: inf.user_id }, { projection: { _id: 0, password_hash: 0 } });
  }
  res.json(influencers);
});

router.get('/influencers', async (req, res) => {
  const { platform, niche, available = 'true', limit = '20', skip = '0' } = req.query;
  const query = { available: available !== 'false' };
  if (platform) query.platforms = platform;
  if (niche) query.niches = niche;
  const profiles = await db.collection('influencer_profiles').find(query, { projection: { _id: 0 } })
    .skip(parseInt(skip)).limit(parseInt(limit)).toArray();
  res.json(profiles);
});

router.get('/influencers/:username', async (req, res) => {
  const profile = await db.collection('influencer_profiles').findOne({ username: req.params.username }, { projection: { _id: 0 } });
  if (!profile) return res.status(404).json({ detail: 'Influencer not found' });
  const user = await db.collection('users').findOne({ user_id: profile.user_id }, { projection: { _id: 0, password_hash: 0 } });
  const reviews = await db.collection('reviews').find(
    { reviewed_user_id: profile.user_id, reviewer_type: 'brand', is_revealed: true }, { projection: { _id: 0 } }
  ).sort({ created_at: -1 }).limit(5).toArray();
  res.json({ ...profile, user, reviews });
});

// ============ OEMBED ============

router.get('/oembed', async (req, res) => {
  const { url } = req.query;
  const endpoints = { youtube: 'https://www.youtube.com/oembed', tiktok: 'https://www.tiktok.com/oembed', instagram: 'https://api.instagram.com/oembed' };
  let platform = null;
  if (url.includes('youtube.com') || url.includes('youtu.be')) platform = 'youtube';
  else if (url.includes('tiktok.com')) platform = 'tiktok';
  else if (url.includes('instagram.com')) platform = 'instagram';
  if (!platform) return res.status(400).json({ detail: 'Unsupported URL' });
  try {
    const resp = await axios.get(endpoints[platform], { params: { url, format: 'json', maxwidth: 500 }, timeout: 10000 });
    const d = resp.data;
    res.json({ platform, title: d.title || '', author_name: d.author_name || '', author_url: d.author_url || '', thumbnail_url: d.thumbnail_url || '', html: d.html || '', width: d.width, height: d.height });
  } catch {
    res.json({ platform, url, html: null, error: 'Could not fetch embed data' });
  }
});

// ============ COLLABORATIONS ============

router.post('/collaborations', async (req, res) => {
  try {
    const user = await requireAuth(req, res); if (!user) return;
    const data = req.body;
    if (!user.is_pro) {
      const activeCount = await db.collection('collaborations').countDocuments({ brand_user_id: user.user_id, status: 'active' });
      if (activeCount >= 3) return res.status(403).json({ detail: 'Free users limited to 3 active collaborations. Upgrade to PRO!' });
    }
    const collab_id = genId('collab');
    const is_paid = data.collaboration_type === 'paid';
    const collabDoc = {
      collab_id, brand_user_id: user.user_id, brand_name: data.brand_name, title: data.title,
      description: data.description, deliverables: data.deliverables, budget_min: data.budget_min,
      budget_max: data.budget_max || null, deadline: data.deadline, platform: data.platform,
      creators_needed: data.creators_needed || 1, status: 'active', applicants_count: 0, views: 0,
      created_at: now(), is_public: data.is_public !== false, collaboration_type: data.collaboration_type || 'paid',
      payment_status: is_paid ? 'awaiting_escrow' : 'none',
    };
    await db.collection('collaborations').insertOne(collabDoc);
    const { _id, ...clean } = collabDoc;
    res.json(clean);
  } catch (e) { res.status(500).json({ detail: e.message }); }
});

router.get('/collaborations', async (req, res) => {
  const { status = 'active', platform, is_public, search, limit = '20', skip = '0' } = req.query;
  const query = {};
  if (status) query.status = status;
  if (platform) query.platform = platform;
  if (is_public !== 'false') query.is_public = true;
  if (search) {
    query.$or = [
      { title: { $regex: search, $options: 'i' } }, { description: { $regex: search, $options: 'i' } },
      { brand_name: { $regex: search, $options: 'i' } }, { deliverables: { $elemMatch: { $regex: search, $options: 'i' } } }
    ];
  }
  const collabs = await db.collection('collaborations').find(query, { projection: { _id: 0 } })
    .sort({ created_at: -1 }).skip(parseInt(skip)).limit(parseInt(limit)).toArray();
  res.json(collabs);
});

router.get('/collaborations/my', async (req, res) => {
  const user = await requireAuth(req, res); if (!user) return;
  const collabs = await db.collection('collaborations').find({ brand_user_id: user.user_id }, { projection: { _id: 0 } })
    .sort({ created_at: -1 }).toArray();
  res.json(collabs);
});

router.get('/collaborations/:collab_id', async (req, res) => {
  const collab = await db.collection('collaborations').findOne({ collab_id: req.params.collab_id }, { projection: { _id: 0 } });
  if (!collab) return res.status(404).json({ detail: 'Collaboration not found' });
  await db.collection('collaborations').updateOne({ collab_id: req.params.collab_id }, { $inc: { views: 1 } });
  res.json(collab);
});

router.put('/collaborations/:collab_id', async (req, res) => {
  const user = await requireAuth(req, res); if (!user) return;
  const collab = await db.collection('collaborations').findOne({ collab_id: req.params.collab_id });
  if (!collab) return res.status(404).json({ detail: 'Collaboration not found' });
  if (collab.brand_user_id !== user.user_id) return res.status(403).json({ detail: 'Not authorized' });
  await db.collection('collaborations').updateOne({ collab_id: req.params.collab_id }, { $set: req.body });
  res.json({ success: true });
});

router.patch('/collaborations/:collab_id/status', async (req, res) => {
  try {
    const user = await requireAuth(req, res); if (!user) return;
    const { status: newStatus } = req.body;
    const collab = await db.collection('collaborations').findOne({ collab_id: req.params.collab_id });
    if (!collab) return res.status(404).json({ detail: 'Collaboration not found' });
    if (collab.brand_user_id !== user.user_id) return res.status(403).json({ detail: 'Not authorized' });

    const is_paid = (collab.collaboration_type || 'paid') === 'paid';

    if (newStatus === 'completed' && is_paid) {
      const escrow = await db.collection('escrow_payments').findOne({ collab_id: req.params.collab_id, status: 'secured' });
      if (!escrow) return res.status(400).json({ detail: 'Fondurile trebuie securizate înainte de finalizare' });
      const release_at = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
      await db.collection('collaborations').updateOne({ collab_id: req.params.collab_id }, { $set: {
        status: 'completed_pending_release', payment_status: 'completed_pending_release',
        completed_at: now(), release_scheduled_at: release_at
      }});
      await db.collection('escrow_payments').updateOne({ escrow_id: escrow.escrow_id }, { $set: {
        status: 'completed_pending_release', completed_at: now(), release_scheduled_at: release_at
      }});
      return res.json({ success: true, payment_status: 'completed_pending_release', release_scheduled_at: release_at });
    }

    if (newStatus === 'completed' && !is_paid) {
      await db.collection('collaborations').updateOne({ collab_id: req.params.collab_id }, { $set: {
        status: 'completed', payment_status: 'none', completed_at: now()
      }});
      return res.json({ success: true });
    }

    await db.collection('collaborations').updateOne({ collab_id: req.params.collab_id }, { $set: { status: newStatus } });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ detail: e.message }); }
});

// ============ CANCELLATION ============

router.post('/collaborations/:collab_id/cancel', async (req, res) => {
  try {
    const user = await requireAuth(req, res); if (!user) return;
    const { reason = '', details = '' } = req.body;
    const collab = await db.collection('collaborations').findOne({ collab_id: req.params.collab_id });
    if (!collab) return res.status(404).json({ detail: 'Collaboration not found' });

    const is_brand = collab.brand_user_id === user.user_id;
    let is_influencer = false;
    if (!is_brand) {
      const infApp = await db.collection('applications').findOne({ collab_id: req.params.collab_id, influencer_user_id: user.user_id, status: 'accepted' });
      is_influencer = !!infApp;
    }
    if (!is_brand && !is_influencer) return res.status(403).json({ detail: 'Not authorized' });

    const blocked = ['completed_pending_release', 'completed', 'disputed', 'cancelled'];
    if (blocked.includes(collab.status)) return res.status(400).json({ detail: 'Anularea nu mai este posibilă în această etapă. Folosiți sistemul de dispute.' });

    const ts = now();
    if (collab.status === 'active' && ['secured', 'awaiting_escrow', 'none'].includes(collab.payment_status || 'none')) {
      await db.collection('collaborations').updateOne({ collab_id: req.params.collab_id }, { $set: {
        status: 'cancelled', payment_status: collab.payment_status === 'secured' ? 'refunded' : 'none',
        cancelled_at: ts, cancelled_by: user.user_id, cancellation_reason: reason
      }});
      if (collab.payment_status === 'secured') {
        await db.collection('escrow_payments').updateOne({ collab_id: req.params.collab_id, status: 'secured' }, { $set: { status: 'refunded', refunded_at: ts } });
      }
      await db.collection('cancellations').insertOne({
        cancellation_id: genId('cancel'), collab_id: req.params.collab_id, requested_by: user.user_id,
        requester_type: is_brand ? 'brand' : 'influencer', reason, details,
        status: 'completed', resolution: collab.payment_status === 'secured' ? 'full_refund' : 'no_payment', created_at: ts, resolved_at: ts
      });
      return res.json({ success: true, status: 'cancelled', message: 'Colaborare anulată cu succes.' });
    }

    if (collab.status === 'in_progress') {
      const requesterType = is_brand ? 'brand' : 'influencer';
      const cancelStatus = `cancellation_requested_by_${requesterType}`;
      await db.collection('collaborations').updateOne({ collab_id: req.params.collab_id }, { $set: { status: cancelStatus } });
      await db.collection('cancellations').insertOne({
        cancellation_id: genId('cancel'), collab_id: req.params.collab_id, requested_by: user.user_id,
        requester_type: requesterType, reason, details, status: 'pending_admin_review', created_at: ts
      });
      return res.json({ success: true, status: cancelStatus, message: 'Cerere de anulare trimisă. Un admin va analiza situația.' });
    }

    res.status(400).json({ detail: 'Anularea nu este posibilă în starea curentă' });
  } catch (e) { res.status(500).json({ detail: e.message }); }
});

router.get('/cancellations/collab/:collab_id', async (req, res) => {
  await requireAuth(req, res);
  const c = await db.collection('cancellations').findOne({ collab_id: req.params.collab_id }, { projection: { _id: 0 } });
  res.json(c);
});

// ============ DISPUTES ============

router.post('/disputes/create/:collab_id', async (req, res) => {
  try {
    const user = await requireAuth(req, res); if (!user) return;
    const { reason = '', details = '' } = req.body;
    const collab = await db.collection('collaborations').findOne({ collab_id: req.params.collab_id });
    if (!collab) return res.status(404).json({ detail: 'Collaboration not found' });
    if (collab.status !== 'completed_pending_release') return res.status(400).json({ detail: 'Disputele sunt posibile doar în faza de verificare a livrării (completed_pending_release)' });

    const is_brand = collab.brand_user_id === user.user_id;
    let is_influencer = false;
    if (!is_brand) {
      const infApp = await db.collection('applications').findOne({ collab_id: req.params.collab_id, influencer_user_id: user.user_id, status: 'accepted' });
      is_influencer = !!infApp;
    }
    if (!is_brand && !is_influencer) return res.status(403).json({ detail: 'Not authorized' });

    const existing = await db.collection('disputes').findOne({ collab_id: req.params.collab_id, status: { $in: ['open', 'under_review'] } });
    if (existing) return res.status(400).json({ detail: 'O dispută este deja deschisă pentru această colaborare' });

    const ts = now();
    const dispute_id = genId('dispute');
    const infApp = await db.collection('applications').findOne({ collab_id: req.params.collab_id, status: 'accepted' });
    const disputeDoc = {
      dispute_id, collab_id: req.params.collab_id, opened_by: user.user_id,
      opener_type: is_brand ? 'brand' : 'influencer', opener_name: user.name,
      reason, details, status: 'open', created_at: ts, brand_user_id: collab.brand_user_id,
      influencer_user_id: infApp?.influencer_user_id || null
    };
    await db.collection('disputes').insertOne(disputeDoc);
    await db.collection('collaborations').updateOne({ collab_id: req.params.collab_id }, { $set: { status: 'disputed', payment_status: 'disputed', disputed_at: ts } });
    await db.collection('escrow_payments').updateOne({ collab_id: req.params.collab_id, status: 'completed_pending_release' }, { $set: { status: 'disputed', disputed_at: ts } });
    await db.collection('messages').updateMany({ collab_id: req.params.collab_id }, { $set: { thread_locked: true } });

    const { _id, ...clean } = disputeDoc;
    res.json(clean);
  } catch (e) { res.status(500).json({ detail: e.message }); }
});

router.get('/disputes/collab/:collab_id', async (req, res) => {
  await requireAuth(req, res);
  const d = await db.collection('disputes').findOne({ collab_id: req.params.collab_id, status: { $in: ['open', 'under_review'] } }, { projection: { _id: 0 } });
  res.json(d);
});

// ============ ESCROW ============

router.post('/escrow/create/:collab_id', async (req, res) => {
  try {
    const user = await requireAuth(req, res); if (!user) return;
    const collab = await db.collection('collaborations').findOne({ collab_id: req.params.collab_id });
    if (!collab) return res.status(404).json({ detail: 'Collaboration not found' });
    if (collab.brand_user_id !== user.user_id) return res.status(403).json({ detail: 'Not authorized' });
    if ((collab.collaboration_type || 'paid') !== 'paid') return res.status(400).json({ detail: 'Escrow only for paid collaborations' });
    const existing = await db.collection('escrow_payments').findOne({ collab_id: req.params.collab_id, status: { $in: ['pending', 'secured'] } });
    if (existing) return res.status(400).json({ detail: 'Escrow already exists for this collaboration' });

    const rate = await getCommissionRate();
    const budget = collab.budget_max || collab.budget_min || 0;
    const commission = Math.round(budget * rate / 100 * 100) / 100;
    const influencer_payout = Math.round((budget - commission) * 100) / 100;

    const escrow_id = genId('escrow');
    const escrowDoc = {
      escrow_id, collab_id: req.params.collab_id, brand_user_id: user.user_id,
      total_amount: budget, influencer_payout, platform_commission: commission,
      commission_rate: rate, payment_status: 'pending', status: 'pending',
      payment_provider: 'mock', payment_reference: null, created_at: now()
    };
    await db.collection('escrow_payments').insertOne(escrowDoc);
    const { _id, ...clean } = escrowDoc;
    res.json(clean);
  } catch (e) { res.status(500).json({ detail: e.message }); }
});

router.post('/escrow/:escrow_id/secure', async (req, res) => {
  try {
    const user = await requireAuth(req, res); if (!user) return;
    const escrow = await db.collection('escrow_payments').findOne({ escrow_id: req.params.escrow_id });
    if (!escrow) return res.status(404).json({ detail: 'Escrow not found' });
    if (escrow.brand_user_id !== user.user_id) return res.status(403).json({ detail: 'Not authorized' });
    if (escrow.status !== 'pending') return res.status(400).json({ detail: 'Escrow is not in pending state' });

    const payment_ref = `pay_${uuidv4().replace(/-/g, '').slice(0, 16)}`;
    await db.collection('escrow_payments').updateOne({ escrow_id: req.params.escrow_id }, { $set: { status: 'secured', payment_reference: payment_ref, secured_at: now() } });
    await db.collection('collaborations').updateOne({ collab_id: escrow.collab_id }, { $set: { payment_status: 'secured', escrow_id: req.params.escrow_id } });
    res.json({ success: true, escrow_id: req.params.escrow_id, status: 'secured', payment_reference: payment_ref, message: 'Fonduri securizate cu succes' });
  } catch (e) { res.status(500).json({ detail: e.message }); }
});

router.get('/escrow/collab/:collab_id', async (req, res) => {
  const user = await requireAuth(req, res); if (!user) return;
  const escrow = await db.collection('escrow_payments').findOne({ collab_id: req.params.collab_id, status: { $nin: ['cancelled'] } }, { projection: { _id: 0 } });
  if (!escrow) return res.json(null);
  const collab = await db.collection('collaborations').findOne({ collab_id: req.params.collab_id });
  if (collab && collab.brand_user_id !== user.user_id && !user.is_admin) {
    return res.json({ escrow_id: escrow.escrow_id, status: escrow.status, total_amount: escrow.total_amount, influencer_payout: escrow.influencer_payout, payment_status: escrow.status });
  }
  res.json(escrow);
});

router.post('/escrow/:escrow_id/release', async (req, res) => {
  try {
    const user = await requireAuth(req, res); if (!user) return;
    const escrow = await db.collection('escrow_payments').findOne({ escrow_id: req.params.escrow_id });
    if (!escrow) return res.status(404).json({ detail: 'Escrow not found' });
    if (escrow.brand_user_id !== user.user_id && !user.is_admin) return res.status(403).json({ detail: 'Not authorized' });
    if (escrow.status !== 'completed_pending_release') return res.status(400).json({ detail: 'Escrow not in release-ready state' });

    const rate = escrow.commission_rate || await getCommissionRate();
    const apps = await db.collection('applications').find({ collab_id: escrow.collab_id, status: 'accepted' }, { projection: { _id: 0 } }).toArray();
    for (const a of apps) {
      const proposed = a.proposed_price || escrow.total_amount || 0;
      const commission = Math.round(proposed * rate / 100 * 100) / 100;
      const net = Math.round((proposed - commission) * 100) / 100;
      await db.collection('commissions').insertOne({
        commission_id: genId('comm'), collab_id: escrow.collab_id, application_id: a.application_id,
        brand_user_id: escrow.brand_user_id, influencer_user_id: a.influencer_user_id,
        gross_amount: proposed, commission_rate: rate, commission_amount: commission,
        net_amount: net, status: 'completed', created_at: now()
      });
    }
    const ts = now();
    await db.collection('escrow_payments').updateOne({ escrow_id: req.params.escrow_id }, { $set: { status: 'released', released_at: ts } });
    await db.collection('collaborations').updateOne({ collab_id: escrow.collab_id }, { $set: { status: 'completed', payment_status: 'released', released_at: ts } });
    res.json({ success: true, status: 'released', message: 'Fonduri eliberate cu succes' });
  } catch (e) { res.status(500).json({ detail: e.message }); }
});

router.post('/escrow/:escrow_id/refund', async (req, res) => {
  try {
    const user = await requireAuth(req, res); if (!user) return;
    const escrow = await db.collection('escrow_payments').findOne({ escrow_id: req.params.escrow_id });
    if (!escrow) return res.status(404).json({ detail: 'Escrow not found' });
    if (escrow.brand_user_id !== user.user_id && !user.is_admin) return res.status(403).json({ detail: 'Not authorized' });
    if (!['secured', 'completed_pending_release'].includes(escrow.status)) return res.status(400).json({ detail: 'Cannot refund in current state' });
    await db.collection('escrow_payments').updateOne({ escrow_id: req.params.escrow_id }, { $set: { status: 'refunded', refunded_at: now() } });
    await db.collection('collaborations').updateOne({ collab_id: escrow.collab_id }, { $set: { payment_status: 'refunded' } });
    res.json({ success: true, status: 'refunded' });
  } catch (e) { res.status(500).json({ detail: e.message }); }
});

// ============ MESSAGES ============

router.post('/messages/:collab_id', async (req, res) => {
  try {
    const user = await requireAuth(req, res); if (!user) return;
    const content = (req.body.content || '').trim();
    if (!content) return res.status(400).json({ detail: 'Message cannot be empty' });
    if (content.length > 2000) return res.status(400).json({ detail: 'Mesajul nu poate depăși 2000 de caractere' });

    const collab = await db.collection('collaborations').findOne({ collab_id: req.params.collab_id });
    if (!collab) return res.status(404).json({ detail: 'Collaboration not found' });
    if (collab.status === 'disputed') return res.status(400).json({ detail: 'Mesajele sunt blocate pe durata disputei' });

    const is_brand = collab.brand_user_id === user.user_id;
    let is_influencer = false;
    if (!is_brand) {
      const infApp = await db.collection('applications').findOne({ collab_id: req.params.collab_id, influencer_user_id: user.user_id, status: 'accepted' });
      is_influencer = !!infApp;
    }
    if (!is_brand && !is_influencer) return res.status(403).json({ detail: 'Not authorized' });

    const allowed = ['active', 'in_progress', 'completed_pending_release', 'completed', 'cancellation_requested_by_brand', 'cancellation_requested_by_influencer'];
    if (!allowed.includes(collab.status)) return res.status(400).json({ detail: 'Mesajele nu sunt disponibile în această etapă' });

    const acceptedApp = await db.collection('applications').findOne({ collab_id: req.params.collab_id, status: 'accepted' });
    if (!acceptedApp) return res.status(400).json({ detail: 'Mesajele sunt disponibile doar după acceptarea unei aplicații' });

    const msgDoc = {
      message_id: genId('msg'), collab_id: req.params.collab_id, sender_id: user.user_id,
      sender_name: user.name, sender_type: is_brand ? 'brand' : 'influencer',
      content, created_at: now(), thread_locked: false
    };
    await db.collection('messages').insertOne(msgDoc);
    const { _id, ...clean } = msgDoc;
    res.json(clean);
  } catch (e) { res.status(500).json({ detail: e.message }); }
});

router.get('/messages/:collab_id', async (req, res) => {
  const user = await requireAuth(req, res); if (!user) return;
  const collab = await db.collection('collaborations').findOne({ collab_id: req.params.collab_id });
  if (!collab) return res.status(404).json({ detail: 'Collaboration not found' });
  const is_brand = collab.brand_user_id === user.user_id;
  let is_influencer = false;
  if (!is_brand) {
    const infApp = await db.collection('applications').findOne({ collab_id: req.params.collab_id, influencer_user_id: user.user_id, status: 'accepted' });
    is_influencer = !!infApp;
  }
  if (!is_brand && !is_influencer && !user.is_admin) return res.status(403).json({ detail: 'Not authorized' });
  const messages = await db.collection('messages').find({ collab_id: req.params.collab_id }, { projection: { _id: 0 } })
    .sort({ created_at: 1 }).skip(parseInt(req.query.skip) || 0).limit(parseInt(req.query.limit) || 100).toArray();
  res.json({ messages, is_locked: collab.status === 'disputed' });
});

// ============ APPLICATIONS ============

router.post('/applications', async (req, res) => {
  try {
    const user = await requireAuth(req, res); if (!user) return;
    const profile = await db.collection('influencer_profiles').findOne({ user_id: user.user_id });
    if (!profile) return res.status(400).json({ detail: 'Please complete your influencer profile first' });
    const data = req.body;
    const existing = await db.collection('applications').findOne({ collab_id: data.collab_id, influencer_user_id: user.user_id });
    if (existing) return res.status(400).json({ detail: 'Already applied to this collaboration' });
    const collab = await db.collection('collaborations').findOne({ collab_id: data.collab_id });
    if (!collab || collab.status !== 'active') return res.status(400).json({ detail: 'Collaboration not available' });

    const appDoc = {
      application_id: genId('app'), collab_id: data.collab_id, influencer_user_id: user.user_id,
      influencer_name: user.name, influencer_username: profile.username || '',
      message: data.message, selected_deliverables: data.selected_deliverables,
      proposed_price: data.proposed_price || null, status: 'pending', created_at: now()
    };
    await db.collection('applications').insertOne(appDoc);
    await db.collection('collaborations').updateOne({ collab_id: data.collab_id }, { $inc: { applicants_count: 1 } });
    const { _id, ...clean } = appDoc;
    res.json(clean);
  } catch (e) { res.status(500).json({ detail: e.message }); }
});

router.get('/applications/my', async (req, res) => {
  const user = await requireAuth(req, res); if (!user) return;
  const apps = await db.collection('applications').find({ influencer_user_id: user.user_id }, { projection: { _id: 0 } }).sort({ created_at: -1 }).toArray();
  for (const a of apps) {
    a.collaboration = await db.collection('collaborations').findOne({ collab_id: a.collab_id }, { projection: { _id: 0 } });
  }
  res.json(apps);
});

router.get('/applications/collab/:collab_id', async (req, res) => {
  const user = await requireAuth(req, res); if (!user) return;
  const collab = await db.collection('collaborations').findOne({ collab_id: req.params.collab_id });
  if (!collab) return res.status(404).json({ detail: 'Collaboration not found' });
  if (collab.brand_user_id !== user.user_id) return res.status(403).json({ detail: 'Not authorized' });
  const apps = await db.collection('applications').find({ collab_id: req.params.collab_id }, { projection: { _id: 0 } }).sort({ created_at: -1 }).toArray();
  for (const a of apps) {
    a.influencer_profile = await db.collection('influencer_profiles').findOne({ user_id: a.influencer_user_id }, { projection: { _id: 0 } });
  }
  res.json(apps);
});

router.patch('/applications/:application_id/status', async (req, res) => {
  try {
    const user = await requireAuth(req, res); if (!user) return;
    const { status: newStatus } = req.body;
    const application = await db.collection('applications').findOne({ application_id: req.params.application_id });
    if (!application) return res.status(404).json({ detail: 'Application not found' });
    const collab = await db.collection('collaborations').findOne({ collab_id: application.collab_id });
    if (collab.brand_user_id !== user.user_id) return res.status(403).json({ detail: 'Not authorized' });
    await db.collection('applications').updateOne({ application_id: req.params.application_id }, { $set: { status: newStatus } });
    if (newStatus === 'accepted') {
      await db.collection('influencer_profiles').updateOne({ user_id: application.influencer_user_id }, { $push: { previous_collaborations: collab.title } });
    }
    res.json({ success: true });
  } catch (e) { res.status(500).json({ detail: e.message }); }
});

// ============ REVIEWS ============

async function updateInfluencerRating(userId) {
  const result = await db.collection('reviews').aggregate([
    { $match: { reviewed_user_id: userId, reviewer_type: 'brand', is_revealed: true } },
    { $group: { _id: null, avg_rating: { $avg: '$rating' }, count: { $sum: 1 } } }
  ]).toArray();
  if (result.length) {
    await db.collection('influencer_profiles').updateOne({ user_id: userId }, { $set: { avg_rating: Math.round(result[0].avg_rating * 10) / 10, review_count: result[0].count } });
  }
}

async function autoRevealTimedOutReviews() {
  const cutoff = new Date(Date.now() - REVIEW_REVEAL_TIMEOUT_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const unrevealed = await db.collection('reviews').find({ is_revealed: false, created_at: { $lt: cutoff } }, { projection: { _id: 0 } }).toArray();
  if (unrevealed.length) {
    const ids = unrevealed.map(r => r.review_id);
    await db.collection('reviews').updateMany({ review_id: { $in: ids } }, { $set: { is_revealed: true } });
    const affected = new Set();
    for (const r of unrevealed) { if (r.reviewer_type === 'brand') affected.add(r.reviewed_user_id); }
    for (const uid of affected) await updateInfluencerRating(uid);
  }
}

router.post('/reviews', async (req, res) => {
  try {
    const user = await requireAuth(req, res); if (!user) return;
    const { application_id, rating, comment } = req.body;
    if (!rating || rating < 1 || rating > 5) return res.status(400).json({ detail: 'Rating must be between 1 and 5' });

    const application = await db.collection('applications').findOne({ application_id });
    if (!application) return res.status(404).json({ detail: 'Application not found' });
    if (application.status !== 'accepted') return res.status(400).json({ detail: 'Can only review accepted collaborations' });

    const collab = await db.collection('collaborations').findOne({ collab_id: application.collab_id });
    if (!collab) return res.status(404).json({ detail: 'Collaboration not found' });

    const is_paid = (collab.collaboration_type || 'paid') === 'paid';
    if (is_paid && collab.payment_status !== 'released') return res.status(400).json({ detail: 'Recenziile sunt disponibile doar după eliberarea fondurilor' });
    if (!is_paid && !['completed', 'completed_pending_release'].includes(collab.status)) return res.status(400).json({ detail: 'Colaborarea trebuie finalizată înainte de recenzie' });

    const is_brand = collab.brand_user_id === user.user_id;
    const is_influencer = application.influencer_user_id === user.user_id;
    if (!is_brand && !is_influencer) return res.status(403).json({ detail: 'Not authorized to review this collaboration' });

    const existing = await db.collection('reviews').findOne({ application_id, reviewer_user_id: user.user_id });
    if (existing) return res.status(400).json({ detail: 'Already reviewed this collaboration' });

    const reviewer_type = is_brand ? 'brand' : 'influencer';
    const reviewed_user_id = is_brand ? application.influencer_user_id : collab.brand_user_id;

    const reviewDoc = {
      review_id: genId('review'), application_id, collab_id: collab.collab_id,
      reviewer_user_id: user.user_id, reviewer_name: user.name, reviewer_type,
      reviewed_user_id, rating, comment: comment || null,
      collab_title: collab.title, is_revealed: false, created_at: now()
    };
    await db.collection('reviews').insertOne(reviewDoc);

    const otherReview = await db.collection('reviews').findOne({ application_id, reviewer_user_id: { $ne: user.user_id } });
    if (otherReview) {
      await db.collection('reviews').updateMany({ application_id }, { $set: { is_revealed: true } });
      await updateInfluencerRating(application.influencer_user_id);
    }

    const { _id, ...clean } = reviewDoc;
    res.json(clean);
  } catch (e) { res.status(500).json({ detail: e.message }); }
});

router.get('/reviews/user/:user_id', async (req, res) => {
  await autoRevealTimedOutReviews();
  const reviews = await db.collection('reviews').find(
    { reviewed_user_id: req.params.user_id, is_revealed: true }, { projection: { _id: 0 } }
  ).sort({ created_at: -1 }).skip(parseInt(req.query.skip) || 0).limit(parseInt(req.query.limit) || 20).toArray();
  res.json(reviews);
});

router.get('/reviews/application/:application_id', async (req, res) => {
  const reviews = await db.collection('reviews').find({ application_id: req.params.application_id }, { projection: { _id: 0 } }).toArray();
  res.json(reviews);
});

router.get('/reviews/pending', async (req, res) => {
  const user = await requireAuth(req, res); if (!user) return;
  const pending = [];
  const canReview = (c) => {
    const is_paid = (c.collaboration_type || 'paid') === 'paid';
    return is_paid ? c.payment_status === 'released' : ['completed', 'completed_pending_release'].includes(c.status);
  };

  if (user.user_type === 'brand') {
    const collabs = await db.collection('collaborations').find({ brand_user_id: user.user_id, status: { $in: ['completed', 'completed_pending_release'] } }, { projection: { _id: 0 } }).toArray();
    for (const c of collabs) {
      if (!canReview(c)) continue;
      const apps = await db.collection('applications').find({ collab_id: c.collab_id, status: 'accepted' }, { projection: { _id: 0 } }).toArray();
      for (const a of apps) {
        const ex = await db.collection('reviews').findOne({ application_id: a.application_id, reviewer_user_id: user.user_id });
        if (!ex) pending.push({ application: a, collaboration: c });
      }
    }
  } else {
    const apps = await db.collection('applications').find({ influencer_user_id: user.user_id, status: 'accepted' }, { projection: { _id: 0 } }).toArray();
    for (const a of apps) {
      const c = await db.collection('collaborations').findOne({ collab_id: a.collab_id, status: { $in: ['completed', 'completed_pending_release'] } }, { projection: { _id: 0 } });
      if (c && canReview(c)) {
        const ex = await db.collection('reviews').findOne({ application_id: a.application_id, reviewer_user_id: user.user_id });
        if (!ex) pending.push({ application: a, collaboration: c });
      }
    }
  }
  res.json(pending);
});

// ============ COMMISSION ============

router.get('/settings/commission', async (req, res) => {
  const user = await requireAdmin(req, res); if (!user) return;
  res.json({ commission_rate: await getCommissionRate() });
});

router.put('/settings/commission', async (req, res) => {
  const user = await requireAdmin(req, res); if (!user) return;
  const { commission_rate } = req.body;
  if (commission_rate == null || commission_rate < 0 || commission_rate > 100) return res.status(400).json({ detail: 'Commission rate must be between 0 and 100' });
  await db.collection('settings').updateOne({ key: 'commission_rate' }, { $set: { key: 'commission_rate', value: parseFloat(commission_rate), updated_at: now() } }, { upsert: true });
  res.json({ commission_rate: parseFloat(commission_rate) });
});

router.get('/commission/calculate', async (req, res) => {
  const user = await requireAuth(req, res); if (!user) return;
  const amount = parseFloat(req.query.amount);
  const rate = await getCommissionRate();
  const commission = Math.round(amount * rate / 100 * 100) / 100;
  res.json({ gross_amount: amount, commission_rate: rate, commission_amount: commission, net_amount: Math.round((amount - commission) * 100) / 100 });
});

// ============ ADMIN ============

router.get('/admin/stats', async (req, res) => {
  const user = await requireAdmin(req, res); if (!user) return;
  const [totalUsers, totalCollabs, totalApps, pendingApps, totalReviews, totalBrands, totalInfluencers, activeCollabs] = await Promise.all([
    db.collection('users').countDocuments(), db.collection('collaborations').countDocuments(),
    db.collection('applications').countDocuments(), db.collection('applications').countDocuments({ status: 'pending' }),
    db.collection('reviews').countDocuments(), db.collection('users').countDocuments({ user_type: 'brand' }),
    db.collection('users').countDocuments({ user_type: 'influencer' }), db.collection('collaborations').countDocuments({ status: 'active' })
  ]);
  res.json({ total_users: totalUsers, total_collaborations: totalCollabs, total_applications: totalApps, pending_applications: pendingApps, total_reviews: totalReviews, total_brands: totalBrands, total_influencers: totalInfluencers, active_collaborations: activeCollabs });
});

router.get('/admin/users', async (req, res) => {
  const user = await requireAdmin(req, res); if (!user) return;
  const { limit = '50', skip = '0', search } = req.query;
  const query = {};
  if (search) query.$or = [{ name: { $regex: search, $options: 'i' } }, { email: { $regex: search, $options: 'i' } }];
  const users = await db.collection('users').find(query, { projection: { _id: 0, password_hash: 0 } }).skip(parseInt(skip)).limit(parseInt(limit)).toArray();
  const total = await db.collection('users').countDocuments(query);
  res.json({ users, total });
});

router.get('/admin/collaborations', async (req, res) => {
  const user = await requireAdmin(req, res); if (!user) return;
  const collabs = await db.collection('collaborations').find({}, { projection: { _id: 0 } }).sort({ created_at: -1 }).limit(parseInt(req.query.limit) || 50).toArray();
  const total = await db.collection('collaborations').countDocuments();
  res.json({ collaborations: collabs, total });
});

router.get('/admin/reports', async (req, res) => {
  const user = await requireAdmin(req, res); if (!user) return;
  const reports = await db.collection('reports').find({}, { projection: { _id: 0 } }).sort({ created_at: -1 }).limit(parseInt(req.query.limit) || 50).toArray();
  for (const r of reports) {
    r.reporter = await db.collection('users').findOne({ user_id: r.reporter_user_id }, { projection: { _id: 0, password_hash: 0, name: 1 } });
    r.reported_user = await db.collection('users').findOne({ user_id: r.reported_user_id }, { projection: { _id: 0, password_hash: 0, name: 1 } });
  }
  res.json({ reports, total: reports.length });
});

router.patch('/admin/reports/:report_id', async (req, res) => {
  const user = await requireAdmin(req, res); if (!user) return;
  const { status, action } = req.body;
  await db.collection('reports').updateOne({ report_id: req.params.report_id }, { $set: { status, action, resolved_at: now() } });
  res.json({ success: true });
});

router.get('/admin/commissions', async (req, res) => {
  const user = await requireAdmin(req, res); if (!user) return;
  const commissions = await db.collection('commissions').find({}, { projection: { _id: 0 } }).sort({ created_at: -1 }).limit(parseInt(req.query.limit) || 50).toArray();
  const total = await db.collection('commissions').countDocuments();
  const summary = await db.collection('commissions').aggregate([
    { $group: { _id: null, total_commission: { $sum: '$commission_amount' }, total_gross: { $sum: '$gross_amount' } } }
  ]).toArray();
  res.json({ commissions, total, summary: { total_commission: summary[0]?.total_commission || 0, total_gross: summary[0]?.total_gross || 0 } });
});

router.get('/admin/disputes', async (req, res) => {
  const user = await requireAdmin(req, res); if (!user) return;
  const query = {};
  if (req.query.status) query.status = req.query.status;
  const disputes = await db.collection('disputes').find(query, { projection: { _id: 0 } }).sort({ created_at: -1 }).limit(parseInt(req.query.limit) || 50).toArray();
  for (const d of disputes) {
    d.collaboration = await db.collection('collaborations').findOne({ collab_id: d.collab_id }, { projection: { _id: 0, title: 1, brand_name: 1, budget_min: 1, budget_max: 1 } });
    d.escrow = await db.collection('escrow_payments').findOne({ collab_id: d.collab_id }, { projection: { _id: 0, total_amount: 1, influencer_payout: 1, platform_commission: 1 } });
    d.message_history = await db.collection('messages').find({ collab_id: d.collab_id }, { projection: { _id: 0 } }).sort({ created_at: 1 }).toArray();
  }
  const total = await db.collection('disputes').countDocuments(query);
  res.json({ disputes, total });
});

router.patch('/admin/disputes/:dispute_id/resolve', async (req, res) => {
  try {
    const user = await requireAdmin(req, res); if (!user) return;
    const { resolution, admin_notes = '', split_influencer = 0, split_brand = 0 } = req.body;
    const dispute = await db.collection('disputes').findOne({ dispute_id: req.params.dispute_id });
    if (!dispute) return res.status(404).json({ detail: 'Dispute not found' });
    if (dispute.status === 'resolved') return res.status(400).json({ detail: 'Dispute already resolved' });

    const ts = now();
    const escrow = await db.collection('escrow_payments').findOne({ collab_id: dispute.collab_id, status: 'disputed' });

    if (resolution === 'release_to_influencer') {
      if (escrow) {
        const rate = escrow.commission_rate || await getCommissionRate();
        const apps = await db.collection('applications').find({ collab_id: dispute.collab_id, status: 'accepted' }, { projection: { _id: 0 } }).toArray();
        for (const a of apps) {
          const proposed = a.proposed_price || escrow.total_amount || 0;
          const commission = Math.round(proposed * rate / 100 * 100) / 100;
          await db.collection('commissions').insertOne({
            commission_id: genId('comm'), collab_id: dispute.collab_id, application_id: a.application_id,
            brand_user_id: escrow.brand_user_id, influencer_user_id: a.influencer_user_id,
            gross_amount: proposed, commission_rate: rate, commission_amount: commission,
            net_amount: Math.round((proposed - commission) * 100) / 100, status: 'completed', created_at: ts
          });
        }
        await db.collection('escrow_payments').updateOne({ escrow_id: escrow.escrow_id }, { $set: { status: 'released', released_at: ts } });
      }
      await db.collection('collaborations').updateOne({ collab_id: dispute.collab_id }, { $set: { status: 'completed', payment_status: 'released', released_at: ts } });
    } else if (resolution === 'refund_to_brand') {
      if (escrow) await db.collection('escrow_payments').updateOne({ escrow_id: escrow.escrow_id }, { $set: { status: 'refunded', refunded_at: ts } });
      await db.collection('collaborations').updateOne({ collab_id: dispute.collab_id }, { $set: { status: 'cancelled', payment_status: 'refunded', cancelled_at: ts } });
    } else if (resolution === 'split') {
      if (escrow) await db.collection('escrow_payments').updateOne({ escrow_id: escrow.escrow_id }, { $set: { status: 'split_resolved', split_influencer, split_brand, resolved_at: ts } });
      await db.collection('collaborations').updateOne({ collab_id: dispute.collab_id }, { $set: { status: 'completed', payment_status: 'split_resolved' } });
    }

    await db.collection('disputes').updateOne({ dispute_id: req.params.dispute_id }, { $set: { status: 'resolved', resolution, admin_notes, split_influencer: resolution === 'split' ? split_influencer : null, split_brand: resolution === 'split' ? split_brand : null, resolved_at: ts } });
    res.json({ success: true, resolution });
  } catch (e) { res.status(500).json({ detail: e.message }); }
});

router.get('/admin/cancellations', async (req, res) => {
  const user = await requireAdmin(req, res); if (!user) return;
  const cancellations = await db.collection('cancellations').find({}, { projection: { _id: 0 } }).sort({ created_at: -1 }).limit(parseInt(req.query.limit) || 50).toArray();
  for (const c of cancellations) {
    c.collaboration = await db.collection('collaborations').findOne({ collab_id: c.collab_id }, { projection: { _id: 0, title: 1, brand_name: 1, budget_min: 1 } });
  }
  const total = await db.collection('cancellations').countDocuments();
  res.json({ cancellations, total });
});

router.patch('/admin/cancellations/:cancellation_id/resolve', async (req, res) => {
  try {
    const user = await requireAdmin(req, res); if (!user) return;
    const { resolution, admin_notes = '', partial_amount = 0 } = req.body;
    const cancellation = await db.collection('cancellations').findOne({ cancellation_id: req.params.cancellation_id });
    if (!cancellation) return res.status(404).json({ detail: 'Cancellation not found' });
    if (cancellation.status !== 'pending_admin_review') return res.status(400).json({ detail: 'Already resolved' });

    const ts = now();
    if (resolution === 'full_refund') {
      await db.collection('collaborations').updateOne({ collab_id: cancellation.collab_id }, { $set: { status: 'cancelled', payment_status: 'refunded', cancelled_at: ts } });
      await db.collection('escrow_payments').updateOne({ collab_id: cancellation.collab_id, status: { $in: ['secured', 'completed_pending_release'] } }, { $set: { status: 'refunded', refunded_at: ts } });
    } else if (resolution === 'partial_refund') {
      await db.collection('collaborations').updateOne({ collab_id: cancellation.collab_id }, { $set: { status: 'cancelled', payment_status: 'partial_refund', cancelled_at: ts } });
      const escrow = await db.collection('escrow_payments').findOne({ collab_id: cancellation.collab_id, status: { $in: ['secured', 'completed_pending_release'] } });
      if (escrow) await db.collection('escrow_payments').updateOne({ escrow_id: escrow.escrow_id }, { $set: { status: 'partial_refund', partial_refund_amount: partial_amount, refunded_at: ts } });
    } else if (resolution === 'continue') {
      await db.collection('collaborations').updateOne({ collab_id: cancellation.collab_id }, { $set: { status: 'in_progress' } });
    }
    await db.collection('cancellations').updateOne({ cancellation_id: req.params.cancellation_id }, { $set: { status: 'resolved', resolution, admin_notes, partial_amount: resolution === 'partial_refund' ? partial_amount : null, resolved_at: ts } });
    res.json({ success: true, resolution });
  } catch (e) { res.status(500).json({ detail: e.message }); }
});

router.patch('/admin/users/:user_id', async (req, res) => {
  const user = await requireAdmin(req, res); if (!user) return;
  const updates = req.body;
  await db.collection('users').updateOne({ user_id: req.params.user_id }, { $set: updates });
  res.json({ success: true });
});

// ============ ANALYTICS ============

router.get('/analytics/brand', async (req, res) => {
  const user = await requireAuth(req, res); if (!user) return;
  const collabs = await db.collection('collaborations').find({ brand_user_id: user.user_id }, { projection: { _id: 0 } }).toArray();
  const totalApps = await db.collection('applications').countDocuments({ collab_id: { $in: collabs.map(c => c.collab_id) } });
  const acceptedApps = await db.collection('applications').countDocuments({ collab_id: { $in: collabs.map(c => c.collab_id) }, status: 'accepted' });
  const totalViews = collabs.reduce((sum, c) => sum + (c.views || 0), 0);
  res.json({ total_collaborations: collabs.length, total_applications: totalApps, accepted_applications: acceptedApps, total_views: totalViews, active_collaborations: collabs.filter(c => c.status === 'active').length });
});

router.get('/analytics/influencer', async (req, res) => {
  const user = await requireAuth(req, res); if (!user) return;
  const apps = await db.collection('applications').find({ influencer_user_id: user.user_id }, { projection: { _id: 0 } }).toArray();
  const profile = await db.collection('influencer_profiles').findOne({ user_id: user.user_id }, { projection: { _id: 0 } });
  res.json({ total_applications: apps.length, pending: apps.filter(a => a.status === 'pending').length, accepted: apps.filter(a => a.status === 'accepted').length, rejected: apps.filter(a => a.status === 'rejected').length, avg_rating: profile?.avg_rating || 0, review_count: profile?.review_count || 0 });
});

// ============ STATS / REPORTS / PAYMENTS ============

router.get('/stats/public', async (req, res) => {
  const [activeCollabs, totalInfluencers, totalApps] = await Promise.all([
    db.collection('collaborations').countDocuments({ status: 'active' }),
    db.collection('influencer_profiles').countDocuments(),
    db.collection('applications').countDocuments()
  ]);
  res.json({ active_collaborations: activeCollabs, total_influencers: totalInfluencers, total_applications: totalApps });
});

router.post('/reports', async (req, res) => {
  const user = await requireAuth(req, res); if (!user) return;
  const { reported_user_id, reason, details } = req.body;
  const reportDoc = { report_id: genId('report'), reporter_user_id: user.user_id, reported_user_id, reason, details: details || '', status: 'pending', created_at: now() };
  await db.collection('reports').insertOne(reportDoc);
  const { _id, ...clean } = reportDoc;
  res.json(clean);
});

router.post('/payments/checkout', async (req, res) => {
  const user = await requireAuth(req, res); if (!user) return;
  const { plan_type } = req.body;
  const txDoc = { transaction_id: genId('tx'), user_id: user.user_id, session_id: `cs_test_${uuidv4().replace(/-/g, '').slice(0, 24)}`, amount: plan_type === 'pro_monthly' ? 29.99 : plan_type === 'pro_yearly' ? 249.99 : 9.99, currency: 'eur', plan_type, status: 'pending', created_at: now() };
  await db.collection('payment_transactions').insertOne(txDoc);
  const { _id, ...clean } = txDoc;
  res.json(clean);
});

router.get('/payments/status/:session_id', async (req, res) => {
  const user = await requireAuth(req, res); if (!user) return;
  const tx = await db.collection('payment_transactions').findOne({ session_id: req.params.session_id }, { projection: { _id: 0 } });
  if (!tx) return res.status(404).json({ detail: 'Transaction not found' });
  if (tx.status === 'pending') {
    await db.collection('payment_transactions').updateOne({ session_id: req.params.session_id }, { $set: { status: 'completed' } });
    await db.collection('users').updateOne({ user_id: user.user_id }, { $set: { is_pro: true } });
    tx.status = 'completed';
  }
  res.json(tx);
});

// ============ MOUNT ROUTER ============
app.use('/api', router);

// Serve frontend static build when available in containerized deployment
const frontendBuildPath = path.resolve(__dirname, '..', 'frontend', 'build');
if (fs.existsSync(frontendBuildPath)) {
  app.use(express.static(frontendBuildPath));
  app.get(/^\/(?!api).*/, (req, res) => {
    res.sendFile(path.join(frontendBuildPath, 'index.html'));
  });
}

// Start
connectDB().then(() => {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Express server running on port ${PORT}`);
  });
}).catch(err => {
  console.error('Failed to connect to MongoDB:', err);
  process.exit(1);
});
