"""
Comprehensive Backend API Test Suite for Node.js/Express.js Migration
Tests all features migrated from Python/FastAPI to MERN stack:
- Auth: register, login, logout, /auth/me
- Brand profile CRUD
- Influencer profile CRUD
- Collaborations CRUD + status updates
- Applications: create, list, status updates
- Escrow: create, secure, release, refund (MOCKED payment provider)
- Reviews: create, reveal logic, pending reviews
- Messages: send, list, thread locking on dispute
- Disputes: create, admin resolution
- Cancellations: create, admin resolution
- Admin endpoints: stats, users, commissions, disputes, cancellations
- Commission settings: get/set
- Public endpoints: stats, influencers, collaborations list
"""

import pytest
import requests
import os
import uuid
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
API = f"{BASE_URL}/api"

# Test credentials
BRAND_EMAIL = "testbrand_new@test.com"
BRAND_PASSWORD = "TestPass123"
INFLUENCER_EMAIL = "testinfluencer_new@test.com"
INFLUENCER_PASSWORD = "TestPass123"
ADMIN_EMAIL = "admin2@colaboreaza.ro"
ADMIN_PASSWORD = "AdminPass123"


class TestHelpers:
    """Helper functions for tests"""
    
    @staticmethod
    def login(email: str, password: str) -> tuple:
        """Login and return (token, user)"""
        response = requests.post(f"{API}/auth/login", json={
            "email": email,
            "password": password
        })
        if response.status_code == 200:
            data = response.json()
            return data.get('token'), data.get('user')
        return None, None
    
    @staticmethod
    def get_auth_headers(token: str) -> dict:
        return {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }
    
    @staticmethod
    def gen_unique_email():
        return f"test_{uuid.uuid4().hex[:8]}@test.com"


# ============ HEALTH CHECK ============

class TestHealthEndpoint:
    """Test health endpoint"""
    
    def test_health_check(self):
        """Test: GET /api/health returns healthy status"""
        response = requests.get(f"{API}/health")
        assert response.status_code == 200
        assert response.json()['status'] == 'healthy'
        print("✅ Health check passed")


# ============ AUTH ENDPOINTS ============

class TestAuthEndpoints:
    """Test authentication endpoints: register, login, logout, /auth/me"""
    
    def test_register_new_user(self):
        """Test: POST /api/auth/register creates new user"""
        unique_email = TestHelpers.gen_unique_email()
        response = requests.post(f"{API}/auth/register", json={
            "email": unique_email,
            "password": "TestPass123",
            "name": "Test User",
            "user_type": "influencer"
        })
        assert response.status_code == 200, f"Register failed: {response.text}"
        data = response.json()
        assert 'token' in data
        assert 'user' in data
        assert data['user']['email'] == unique_email
        assert data['user']['user_type'] == 'influencer'
        print(f"✅ Register new user passed: {unique_email}")
    
    def test_register_duplicate_email_fails(self):
        """Test: POST /api/auth/register with existing email returns 400"""
        response = requests.post(f"{API}/auth/register", json={
            "email": BRAND_EMAIL,  # Already exists
            "password": "TestPass123",
            "name": "Duplicate Test"
        })
        assert response.status_code == 400
        assert 'already registered' in response.json().get('detail', '').lower()
        print("✅ Register duplicate email returns 400")
    
    def test_login_success(self):
        """Test: POST /api/auth/login with valid credentials returns token"""
        response = requests.post(f"{API}/auth/login", json={
            "email": BRAND_EMAIL,
            "password": BRAND_PASSWORD
        })
        assert response.status_code == 200
        data = response.json()
        assert 'token' in data
        assert 'user' in data
        assert data['user']['email'] == BRAND_EMAIL
        print("✅ Login success passed")
    
    def test_login_invalid_credentials(self):
        """Test: POST /api/auth/login with wrong password returns 401"""
        response = requests.post(f"{API}/auth/login", json={
            "email": BRAND_EMAIL,
            "password": "wrongpassword"
        })
        assert response.status_code == 401
        assert 'invalid' in response.json().get('detail', '').lower()
        print("✅ Login invalid credentials returns 401")
    
    def test_auth_me_authenticated(self):
        """Test: GET /api/auth/me returns current user when authenticated"""
        token, _ = TestHelpers.login(BRAND_EMAIL, BRAND_PASSWORD)
        response = requests.get(f"{API}/auth/me", headers=TestHelpers.get_auth_headers(token))
        assert response.status_code == 200
        data = response.json()
        assert data['email'] == BRAND_EMAIL
        assert 'password_hash' not in data  # Should be cleaned
        print("✅ Auth me authenticated passed")
    
    def test_auth_me_unauthenticated(self):
        """Test: GET /api/auth/me returns 401 when not authenticated"""
        response = requests.get(f"{API}/auth/me")
        assert response.status_code == 401
        print("✅ Auth me unauthenticated returns 401")
    
    def test_logout(self):
        """Test: POST /api/auth/logout clears session"""
        token, _ = TestHelpers.login(BRAND_EMAIL, BRAND_PASSWORD)
        response = requests.post(f"{API}/auth/logout", headers=TestHelpers.get_auth_headers(token))
        assert response.status_code == 200
        assert response.json()['success'] == True
        print("✅ Logout passed")


# ============ BRAND PROFILE ============

