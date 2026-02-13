from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Depends, Query
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone, timedelta
import bcrypt
import jwt
import httpx
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import asyncio

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT Config
JWT_SECRET = os.environ.get('JWT_SECRET', 'colaboreaza-secret-key-2024')
JWT_ALGORITHM = 'HS256'
JWT_EXPIRY_DAYS = 7

# Stripe
STRIPE_API_KEY = os.environ.get('STRIPE_API_KEY')

# Email Config (for cPanel SMTP)
SMTP_HOST = os.environ.get('SMTP_HOST', 'localhost')
SMTP_PORT = int(os.environ.get('SMTP_PORT', 587))
SMTP_USER = os.environ.get('SMTP_USER', '')
SMTP_PASSWORD = os.environ.get('SMTP_PASSWORD', '')
SMTP_FROM_EMAIL = os.environ.get('SMTP_FROM_EMAIL', 'noreply@colaboreaza.ro')
SMTP_FROM_NAME = os.environ.get('SMTP_FROM_NAME', 'colaboreaza.ro')
EMAIL_ENABLED = os.environ.get('EMAIL_ENABLED', 'false').lower() == 'true'

# Admin Config
ADMIN_EMAILS = os.environ.get('ADMIN_EMAILS', '').split(',')

# Commission Config (default 10%, stored in DB for admin configurability)
DEFAULT_COMMISSION_RATE = 10.0

app = FastAPI(title="colaboreaza.ro API")
api_router = APIRouter(prefix="/api")

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# ============ EMAIL SERVICE ============

async def send_email(to_email: str, subject: str, html_content: str, text_content: str = None):
    """Send email via SMTP (cPanel compatible)"""
    if not EMAIL_ENABLED:
        logger.info(f"Email disabled. Would send to {to_email}: {subject}")
        return False
    
    try:
        msg = MIMEMultipart('alternative')
        msg['Subject'] = subject
        msg['From'] = f"{SMTP_FROM_NAME} <{SMTP_FROM_EMAIL}>"
        msg['To'] = to_email
        
        if text_content:
            msg.attach(MIMEText(text_content, 'plain'))
        msg.attach(MIMEText(html_content, 'html'))
        
        # Run SMTP in thread pool to not block
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(None, _send_smtp, msg, to_email)
        
        logger.info(f"Email sent to {to_email}: {subject}")
        return True
    except Exception as e:
        logger.error(f"Email failed to {to_email}: {e}")
        return False

def _send_smtp(msg, to_email):
    """Synchronous SMTP send"""
    with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
        if SMTP_USER and SMTP_PASSWORD:
            server.starttls()
            server.login(SMTP_USER, SMTP_PASSWORD)
        server.sendmail(SMTP_FROM_EMAIL, to_email, msg.as_string())

async def send_new_application_email(brand_email: str, brand_name: str, collab_title: str, influencer_name: str, influencer_username: str):
    """Email brand when influencer applies"""
    subject = f"Aplicație nouă pentru {collab_title}"
    html_content = f"""
    <html>
    <body style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #FF4F00 0%, #FF6B2C 100%); padding: 30px; border-radius: 12px 12px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 24px;">colaboreaza.ro</h1>
        </div>
        <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
            <h2 style="color: #111827; margin-top: 0;">Aplicație nouă! 🎉</h2>
            <p style="color: #6b7280;">Salut {brand_name},</p>
            <p style="color: #374151;">Ai primit o nouă aplicație pentru colaborarea ta:</p>
            <div style="background: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <p style="margin: 0; color: #111827;"><strong>Colaborare:</strong> {collab_title}</p>
                <p style="margin: 10px 0 0 0; color: #111827;"><strong>Creator:</strong> {influencer_name} (@{influencer_username})</p>
            </div>
            <a href="https://colaboreaza.ro/dashboard" style="display: inline-block; background: #FF4F00; color: white; padding: 12px 24px; border-radius: 50px; text-decoration: none; font-weight: 600;">Vezi aplicația</a>
            <p style="color: #9ca3af; font-size: 12px; margin-top: 30px;">Primești acest email pentru că ai un cont pe colaboreaza.ro</p>
        </div>
    </body>
    </html>
    """
    await send_email(brand_email, subject, html_content)

async def send_application_status_email(influencer_email: str, influencer_name: str, collab_title: str, brand_name: str, status: str):
    """Email influencer when application status changes"""
    status_text = "acceptată" if status == "accepted" else "respinsă"
    emoji = "🎉" if status == "accepted" else "😔"
    color = "#059669" if status == "accepted" else "#dc2626"
    
    subject = f"Aplicația ta a fost {status_text} - {collab_title}"
    html_content = f"""
    <html>
    <body style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #FF4F00 0%, #FF6B2C 100%); padding: 30px; border-radius: 12px 12px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 24px;">colaboreaza.ro</h1>
        </div>
        <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
            <h2 style="color: #111827; margin-top: 0;">Aplicația ta a fost {status_text} {emoji}</h2>
            <p style="color: #6b7280;">Salut {influencer_name},</p>
            <div style="background: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <p style="margin: 0; color: #111827;"><strong>Colaborare:</strong> {collab_title}</p>
                <p style="margin: 10px 0 0 0; color: #111827;"><strong>Brand:</strong> {brand_name}</p>
                <p style="margin: 10px 0 0 0;"><span style="background: {color}; color: white; padding: 4px 12px; border-radius: 50px; font-size: 12px; font-weight: 600;">{status_text.upper()}</span></p>
            </div>
            {"<p style='color: #374151;'>Felicitări! Brandul te va contacta în curând pentru detalii.</p>" if status == "accepted" else "<p style='color: #374151;'>Nu te descuraja! Continuă să aplici la alte colaborări.</p>"}
            <a href="https://colaboreaza.ro/dashboard" style="display: inline-block; background: #FF4F00; color: white; padding: 12px 24px; border-radius: 50px; text-decoration: none; font-weight: 600;">Vezi dashboard</a>
        </div>
    </body>
    </html>
    """
    await send_email(influencer_email, subject, html_content)

# ============ MODELS ============

class UserBase(BaseModel):
    email: EmailStr
    name: str
    picture: Optional[str] = None
    user_type: str = "influencer"

class UserCreate(BaseModel):
    email: EmailStr
    password: str
    name: str
    user_type: str = "influencer"

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class User(UserBase):
    user_id: str
    created_at: datetime
    is_pro: bool = False
    pro_expires_at: Optional[datetime] = None
    is_admin: bool = False

class BrandProfile(BaseModel):
    user_id: str
    company_name: str
    website: Optional[str] = None
    industry: Optional[str] = None
    description: Optional[str] = None
    logo_url: Optional[str] = None
    verified: bool = False

class InfluencerProfile(BaseModel):
    user_id: str
    username: str
    bio: Optional[str] = None
    profile_photo: Optional[str] = None
    niches: List[str] = []
    platforms: List[str] = []
    audience_size: Optional[int] = None
    engagement_rate: Optional[float] = None
    price_per_post: Optional[float] = None
    price_per_story: Optional[float] = None
    price_bundle: Optional[float] = None
    instagram_url: Optional[str] = None
    tiktok_url: Optional[str] = None
    youtube_url: Optional[str] = None
    previous_collaborations: List[str] = []
    badges: List[str] = []
    available: bool = True
    featured_posts: List[str] = []  # URLs to featured social media posts

class InfluencerProfileCreate(BaseModel):
    username: str
    bio: Optional[str] = None
    profile_photo: Optional[str] = None
    niches: List[str] = []
    platforms: List[str] = []
    audience_size: Optional[int] = None
    engagement_rate: Optional[float] = None
    price_per_post: Optional[float] = None
    price_per_story: Optional[float] = None
    price_bundle: Optional[float] = None
    instagram_url: Optional[str] = None
    tiktok_url: Optional[str] = None
    youtube_url: Optional[str] = None
    featured_posts: List[str] = []  # URLs to Instagram, TikTok, YouTube posts

class Collaboration(BaseModel):
    collab_id: str
    brand_user_id: str
    brand_name: str
    title: str
    description: str
    deliverables: List[str]
    budget_min: float
    budget_max: Optional[float] = None
    deadline: datetime
    platform: str
    creators_needed: int
    status: str = "active"
    applicants_count: int = 0
    created_at: datetime
    is_public: bool = True
    views: int = 0

class CollaborationCreate(BaseModel):
    brand_name: str
    title: str
    description: str
    deliverables: List[str]
    budget_min: float
    budget_max: Optional[float] = None
    deadline: datetime
    platform: str
    creators_needed: int = 1
    is_public: bool = True
    collaboration_type: str = "paid"  # "paid", "barter", "free"

class Application(BaseModel):
    application_id: str
    collab_id: str
    influencer_user_id: str
    influencer_name: str
    influencer_username: str
    message: str
    selected_deliverables: List[str]
    proposed_price: Optional[float] = None
    status: str = "pending"
    created_at: datetime

class ApplicationCreate(BaseModel):
    collab_id: str
    message: str
    selected_deliverables: List[str]
    proposed_price: Optional[float] = None

class PaymentTransaction(BaseModel):
    transaction_id: str
    user_id: str
    session_id: str
    amount: float
    currency: str
    plan_type: str
    status: str
    created_at: datetime

class ReportCreate(BaseModel):
    reported_user_id: str
    reason: str
    details: Optional[str] = None

class ReviewCreate(BaseModel):
    application_id: str
    rating: int = Field(..., ge=1, le=5)
    comment: Optional[str] = None

class Review(BaseModel):
    review_id: str
    application_id: str
    collab_id: str
    reviewer_user_id: str
    reviewer_name: str
    reviewer_type: str  # "brand" or "influencer"
    reviewed_user_id: str
    rating: int
    comment: Optional[str]
    collab_title: str
    created_at: datetime

# ============ AUTH HELPERS ============

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))

