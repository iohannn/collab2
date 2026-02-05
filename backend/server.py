from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Depends
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

app = FastAPI(title="colaboreaza.ro API")
api_router = APIRouter(prefix="/api")

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# ============ MODELS ============

class UserBase(BaseModel):
    email: EmailStr
    name: str
    picture: Optional[str] = None
    user_type: str = "influencer"  # "brand" or "influencer"

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
    status: str = "active"  # active, closed, completed
    applicants_count: int = 0
    created_at: datetime
    is_public: bool = True

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

class Application(BaseModel):
    application_id: str
    collab_id: str
    influencer_user_id: str
    influencer_name: str
    influencer_username: str
    message: str
    selected_deliverables: List[str]
    proposed_price: Optional[float] = None
    status: str = "pending"  # pending, accepted, rejected
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
    # Check cookie first
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
    
    # Check Authorization header
    auth_header = request.headers.get('Authorization')
    if auth_header and auth_header.startswith('Bearer '):
        token = auth_header.split(' ')[1]
        # Check if it's a session token
        session = await db.user_sessions.find_one({'session_token': token}, {'_id': 0})
        if session:
            user = await db.users.find_one({'user_id': session['user_id']}, {'_id': 0})
            return user
        # Check if it's a JWT token
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

# ============ AUTH ENDPOINTS ============

@api_router.post("/auth/register")
async def register(data: UserCreate):
    existing = await db.users.find_one({'email': data.email}, {'_id': 0})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    user_id = f"user_{uuid.uuid4().hex[:12]}"
    user_doc = {
        'user_id': user_id,
        'email': data.email,
        'name': data.name,
        'password_hash': hash_password(data.password),
        'user_type': data.user_type,
        'picture': None,
        'is_pro': False,
        'pro_expires_at': None,
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
    user_response = {k: v for k, v in user.items() if k != 'password_hash'}
    return {'token': token, 'user': user_response}

@api_router.post("/auth/session")
async def create_session(request: Request, response: Response):
    """Exchange session_id from Google OAuth for session_token"""
    body = await request.json()
    session_id = body.get('session_id')
    
    if not session_id:
        raise HTTPException(status_code=400, detail="session_id required")
    
    # Call Emergent auth to get user data
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
    
    # Find or create user
    user = await db.users.find_one({'email': email}, {'_id': 0})
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
            'created_at': datetime.now(timezone.utc).isoformat()
        }
        await db.users.insert_one(user)
    else:
        user_id = user['user_id']
        await db.users.update_one({'user_id': user_id}, {'$set': {'picture': picture, 'name': name}})
        user['picture'] = picture
        user['name'] = name
    
    # Store session
    expires_at = datetime.now(timezone.utc) + timedelta(days=7)
    await db.user_sessions.delete_many({'user_id': user_id})
    await db.user_sessions.insert_one({
        'user_id': user_id,
        'session_token': session_token,
        'expires_at': expires_at.isoformat(),
        'created_at': datetime.now(timezone.utc).isoformat()
    })
    
    # Set cookie
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
    
    # Update user type
    await db.users.update_one({'user_id': user['user_id']}, {'$set': {'user_type': 'brand'}})
    
    # Return clean profile without _id
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
        # Check username uniqueness
        username_exists = await db.influencer_profiles.find_one({'username': data.username})
        if username_exists:
            raise HTTPException(status_code=400, detail="Username already taken")
        await db.influencer_profiles.insert_one(profile_dict)
    
    # Update user type
    await db.users.update_one({'user_id': user['user_id']}, {'$set': {'user_type': 'influencer'}})
    
    # Return clean profile without _id
    clean_profile = {k: v for k, v in profile_dict.items() if k != '_id'}
    return clean_profile

@api_router.get("/influencers/{username}")
async def get_public_influencer_profile(username: str):
    """Public endpoint for SEO-friendly influencer profiles"""
    profile = await db.influencer_profiles.find_one({'username': username}, {'_id': 0})
    if not profile:
        raise HTTPException(status_code=404, detail="Influencer not found")
    
    user = await db.users.find_one({'user_id': profile['user_id']}, {'_id': 0, 'password_hash': 0})
    return {**profile, 'user': user}

@api_router.get("/influencers")
async def list_influencers(
    platform: Optional[str] = None,
    niche: Optional[str] = None,
    available: bool = True,
    limit: int = 20,
    skip: int = 0
):
    """List influencers with filters"""
    query = {'available': available}
    if platform:
        query['platforms'] = platform
    if niche:
        query['niches'] = niche
    
    profiles = await db.influencer_profiles.find(query, {'_id': 0}).skip(skip).limit(limit).to_list(limit)
    return profiles

# ============ COLLABORATION ENDPOINTS ============