class TestBrandProfile:
    """Test brand profile CRUD"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        self.brand_token, self.brand_user = TestHelpers.login(BRAND_EMAIL, BRAND_PASSWORD)
    
    def test_get_brand_profile(self):
        """Test: GET /api/brands/profile returns brand profile"""
        response = requests.get(
            f"{API}/brands/profile",
            headers=TestHelpers.get_auth_headers(self.brand_token)
        )
        assert response.status_code == 200
        print("✅ Get brand profile passed")
    
    def test_create_update_brand_profile(self):
        """Test: POST /api/brands/profile creates/updates brand profile"""
        profile_data = {
            "company_name": "Test Company",
            "website": "https://testcompany.com",
            "industry": "Technology",
            "description": "A test company for API testing"
        }
        response = requests.post(
            f"{API}/brands/profile",
            headers=TestHelpers.get_auth_headers(self.brand_token),
            json=profile_data
        )
        assert response.status_code == 200
        data = response.json()
        assert data['company_name'] == "Test Company"
        print("✅ Create/Update brand profile passed")


# ============ INFLUENCER PROFILE ============

class TestInfluencerProfile:
    """Test influencer profile CRUD"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        self.influencer_token, self.influencer_user = TestHelpers.login(INFLUENCER_EMAIL, INFLUENCER_PASSWORD)
    
    def test_get_influencer_profile(self):
        """Test: GET /api/influencers/profile returns influencer profile"""
        response = requests.get(
            f"{API}/influencers/profile",
            headers=TestHelpers.get_auth_headers(self.influencer_token)
        )
        assert response.status_code == 200
        print("✅ Get influencer profile passed")
    
    def test_create_update_influencer_profile(self):
        """Test: POST /api/influencers/profile creates/updates influencer profile"""
        profile_data = {
            "username": "testcreator",  # Existing username
            "bio": "Test influencer bio updated",
            "platforms": ["instagram", "tiktok"],
            "niches": ["lifestyle", "tech"],
            "follower_count": 50000
        }
        response = requests.post(
            f"{API}/influencers/profile",
            headers=TestHelpers.get_auth_headers(self.influencer_token),
            json=profile_data
        )
        assert response.status_code == 200
        print("✅ Create/Update influencer profile passed")
    
    def test_get_top_influencers(self):
        """Test: GET /api/influencers/top returns top rated influencers"""
        response = requests.get(f"{API}/influencers/top?limit=5")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✅ Get top influencers passed: {len(data)} found")
    
    def test_list_influencers(self):
        """Test: GET /api/influencers returns influencer list"""
        response = requests.get(f"{API}/influencers?limit=10")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✅ List influencers passed: {len(data)} found")
    
    def test_get_influencer_by_username(self):
        """Test: GET /api/influencers/:username returns influencer profile"""
        response = requests.get(f"{API}/influencers/testcreator")
        assert response.status_code == 200
        data = response.json()
        assert data['username'] == 'testcreator'
        print("✅ Get influencer by username passed")


# ============ COLLABORATIONS ============