def create_jwt_token(user_id: str, email: str) -> str:
    payload = {
        'user_id': user_id,
        'email': email,
        'exp': datetime.now(timezone.utc) + timedelta(days=JWT_EXPIRY_DAYS)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def decode_jwt_token(token: str) -> Optional[dict]:
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None

async def get_current_user(request: Request) -> Optional[dict]:
    session_token = request.cookies.get('session_token')
    if session_token:
        session = await db.user_sessions.find_one({'session_token': session_token}, {'_id': 0})
        if session:
            expires_at = session.get('expires_at')
            if isinstance(expires_at, str):
                expires_at = datetime.fromisoformat(expires_at)
            if expires_at.tzinfo is None:
                expires_at = expires_at.replace(tzinfo=timezone.utc)
            if expires_at > datetime.now(timezone.utc):
                user = await db.users.find_one({'user_id': session['user_id']}, {'_id': 0})
                return user
    
    auth_header = request.headers.get('Authorization')
    if auth_header and auth_header.startswith('Bearer '):
        token = auth_header.split(' ')[1]
        session = await db.user_sessions.find_one({'session_token': token}, {'_id': 0})
        if session:
            user = await db.users.find_one({'user_id': session['user_id']}, {'_id': 0})
            return user
        payload = decode_jwt_token(token)
        if payload:
            user = await db.users.find_one({'user_id': payload['user_id']}, {'_id': 0})
            return user
    return None

async def require_auth(request: Request) -> dict:
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return user

async def require_admin(request: Request) -> dict:
    user = await require_auth(request)
    if not user.get('is_admin') and user.get('email') not in ADMIN_EMAILS:
        raise HTTPException(status_code=403, detail="Admin access required")
    return user

# ============ AUTH ENDPOINTS ============

@api_router.post("/auth/register")
async def register(data: UserCreate):
    existing = await db.users.find_one({'email': data.email}, {'_id': 0})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    user_id = f"user_{uuid.uuid4().hex[:12]}"
    is_admin = data.email in ADMIN_EMAILS
    
    user_doc = {
        'user_id': user_id,
        'email': data.email,
        'name': data.name,
        'password_hash': hash_password(data.password),
        'user_type': data.user_type,
        'picture': None,
        'is_pro': False,
        'pro_expires_at': None,
        'is_admin': is_admin,
        'created_at': datetime.now(timezone.utc).isoformat()
    }
    await db.users.insert_one(user_doc)
    
    token = create_jwt_token(user_id, data.email)
    user_response = {k: v for k, v in user_doc.items() if k not in ['password_hash', '_id']}
    return {'token': token, 'user': user_response}

@api_router.post("/auth/login")
async def login(data: UserLogin, response: Response):
    user = await db.users.find_one({'email': data.email}, {'_id': 0})
    if not user or not verify_password(data.password, user.get('password_hash', '')):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    token = create_jwt_token(user['user_id'], user['email'])
    user_response = {k: v for k, v in user.items() if k not in ['password_hash', '_id']}
    return {'token': token, 'user': user_response}

@api_router.post("/auth/session")
async def create_session(request: Request, response: Response):
    body = await request.json()
    session_id = body.get('session_id')
    
    if not session_id:
        raise HTTPException(status_code=400, detail="session_id required")
    
    async with httpx.AsyncClient() as client_http:
        auth_response = await client_http.get(
            "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
            headers={"X-Session-ID": session_id}
        )
        if auth_response.status_code != 200:
            raise HTTPException(status_code=401, detail="Invalid session_id")
        
        auth_data = auth_response.json()
    
    email = auth_data['email']
    name = auth_data.get('name', email.split('@')[0])
    picture = auth_data.get('picture')
    session_token = auth_data.get('session_token', f"session_{uuid.uuid4().hex}")
    
    user = await db.users.find_one({'email': email}, {'_id': 0})
    is_admin = email in ADMIN_EMAILS
    
    if not user:
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        user = {
            'user_id': user_id,
            'email': email,
            'name': name,
            'picture': picture,
            'user_type': 'influencer',
            'is_pro': False,
            'pro_expires_at': None,
            'is_admin': is_admin,
            'created_at': datetime.now(timezone.utc).isoformat()
        }
        await db.users.insert_one(user)
    else:
        user_id = user['user_id']
        await db.users.update_one({'user_id': user_id}, {'$set': {'picture': picture, 'name': name, 'is_admin': is_admin}})
        user['picture'] = picture
        user['name'] = name
        user['is_admin'] = is_admin
    
    expires_at = datetime.now(timezone.utc) + timedelta(days=7)
    await db.user_sessions.delete_many({'user_id': user_id})
    await db.user_sessions.insert_one({
        'user_id': user_id,
        'session_token': session_token,
        'expires_at': expires_at.isoformat(),
        'created_at': datetime.now(timezone.utc).isoformat()
    })
    
    response.set_cookie(
        key="session_token",
        value=session_token,
        httponly=True,
        secure=True,
        samesite="none",
        path="/",
        max_age=7*24*60*60
    )
    
    user_response = {k: v for k, v in user.items() if k not in ['password_hash', '_id']}
    return {'user': user_response, 'session_token': session_token}

@api_router.get("/auth/me")
async def get_me(request: Request):
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    user_response = {k: v for k, v in user.items() if k not in ['password_hash', '_id']}
    return user_response

@api_router.post("/auth/logout")
async def logout(request: Request, response: Response):
    session_token = request.cookies.get('session_token')
    if session_token:
        await db.user_sessions.delete_one({'session_token': session_token})
    response.delete_cookie(key="session_token", path="/")
    return {'success': True}

# ============ BRAND PROFILE ENDPOINTS ============

@api_router.get("/brands/profile")
async def get_brand_profile(request: Request):
    user = await require_auth(request)
    profile = await db.brand_profiles.find_one({'user_id': user['user_id']}, {'_id': 0})
    return profile or {}

@api_router.post("/brands/profile")
async def create_or_update_brand_profile(request: Request, profile: BrandProfile):
    user = await require_auth(request)
    profile_dict = profile.model_dump()
    profile_dict['user_id'] = user['user_id']
    
    existing = await db.brand_profiles.find_one({'user_id': user['user_id']})
    if existing:
        await db.brand_profiles.update_one({'user_id': user['user_id']}, {'$set': profile_dict})
    else:
        await db.brand_profiles.insert_one(profile_dict)
    
    await db.users.update_one({'user_id': user['user_id']}, {'$set': {'user_type': 'brand'}})
    
    clean_profile = {k: v for k, v in profile_dict.items() if k != '_id'}
    return clean_profile

# ============ INFLUENCER PROFILE ENDPOINTS ============

@api_router.get("/influencers/profile")
async def get_my_influencer_profile(request: Request):
    user = await require_auth(request)
    profile = await db.influencer_profiles.find_one({'user_id': user['user_id']}, {'_id': 0})
    return profile or {}

@api_router.post("/influencers/profile")
async def create_or_update_influencer_profile(request: Request, data: InfluencerProfileCreate):
    user = await require_auth(request)
    
    profile_dict = data.model_dump()
    profile_dict['user_id'] = user['user_id']
    profile_dict['badges'] = []
    profile_dict['available'] = True
    profile_dict['previous_collaborations'] = []
    
    existing = await db.influencer_profiles.find_one({'user_id': user['user_id']})
    if existing:
        await db.influencer_profiles.update_one({'user_id': user['user_id']}, {'$set': profile_dict})
    else:
        username_exists = await db.influencer_profiles.find_one({'username': data.username})
        if username_exists:
            raise HTTPException(status_code=400, detail="Username already taken")
        await db.influencer_profiles.insert_one(profile_dict)
    
    await db.users.update_one({'user_id': user['user_id']}, {'$set': {'user_type': 'influencer'}})
    
    clean_profile = {k: v for k, v in profile_dict.items() if k != '_id'}
    return clean_profile

@api_router.get("/influencers/top")
async def get_top_influencers(limit: int = 10):
    """Get top influencers by rating"""
    # Get influencers with ratings, sorted by avg_rating desc
    influencers = await db.influencer_profiles.find(
        {'avg_rating': {'$exists': True, '$gt': 0}},
        {'_id': 0}
    ).sort('avg_rating', -1).limit(limit).to_list(limit)
    
    # Enrich with user data
    for inf in influencers:
        user = await db.users.find_one({'user_id': inf['user_id']}, {'_id': 0, 'password_hash': 0})
        inf['user'] = user
    
    return influencers

@api_router.get("/influencers/{username}")
async def get_public_influencer_profile(username: str):
    profile = await db.influencer_profiles.find_one({'username': username}, {'_id': 0})
    if not profile:
        raise HTTPException(status_code=404, detail="Influencer not found")
    
    user = await db.users.find_one({'user_id': profile['user_id']}, {'_id': 0, 'password_hash': 0})
    
    # Get recent revealed reviews only
    reviews = await db.reviews.find(
        {'reviewed_user_id': profile['user_id'], 'reviewer_type': 'brand', 'is_revealed': True},
        {'_id': 0}
    ).sort('created_at', -1).limit(5).to_list(5)
    
    return {**profile, 'user': user, 'reviews': reviews}

@api_router.get("/influencers")
async def list_influencers(
    platform: Optional[str] = None,
    niche: Optional[str] = None,
    available: bool = True,
    limit: int = 20,
    skip: int = 0
):
    query = {'available': available}
    if platform:
        query['platforms'] = platform
    if niche:
        query['niches'] = niche
    
    profiles = await db.influencer_profiles.find(query, {'_id': 0}).skip(skip).limit(limit).to_list(limit)
    return profiles

# ============ OEMBED ENDPOINT ============

@api_router.get("/oembed")
async def get_oembed(url: str):
    """Fetch oEmbed data for social media posts"""
    import re
    
    oembed_endpoints = {
        'youtube': 'https://www.youtube.com/oembed',
        'tiktok': 'https://www.tiktok.com/oembed',
        'instagram': 'https://api.instagram.com/oembed',  # Requires auth but try anyway
    }
    
    # Detect platform from URL
    platform = None
    if 'youtube.com' in url or 'youtu.be' in url:
        platform = 'youtube'
    elif 'tiktok.com' in url:
        platform = 'tiktok'
    elif 'instagram.com' in url:
        platform = 'instagram'
    
    if not platform:
        raise HTTPException(status_code=400, detail="Unsupported URL")
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                oembed_endpoints[platform],
                params={'url': url, 'format': 'json', 'maxwidth': 500},
                timeout=10.0
            )
            
            if response.status_code == 200:
                data = response.json()
                return {
                    'platform': platform,
                    'title': data.get('title', ''),
                    'author_name': data.get('author_name', ''),
                    'author_url': data.get('author_url', ''),
                    'thumbnail_url': data.get('thumbnail_url', ''),
                    'html': data.get('html', ''),
                    'width': data.get('width'),
                    'height': data.get('height'),
                }
            else:
                # Return basic info for unsupported/failed requests
                return {
                    'platform': platform,
                    'url': url,
                    'html': None,
                    'error': 'Could not fetch embed data'
                }
    except Exception as e:
        logger.error(f"oEmbed error for {url}: {e}")
        return {
            'platform': platform,
            'url': url,
            'html': None,
            'error': str(e)
        }

# ============ COLLABORATION ENDPOINTS ============