@api_router.post("/collaborations")
async def create_collaboration(request: Request, data: CollaborationCreate):
    user = await require_auth(request)
    
    # Check PRO limit for brands
    if not user.get('is_pro'):
        active_count = await db.collaborations.count_documents({
            'brand_user_id': user['user_id'],
            'status': 'active'
        })
        if active_count >= 3:
            raise HTTPException(status_code=403, detail="Free users limited to 3 active collaborations. Upgrade to PRO!")
    
    collab_id = f"collab_{uuid.uuid4().hex[:12]}"
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
        'created_at': datetime.now(timezone.utc).isoformat(),
        'is_public': data.is_public
    }
    
    await db.collaborations.insert_one(collab_doc)
    # Return clean collaboration without _id
    clean_collab = {k: v for k, v in collab_doc.items() if k != '_id'}
    return clean_collab

@api_router.get("/collaborations")
async def list_collaborations(
    status: Optional[str] = "active",
    platform: Optional[str] = None,
    is_public: bool = True,
    limit: int = 20,
    skip: int = 0
):
    """List public collaborations"""
    query = {}
    if status:
        query['status'] = status
    if platform:
        query['platform'] = platform
    if is_public:
        query['is_public'] = True
    
    collabs = await db.collaborations.find(query, {'_id': 0}).sort('created_at', -1).skip(skip).limit(limit).to_list(limit)
    return collabs

@api_router.get("/collaborations/my")
async def get_my_collaborations(request: Request):
    """Get collaborations created by the current brand user"""
    user = await require_auth(request)
    collabs = await db.collaborations.find({'brand_user_id': user['user_id']}, {'_id': 0}).sort('created_at', -1).to_list(100)
    return collabs

@api_router.get("/collaborations/{collab_id}")
async def get_collaboration(collab_id: str):
    collab = await db.collaborations.find_one({'collab_id': collab_id}, {'_id': 0})
    if not collab:
        raise HTTPException(status_code=404, detail="Collaboration not found")
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
    
    await db.collaborations.update_one({'collab_id': collab_id}, {'$set': {'status': new_status}})
    return {'success': True}

# ============ APPLICATION ENDPOINTS ============

@api_router.post("/applications")
async def create_application(request: Request, data: ApplicationCreate):
    user = await require_auth(request)
    
    # Get influencer profile
    profile = await db.influencer_profiles.find_one({'user_id': user['user_id']}, {'_id': 0})
    if not profile:
        raise HTTPException(status_code=400, detail="Please complete your influencer profile first")
    
    # Check if already applied
    existing = await db.applications.find_one({
        'collab_id': data.collab_id,
        'influencer_user_id': user['user_id']
    })
    if existing:
        raise HTTPException(status_code=400, detail="Already applied to this collaboration")
    
    # Check collaboration exists and is active
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
    
    # Update applicants count
    await db.collaborations.update_one(
        {'collab_id': data.collab_id},
        {'$inc': {'applicants_count': 1}}
    )
    
    # Return clean application without _id
    clean_app = {k: v for k, v in app_doc.items() if k != '_id'}
    return clean_app

@api_router.get("/applications/my")
async def get_my_applications(request: Request):
    """Get applications made by the current influencer"""
    user = await require_auth(request)
    apps = await db.applications.find({'influencer_user_id': user['user_id']}, {'_id': 0}).sort('created_at', -1).to_list(100)
    
    # Enrich with collaboration details
    for app in apps:
        collab = await db.collaborations.find_one({'collab_id': app['collab_id']}, {'_id': 0})
        app['collaboration'] = collab
    
    return apps

@api_router.get("/applications/collab/{collab_id}")
async def get_collab_applications(collab_id: str, request: Request):
    """Get all applications for a collaboration (brand only)"""
    user = await require_auth(request)
    
    collab = await db.collaborations.find_one({'collab_id': collab_id})
    if not collab:
        raise HTTPException(status_code=404, detail="Collaboration not found")
    if collab['brand_user_id'] != user['user_id']:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    apps = await db.applications.find({'collab_id': collab_id}, {'_id': 0}).sort('created_at', -1).to_list(100)
    
    # Enrich with influencer profiles
    for app in apps:
        profile = await db.influencer_profiles.find_one({'user_id': app['influencer_user_id']}, {'_id': 0})
        app['influencer_profile'] = profile
    
    return apps

@api_router.patch("/applications/{application_id}/status")
async def update_application_status(application_id: str, request: Request):
    user = await require_auth(request)
    body = await request.json()
    new_status = body.get('status')  # accepted or rejected
    
    app = await db.applications.find_one({'application_id': application_id})
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")
    
    # Verify brand owns the collaboration
    collab = await db.collaborations.find_one({'collab_id': app['collab_id']})
    if collab['brand_user_id'] != user['user_id']:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    await db.applications.update_one({'application_id': application_id}, {'$set': {'status': new_status}})
    
    # If accepted, add to influencer's previous collaborations
    if new_status == 'accepted':
        await db.influencer_profiles.update_one(
            {'user_id': app['influencer_user_id']},
            {'$push': {'previous_collaborations': collab['title']}}
        )
    
    return {'success': True}

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
    
    # Import Stripe checkout
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
    
    # Create transaction record
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
    
    # Update transaction and user if paid
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
            
            # Update user PRO status
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

# ============ STATS ENDPOINTS ============

@api_router.get("/stats/public")
async def get_public_stats():
    """Public stats for landing page"""
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