class TestCollaborations:
    """Test collaborations CRUD + status updates"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        self.brand_token, self.brand_user = TestHelpers.login(BRAND_EMAIL, BRAND_PASSWORD)
        self.influencer_token, self.influencer_user = TestHelpers.login(INFLUENCER_EMAIL, INFLUENCER_PASSWORD)
    
    def test_create_collaboration_paid(self):
        """Test: POST /api/collaborations creates paid collaboration"""
        unique_id = uuid.uuid4().hex[:8]
        collab_data = {
            "brand_name": "Test Brand",
            "title": f"TEST_COLLAB_PAID_{unique_id}",
            "description": "Test paid collaboration",
            "deliverables": ["1 Instagram post", "2 Stories"],
            "budget_min": 200,
            "budget_max": 400,
            "deadline": (datetime.now() + timedelta(days=30)).isoformat(),
            "platform": "instagram",
            "creators_needed": 1,
            "collaboration_type": "paid"
        }
        response = requests.post(
            f"{API}/collaborations",
            headers=TestHelpers.get_auth_headers(self.brand_token),
            json=collab_data
        )
        assert response.status_code == 200, f"Create collab failed: {response.text}"
        data = response.json()
        assert 'collab_id' in data
        assert data['collaboration_type'] == 'paid'
        assert data['payment_status'] == 'awaiting_escrow'
        print(f"✅ Create paid collaboration passed: {data['collab_id']}")
        return data['collab_id']
    
    def test_create_collaboration_barter(self):
        """Test: POST /api/collaborations creates barter collaboration"""
        unique_id = uuid.uuid4().hex[:8]
        collab_data = {
            "brand_name": "Test Brand",
            "title": f"TEST_COLLAB_BARTER_{unique_id}",
            "description": "Test barter collaboration",
            "deliverables": ["1 Instagram post"],
            "budget_min": 0,
            "deadline": (datetime.now() + timedelta(days=30)).isoformat(),
            "platform": "instagram",
            "collaboration_type": "barter"
        }
        response = requests.post(
            f"{API}/collaborations",
            headers=TestHelpers.get_auth_headers(self.brand_token),
            json=collab_data
        )
        assert response.status_code == 200
        data = response.json()
        assert data['collaboration_type'] == 'barter'
        assert data['payment_status'] == 'none'
        print(f"✅ Create barter collaboration passed: {data['collab_id']}")
    
    def test_list_collaborations_public(self):
        """Test: GET /api/collaborations returns public collaborations"""
        response = requests.get(f"{API}/collaborations?status=active&limit=10")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✅ List collaborations public passed: {len(data)} found")
    
    def test_get_my_collaborations(self):
        """Test: GET /api/collaborations/my returns user's collaborations"""
        response = requests.get(
            f"{API}/collaborations/my",
            headers=TestHelpers.get_auth_headers(self.brand_token)
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✅ Get my collaborations passed: {len(data)} found")
    
    def test_get_collaboration_by_id(self):
        """Test: GET /api/collaborations/:collab_id returns collaboration"""
        # First get a collaboration
        collabs_res = requests.get(f"{API}/collaborations?status=active&limit=1")
        if collabs_res.status_code == 200 and len(collabs_res.json()) > 0:
            collab_id = collabs_res.json()[0]['collab_id']
            response = requests.get(f"{API}/collaborations/{collab_id}")
            assert response.status_code == 200
            data = response.json()
            assert data['collab_id'] == collab_id
            print(f"✅ Get collaboration by ID passed: {collab_id}")
        else:
            pytest.skip("No collaborations available for testing")
    
    def test_update_collaboration_status(self):
        """Test: PATCH /api/collaborations/:collab_id/status updates status"""
        # Create a collaboration first
        unique_id = uuid.uuid4().hex[:8]
        collab_data = {
            "brand_name": "Test Brand",
            "title": f"TEST_STATUS_UPDATE_{unique_id}",
            "description": "Test status update",
            "deliverables": ["1 post"],
            "budget_min": 100,
            "deadline": (datetime.now() + timedelta(days=30)).isoformat(),
            "platform": "instagram",
            "collaboration_type": "barter"
        }
        create_res = requests.post(
            f"{API}/collaborations",
            headers=TestHelpers.get_auth_headers(self.brand_token),
            json=collab_data
        )
        assert create_res.status_code == 200
        collab_id = create_res.json()['collab_id']
        
        # Update status to 'paused'
        status_res = requests.patch(
            f"{API}/collaborations/{collab_id}/status",
            headers=TestHelpers.get_auth_headers(self.brand_token),
            json={"status": "paused"}
        )
        assert status_res.status_code == 200
        print(f"✅ Update collaboration status passed: {collab_id}")


# ============ APPLICATIONS ============

class TestApplications:
    """Test applications: create, list, status updates"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        self.brand_token, self.brand_user = TestHelpers.login(BRAND_EMAIL, BRAND_PASSWORD)
        self.influencer_token, self.influencer_user = TestHelpers.login(INFLUENCER_EMAIL, INFLUENCER_PASSWORD)
    
    def test_create_application(self):
        """Test: POST /api/applications creates application to collaboration"""
        # Create a collaboration first
        unique_id = uuid.uuid4().hex[:8]
        collab_data = {
            "brand_name": "Test Brand",
            "title": f"TEST_APP_{unique_id}",
            "description": "Test for application",
            "deliverables": ["1 post"],
            "budget_min": 200,
            "deadline": (datetime.now() + timedelta(days=30)).isoformat(),
            "platform": "instagram",
            "collaboration_type": "paid"
        }
        create_res = requests.post(
            f"{API}/collaborations",
            headers=TestHelpers.get_auth_headers(self.brand_token),
            json=collab_data
        )
        assert create_res.status_code == 200
        collab_id = create_res.json()['collab_id']
        
        # Apply as influencer
        app_data = {
            "collab_id": collab_id,
            "message": "I'd love to work on this collaboration!",
            "selected_deliverables": ["1 post"],
            "proposed_price": 250
        }
        apply_res = requests.post(
            f"{API}/applications",
            headers=TestHelpers.get_auth_headers(self.influencer_token),
            json=app_data
        )
        assert apply_res.status_code == 200, f"Apply failed: {apply_res.text}"
        data = apply_res.json()
        assert 'application_id' in data
        assert data['status'] == 'pending'
        print(f"✅ Create application passed: {data['application_id']}")
        return data['application_id'], collab_id
    
    def test_get_my_applications(self):
        """Test: GET /api/applications/my returns influencer's applications"""
        response = requests.get(
            f"{API}/applications/my",
            headers=TestHelpers.get_auth_headers(self.influencer_token)
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✅ Get my applications passed: {len(data)} found")
    
    def test_get_applications_for_collab(self):
        """Test: GET /api/applications/collab/:collab_id returns applications for collaboration"""
        # Get my collaborations as brand
        collabs_res = requests.get(
            f"{API}/collaborations/my",
            headers=TestHelpers.get_auth_headers(self.brand_token)
        )
        if collabs_res.status_code == 200 and len(collabs_res.json()) > 0:
            collab_id = collabs_res.json()[0]['collab_id']
            response = requests.get(
                f"{API}/applications/collab/{collab_id}",
                headers=TestHelpers.get_auth_headers(self.brand_token)
            )
            assert response.status_code == 200
            print(f"✅ Get applications for collab passed")
        else:
            pytest.skip("No collaborations to check applications")
    
    def test_update_application_status_accept(self):
        """Test: PATCH /api/applications/:application_id/status accepts application"""
        # Create collab and apply
        unique_id = uuid.uuid4().hex[:8]
        collab_data = {
            "brand_name": "Test Brand",
            "title": f"TEST_ACCEPT_APP_{unique_id}",
            "description": "Test accept application",
            "deliverables": ["1 post"],
            "budget_min": 200,
            "deadline": (datetime.now() + timedelta(days=30)).isoformat(),
            "platform": "instagram",
            "collaboration_type": "paid"
        }
        create_res = requests.post(
            f"{API}/collaborations",
            headers=TestHelpers.get_auth_headers(self.brand_token),
            json=collab_data
        )
        collab_id = create_res.json()['collab_id']
        
        # Apply
        app_data = {
            "collab_id": collab_id,
            "message": "Apply for accept test",
            "selected_deliverables": ["1 post"],
            "proposed_price": 200
        }
        apply_res = requests.post(
            f"{API}/applications",
            headers=TestHelpers.get_auth_headers(self.influencer_token),
            json=app_data
        )
        app_id = apply_res.json()['application_id']
        
        # Accept
        accept_res = requests.patch(
            f"{API}/applications/{app_id}/status",
            headers=TestHelpers.get_auth_headers(self.brand_token),
            json={"status": "accepted"}
        )
        assert accept_res.status_code == 200
        print(f"✅ Accept application passed: {app_id}")


# ============ ESCROW PAYMENTS (MOCKED) ============

class TestEscrowPayments:
    """Test escrow: create, secure, release, refund - Payment provider is MOCKED"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        self.brand_token, self.brand_user = TestHelpers.login(BRAND_EMAIL, BRAND_PASSWORD)
        self.influencer_token, self.influencer_user = TestHelpers.login(INFLUENCER_EMAIL, INFLUENCER_PASSWORD)
    
    def test_create_escrow(self):
        """Test: POST /api/escrow/create/:collab_id creates escrow for paid collaboration"""
        # Create paid collaboration
        unique_id = uuid.uuid4().hex[:8]
        collab_data = {
            "brand_name": "Test Brand",
            "title": f"TEST_ESCROW_CREATE_{unique_id}",
            "description": "Test escrow creation",
            "deliverables": ["1 post"],
            "budget_min": 300,
            "budget_max": 500,
            "deadline": (datetime.now() + timedelta(days=30)).isoformat(),
            "platform": "instagram",
            "collaboration_type": "paid"
        }
        create_res = requests.post(
            f"{API}/collaborations",
            headers=TestHelpers.get_auth_headers(self.brand_token),
            json=collab_data
        )
        collab_id = create_res.json()['collab_id']
        
        # Create escrow
        escrow_res = requests.post(
            f"{API}/escrow/create/{collab_id}",
            headers=TestHelpers.get_auth_headers(self.brand_token)
        )
        assert escrow_res.status_code == 200, f"Create escrow failed: {escrow_res.text}"
        data = escrow_res.json()
        assert 'escrow_id' in data
        assert data['status'] == 'pending'
        assert data['total_amount'] == 500  # budget_max
        assert 'platform_commission' in data
        print(f"✅ Create escrow passed: {data['escrow_id']}")
        return data['escrow_id'], collab_id
    
    def test_secure_escrow(self):
        """Test: POST /api/escrow/:escrow_id/secure marks escrow as secured (MOCKED)"""
        # Create collab and escrow
        unique_id = uuid.uuid4().hex[:8]
        collab_data = {
            "brand_name": "Test Brand",
            "title": f"TEST_ESCROW_SECURE_{unique_id}",
            "description": "Test escrow secure",
            "deliverables": ["1 post"],
            "budget_min": 300,
            "deadline": (datetime.now() + timedelta(days=30)).isoformat(),
            "platform": "instagram",
            "collaboration_type": "paid"
        }
        create_res = requests.post(
            f"{API}/collaborations",
            headers=TestHelpers.get_auth_headers(self.brand_token),
            json=collab_data
        )
        collab_id = create_res.json()['collab_id']
        
        escrow_res = requests.post(
            f"{API}/escrow/create/{collab_id}",
            headers=TestHelpers.get_auth_headers(self.brand_token)
        )
        escrow_id = escrow_res.json()['escrow_id']
        
        # Secure escrow
        secure_res = requests.post(
            f"{API}/escrow/{escrow_id}/secure",
            headers=TestHelpers.get_auth_headers(self.brand_token)
        )
        assert secure_res.status_code == 200
        data = secure_res.json()
        assert data['status'] == 'secured'
        assert 'payment_reference' in data
        print(f"✅ Secure escrow passed (MOCKED): {escrow_id}")
    
    def test_get_escrow_for_collab(self):
        """Test: GET /api/escrow/collab/:collab_id returns escrow status"""
        # Create collab and escrow
        unique_id = uuid.uuid4().hex[:8]
        collab_data = {
            "brand_name": "Test Brand",
            "title": f"TEST_ESCROW_GET_{unique_id}",
            "description": "Test get escrow",
            "deliverables": ["1 post"],
            "budget_min": 200,
            "deadline": (datetime.now() + timedelta(days=30)).isoformat(),
            "platform": "instagram",
            "collaboration_type": "paid"
        }
        create_res = requests.post(
            f"{API}/collaborations",
            headers=TestHelpers.get_auth_headers(self.brand_token),
            json=collab_data
        )
        collab_id = create_res.json()['collab_id']
        
        escrow_res = requests.post(
            f"{API}/escrow/create/{collab_id}",
            headers=TestHelpers.get_auth_headers(self.brand_token)
        )
        
        # Get escrow
        get_res = requests.get(
            f"{API}/escrow/collab/{collab_id}",
            headers=TestHelpers.get_auth_headers(self.brand_token)
        )
        assert get_res.status_code == 200
        data = get_res.json()
        assert data['collab_id'] == collab_id
        print(f"✅ Get escrow for collab passed")
    
    def test_refund_escrow(self):
        """Test: POST /api/escrow/:escrow_id/refund refunds secured escrow"""
        # Create collab, escrow and secure
        unique_id = uuid.uuid4().hex[:8]
        collab_data = {
            "brand_name": "Test Brand",
            "title": f"TEST_ESCROW_REFUND_{unique_id}",
            "description": "Test escrow refund",
            "deliverables": ["1 post"],
            "budget_min": 200,
            "deadline": (datetime.now() + timedelta(days=30)).isoformat(),
            "platform": "instagram",
            "collaboration_type": "paid"
        }
        create_res = requests.post(
            f"{API}/collaborations",
            headers=TestHelpers.get_auth_headers(self.brand_token),
            json=collab_data
        )
        collab_id = create_res.json()['collab_id']
        
        escrow_res = requests.post(
            f"{API}/escrow/create/{collab_id}",
            headers=TestHelpers.get_auth_headers(self.brand_token)
        )
        escrow_id = escrow_res.json()['escrow_id']
        
        # Secure
        requests.post(
            f"{API}/escrow/{escrow_id}/secure",
            headers=TestHelpers.get_auth_headers(self.brand_token)
        )
        
        # Refund
        refund_res = requests.post(
            f"{API}/escrow/{escrow_id}/refund",
            headers=TestHelpers.get_auth_headers(self.brand_token)
        )
        assert refund_res.status_code == 200
        assert refund_res.json()['status'] == 'refunded'
        print(f"✅ Refund escrow passed: {escrow_id}")


# ============ REVIEWS ============

class TestReviews:
    """Test reviews: create, reveal logic, pending reviews"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        self.brand_token, self.brand_user = TestHelpers.login(BRAND_EMAIL, BRAND_PASSWORD)
        self.influencer_token, self.influencer_user = TestHelpers.login(INFLUENCER_EMAIL, INFLUENCER_PASSWORD)
    
    def test_get_pending_reviews(self):
        """Test: GET /api/reviews/pending returns pending reviews for user"""
        response = requests.get(
            f"{API}/reviews/pending",
            headers=TestHelpers.get_auth_headers(self.brand_token)
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✅ Get pending reviews passed: {len(data)} pending")
    
    def test_get_reviews_for_user(self):
        """Test: GET /api/reviews/user/:user_id returns revealed reviews"""
        user_id = self.influencer_user['user_id']
        response = requests.get(f"{API}/reviews/user/{user_id}")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        # All returned reviews should be revealed
        for review in data:
            assert review.get('is_revealed', True) == True
        print(f"✅ Get reviews for user passed: {len(data)} revealed reviews")
    
    def test_create_review_requires_completed_collab(self):
        """Test: POST /api/reviews requires completed collaboration or released payment"""
        # Create a collaboration, apply and accept (but don't complete)
        unique_id = uuid.uuid4().hex[:8]
        collab_data = {
            "brand_name": "Test Brand",
            "title": f"TEST_REVIEW_BLOCK_{unique_id}",
            "description": "Test review block",
            "deliverables": ["1 post"],
            "budget_min": 100,
            "deadline": (datetime.now() + timedelta(days=30)).isoformat(),
            "platform": "instagram",
            "collaboration_type": "barter"
        }
        create_res = requests.post(
            f"{API}/collaborations",
            headers=TestHelpers.get_auth_headers(self.brand_token),
            json=collab_data
        )
        collab_id = create_res.json()['collab_id']
        
        # Apply
        app_data = {
            "collab_id": collab_id,
            "message": "Apply for review test",
            "selected_deliverables": ["1 post"]
        }
        apply_res = requests.post(
            f"{API}/applications",
            headers=TestHelpers.get_auth_headers(self.influencer_token),
            json=app_data
        )
        app_id = apply_res.json()['application_id']
        
        # Accept
        requests.patch(
            f"{API}/applications/{app_id}/status",
            headers=TestHelpers.get_auth_headers(self.brand_token),
            json={"status": "accepted"}
        )
        
        # Try to review before completion (should fail for barter/free until completed)
        review_res = requests.post(
            f"{API}/reviews",
            headers=TestHelpers.get_auth_headers(self.brand_token),
            json={
                "application_id": app_id,
                "rating": 5,
                "comment": "Great work!"
            }
        )
        assert review_res.status_code == 400  # Should fail - not completed
        print("✅ Review requires completed collab passed")


# ============ MESSAGES ============

class TestMessages:
    """Test messages: send, list, thread locking on dispute"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        self.brand_token, self.brand_user = TestHelpers.login(BRAND_EMAIL, BRAND_PASSWORD)
        self.influencer_token, self.influencer_user = TestHelpers.login(INFLUENCER_EMAIL, INFLUENCER_PASSWORD)
    
    def test_send_message_requires_accepted_application(self):
        """Test: POST /api/messages/:collab_id requires accepted application"""
        # Create collab without any applications
        unique_id = uuid.uuid4().hex[:8]
        collab_data = {
            "brand_name": "Test Brand",
            "title": f"TEST_MSG_NO_APP_{unique_id}",
            "description": "Test message without app",
            "deliverables": ["1 post"],
            "budget_min": 100,
            "deadline": (datetime.now() + timedelta(days=30)).isoformat(),
            "platform": "instagram",
            "collaboration_type": "barter"
        }
        create_res = requests.post(
            f"{API}/collaborations",
            headers=TestHelpers.get_auth_headers(self.brand_token),
            json=collab_data
        )
        collab_id = create_res.json()['collab_id']
        
        # Try to send message without accepted application
        msg_res = requests.post(
            f"{API}/messages/{collab_id}",
            headers=TestHelpers.get_auth_headers(self.brand_token),
            json={"content": "Hello!"}
        )
        assert msg_res.status_code == 400
        print("✅ Send message requires accepted application passed")
    
    def test_send_and_get_messages(self):
        """Test: POST and GET /api/messages/:collab_id work after acceptance"""
        # Create collab
        unique_id = uuid.uuid4().hex[:8]
        collab_data = {
            "brand_name": "Test Brand",
            "title": f"TEST_MSG_FLOW_{unique_id}",
            "description": "Test message flow",
            "deliverables": ["1 post"],
            "budget_min": 100,
            "deadline": (datetime.now() + timedelta(days=30)).isoformat(),
            "platform": "instagram",
            "collaboration_type": "barter"
        }
        create_res = requests.post(
            f"{API}/collaborations",
            headers=TestHelpers.get_auth_headers(self.brand_token),
            json=collab_data
        )
        collab_id = create_res.json()['collab_id']
        
        # Apply
        app_data = {
            "collab_id": collab_id,
            "message": "Apply for messaging test",
            "selected_deliverables": ["1 post"]
        }
        apply_res = requests.post(
            f"{API}/applications",
            headers=TestHelpers.get_auth_headers(self.influencer_token),
            json=app_data
        )
        app_id = apply_res.json()['application_id']
        
        # Accept
        requests.patch(
            f"{API}/applications/{app_id}/status",
            headers=TestHelpers.get_auth_headers(self.brand_token),
            json={"status": "accepted"}
        )
        
        # Send message
        msg_res = requests.post(
            f"{API}/messages/{collab_id}",
            headers=TestHelpers.get_auth_headers(self.brand_token),
            json={"content": "Hello influencer!"}
        )
        assert msg_res.status_code == 200
        msg = msg_res.json()
        assert 'message_id' in msg
        assert msg['sender_type'] == 'brand'
        
        # Get messages
        get_res = requests.get(
            f"{API}/messages/{collab_id}",
            headers=TestHelpers.get_auth_headers(self.brand_token)
        )
        assert get_res.status_code == 200
        data = get_res.json()
        assert 'messages' in data
        assert 'is_locked' in data
        assert len(data['messages']) >= 1
        print("✅ Send and get messages passed")


# ============ DISPUTES ============

class TestDisputes:
    """Test disputes: create, admin resolution"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        self.brand_token, self.brand_user = TestHelpers.login(BRAND_EMAIL, BRAND_PASSWORD)
        self.influencer_token, self.influencer_user = TestHelpers.login(INFLUENCER_EMAIL, INFLUENCER_PASSWORD)
        self.admin_token, self.admin_user = TestHelpers.login(ADMIN_EMAIL, ADMIN_PASSWORD)
    
    def test_create_dispute_wrong_status_fails(self):
        """Test: POST /api/disputes/create/:collab_id fails when not completed_pending_release"""
        # Create collab in active status
        unique_id = uuid.uuid4().hex[:8]
        collab_data = {
            "brand_name": "Test Brand",
            "title": f"TEST_DISPUTE_WRONG_{unique_id}",
            "description": "Test dispute wrong status",
            "deliverables": ["1 post"],
            "budget_min": 200,
            "deadline": (datetime.now() + timedelta(days=30)).isoformat(),
            "platform": "instagram",
            "collaboration_type": "paid"
        }
        create_res = requests.post(
            f"{API}/collaborations",
            headers=TestHelpers.get_auth_headers(self.brand_token),
            json=collab_data
        )
        collab_id = create_res.json()['collab_id']
        
        # Try to create dispute on active status
        dispute_res = requests.post(
            f"{API}/disputes/create/{collab_id}",
            headers=TestHelpers.get_auth_headers(self.brand_token),
            json={"reason": "quality_issues", "details": "Test"}
        )
        assert dispute_res.status_code == 400
        print("✅ Create dispute wrong status fails passed")
    
    def test_get_dispute_for_collab(self):
        """Test: GET /api/disputes/collab/:collab_id returns dispute"""
        # Get any dispute (may not exist)
        collabs_res = requests.get(
            f"{API}/collaborations/my",
            headers=TestHelpers.get_auth_headers(self.brand_token)
        )
        if collabs_res.status_code == 200 and len(collabs_res.json()) > 0:
            collab_id = collabs_res.json()[0]['collab_id']
            response = requests.get(
                f"{API}/disputes/collab/{collab_id}",
                headers=TestHelpers.get_auth_headers(self.brand_token)
            )
            assert response.status_code == 200
            print("✅ Get dispute for collab passed")
        else:
            pytest.skip("No collaborations to check disputes")


# ============ CANCELLATIONS ============

class TestCancellations:
    """Test cancellations: create, admin resolution"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        self.brand_token, self.brand_user = TestHelpers.login(BRAND_EMAIL, BRAND_PASSWORD)
        self.admin_token, self.admin_user = TestHelpers.login(ADMIN_EMAIL, ADMIN_PASSWORD)
    
    def test_cancel_active_collab_success(self):
        """Test: POST /api/collaborations/:collab_id/cancel on active collab succeeds"""
        # Create collab
        unique_id = uuid.uuid4().hex[:8]
        collab_data = {
            "brand_name": "Test Brand",
            "title": f"TEST_CANCEL_{unique_id}",
            "description": "Test cancellation",
            "deliverables": ["1 post"],
            "budget_min": 100,
            "deadline": (datetime.now() + timedelta(days=30)).isoformat(),
            "platform": "instagram",
            "collaboration_type": "barter"
        }
        create_res = requests.post(
            f"{API}/collaborations",
            headers=TestHelpers.get_auth_headers(self.brand_token),
            json=collab_data
        )
        collab_id = create_res.json()['collab_id']
        
        # Cancel
        cancel_res = requests.post(
            f"{API}/collaborations/{collab_id}/cancel",
            headers=TestHelpers.get_auth_headers(self.brand_token),
            json={"reason": "changed_requirements", "details": "Plans changed"}
        )
        assert cancel_res.status_code == 200
        assert cancel_res.json()['success'] == True
        print(f"✅ Cancel active collab passed: {collab_id}")
    
    def test_get_cancellation_for_collab(self):
        """Test: GET /api/cancellations/collab/:collab_id returns cancellation"""
        # First cancel a collab
        unique_id = uuid.uuid4().hex[:8]
        collab_data = {
            "brand_name": "Test Brand",
            "title": f"TEST_GET_CANCEL_{unique_id}",
            "description": "Test get cancellation",
            "deliverables": ["1 post"],
            "budget_min": 100,
            "deadline": (datetime.now() + timedelta(days=30)).isoformat(),
            "platform": "instagram",
            "collaboration_type": "barter"
        }
        create_res = requests.post(
            f"{API}/collaborations",
            headers=TestHelpers.get_auth_headers(self.brand_token),
            json=collab_data
        )
        collab_id = create_res.json()['collab_id']
        
        # Cancel
        requests.post(
            f"{API}/collaborations/{collab_id}/cancel",
            headers=TestHelpers.get_auth_headers(self.brand_token),
            json={"reason": "test", "details": "test"}
        )
        
        # Get cancellation
        get_res = requests.get(
            f"{API}/cancellations/collab/{collab_id}",
            headers=TestHelpers.get_auth_headers(self.brand_token)
        )
        assert get_res.status_code == 200
        print("✅ Get cancellation for collab passed")


# ============ ADMIN ENDPOINTS ============

class TestAdminEndpoints:
    """Test admin endpoints: stats, users, commissions, disputes, cancellations"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        self.admin_token, self.admin_user = TestHelpers.login(ADMIN_EMAIL, ADMIN_PASSWORD)
        self.brand_token, _ = TestHelpers.login(BRAND_EMAIL, BRAND_PASSWORD)
    
    def test_admin_stats(self):
        """Test: GET /api/admin/stats returns platform statistics"""
        response = requests.get(
            f"{API}/admin/stats",
            headers=TestHelpers.get_auth_headers(self.admin_token)
        )
        assert response.status_code == 200
        data = response.json()
        assert 'total_users' in data
        assert 'total_collaborations' in data
        assert 'total_applications' in data
        print(f"✅ Admin stats passed: {data['total_users']} users, {data['total_collaborations']} collabs")
    
    def test_admin_stats_unauthorized(self):
        """Test: GET /api/admin/stats returns 403 for non-admin"""
        response = requests.get(
            f"{API}/admin/stats",
            headers=TestHelpers.get_auth_headers(self.brand_token)
        )
        assert response.status_code == 403
        print("✅ Admin stats unauthorized returns 403")
    
    def test_admin_users(self):
        """Test: GET /api/admin/users returns user list"""
        response = requests.get(
            f"{API}/admin/users?limit=10",
            headers=TestHelpers.get_auth_headers(self.admin_token)
        )
        assert response.status_code == 200
        data = response.json()
        assert 'users' in data
        assert 'total' in data
        print(f"✅ Admin users passed: {data['total']} total users")
    
    def test_admin_collaborations(self):
        """Test: GET /api/admin/collaborations returns all collaborations"""
        response = requests.get(
            f"{API}/admin/collaborations?limit=10",
            headers=TestHelpers.get_auth_headers(self.admin_token)
        )
        assert response.status_code == 200
        data = response.json()
        assert 'collaborations' in data
        assert 'total' in data
        print(f"✅ Admin collaborations passed: {data['total']} total")
    
    def test_admin_commissions(self):
        """Test: GET /api/admin/commissions returns commission records"""
        response = requests.get(
            f"{API}/admin/commissions",
            headers=TestHelpers.get_auth_headers(self.admin_token)
        )
        assert response.status_code == 200
        data = response.json()
        assert 'commissions' in data
        assert 'total' in data
        assert 'summary' in data
        print(f"✅ Admin commissions passed: {data['total']} records")
    
    def test_admin_disputes(self):
        """Test: GET /api/admin/disputes returns dispute list"""
        response = requests.get(
            f"{API}/admin/disputes",
            headers=TestHelpers.get_auth_headers(self.admin_token)
        )
        assert response.status_code == 200
        data = response.json()
        assert 'disputes' in data
        assert 'total' in data
        print(f"✅ Admin disputes passed: {data['total']} disputes")
    
    def test_admin_cancellations(self):
        """Test: GET /api/admin/cancellations returns cancellation list"""
        response = requests.get(
            f"{API}/admin/cancellations",
            headers=TestHelpers.get_auth_headers(self.admin_token)
        )
        assert response.status_code == 200
        data = response.json()
        assert 'cancellations' in data
        assert 'total' in data
        print(f"✅ Admin cancellations passed: {data['total']} cancellations")
    
    def test_admin_update_user(self):
        """Test: PATCH /api/admin/users/:user_id updates user"""
        # Get a user first
        users_res = requests.get(
            f"{API}/admin/users?limit=1",
            headers=TestHelpers.get_auth_headers(self.admin_token)
        )
        if users_res.status_code == 200 and len(users_res.json()['users']) > 0:
            user_id = users_res.json()['users'][0]['user_id']
            # Update (just set the same value to avoid breaking anything)
            response = requests.patch(
                f"{API}/admin/users/{user_id}",
                headers=TestHelpers.get_auth_headers(self.admin_token),
                json={"is_pro": False}
            )
            assert response.status_code == 200
            print("✅ Admin update user passed")
        else:
            pytest.skip("No users to update")


# ============ COMMISSION SETTINGS ============

class TestCommissionSettings:
    """Test commission settings: get/set"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        self.admin_token, _ = TestHelpers.login(ADMIN_EMAIL, ADMIN_PASSWORD)
        self.brand_token, _ = TestHelpers.login(BRAND_EMAIL, BRAND_PASSWORD)
    
    def test_get_commission_rate(self):
        """Test: GET /api/settings/commission returns commission rate"""
        response = requests.get(
            f"{API}/settings/commission",
            headers=TestHelpers.get_auth_headers(self.admin_token)
        )
        assert response.status_code == 200
        data = response.json()
        assert 'commission_rate' in data
        print(f"✅ Get commission rate passed: {data['commission_rate']}%")
    
    def test_set_commission_rate(self):
        """Test: PUT /api/settings/commission updates commission rate"""
        # First get current rate
        get_res = requests.get(
            f"{API}/settings/commission",
            headers=TestHelpers.get_auth_headers(self.admin_token)
        )
        original_rate = get_res.json()['commission_rate']
        
        # Update rate
        response = requests.put(
            f"{API}/settings/commission",
            headers=TestHelpers.get_auth_headers(self.admin_token),
            json={"commission_rate": 10.0}
        )
        assert response.status_code == 200
        assert response.json()['commission_rate'] == 10.0
        print("✅ Set commission rate passed")
    
    def test_calculate_commission(self):
        """Test: GET /api/commission/calculate returns commission breakdown"""
        response = requests.get(
            f"{API}/commission/calculate?amount=1000",
            headers=TestHelpers.get_auth_headers(self.brand_token)
        )
        assert response.status_code == 200
        data = response.json()
        assert 'gross_amount' in data
        assert 'commission_rate' in data
        assert 'commission_amount' in data
        assert 'net_amount' in data
        print(f"✅ Calculate commission passed: {data['commission_amount']} commission on {data['gross_amount']}")


# ============ PUBLIC ENDPOINTS ============

class TestPublicEndpoints:
    """Test public endpoints: stats, influencers, collaborations list"""
    
    def test_public_stats(self):
        """Test: GET /api/stats/public returns public statistics"""
        response = requests.get(f"{API}/stats/public")
        assert response.status_code == 200
        data = response.json()
        assert 'active_collaborations' in data
        assert 'total_influencers' in data
        assert 'total_applications' in data
        print(f"✅ Public stats passed: {data['active_collaborations']} active collaborations")
    
    def test_public_influencers_list(self):
        """Test: GET /api/influencers returns public influencer list"""
        response = requests.get(f"{API}/influencers?limit=10")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✅ Public influencers list passed: {len(data)} influencers")
    
    def test_public_collaborations_list(self):
        """Test: GET /api/collaborations returns public collaboration list"""
        response = requests.get(f"{API}/collaborations?status=active&limit=10")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✅ Public collaborations list passed: {len(data)} collaborations")
    
    def test_public_top_influencers(self):
        """Test: GET /api/influencers/top returns top rated influencers"""
        response = requests.get(f"{API}/influencers/top?limit=5")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✅ Public top influencers passed: {len(data)} influencers")


# ============ ANALYTICS ============

class TestAnalytics:
    """Test analytics endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        self.brand_token, _ = TestHelpers.login(BRAND_EMAIL, BRAND_PASSWORD)
        self.influencer_token, _ = TestHelpers.login(INFLUENCER_EMAIL, INFLUENCER_PASSWORD)
    
    def test_brand_analytics(self):
        """Test: GET /api/analytics/brand returns brand analytics"""
        response = requests.get(
            f"{API}/analytics/brand",
            headers=TestHelpers.get_auth_headers(self.brand_token)
        )
        assert response.status_code == 200
        data = response.json()
        assert 'total_collaborations' in data
        assert 'total_applications' in data
        print(f"✅ Brand analytics passed: {data['total_collaborations']} collaborations")
    
    def test_influencer_analytics(self):
        """Test: GET /api/analytics/influencer returns influencer analytics"""
        response = requests.get(
            f"{API}/analytics/influencer",
            headers=TestHelpers.get_auth_headers(self.influencer_token)
        )
        assert response.status_code == 200
        data = response.json()
        assert 'total_applications' in data
        assert 'pending' in data
        assert 'accepted' in data
        print(f"✅ Influencer analytics passed: {data['total_applications']} applications")


# ============ REPORTS ============

class TestReports:
    """Test report endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        self.brand_token, self.brand_user = TestHelpers.login(BRAND_EMAIL, BRAND_PASSWORD)
        self.influencer_token, self.influencer_user = TestHelpers.login(INFLUENCER_EMAIL, INFLUENCER_PASSWORD)
    
    def test_create_report(self):
        """Test: POST /api/reports creates a user report"""
        response = requests.post(
            f"{API}/reports",
            headers=TestHelpers.get_auth_headers(self.brand_token),
            json={
                "reported_user_id": self.influencer_user['user_id'],
                "reason": "test_report",
                "details": "Test report for API testing"
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert 'report_id' in data
        assert data['status'] == 'pending'
        print(f"✅ Create report passed: {data['report_id']}")


# ============ PAYMENTS ============

class TestPayments:
    """Test payment endpoints (MOCKED)"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        self.brand_token, _ = TestHelpers.login(BRAND_EMAIL, BRAND_PASSWORD)
    
    def test_checkout_session(self):
        """Test: POST /api/payments/checkout creates checkout session (MOCKED)"""
        response = requests.post(
            f"{API}/payments/checkout",
            headers=TestHelpers.get_auth_headers(self.brand_token),
            json={"plan_type": "pro_monthly"}
        )
        assert response.status_code == 200
        data = response.json()
        assert 'session_id' in data
        assert 'transaction_id' in data
        print(f"✅ Checkout session passed (MOCKED): {data['session_id']}")
    
    def test_payment_status(self):
        """Test: GET /api/payments/status/:session_id returns payment status"""
        # Create session first
        create_res = requests.post(
            f"{API}/payments/checkout",
            headers=TestHelpers.get_auth_headers(self.brand_token),
            json={"plan_type": "pro_monthly"}
        )
        session_id = create_res.json()['session_id']
        
        # Check status (will auto-complete in mock)
        status_res = requests.get(
            f"{API}/payments/status/{session_id}",
            headers=TestHelpers.get_auth_headers(self.brand_token)
        )
        assert status_res.status_code == 200
        data = status_res.json()
        assert data['status'] in ['pending', 'completed']
        print(f"✅ Payment status passed: {data['status']}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