@api_router.post("/collaborations")
async def create_collaboration(request: Request, data: CollaborationCreate):
    user = await require_auth(request)
    
    if not user.get('is_pro'):
        active_count = await db.collaborations.count_documents({
            'brand_user_id': user['user_id'],
            'status': 'active'
        })
        if active_count >= 3:
            raise HTTPException(status_code=403, detail="Free users limited to 3 active collaborations. Upgrade to PRO!")
    
    collab_id = f"collab_{uuid.uuid4().hex[:12]}"
    is_paid = data.collaboration_type == 'paid'
    collab_doc = {
        'collab_id': collab_id,
        'brand_user_id': user['user_id'],
        'brand_name': data.brand_name,
        'title': data.title,
        'description': data.description,
        'deliverables': data.deliverables,
        'budget_min': data.budget_min,
        'budget_max': data.budget_max,
        'deadline': data.deadline.isoformat(),
        'platform': data.platform,
        'creators_needed': data.creators_needed,
        'status': 'active',
        'applicants_count': 0,
        'views': 0,
        'created_at': datetime.now(timezone.utc).isoformat(),
        'is_public': data.is_public,
        'collaboration_type': data.collaboration_type,
        'payment_status': 'none' if not is_paid else 'awaiting_escrow',
    }
    
    await db.collaborations.insert_one(collab_doc)
    clean_collab = {k: v for k, v in collab_doc.items() if k != '_id'}
    return clean_collab

@api_router.get("/collaborations")
async def list_collaborations(
    status: Optional[str] = "active",
    platform: Optional[str] = None,
    is_public: bool = True,
    search: Optional[str] = None,
    limit: int = 20,
    skip: int = 0
):
    """List public collaborations with optional full-text search"""
    query = {}
    if status:
        query['status'] = status
    if platform:
        query['platform'] = platform
    if is_public:
        query['is_public'] = True
    
    # Full-text search
    if search:
        query['$or'] = [
            {'title': {'$regex': search, '$options': 'i'}},
            {'description': {'$regex': search, '$options': 'i'}},
            {'brand_name': {'$regex': search, '$options': 'i'}},
            {'deliverables': {'$elemMatch': {'$regex': search, '$options': 'i'}}}
        ]
    
    collabs = await db.collaborations.find(query, {'_id': 0}).sort('created_at', -1).skip(skip).limit(limit).to_list(limit)
    return collabs

@api_router.get("/collaborations/my")
async def get_my_collaborations(request: Request):
    user = await require_auth(request)
    collabs = await db.collaborations.find({'brand_user_id': user['user_id']}, {'_id': 0}).sort('created_at', -1).to_list(100)
    return collabs

@api_router.get("/collaborations/{collab_id}")
async def get_collaboration(collab_id: str):
    collab = await db.collaborations.find_one({'collab_id': collab_id}, {'_id': 0})
    if not collab:
        raise HTTPException(status_code=404, detail="Collaboration not found")
    
    # Increment view count
    await db.collaborations.update_one({'collab_id': collab_id}, {'$inc': {'views': 1}})
    
    return collab

@api_router.put("/collaborations/{collab_id}")
async def update_collaboration(collab_id: str, request: Request, data: CollaborationCreate):
    user = await require_auth(request)
    collab = await db.collaborations.find_one({'collab_id': collab_id})
    if not collab:
        raise HTTPException(status_code=404, detail="Collaboration not found")
    if collab['brand_user_id'] != user['user_id']:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    update_doc = data.model_dump()
    update_doc['deadline'] = data.deadline.isoformat()
    await db.collaborations.update_one({'collab_id': collab_id}, {'$set': update_doc})
    return {'success': True}

@api_router.patch("/collaborations/{collab_id}/status")
async def update_collaboration_status(collab_id: str, request: Request):
    user = await require_auth(request)
    body = await request.json()
    new_status = body.get('status')
    
    collab = await db.collaborations.find_one({'collab_id': collab_id})
    if not collab:
        raise HTTPException(status_code=404, detail="Collaboration not found")
    if collab['brand_user_id'] != user['user_id']:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    is_paid = collab.get('collaboration_type', 'paid') == 'paid'
    
    # For paid collaborations: completed → completed_pending_release (not directly to completed)
    if new_status == 'completed' and is_paid:
        escrow = await db.escrow_payments.find_one({'collab_id': collab_id, 'status': 'secured'})
        if not escrow:
            raise HTTPException(status_code=400, detail="Fondurile trebuie securizate înainte de finalizare")
        
        # Set to pending release (confirmation window)
        release_at = datetime.now(timezone.utc) + timedelta(hours=48)
        await db.collaborations.update_one({'collab_id': collab_id}, {'$set': {
            'status': 'completed_pending_release',
            'payment_status': 'completed_pending_release',
            'completed_at': datetime.now(timezone.utc).isoformat(),
            'release_scheduled_at': release_at.isoformat()
        }})
        await db.escrow_payments.update_one({'escrow_id': escrow['escrow_id']}, {'$set': {
            'status': 'completed_pending_release',
            'completed_at': datetime.now(timezone.utc).isoformat(),
            'release_scheduled_at': release_at.isoformat()
        }})
        return {'success': True, 'payment_status': 'completed_pending_release', 'release_scheduled_at': release_at.isoformat()}
    
    # For free/barter collaborations: go directly to completed
    if new_status == 'completed' and not is_paid:
        await db.collaborations.update_one({'collab_id': collab_id}, {'$set': {
            'status': 'completed',
            'payment_status': 'none',
            'completed_at': datetime.now(timezone.utc).isoformat()
        }})
        return {'success': True}
    
    await db.collaborations.update_one({'collab_id': collab_id}, {'$set': {'status': new_status}})
    return {'success': True}

# ============ CANCELLATION ENDPOINTS ============

CANCELLATION_REASONS = [
    'brand_changed_requirements',
    'influencer_unavailable',
    'budget_issues',
    'timeline_conflict',
    'quality_concerns',
    'mutual_agreement',
    'other'
]

@api_router.post("/collaborations/{collab_id}/cancel")
async def cancel_collaboration(collab_id: str, request: Request):
    """Cancel a collaboration (before delivery). Rules depend on escrow state."""
    user = await require_auth(request)
    body = await request.json()
    reason = body.get('reason', '')
    details = body.get('details', '')
    
    collab = await db.collaborations.find_one({'collab_id': collab_id})
    if not collab:
        raise HTTPException(status_code=404, detail="Collaboration not found")
    
    is_brand = collab['brand_user_id'] == user['user_id']
    # Check if user is an accepted influencer for this collab
    is_influencer = False
    if not is_brand:
        inf_app = await db.applications.find_one({
            'collab_id': collab_id,
            'influencer_user_id': user['user_id'],
            'status': 'accepted'
        })
        is_influencer = bool(inf_app)
    
    if not is_brand and not is_influencer:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    current_status = collab.get('status', '')
    payment_status = collab.get('payment_status', 'none')
    
    # Block cancellation after delivery / completed_pending_release / disputed
    blocked_statuses = ['completed_pending_release', 'completed', 'disputed', 'cancelled']
    if current_status in blocked_statuses:
        raise HTTPException(status_code=400, detail="Anularea nu mai este posibilă în această etapă. Folosiți sistemul de dispute.")
    
    # Scenario 1: Before work starts (status=active, payment_status=secured or awaiting_escrow)
    if current_status == 'active' and payment_status in ('secured', 'awaiting_escrow', 'none'):
        # Direct cancellation with full refund
        now = datetime.now(timezone.utc).isoformat()
        
        await db.collaborations.update_one({'collab_id': collab_id}, {'$set': {
            'status': 'cancelled',
            'payment_status': 'refunded' if payment_status == 'secured' else 'none',
            'cancelled_at': now,
            'cancelled_by': user['user_id'],
            'cancellation_reason': reason
        }})
        
        # Refund escrow if secured
        if payment_status == 'secured':
            await db.escrow_payments.update_one(
                {'collab_id': collab_id, 'status': 'secured'},
                {'$set': {'status': 'refunded', 'refunded_at': now}}
            )
        
        # Log cancellation
        await db.cancellations.insert_one({
            'cancellation_id': f"cancel_{uuid.uuid4().hex[:12]}",
            'collab_id': collab_id,
            'requested_by': user['user_id'],
            'requester_type': 'brand' if is_brand else 'influencer',
            'reason': reason,
            'details': details,
            'status': 'completed',
            'resolution': 'full_refund' if payment_status == 'secured' else 'no_payment',
            'created_at': now,
            'resolved_at': now
        })
        
        return {'success': True, 'status': 'cancelled', 'message': 'Colaborare anulată cu succes.'}
    
    # Scenario 2: After work started (status=in_progress)
    if current_status == 'in_progress':
        requester_type = 'brand' if is_brand else 'influencer'
        cancel_status = f"cancellation_requested_by_{requester_type}"
        now = datetime.now(timezone.utc).isoformat()
        
        await db.collaborations.update_one({'collab_id': collab_id}, {'$set': {
            'status': cancel_status,
        }})
        
        await db.cancellations.insert_one({
            'cancellation_id': f"cancel_{uuid.uuid4().hex[:12]}",
            'collab_id': collab_id,
            'requested_by': user['user_id'],
            'requester_type': requester_type,
            'reason': reason,
            'details': details,
            'status': 'pending_admin_review',
            'created_at': now
        })
        
        return {'success': True, 'status': cancel_status, 'message': 'Cerere de anulare trimisă. Un admin va analiza situația.'}
    
    raise HTTPException(status_code=400, detail="Anularea nu este posibilă în starea curentă")

@api_router.get("/cancellations/collab/{collab_id}")
async def get_cancellation_for_collab(collab_id: str, request: Request):
    """Get cancellation request for a collaboration"""
    user = await require_auth(request)
    cancellation = await db.cancellations.find_one(
        {'collab_id': collab_id},
        {'_id': 0}
    )
    return cancellation

@api_router.get("/admin/cancellations")
async def get_admin_cancellations(request: Request, limit: int = 50, skip: int = 0):
    """List all cancellation requests (admin only)"""
    await require_admin(request)
    cancellations = await db.cancellations.find(
        {}, {'_id': 0}
    ).sort('created_at', -1).skip(skip).limit(limit).to_list(limit)
    
    # Enrich with collab info
    for c in cancellations:
        collab = await db.collaborations.find_one({'collab_id': c['collab_id']}, {'_id': 0, 'title': 1, 'brand_name': 1, 'budget_min': 1})
        c['collaboration'] = collab
    
    total = await db.cancellations.count_documents({})
    return {'cancellations': cancellations, 'total': total}

@api_router.patch("/admin/cancellations/{cancellation_id}/resolve")
async def resolve_cancellation(cancellation_id: str, request: Request):
    """Admin resolves a cancellation request"""
    await require_admin(request)
    body = await request.json()
    resolution = body.get('resolution')  # 'full_refund', 'partial_refund', 'continue'
    admin_notes = body.get('admin_notes', '')
    partial_amount = body.get('partial_amount', 0)
    
    cancellation = await db.cancellations.find_one({'cancellation_id': cancellation_id})
    if not cancellation:
        raise HTTPException(status_code=404, detail="Cancellation not found")
    if cancellation['status'] != 'pending_admin_review':
        raise HTTPException(status_code=400, detail="Already resolved")
    
    now = datetime.now(timezone.utc).isoformat()
    collab_id = cancellation['collab_id']
    
    if resolution == 'full_refund':
        await db.collaborations.update_one({'collab_id': collab_id}, {'$set': {
            'status': 'cancelled',
            'payment_status': 'refunded',
            'cancelled_at': now
        }})
        await db.escrow_payments.update_one(
            {'collab_id': collab_id, 'status': {'$in': ['secured', 'completed_pending_release']}},
            {'$set': {'status': 'refunded', 'refunded_at': now}}
        )
    elif resolution == 'partial_refund':
        await db.collaborations.update_one({'collab_id': collab_id}, {'$set': {
            'status': 'cancelled',
            'payment_status': 'partial_refund',
            'cancelled_at': now
        }})
        escrow = await db.escrow_payments.find_one({'collab_id': collab_id, 'status': {'$in': ['secured', 'completed_pending_release']}})
        if escrow:
            await db.escrow_payments.update_one({'escrow_id': escrow['escrow_id']}, {'$set': {
                'status': 'partial_refund',
                'partial_refund_amount': partial_amount,
                'refunded_at': now
            }})
    elif resolution == 'continue':
        # Restore to in_progress
        await db.collaborations.update_one({'collab_id': collab_id}, {'$set': {
            'status': 'in_progress'
        }})
    
    await db.cancellations.update_one({'cancellation_id': cancellation_id}, {'$set': {
        'status': 'resolved',
        'resolution': resolution,
        'admin_notes': admin_notes,
        'partial_amount': partial_amount if resolution == 'partial_refund' else None,
        'resolved_at': now
    }})
    
    return {'success': True, 'resolution': resolution}

# ============ DISPUTE ENDPOINTS ============

@api_router.post("/disputes/create/{collab_id}")
async def create_dispute(collab_id: str, request: Request):
    """Create a dispute (only for completed_pending_release collaborations)"""
    user = await require_auth(request)
    body = await request.json()
    reason = body.get('reason', '')
    details = body.get('details', '')
    
    collab = await db.collaborations.find_one({'collab_id': collab_id})
    if not collab:
        raise HTTPException(status_code=404, detail="Collaboration not found")
    
    if collab['status'] != 'completed_pending_release':
        raise HTTPException(status_code=400, detail="Disputele sunt posibile doar în faza de verificare a livrării (completed_pending_release)")
    
    # Verify user is participant
    is_brand = collab['brand_user_id'] == user['user_id']
    is_influencer = False
    if not is_brand:
        inf_app = await db.applications.find_one({
            'collab_id': collab_id,
            'influencer_user_id': user['user_id'],
            'status': 'accepted'
        })
        is_influencer = bool(inf_app)
    
    if not is_brand and not is_influencer:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Check no existing active dispute
    existing = await db.disputes.find_one({'collab_id': collab_id, 'status': {'$in': ['open', 'under_review']}})
    if existing:
        raise HTTPException(status_code=400, detail="O dispută este deja deschisă pentru această colaborare")
    
    now = datetime.now(timezone.utc).isoformat()
    dispute_id = f"dispute_{uuid.uuid4().hex[:12]}"
    
    dispute_doc = {
        'dispute_id': dispute_id,
        'collab_id': collab_id,
        'opened_by': user['user_id'],
        'opener_type': 'brand' if is_brand else 'influencer',
        'opener_name': user['name'],
        'reason': reason,
        'details': details,
        'status': 'open',
        'created_at': now,
        'brand_user_id': collab['brand_user_id'],
    }
    
    # Find influencer
    inf_app = await db.applications.find_one({'collab_id': collab_id, 'status': 'accepted'})
    if inf_app:
        dispute_doc['influencer_user_id'] = inf_app['influencer_user_id']
    
    await db.disputes.insert_one(dispute_doc)
    
    # Update collaboration and escrow status to disputed
    await db.collaborations.update_one({'collab_id': collab_id}, {'$set': {
        'status': 'disputed',
        'payment_status': 'disputed',
        'disputed_at': now
    }})
    await db.escrow_payments.update_one(
        {'collab_id': collab_id, 'status': 'completed_pending_release'},
        {'$set': {'status': 'disputed', 'disputed_at': now}}
    )
    
    # Lock messaging
    await db.messages.update_many(
        {'collab_id': collab_id},
        {'$set': {'thread_locked': True}}
    )
    
    clean = {k: v for k, v in dispute_doc.items() if k != '_id'}
    return clean

@api_router.get("/disputes/collab/{collab_id}")
async def get_dispute_for_collab(collab_id: str, request: Request):
    """Get dispute details for a collaboration"""
    user = await require_auth(request)
    dispute = await db.disputes.find_one(
        {'collab_id': collab_id, 'status': {'$in': ['open', 'under_review']}},
        {'_id': 0}
    )
    return dispute

@api_router.get("/admin/disputes")
async def get_admin_disputes(request: Request, status: str = None, limit: int = 50, skip: int = 0):
    """List all disputes (admin only)"""
    await require_admin(request)
    query = {}
    if status:
        query['status'] = status
    
    disputes = await db.disputes.find(query, {'_id': 0}).sort('created_at', -1).skip(skip).limit(limit).to_list(limit)
    
    for d in disputes:
        collab = await db.collaborations.find_one({'collab_id': d['collab_id']}, {'_id': 0, 'title': 1, 'brand_name': 1, 'budget_min': 1, 'budget_max': 1})
        d['collaboration'] = collab
        escrow = await db.escrow_payments.find_one({'collab_id': d['collab_id']}, {'_id': 0, 'total_amount': 1, 'influencer_payout': 1, 'platform_commission': 1})
        d['escrow'] = escrow
        # Get message history for context
        msgs = await db.messages.find({'collab_id': d['collab_id']}, {'_id': 0}).sort('created_at', 1).to_list(100)
        d['message_history'] = msgs
    
    total = await db.disputes.count_documents(query)
    return {'disputes': disputes, 'total': total}

@api_router.patch("/admin/disputes/{dispute_id}/resolve")
async def resolve_dispute(dispute_id: str, request: Request):
    """Admin resolves a dispute"""
    await require_admin(request)
    body = await request.json()
    resolution = body.get('resolution')  # 'release_to_influencer', 'refund_to_brand', 'split'
    admin_notes = body.get('admin_notes', '')
    split_influencer = body.get('split_influencer', 0)
    split_brand = body.get('split_brand', 0)
    
    dispute = await db.disputes.find_one({'dispute_id': dispute_id})
    if not dispute:
        raise HTTPException(status_code=404, detail="Dispute not found")
    if dispute['status'] == 'resolved':
        raise HTTPException(status_code=400, detail="Dispute already resolved")
    
    collab_id = dispute['collab_id']
    now = datetime.now(timezone.utc).isoformat()
    
    escrow = await db.escrow_payments.find_one({'collab_id': collab_id, 'status': 'disputed'})
    
    if resolution == 'release_to_influencer':
        # Release full amount to influencer
        if escrow:
            rate = escrow.get('commission_rate', await get_commission_rate())
            # Create commission record
            accepted_apps = await db.applications.find({'collab_id': collab_id, 'status': 'accepted'}, {'_id': 0}).to_list(10)
            for app in accepted_apps:
                proposed_price = app.get('proposed_price') or escrow.get('total_amount', 0)
                commission = round(proposed_price * rate / 100, 2)
                net_amount = round(proposed_price - commission, 2)
                await db.commissions.insert_one({
                    'commission_id': f"comm_{uuid.uuid4().hex[:12]}",
                    'collab_id': collab_id,
                    'application_id': app['application_id'],
                    'brand_user_id': escrow['brand_user_id'],
                    'influencer_user_id': app['influencer_user_id'],
                    'gross_amount': proposed_price,
                    'commission_rate': rate,
                    'commission_amount': commission,
                    'net_amount': net_amount,
                    'status': 'completed',
                    'created_at': now
                })
            
            await db.escrow_payments.update_one({'escrow_id': escrow['escrow_id']}, {'$set': {
                'status': 'released',
                'released_at': now
            }})
        
        await db.collaborations.update_one({'collab_id': collab_id}, {'$set': {
            'status': 'completed',
            'payment_status': 'released',
            'released_at': now
        }})
    
    elif resolution == 'refund_to_brand':
        if escrow:
            await db.escrow_payments.update_one({'escrow_id': escrow['escrow_id']}, {'$set': {
                'status': 'refunded',
                'refunded_at': now
            }})
        await db.collaborations.update_one({'collab_id': collab_id}, {'$set': {
            'status': 'cancelled',
            'payment_status': 'refunded',
            'cancelled_at': now
        }})
    
    elif resolution == 'split':
        if escrow:
            await db.escrow_payments.update_one({'escrow_id': escrow['escrow_id']}, {'$set': {
                'status': 'split_resolved',
                'split_influencer': split_influencer,
                'split_brand': split_brand,
                'resolved_at': now
            }})
        await db.collaborations.update_one({'collab_id': collab_id}, {'$set': {
            'status': 'completed',
            'payment_status': 'split_resolved',
        }})
    
    await db.disputes.update_one({'dispute_id': dispute_id}, {'$set': {
        'status': 'resolved',
        'resolution': resolution,
        'admin_notes': admin_notes,
        'split_influencer': split_influencer if resolution == 'split' else None,
        'split_brand': split_brand if resolution == 'split' else None,
        'resolved_at': now
    }})
    
    return {'success': True, 'resolution': resolution}

# ============ MESSAGING ENDPOINTS ============

@api_router.post("/messages/{collab_id}")
async def send_message(collab_id: str, request: Request):
    """Send a message in a collaboration thread"""
    user = await require_auth(request)
    body = await request.json()
    content = body.get('content', '').strip()
    
    if not content:
        raise HTTPException(status_code=400, detail="Message cannot be empty")
    if len(content) > 2000:
        raise HTTPException(status_code=400, detail="Mesajul nu poate depăși 2000 de caractere")
    
    collab = await db.collaborations.find_one({'collab_id': collab_id})
    if not collab:
        raise HTTPException(status_code=404, detail="Collaboration not found")
    
    # Check if thread is locked (dispute)
    if collab.get('status') == 'disputed':
        raise HTTPException(status_code=400, detail="Mesajele sunt blocate pe durata disputei")
    
    # Verify user is participant
    is_brand = collab['brand_user_id'] == user['user_id']
    is_influencer = False
    if not is_brand:
        inf_app = await db.applications.find_one({
            'collab_id': collab_id,
            'influencer_user_id': user['user_id'],
            'status': 'accepted'
        })
        is_influencer = bool(inf_app)
    
    if not is_brand and not is_influencer:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Collaboration must be active or in progress
    allowed_statuses = ['active', 'in_progress', 'completed_pending_release', 'completed',
                        'cancellation_requested_by_brand', 'cancellation_requested_by_influencer']
    if collab['status'] not in allowed_statuses:
        raise HTTPException(status_code=400, detail="Mesajele nu sunt disponibile în această etapă")
    
    # Check if there's an accepted application (messaging only after acceptance)
    accepted_app = await db.applications.find_one({
        'collab_id': collab_id,
        'status': 'accepted'
    })
    if not accepted_app:
        raise HTTPException(status_code=400, detail="Mesajele sunt disponibile doar după acceptarea unei aplicații")
    
    msg_id = f"msg_{uuid.uuid4().hex[:12]}"
    msg_doc = {
        'message_id': msg_id,
        'collab_id': collab_id,
        'sender_id': user['user_id'],
        'sender_name': user['name'],
        'sender_type': 'brand' if is_brand else 'influencer',
        'content': content,
        'created_at': datetime.now(timezone.utc).isoformat(),
        'thread_locked': False
    }
    
    await db.messages.insert_one(msg_doc)
    
    clean = {k: v for k, v in msg_doc.items() if k != '_id'}
    return clean

@api_router.get("/messages/{collab_id}")
async def get_messages(collab_id: str, request: Request, limit: int = 100, skip: int = 0):
    """Get messages for a collaboration"""
    user = await require_auth(request)
    
    collab = await db.collaborations.find_one({'collab_id': collab_id})
    if not collab:
        raise HTTPException(status_code=404, detail="Collaboration not found")
    
    # Verify user is participant or admin
    is_brand = collab['brand_user_id'] == user['user_id']
    is_influencer = False
    if not is_brand:
        inf_app = await db.applications.find_one({
            'collab_id': collab_id,
            'influencer_user_id': user['user_id'],
            'status': 'accepted'
        })
        is_influencer = bool(inf_app)
    
    if not is_brand and not is_influencer and not user.get('is_admin'):
        raise HTTPException(status_code=403, detail="Not authorized")
    
    messages = await db.messages.find(
        {'collab_id': collab_id},
        {'_id': 0}
    ).sort('created_at', 1).skip(skip).limit(limit).to_list(limit)
    
    is_locked = collab.get('status') == 'disputed'
    
    return {'messages': messages, 'is_locked': is_locked}

REVIEW_REVEAL_TIMEOUT_DAYS = 14  # Days after release before reviews auto-reveal

@api_router.post("/escrow/create/{collab_id}")
async def create_escrow(collab_id: str, request: Request):
    """Create an escrow payment for a paid collaboration"""
    user = await require_auth(request)
    
    collab = await db.collaborations.find_one({'collab_id': collab_id})
    if not collab:
        raise HTTPException(status_code=404, detail="Collaboration not found")
    if collab['brand_user_id'] != user['user_id']:
        raise HTTPException(status_code=403, detail="Not authorized")
    if collab.get('collaboration_type', 'paid') != 'paid':
        raise HTTPException(status_code=400, detail="Escrow only for paid collaborations")
    
    # Check no existing active escrow
    existing = await db.escrow_payments.find_one({'collab_id': collab_id, 'status': {'$in': ['pending', 'secured']}})
    if existing:
        raise HTTPException(status_code=400, detail="Escrow already exists for this collaboration")
    
    rate = await get_commission_rate()
    budget = collab.get('budget_max') or collab.get('budget_min', 0)
    commission = round(budget * rate / 100, 2)
    influencer_payout = round(budget - commission, 2)
    total_secured = budget  # Brand pays full budget, commission deducted from it
    
    escrow_id = f"escrow_{uuid.uuid4().hex[:12]}"
    escrow_doc = {
        'escrow_id': escrow_id,
        'collab_id': collab_id,
        'brand_user_id': user['user_id'],
        'total_amount': total_secured,
        'influencer_payout': influencer_payout,
        'platform_commission': commission,
        'commission_rate': rate,
        'payment_status': 'pending',
        'status': 'pending',
        'payment_provider': 'mock',  # Will be 'netopia' or 'stripe' in production
        'payment_reference': None,
        'created_at': datetime.now(timezone.utc).isoformat()
    }
    
    await db.escrow_payments.insert_one(escrow_doc)
    
    clean = {k: v for k, v in escrow_doc.items() if k != '_id'}
    return clean

@api_router.post("/escrow/{escrow_id}/secure")
async def secure_escrow_payment(escrow_id: str, request: Request):
    """Simulate securing funds (mock provider). In production: redirect to Netopia/Stripe"""
    user = await require_auth(request)
    
    escrow = await db.escrow_payments.find_one({'escrow_id': escrow_id})
    if not escrow:
        raise HTTPException(status_code=404, detail="Escrow not found")
    if escrow['brand_user_id'] != user['user_id']:
        raise HTTPException(status_code=403, detail="Not authorized")
    if escrow['status'] != 'pending':
        raise HTTPException(status_code=400, detail="Escrow is not in pending state")
    
    # MOCK PROVIDER: instantly mark as secured
    # In production, this would redirect to Netopia payment page
    payment_ref = f"pay_{uuid.uuid4().hex[:16]}"
    
    await db.escrow_payments.update_one({'escrow_id': escrow_id}, {'$set': {
        'status': 'secured',
        'payment_reference': payment_ref,
        'secured_at': datetime.now(timezone.utc).isoformat()
    }})
    
    await db.collaborations.update_one({'collab_id': escrow['collab_id']}, {'$set': {
        'payment_status': 'secured',
        'escrow_id': escrow_id
    }})
    
    logger.info(f"Escrow {escrow_id} secured (mock) for collab {escrow['collab_id']}")
    
    return {
        'success': True,
        'escrow_id': escrow_id,
        'status': 'secured',
        'payment_reference': payment_ref,
        'message': 'Fonduri securizate cu succes'
    }

@api_router.get("/escrow/collab/{collab_id}")
async def get_escrow_for_collab(collab_id: str, request: Request):
    """Get escrow payment details for a collaboration"""
    user = await require_auth(request)
    
    escrow = await db.escrow_payments.find_one(
        {'collab_id': collab_id, 'status': {'$nin': ['cancelled']}},
        {'_id': 0}
    )
    if not escrow:
        return None
    
    # Only brand owner or admin can see full details
    collab = await db.collaborations.find_one({'collab_id': collab_id})
    if collab and collab['brand_user_id'] != user['user_id'] and not user.get('is_admin'):
        # Return limited info for influencers
        return {
            'escrow_id': escrow['escrow_id'],
            'status': escrow['status'],
            'total_amount': escrow['total_amount'],
            'influencer_payout': escrow['influencer_payout'],
            'payment_status': escrow['status']
        }
    
    return escrow

@api_router.post("/escrow/{escrow_id}/release")
async def release_escrow(escrow_id: str, request: Request):
    """Release escrowed funds after confirmation window"""
    user = await require_auth(request)
    
    escrow = await db.escrow_payments.find_one({'escrow_id': escrow_id})
    if not escrow:
        raise HTTPException(status_code=404, detail="Escrow not found")
    if escrow['brand_user_id'] != user['user_id'] and not user.get('is_admin'):
        raise HTTPException(status_code=403, detail="Not authorized")
    if escrow['status'] != 'completed_pending_release':
        raise HTTPException(status_code=400, detail="Escrow not in release-ready state")
    
    # Record commission
    rate = escrow.get('commission_rate', await get_commission_rate())
    collab = await db.collaborations.find_one({'collab_id': escrow['collab_id']})
    
    accepted_apps = await db.applications.find({
        'collab_id': escrow['collab_id'],
        'status': 'accepted'
    }, {'_id': 0}).to_list(100)
    
    for app in accepted_apps:
        proposed_price = app.get('proposed_price') or escrow.get('total_amount', 0)
        commission = round(proposed_price * rate / 100, 2)
        net_amount = round(proposed_price - commission, 2)
        
        await db.commissions.insert_one({
            'commission_id': f"comm_{uuid.uuid4().hex[:12]}",
            'collab_id': escrow['collab_id'],
            'application_id': app['application_id'],
            'brand_user_id': escrow['brand_user_id'],
            'influencer_user_id': app['influencer_user_id'],
            'gross_amount': proposed_price,
            'commission_rate': rate,
            'commission_amount': commission,
            'net_amount': net_amount,
            'status': 'completed',
            'created_at': datetime.now(timezone.utc).isoformat()
        })
    
    # Update escrow and collaboration
    now = datetime.now(timezone.utc).isoformat()
    await db.escrow_payments.update_one({'escrow_id': escrow_id}, {'$set': {
        'status': 'released',
        'released_at': now
    }})
    await db.collaborations.update_one({'collab_id': escrow['collab_id']}, {'$set': {
        'status': 'completed',
        'payment_status': 'released',
        'released_at': now
    }})
    
    logger.info(f"Escrow {escrow_id} released for collab {escrow['collab_id']}")
    
    return {'success': True, 'status': 'released', 'message': 'Fonduri eliberate cu succes'}

@api_router.post("/escrow/{escrow_id}/refund")
async def refund_escrow(escrow_id: str, request: Request):
    """Refund escrowed funds (admin or brand before release)"""
    user = await require_auth(request)
    
    escrow = await db.escrow_payments.find_one({'escrow_id': escrow_id})
    if not escrow:
        raise HTTPException(status_code=404, detail="Escrow not found")
    if escrow['brand_user_id'] != user['user_id'] and not user.get('is_admin'):
        raise HTTPException(status_code=403, detail="Not authorized")
    if escrow['status'] not in ('secured', 'completed_pending_release'):
        raise HTTPException(status_code=400, detail="Cannot refund in current state")
    
    await db.escrow_payments.update_one({'escrow_id': escrow_id}, {'$set': {
        'status': 'refunded',
        'refunded_at': datetime.now(timezone.utc).isoformat()
    }})
    await db.collaborations.update_one({'collab_id': escrow['collab_id']}, {'$set': {
        'payment_status': 'refunded'
    }})
    
    return {'success': True, 'status': 'refunded'}

# ============ APPLICATION ENDPOINTS ============

@api_router.post("/applications")
async def create_application(request: Request, data: ApplicationCreate):
    user = await require_auth(request)
    
    profile = await db.influencer_profiles.find_one({'user_id': user['user_id']}, {'_id': 0})
    if not profile:
        raise HTTPException(status_code=400, detail="Please complete your influencer profile first")
    
    existing = await db.applications.find_one({
        'collab_id': data.collab_id,
        'influencer_user_id': user['user_id']
    })
    if existing:
        raise HTTPException(status_code=400, detail="Already applied to this collaboration")
    
    collab = await db.collaborations.find_one({'collab_id': data.collab_id})
    if not collab or collab['status'] != 'active':
        raise HTTPException(status_code=400, detail="Collaboration not available")
    
    application_id = f"app_{uuid.uuid4().hex[:12]}"
    app_doc = {
        'application_id': application_id,
        'collab_id': data.collab_id,
        'influencer_user_id': user['user_id'],
        'influencer_name': user['name'],
        'influencer_username': profile.get('username', ''),
        'message': data.message,
        'selected_deliverables': data.selected_deliverables,
        'proposed_price': data.proposed_price,
        'status': 'pending',
        'created_at': datetime.now(timezone.utc).isoformat()
    }
    
    await db.applications.insert_one(app_doc)
    await db.collaborations.update_one(
        {'collab_id': data.collab_id},
        {'$inc': {'applicants_count': 1}}
    )
    
    # Send email notification to brand
    brand_user = await db.users.find_one({'user_id': collab['brand_user_id']}, {'_id': 0})
    if brand_user:
        asyncio.create_task(send_new_application_email(
            brand_user['email'],
            collab['brand_name'],
            collab['title'],
            user['name'],
            profile.get('username', '')
        ))
    
    clean_app = {k: v for k, v in app_doc.items() if k != '_id'}
    return clean_app

@api_router.get("/applications/my")
async def get_my_applications(request: Request):
    user = await require_auth(request)
    apps = await db.applications.find({'influencer_user_id': user['user_id']}, {'_id': 0}).sort('created_at', -1).to_list(100)
    
    for app in apps:
        collab = await db.collaborations.find_one({'collab_id': app['collab_id']}, {'_id': 0})
        app['collaboration'] = collab
    
    return apps

@api_router.get("/applications/collab/{collab_id}")
async def get_collab_applications(collab_id: str, request: Request):
    user = await require_auth(request)
    
    collab = await db.collaborations.find_one({'collab_id': collab_id})
    if not collab:
        raise HTTPException(status_code=404, detail="Collaboration not found")
    if collab['brand_user_id'] != user['user_id']:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    apps = await db.applications.find({'collab_id': collab_id}, {'_id': 0}).sort('created_at', -1).to_list(100)
    
    for app in apps:
        profile = await db.influencer_profiles.find_one({'user_id': app['influencer_user_id']}, {'_id': 0})
        app['influencer_profile'] = profile
    
    return apps

@api_router.patch("/applications/{application_id}/status")
async def update_application_status(application_id: str, request: Request):
    user = await require_auth(request)
    body = await request.json()
    new_status = body.get('status')
    
    app = await db.applications.find_one({'application_id': application_id})
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")
    
    collab = await db.collaborations.find_one({'collab_id': app['collab_id']})
    if collab['brand_user_id'] != user['user_id']:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    await db.applications.update_one({'application_id': application_id}, {'$set': {'status': new_status}})
    
    if new_status == 'accepted':
        await db.influencer_profiles.update_one(
            {'user_id': app['influencer_user_id']},
            {'$push': {'previous_collaborations': collab['title']}}
        )
    
    # Send email to influencer
    influencer_user = await db.users.find_one({'user_id': app['influencer_user_id']}, {'_id': 0})
    if influencer_user:
        asyncio.create_task(send_application_status_email(
            influencer_user['email'],
            app['influencer_name'],
            collab['title'],
            collab['brand_name'],
            new_status
        ))
    
    return {'success': True}

# ============ REVIEW ENDPOINTS ============

@api_router.post("/reviews")
async def create_review(request: Request, data: ReviewCreate):
    """Create a review for a completed collaboration (mutual reveal)"""
    user = await require_auth(request)
    
    # Get the application
    app = await db.applications.find_one({'application_id': data.application_id})
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")
    
    # Application must be accepted
    if app['status'] != 'accepted':
        raise HTTPException(status_code=400, detail="Can only review accepted collaborations")
    
    # Get the collaboration
    collab = await db.collaborations.find_one({'collab_id': app['collab_id']})
    if not collab:
        raise HTTPException(status_code=404, detail="Collaboration not found")
    
    is_paid = collab.get('collaboration_type', 'paid') == 'paid'
    
    # For paid collaborations: require funds released
    if is_paid:
        if collab.get('payment_status') != 'released':
            raise HTTPException(status_code=400, detail="Recenziile sunt disponibile doar după eliberarea fondurilor")
    else:
        # For free/barter: collaboration must be completed
        if collab['status'] not in ('completed', 'completed_pending_release'):
            raise HTTPException(status_code=400, detail="Colaborarea trebuie finalizată înainte de recenzie")
    
    # Determine reviewer type and reviewed user
    is_brand = collab['brand_user_id'] == user['user_id']
    is_influencer = app['influencer_user_id'] == user['user_id']
    
    if not is_brand and not is_influencer:
        raise HTTPException(status_code=403, detail="Not authorized to review this collaboration")
    
    reviewer_type = 'brand' if is_brand else 'influencer'
    reviewed_user_id = app['influencer_user_id'] if is_brand else collab['brand_user_id']
    
    # Check if already reviewed
    existing = await db.reviews.find_one({
        'application_id': data.application_id,
        'reviewer_user_id': user['user_id']
    })
    if existing:
        raise HTTPException(status_code=400, detail="Already reviewed this collaboration")
    
    review_id = f"review_{uuid.uuid4().hex[:12]}"
    review_doc = {
        'review_id': review_id,
        'application_id': data.application_id,
        'collab_id': collab['collab_id'],
        'reviewer_user_id': user['user_id'],
        'reviewer_name': user['name'],
        'reviewer_type': reviewer_type,
        'reviewed_user_id': reviewed_user_id,
        'rating': data.rating,
        'comment': data.comment,
        'collab_title': collab['title'],
        'is_revealed': False,  # Hidden until both submit or timeout
        'created_at': datetime.now(timezone.utc).isoformat()
    }
    
    await db.reviews.insert_one(review_doc)
    
    # Check if both parties have now reviewed → reveal both
    other_review = await db.reviews.find_one({
        'application_id': data.application_id,
        'reviewer_user_id': {'$ne': user['user_id']}
    })
    
    if other_review:
        # Both reviews exist → reveal simultaneously
        await db.reviews.update_many(
            {'application_id': data.application_id},
            {'$set': {'is_revealed': True}}
        )
        # Now update ratings
        if is_brand:
            await update_influencer_rating(app['influencer_user_id'])
        else:
            # Find the brand review and update influencer rating
            brand_review = await db.reviews.find_one({
                'application_id': data.application_id,
                'reviewer_type': 'brand'
            })
            if brand_review:
                await update_influencer_rating(app['influencer_user_id'])
    
    clean_review = {k: v for k, v in review_doc.items() if k != '_id'}
    return clean_review

async def update_influencer_rating(user_id: str):
    """Calculate and update influencer's average rating (only revealed reviews)"""
    pipeline = [
        {'$match': {'reviewed_user_id': user_id, 'reviewer_type': 'brand', 'is_revealed': True}},
        {'$group': {'_id': None, 'avg_rating': {'$avg': '$rating'}, 'count': {'$sum': 1}}}
    ]
    result = await db.reviews.aggregate(pipeline).to_list(1)
    
    if result:
        avg_rating = round(result[0]['avg_rating'], 1)
        review_count = result[0]['count']
        await db.influencer_profiles.update_one(
            {'user_id': user_id},
            {'$set': {'avg_rating': avg_rating, 'review_count': review_count}}
        )

async def auto_reveal_timed_out_reviews():
    """Auto-reveal reviews older than REVIEW_REVEAL_TIMEOUT_DAYS"""
    cutoff = (datetime.now(timezone.utc) - timedelta(days=REVIEW_REVEAL_TIMEOUT_DAYS)).isoformat()
    unrevealed = await db.reviews.find(
        {'is_revealed': False, 'created_at': {'$lt': cutoff}},
        {'_id': 0}
    ).to_list(100)
    
    if unrevealed:
        review_ids = [r['review_id'] for r in unrevealed]
        await db.reviews.update_many(
            {'review_id': {'$in': review_ids}},
            {'$set': {'is_revealed': True}}
        )
        # Update ratings for affected influencers
        affected_user_ids = set()
        for r in unrevealed:
            if r.get('reviewer_type') == 'brand':
                affected_user_ids.add(r['reviewed_user_id'])
        for uid in affected_user_ids:
            await update_influencer_rating(uid)

@api_router.get("/reviews/user/{user_id}")
async def get_user_reviews(user_id: str, limit: int = 20, skip: int = 0):
    """Get reviews for a user (only revealed reviews)"""
    # Auto-reveal reviews past timeout
    await auto_reveal_timed_out_reviews()
    
    reviews = await db.reviews.find(
        {'reviewed_user_id': user_id, 'is_revealed': True},
        {'_id': 0}
    ).sort('created_at', -1).skip(skip).limit(limit).to_list(limit)
    
    return reviews

@api_router.get("/reviews/application/{application_id}")
async def get_application_reviews(application_id: str, request: Request):
    """Get reviews for a specific application"""
    user = await require_auth(request)
    
    app = await db.applications.find_one({'application_id': application_id})
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")
    
    collab = await db.collaborations.find_one({'collab_id': app['collab_id']})
    
    # Only brand or influencer involved can see reviews
    if user['user_id'] != collab['brand_user_id'] and user['user_id'] != app['influencer_user_id']:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    reviews = await db.reviews.find({'application_id': application_id}, {'_id': 0}).to_list(2)
    
    # Check if current user has already reviewed
    user_reviewed = any(r['reviewer_user_id'] == user['user_id'] for r in reviews)
    
    return {
        'reviews': reviews,
        'user_reviewed': user_reviewed,
        'can_review': collab['status'] == 'completed' and app['status'] == 'accepted' and not user_reviewed
    }

@api_router.get("/reviews/pending")
async def get_pending_reviews(request: Request):
    """Get collaborations pending review for current user (respects escrow rules)"""
    user = await require_auth(request)
    
    pending = []
    
    def can_review(collab):
        """Check if collaboration is review-eligible"""
        is_paid = collab.get('collaboration_type', 'paid') == 'paid'
        if is_paid:
            return collab.get('payment_status') == 'released'
        else:
            return collab.get('status') in ('completed', 'completed_pending_release')
    
    # For brands - get completed collaborations with accepted applications
    if user.get('user_type') == 'brand':
        collabs = await db.collaborations.find({
            'brand_user_id': user['user_id'],
            'status': {'$in': ['completed', 'completed_pending_release']}
        }, {'_id': 0}).to_list(100)
        
        for collab in collabs:
            if not can_review(collab):
                continue
            apps = await db.applications.find({
                'collab_id': collab['collab_id'],
                'status': 'accepted'
            }, {'_id': 0}).to_list(100)
            
            for app in apps:
                existing = await db.reviews.find_one({
                    'application_id': app['application_id'],
                    'reviewer_user_id': user['user_id']
                })
                if not existing:
                    pending.append({
                        'application': app,
                        'collaboration': collab
                    })
    else:
        # For influencers - get accepted applications for completed collaborations
        apps = await db.applications.find({
            'influencer_user_id': user['user_id'],
            'status': 'accepted'
        }, {'_id': 0}).to_list(100)
        
        for app in apps:
            collab = await db.collaborations.find_one({
                'collab_id': app['collab_id'],
                'status': {'$in': ['completed', 'completed_pending_release']}
            }, {'_id': 0})
            
            if collab and can_review(collab):
                existing = await db.reviews.find_one({
                    'application_id': app['application_id'],
                    'reviewer_user_id': user['user_id']
                })
                if not existing:
                    pending.append({
                        'application': app,
                        'collaboration': collab
                    })
    
    return pending

# ============ PAYMENT ENDPOINTS ============

PRO_PLANS = {
    'pro_monthly': {'amount': 29.00, 'currency': 'eur', 'duration_days': 30, 'name': 'PRO Monthly'},
    'pro_yearly': {'amount': 249.00, 'currency': 'eur', 'duration_days': 365, 'name': 'PRO Yearly'},
    'featured': {'amount': 9.00, 'currency': 'eur', 'duration_days': 7, 'name': 'Featured Placement'}
}

@api_router.post("/payments/checkout")
async def create_checkout(request: Request):
    user = await require_auth(request)
    body = await request.json()
    plan_id = body.get('plan_id')
    origin_url = body.get('origin_url')
    
    if plan_id not in PRO_PLANS:
        raise HTTPException(status_code=400, detail="Invalid plan")
    
    plan = PRO_PLANS[plan_id]
    
    from emergentintegrations.payments.stripe.checkout import StripeCheckout, CheckoutSessionRequest
    
    success_url = f"{origin_url}/payment/success?session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url = f"{origin_url}/pricing"
    
    host_url = str(request.base_url)
    webhook_url = f"{host_url}api/webhook/stripe"
    
    stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)
    
    checkout_request = CheckoutSessionRequest(
        amount=plan['amount'],
        currency=plan['currency'],
        success_url=success_url,
        cancel_url=cancel_url,
        metadata={
            'user_id': user['user_id'],
            'plan_id': plan_id,
            'plan_name': plan['name']
        }
    )
    
    session = await stripe_checkout.create_checkout_session(checkout_request)
    
    transaction_id = f"txn_{uuid.uuid4().hex[:12]}"
    await db.payment_transactions.insert_one({
        'transaction_id': transaction_id,
        'user_id': user['user_id'],
        'session_id': session.session_id,
        'amount': plan['amount'],
        'currency': plan['currency'],
        'plan_type': plan_id,
        'status': 'pending',
        'created_at': datetime.now(timezone.utc).isoformat()
    })
    
    return {'url': session.url, 'session_id': session.session_id}

@api_router.get("/payments/status/{session_id}")
async def get_payment_status(session_id: str, request: Request):
    user = await require_auth(request)
    
    from emergentintegrations.payments.stripe.checkout import StripeCheckout
    
    host_url = str(request.base_url)
    webhook_url = f"{host_url}api/webhook/stripe"
    stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)
    
    status = await stripe_checkout.get_checkout_status(session_id)
    
    if status.payment_status == 'paid':
        txn = await db.payment_transactions.find_one({'session_id': session_id})
        if txn and txn['status'] != 'completed':
            plan_id = txn.get('plan_type')
            plan = PRO_PLANS.get(plan_id, {})
            duration_days = plan.get('duration_days', 30)
            
            await db.payment_transactions.update_one(
                {'session_id': session_id},
                {'$set': {'status': 'completed'}}
            )
            
            pro_expires = datetime.now(timezone.utc) + timedelta(days=duration_days)
            await db.users.update_one(
                {'user_id': user['user_id']},
                {'$set': {'is_pro': True, 'pro_expires_at': pro_expires.isoformat()}}
            )
    
    return {
        'status': status.status,
        'payment_status': status.payment_status,
        'amount_total': status.amount_total,
        'currency': status.currency
    }

@api_router.post("/webhook/stripe")
async def stripe_webhook(request: Request):
    from emergentintegrations.payments.stripe.checkout import StripeCheckout
    
    body = await request.body()
    signature = request.headers.get("Stripe-Signature")
    
    host_url = str(request.base_url)
    webhook_url = f"{host_url}api/webhook/stripe"
    stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)
    
    try:
        event = await stripe_checkout.handle_webhook(body, signature)
        
        if event.payment_status == 'paid':
            session_id = event.session_id
            txn = await db.payment_transactions.find_one({'session_id': session_id})
            if txn and txn['status'] != 'completed':
                plan_id = txn.get('plan_type')
                plan = PRO_PLANS.get(plan_id, {})
                duration_days = plan.get('duration_days', 30)
                
                await db.payment_transactions.update_one(
                    {'session_id': session_id},
                    {'$set': {'status': 'completed'}}
                )
                
                pro_expires = datetime.now(timezone.utc) + timedelta(days=duration_days)
                await db.users.update_one(
                    {'user_id': txn['user_id']},
                    {'$set': {'is_pro': True, 'pro_expires_at': pro_expires.isoformat()}}
                )
        
        return {'received': True}
    except Exception as e:
        logger.error(f"Webhook error: {e}")
        return {'received': True}

# ============ ADMIN ENDPOINTS ============

@api_router.get("/admin/stats")
async def get_admin_stats(request: Request):
    """Admin dashboard statistics"""
    await require_admin(request)
    
    total_users = await db.users.count_documents({})
    total_brands = await db.users.count_documents({'user_type': 'brand'})
    total_influencers = await db.users.count_documents({'user_type': 'influencer'})
    pro_users = await db.users.count_documents({'is_pro': True})
    
    total_collabs = await db.collaborations.count_documents({})
    active_collabs = await db.collaborations.count_documents({'status': 'active'})
    
    total_applications = await db.applications.count_documents({})
    pending_apps = await db.applications.count_documents({'status': 'pending'})
    accepted_apps = await db.applications.count_documents({'status': 'accepted'})
    
    total_reports = await db.reports.count_documents({})
    pending_reports = await db.reports.count_documents({'status': 'pending'})
    
    # Revenue from completed payments
    pipeline = [
        {'$match': {'status': 'completed'}},
        {'$group': {'_id': None, 'total': {'$sum': '$amount'}}}
    ]
    revenue_result = await db.payment_transactions.aggregate(pipeline).to_list(1)
    total_revenue = revenue_result[0]['total'] if revenue_result else 0
    
    return {
        'users': {
            'total': total_users,
            'brands': total_brands,
            'influencers': total_influencers,
            'pro': pro_users
        },
        'collaborations': {
            'total': total_collabs,
            'active': active_collabs
        },
        'applications': {
            'total': total_applications,
            'pending': pending_apps,
            'accepted': accepted_apps
        },
        'reports': {
            'total': total_reports,
            'pending': pending_reports
        },
        'revenue': {
            'total': total_revenue,
            'currency': 'EUR'
        }
    }

@api_router.get("/admin/users")
async def get_admin_users(
    request: Request,
    user_type: Optional[str] = None,
    is_pro: Optional[bool] = None,
    search: Optional[str] = None,
    limit: int = 50,
    skip: int = 0
):
    """List all users for admin"""
    await require_admin(request)
    
    query = {}
    if user_type:
        query['user_type'] = user_type
    if is_pro is not None:
        query['is_pro'] = is_pro
    if search:
        query['$or'] = [
            {'name': {'$regex': search, '$options': 'i'}},
            {'email': {'$regex': search, '$options': 'i'}}
        ]
    
    users = await db.users.find(query, {'_id': 0, 'password_hash': 0}).skip(skip).limit(limit).to_list(limit)
    total = await db.users.count_documents(query)
    
    return {'users': users, 'total': total}

@api_router.patch("/admin/users/{user_id}")
async def update_user_admin(user_id: str, request: Request):
    """Admin update user (ban, verify, set PRO, etc.)"""
    await require_admin(request)
    body = await request.json()
    
    allowed_fields = ['is_pro', 'is_banned', 'is_verified', 'user_type']
    update_data = {k: v for k, v in body.items() if k in allowed_fields}
    
    if not update_data:
        raise HTTPException(status_code=400, detail="No valid fields to update")
    
    result = await db.users.update_one({'user_id': user_id}, {'$set': update_data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {'success': True}

@api_router.get("/admin/collaborations")
async def get_admin_collaborations(
    request: Request,
    status: Optional[str] = None,
    search: Optional[str] = None,
    limit: int = 50,
    skip: int = 0
):
    """List all collaborations for admin"""
    await require_admin(request)
    
    query = {}
    if status:
        query['status'] = status
    if search:
        query['$or'] = [
            {'title': {'$regex': search, '$options': 'i'}},
            {'brand_name': {'$regex': search, '$options': 'i'}}
        ]
    
    collabs = await db.collaborations.find(query, {'_id': 0}).sort('created_at', -1).skip(skip).limit(limit).to_list(limit)
    total = await db.collaborations.count_documents(query)
    
    return {'collaborations': collabs, 'total': total}

@api_router.delete("/admin/collaborations/{collab_id}")
async def delete_collaboration_admin(collab_id: str, request: Request):
    """Admin delete collaboration"""
    await require_admin(request)
    
    result = await db.collaborations.delete_one({'collab_id': collab_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Collaboration not found")
    
    # Also delete related applications
    await db.applications.delete_many({'collab_id': collab_id})
    
    return {'success': True}

@api_router.get("/admin/reports")
async def get_admin_reports(
    request: Request,
    status: Optional[str] = None,
    limit: int = 50,
    skip: int = 0
):
    """List all reports for admin"""
    await require_admin(request)
    
    query = {}
    if status:
        query['status'] = status
    
    reports = await db.reports.find(query, {'_id': 0}).sort('created_at', -1).skip(skip).limit(limit).to_list(limit)
    total = await db.reports.count_documents(query)
    
    # Enrich with user info
    for report in reports:
        reporter = await db.users.find_one({'user_id': report['reporter_user_id']}, {'_id': 0, 'password_hash': 0})
        reported = await db.users.find_one({'user_id': report['reported_user_id']}, {'_id': 0, 'password_hash': 0})
        report['reporter'] = reporter
        report['reported_user'] = reported
    
    return {'reports': reports, 'total': total}

@api_router.patch("/admin/reports/{report_id}")
async def update_report_admin(report_id: str, request: Request):
    """Admin update report status"""
    await require_admin(request)
    body = await request.json()
    
    new_status = body.get('status')
    action = body.get('action')  # 'ban_user', 'warn_user', 'dismiss'
    
    report = await db.reports.find_one({'report_id': report_id})
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    
    update_data = {'status': new_status, 'resolved_at': datetime.now(timezone.utc).isoformat()}
    await db.reports.update_one({'report_id': report_id}, {'$set': update_data})
    
    # Take action if specified
    if action == 'ban_user':
        await db.users.update_one({'user_id': report['reported_user_id']}, {'$set': {'is_banned': True}})
    
    return {'success': True}

# ============ REPORT USER ENDPOINT ============

@api_router.post("/reports")
async def create_report(request: Request, data: ReportCreate):
    """Report a user"""
    user = await require_auth(request)
    
    # Check reported user exists
    reported = await db.users.find_one({'user_id': data.reported_user_id})
    if not reported:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Can't report yourself
    if data.reported_user_id == user['user_id']:
        raise HTTPException(status_code=400, detail="Cannot report yourself")
    
    report_id = f"report_{uuid.uuid4().hex[:12]}"
    report_doc = {
        'report_id': report_id,
        'reporter_user_id': user['user_id'],
        'reported_user_id': data.reported_user_id,
        'reason': data.reason,
        'details': data.details,
        'status': 'pending',
        'created_at': datetime.now(timezone.utc).isoformat()
    }
    
    await db.reports.insert_one(report_doc)
    
    return {'success': True, 'report_id': report_id}

# ============ ANALYTICS ENDPOINTS (PRO USERS) ============

@api_router.get("/analytics/brand")
async def get_brand_analytics(request: Request):
    """Analytics for brand users (PRO feature)"""
    user = await require_auth(request)
    
    if not user.get('is_pro'):
        raise HTTPException(status_code=403, detail="PRO subscription required for analytics")
    
    # Get all collaborations for this brand
    collabs = await db.collaborations.find({'brand_user_id': user['user_id']}, {'_id': 0}).to_list(100)
    
    total_views = sum(c.get('views', 0) for c in collabs)
    total_applicants = sum(c.get('applicants_count', 0) for c in collabs)
    
    # Application stats
    all_apps = await db.applications.find({'collab_id': {'$in': [c['collab_id'] for c in collabs]}}, {'_id': 0}).to_list(1000)
    
    accepted = len([a for a in all_apps if a['status'] == 'accepted'])
    rejected = len([a for a in all_apps if a['status'] == 'rejected'])
    pending = len([a for a in all_apps if a['status'] == 'pending'])
    
    # Conversion rate
    conversion_rate = (accepted / total_applicants * 100) if total_applicants > 0 else 0
    
    # Platform breakdown
    platform_stats = {}
    for c in collabs:
        platform = c.get('platform', 'other')
        if platform not in platform_stats:
            platform_stats[platform] = {'collabs': 0, 'views': 0, 'applicants': 0}
        platform_stats[platform]['collabs'] += 1
        platform_stats[platform]['views'] += c.get('views', 0)
        platform_stats[platform]['applicants'] += c.get('applicants_count', 0)
    
    # Monthly trend (last 6 months)
    monthly_data = []
    for i in range(6):
        month_start = datetime.now(timezone.utc).replace(day=1) - timedelta(days=30*i)
        month_end = (month_start + timedelta(days=32)).replace(day=1)
        
        month_collabs = [c for c in collabs if month_start.isoformat() <= c.get('created_at', '') < month_end.isoformat()]
        month_apps = [a for a in all_apps if month_start.isoformat() <= a.get('created_at', '') < month_end.isoformat()]
        
        monthly_data.append({
            'month': month_start.strftime('%b %Y'),
            'collaborations': len(month_collabs),
            'applications': len(month_apps)
        })
    
    monthly_data.reverse()
    
    return {
        'overview': {
            'total_collaborations': len(collabs),
            'active_collaborations': len([c for c in collabs if c['status'] == 'active']),
            'total_views': total_views,
            'total_applicants': total_applicants,
            'conversion_rate': round(conversion_rate, 1)
        },
        'applications': {
            'total': len(all_apps),
            'accepted': accepted,
            'rejected': rejected,
            'pending': pending
        },
        'platform_breakdown': platform_stats,
        'monthly_trend': monthly_data
    }

@api_router.get("/analytics/influencer")
async def get_influencer_analytics(request: Request):
    """Analytics for influencer users (PRO feature)"""
    user = await require_auth(request)
    
    if not user.get('is_pro'):
        raise HTTPException(status_code=403, detail="PRO subscription required for analytics")
    
    # Get all applications
    apps = await db.applications.find({'influencer_user_id': user['user_id']}, {'_id': 0}).to_list(100)
    
    total_applied = len(apps)
    accepted = len([a for a in apps if a['status'] == 'accepted'])
    rejected = len([a for a in apps if a['status'] == 'rejected'])
    pending = len([a for a in apps if a['status'] == 'pending'])
    
    # Success rate
    success_rate = (accepted / (accepted + rejected) * 100) if (accepted + rejected) > 0 else 0
    
    # Get profile views (from profile collection)
    profile = await db.influencer_profiles.find_one({'user_id': user['user_id']}, {'_id': 0})
    profile_views = profile.get('views', 0) if profile else 0
    
    # Total earnings estimate (from accepted applications)
    accepted_apps = [a for a in apps if a['status'] == 'accepted']
    total_earnings = sum(a.get('proposed_price', 0) or 0 for a in accepted_apps)
    
    # Platform breakdown of applications
    platform_stats = {}
    for app in apps:
        collab = await db.collaborations.find_one({'collab_id': app['collab_id']}, {'_id': 0})
        if collab:
            platform = collab.get('platform', 'other')
            if platform not in platform_stats:
                platform_stats[platform] = {'applied': 0, 'accepted': 0}
            platform_stats[platform]['applied'] += 1
            if app['status'] == 'accepted':
                platform_stats[platform]['accepted'] += 1
    
    # Monthly activity
    monthly_data = []
    for i in range(6):
        month_start = datetime.now(timezone.utc).replace(day=1) - timedelta(days=30*i)
        month_end = (month_start + timedelta(days=32)).replace(day=1)
        
        month_apps = [a for a in apps if month_start.isoformat() <= a.get('created_at', '') < month_end.isoformat()]
        month_accepted = [a for a in month_apps if a['status'] == 'accepted']
        
        monthly_data.append({
            'month': month_start.strftime('%b %Y'),
            'applications': len(month_apps),
            'accepted': len(month_accepted)
        })
    
    monthly_data.reverse()
    
    return {
        'overview': {
            'total_applications': total_applied,
            'success_rate': round(success_rate, 1),
            'profile_views': profile_views,
            'total_earnings': total_earnings
        },
        'applications': {
            'total': total_applied,
            'accepted': accepted,
            'rejected': rejected,
            'pending': pending
        },
        'platform_breakdown': platform_stats,
        'monthly_trend': monthly_data
    }

# ============ COMMISSION ENDPOINTS ============

async def get_commission_rate() -> float:
    """Get current commission rate from DB, or use default"""
    settings = await db.settings.find_one({'key': 'commission_rate'}, {'_id': 0})
    if settings:
        return settings['value']
    return DEFAULT_COMMISSION_RATE

@api_router.get("/settings/commission")
async def get_commission(request: Request):
    """Get current commission rate (admin only)"""
    await require_admin(request)
    rate = await get_commission_rate()
    return {'commission_rate': rate}

@api_router.put("/settings/commission")
async def update_commission(request: Request):
    """Update commission rate (admin only)"""
    await require_admin(request)
    body = await request.json()
    new_rate = body.get('commission_rate')
    
    if new_rate is None or not (0 <= new_rate <= 100):
        raise HTTPException(status_code=400, detail="Commission rate must be between 0 and 100")
    
    await db.settings.update_one(
        {'key': 'commission_rate'},
        {'$set': {'key': 'commission_rate', 'value': float(new_rate), 'updated_at': datetime.now(timezone.utc).isoformat()}},
        upsert=True
    )
    
    return {'commission_rate': float(new_rate)}

@api_router.get("/admin/commissions")
async def get_admin_commissions(request: Request, limit: int = 50, skip: int = 0):
    """List all commissions (admin only)"""
    await require_admin(request)
    
    commissions = await db.commissions.find({}, {'_id': 0}).sort('created_at', -1).skip(skip).limit(limit).to_list(limit)
    total = await db.commissions.count_documents({})
    
    pipeline = [
        {'$group': {'_id': None, 'total_commission': {'$sum': '$commission_amount'}, 'total_gross': {'$sum': '$gross_amount'}}}
    ]
    summary = await db.commissions.aggregate(pipeline).to_list(1)
    
    return {
        'commissions': commissions,
        'total': total,
        'summary': {
            'total_commission': summary[0]['total_commission'] if summary else 0,
            'total_gross': summary[0]['total_gross'] if summary else 0
        }
    }

@api_router.get("/commission/calculate")
async def calculate_commission(amount: float, request: Request):
    """Calculate commission for a given amount"""
    await require_auth(request)
    rate = await get_commission_rate()
    commission = round(amount * rate / 100, 2)
    net_amount = round(amount - commission, 2)
    return {
        'gross_amount': amount,
        'commission_rate': rate,
        'commission_amount': commission,
        'net_amount': net_amount
    }

# ============ STATS ENDPOINTS ============

@api_router.get("/stats/public")
async def get_public_stats():
    total_collabs = await db.collaborations.count_documents({'status': 'active'})
    total_influencers = await db.influencer_profiles.count_documents({})
    total_applications = await db.applications.count_documents({})
    
    return {
        'active_collaborations': total_collabs,
        'registered_influencers': total_influencers,
        'total_applications': total_applications
    }

# ============ HEALTH CHECK ============

@api_router.get("/")
async def root():
    return {"message": "colaboreaza.ro API is running"}

@api_router.get("/health")
async def health():
    return {"status": "healthy"}

# Include router
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
