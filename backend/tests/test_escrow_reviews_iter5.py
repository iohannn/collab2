"""
Test Escrow Payment System & Updated Review Logic
Tests for colaboreaza.ro iteration 5 - New Features:
1. Escrow payment system for paid collaborations
2. Mutual review reveal system (reviews hidden until both parties submit or 14-day timeout)
3. Collaboration types (paid/barter/free) with escrow mandatory only for paid
"""

import pytest
import requests
import os
import uuid
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://mern-collab.preview.emergentagent.com')
API = f"{BASE_URL}/api"

# Test credentials
ADMIN_EMAIL = "admin2@colaboreaza.ro"
ADMIN_PASSWORD = "AdminPass123"
INFLUENCER_EMAIL = "testinfluencer_new@test.com"
INFLUENCER_PASSWORD = "TestPass123"
BRAND_EMAIL = "testbrand_new@test.com"
BRAND_PASSWORD = "TestPass123"


class TestAuthHelpers:
    """Get auth tokens for testing"""
    
    @staticmethod
    def get_brand_token():
        """Get brand auth token"""
        response = requests.post(f"{API}/auth/login", json={
            "email": BRAND_EMAIL,
            "password": BRAND_PASSWORD
        })
        if response.status_code == 200:
            return response.json()["token"]
        return None
    
    @staticmethod
    def get_influencer_token():
        """Get influencer auth token"""
        response = requests.post(f"{API}/auth/login", json={
            "email": INFLUENCER_EMAIL,
            "password": INFLUENCER_PASSWORD
        })
        if response.status_code == 200:
            return response.json()["token"]
        return None
    
    @staticmethod
    def get_admin_token():
        """Get admin auth token"""
        response = requests.post(f"{API}/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code == 200:
            return response.json()["token"]
        return None


# ============ COLLABORATION TYPE TESTS ============

class TestCollaborationTypes:
    """Test collaboration types: paid, barter, free"""
    
    @pytest.fixture
    def brand_token(self):
        return TestAuthHelpers.get_brand_token()
    
    def test_create_paid_collaboration_awaiting_escrow(self, brand_token):
        """Test 1: POST /api/collaborations with collaboration_type='paid' → payment_status should be 'awaiting_escrow'"""
        unique_id = uuid.uuid4().hex[:8]
        response = requests.post(
            f"{API}/collaborations",
            headers={"Authorization": f"Bearer {brand_token}", "Content-Type": "application/json"},
            json={
                "brand_name": "TEST ESCROW BRAND",
                "title": f"TEST_PAID_COLLAB_{unique_id}",
                "description": "Test paid collaboration for escrow",
                "deliverables": ["1 Instagram Post", "2 Stories"],
                "budget_min": 500,
                "budget_max": 800,
                "deadline": (datetime.now() + timedelta(days=14)).isoformat(),
                "platform": "instagram",
                "creators_needed": 1,
                "collaboration_type": "paid"
            }
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        # Verify collaboration type is paid
        assert data["collaboration_type"] == "paid", f"Expected 'paid', got {data.get('collaboration_type')}"
        
        # Verify payment_status is awaiting_escrow for paid collaborations
        assert data["payment_status"] == "awaiting_escrow", f"Expected 'awaiting_escrow', got {data.get('payment_status')}"
        
        print(f"✅ Created paid collaboration {data['collab_id']} with payment_status='awaiting_escrow'")
        return data["collab_id"]
    
    def test_create_barter_collaboration_no_payment(self, brand_token):
        """Test 2: POST /api/collaborations with collaboration_type='barter' → payment_status should be 'none'"""
        unique_id = uuid.uuid4().hex[:8]
        response = requests.post(
            f"{API}/collaborations",
            headers={"Authorization": f"Bearer {brand_token}", "Content-Type": "application/json"},
            json={
                "brand_name": "TEST BARTER BRAND",
                "title": f"TEST_BARTER_COLLAB_{unique_id}",
                "description": "Test barter collaboration - product exchange",
                "deliverables": ["1 TikTok Video"],
                "budget_min": 0,
                "deadline": (datetime.now() + timedelta(days=14)).isoformat(),
                "platform": "tiktok",
                "creators_needed": 1,
                "collaboration_type": "barter"
            }
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        # Verify collaboration type is barter
        assert data["collaboration_type"] == "barter", f"Expected 'barter', got {data.get('collaboration_type')}"
        
        # Verify payment_status is 'none' for barter collaborations
        assert data["payment_status"] == "none", f"Expected 'none', got {data.get('payment_status')}"
        
        print(f"✅ Created barter collaboration {data['collab_id']} with payment_status='none'")
        return data["collab_id"]
    
    def test_create_free_collaboration_no_payment(self, brand_token):
        """Test collaboration_type='free' → payment_status should be 'none'"""
        unique_id = uuid.uuid4().hex[:8]
        response = requests.post(
            f"{API}/collaborations",
            headers={"Authorization": f"Bearer {brand_token}", "Content-Type": "application/json"},
            json={
                "brand_name": "TEST FREE BRAND",
                "title": f"TEST_FREE_COLLAB_{unique_id}",
                "description": "Test free collaboration - exposure only",
                "deliverables": ["Shoutout"],
                "budget_min": 0,
                "deadline": (datetime.now() + timedelta(days=14)).isoformat(),
                "platform": "instagram",
                "creators_needed": 1,
                "collaboration_type": "free"
            }
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        # Verify collaboration type is free
        assert data["collaboration_type"] == "free", f"Expected 'free', got {data.get('collaboration_type')}"
        
        # Verify payment_status is 'none' for free collaborations
        assert data["payment_status"] == "none", f"Expected 'none', got {data.get('payment_status')}"
        
        print(f"✅ Created free collaboration {data['collab_id']} with payment_status='none'")


# ============ ESCROW SYSTEM TESTS ============

class TestEscrowSystem:
    """Test escrow payment system"""
    
    @pytest.fixture
    def brand_token(self):
        return TestAuthHelpers.get_brand_token()
    
    @pytest.fixture
    def influencer_token(self):
        return TestAuthHelpers.get_influencer_token()
    
    @pytest.fixture
    def paid_collaboration(self, brand_token):
        """Create a paid collaboration for testing"""
        unique_id = uuid.uuid4().hex[:8]
        response = requests.post(
            f"{API}/collaborations",
            headers={"Authorization": f"Bearer {brand_token}", "Content-Type": "application/json"},
            json={
                "brand_name": "TEST ESCROW BRAND",
                "title": f"TEST_ESCROW_{unique_id}",
                "description": "Test collaboration for escrow flow",
                "deliverables": ["1 Post", "2 Stories"],
                "budget_min": 400,
                "budget_max": 600,
                "deadline": (datetime.now() + timedelta(days=14)).isoformat(),
                "platform": "instagram",
                "creators_needed": 1,
                "collaboration_type": "paid"
            }
        )
        assert response.status_code == 200
        return response.json()
    
    def test_create_escrow(self, brand_token, paid_collaboration):
        """Test 3: POST /api/escrow/create/{collab_id} → creates escrow with correct commission breakdown (10%)"""
        collab_id = paid_collaboration["collab_id"]
        budget = paid_collaboration.get("budget_max") or paid_collaboration.get("budget_min")
        
        response = requests.post(
            f"{API}/escrow/create/{collab_id}",
            headers={"Authorization": f"Bearer {brand_token}", "Content-Type": "application/json"}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        # Verify escrow was created
        assert "escrow_id" in data, "Response should contain escrow_id"
        assert data["collab_id"] == collab_id
        assert data["status"] == "pending"
        
        # Verify commission breakdown (10% default rate)
        assert "total_amount" in data, "Response should contain total_amount"
        assert "influencer_payout" in data, "Response should contain influencer_payout"
        assert "platform_commission" in data, "Response should contain platform_commission"
        assert "commission_rate" in data, "Response should contain commission_rate"
        
        # Default commission rate is 10%
        expected_commission = round(budget * 0.10, 2)
        expected_payout = round(budget - expected_commission, 2)
        
        assert data["total_amount"] == budget, f"total_amount should be {budget}"
        assert abs(data["platform_commission"] - expected_commission) < 0.1, f"Commission should be ~{expected_commission}"
        assert abs(data["influencer_payout"] - expected_payout) < 0.1, f"Payout should be ~{expected_payout}"
        
        print(f"✅ Created escrow {data['escrow_id']} with commission breakdown: total={data['total_amount']}, commission={data['platform_commission']}, payout={data['influencer_payout']}")
        return data
    
    def test_secure_escrow(self, brand_token, paid_collaboration):
        """Test 4: POST /api/escrow/{escrow_id}/secure → marks escrow as 'secured' and updates collaboration"""
        collab_id = paid_collaboration["collab_id"]
        
        # First create escrow
        create_resp = requests.post(
            f"{API}/escrow/create/{collab_id}",
            headers={"Authorization": f"Bearer {brand_token}", "Content-Type": "application/json"}
        )
        assert create_resp.status_code == 200
        escrow_id = create_resp.json()["escrow_id"]
        
        # Now secure escrow (mock payment)
        secure_resp = requests.post(
            f"{API}/escrow/{escrow_id}/secure",
            headers={"Authorization": f"Bearer {brand_token}", "Content-Type": "application/json"}
        )
        
        assert secure_resp.status_code == 200, f"Expected 200, got {secure_resp.status_code}: {secure_resp.text}"
        data = secure_resp.json()
        
        assert data["status"] == "secured", f"Expected status='secured', got {data.get('status')}"
        assert data["success"] == True
        assert "payment_reference" in data, "Should contain payment_reference"
        
        # Verify collaboration payment_status is updated
        collab_resp = requests.get(f"{API}/collaborations/{collab_id}")
        assert collab_resp.status_code == 200
        collab = collab_resp.json()
        
        assert collab["payment_status"] == "secured", f"Collaboration payment_status should be 'secured', got {collab.get('payment_status')}"
        
        print(f"✅ Escrow {escrow_id} secured successfully with payment_reference={data['payment_reference']}")
        return escrow_id
    
    def test_get_escrow_for_collaboration(self, brand_token, paid_collaboration):
        """Test 5: GET /api/escrow/collab/{collab_id} → returns escrow status for a collaboration"""
        collab_id = paid_collaboration["collab_id"]
        
        # Create and secure escrow
        create_resp = requests.post(
            f"{API}/escrow/create/{collab_id}",
            headers={"Authorization": f"Bearer {brand_token}", "Content-Type": "application/json"}
        )
        assert create_resp.status_code == 200
        escrow_id = create_resp.json()["escrow_id"]
        
        requests.post(
            f"{API}/escrow/{escrow_id}/secure",
            headers={"Authorization": f"Bearer {brand_token}", "Content-Type": "application/json"}
        )
        
        # Get escrow for collaboration
        response = requests.get(
            f"{API}/escrow/collab/{collab_id}",
            headers={"Authorization": f"Bearer {brand_token}"}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        assert data["escrow_id"] == escrow_id
        assert data["status"] == "secured"
        assert "total_amount" in data
        assert "influencer_payout" in data
        
        print(f"✅ GET escrow for collab {collab_id} returned status={data['status']}")
    
    def test_cannot_create_escrow_for_barter(self, brand_token):
        """Test that escrow cannot be created for barter collaborations"""
        unique_id = uuid.uuid4().hex[:8]
        
        # Create barter collaboration
        create_collab = requests.post(
            f"{API}/collaborations",
            headers={"Authorization": f"Bearer {brand_token}", "Content-Type": "application/json"},
            json={
                "brand_name": "BARTER BRAND",
                "title": f"TEST_BARTER_{unique_id}",
                "description": "Barter - no escrow needed",
                "deliverables": ["1 Post"],
                "budget_min": 0,
                "deadline": (datetime.now() + timedelta(days=14)).isoformat(),
                "platform": "instagram",
                "creators_needed": 1,
                "collaboration_type": "barter"
            }
        )
        assert create_collab.status_code == 200
        collab_id = create_collab.json()["collab_id"]
        
        # Try to create escrow (should fail)
        response = requests.post(
            f"{API}/escrow/create/{collab_id}",
            headers={"Authorization": f"Bearer {brand_token}", "Content-Type": "application/json"}
        )
        
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        print(f"✅ Escrow correctly rejected for barter collaboration")


# ============ COLLABORATION STATUS TESTS ============

class TestCollaborationStatus:
    """Test collaboration status changes with escrow"""
    
    @pytest.fixture
    def brand_token(self):
        return TestAuthHelpers.get_brand_token()
    
    @pytest.fixture
    def influencer_token(self):
        return TestAuthHelpers.get_influencer_token()
    
    def test_paid_collab_completion_pending_release(self, brand_token):
        """Test 6: PATCH /api/collaborations/{collab_id}/status with 'completed' on paid collab → should return 'completed_pending_release' not 'completed'"""
        unique_id = uuid.uuid4().hex[:8]
        
        # Create paid collaboration
        create_resp = requests.post(
            f"{API}/collaborations",
            headers={"Authorization": f"Bearer {brand_token}", "Content-Type": "application/json"},
            json={
                "brand_name": "TEST RELEASE BRAND",
                "title": f"TEST_RELEASE_{unique_id}",
                "description": "Test completion pending release",
                "deliverables": ["1 Post"],
                "budget_min": 300,
                "deadline": (datetime.now() + timedelta(days=14)).isoformat(),
                "platform": "instagram",
                "creators_needed": 1,
                "collaboration_type": "paid"
            }
        )
        assert create_resp.status_code == 200
        collab_id = create_resp.json()["collab_id"]
        
        # Create and secure escrow
        escrow_resp = requests.post(
            f"{API}/escrow/create/{collab_id}",
            headers={"Authorization": f"Bearer {brand_token}", "Content-Type": "application/json"}
        )
        assert escrow_resp.status_code == 200
        escrow_id = escrow_resp.json()["escrow_id"]
        
        secure_resp = requests.post(
            f"{API}/escrow/{escrow_id}/secure",
            headers={"Authorization": f"Bearer {brand_token}", "Content-Type": "application/json"}
        )
        assert secure_resp.status_code == 200
        
        # Mark as completed (should go to completed_pending_release)
        status_resp = requests.patch(
            f"{API}/collaborations/{collab_id}/status",
            headers={"Authorization": f"Bearer {brand_token}", "Content-Type": "application/json"},
            json={"status": "completed"}
        )
        
        assert status_resp.status_code == 200, f"Expected 200, got {status_resp.status_code}: {status_resp.text}"
        data = status_resp.json()
        
        # Verify status is completed_pending_release (not completed)
        assert data.get("payment_status") == "completed_pending_release", f"Expected 'completed_pending_release', got {data.get('payment_status')}"
        
        # Verify collaboration status
        collab_resp = requests.get(f"{API}/collaborations/{collab_id}")
        collab = collab_resp.json()
        assert collab["status"] == "completed_pending_release", f"Collab status should be 'completed_pending_release', got {collab.get('status')}"
        
        print(f"✅ Paid collaboration {collab_id} correctly set to 'completed_pending_release'")
        return collab_id, escrow_id
    
    def test_barter_collab_directly_completed(self, brand_token):
        """Test 7: PATCH /api/collaborations/{collab_id}/status with 'completed' on barter collab → should go directly to 'completed'"""
        unique_id = uuid.uuid4().hex[:8]
        
        # Create barter collaboration
        create_resp = requests.post(
            f"{API}/collaborations",
            headers={"Authorization": f"Bearer {brand_token}", "Content-Type": "application/json"},
            json={
                "brand_name": "TEST BARTER COMPLETE",
                "title": f"TEST_BARTER_COMPLETE_{unique_id}",
                "description": "Test barter direct completion",
                "deliverables": ["1 Video"],
                "budget_min": 0,
                "deadline": (datetime.now() + timedelta(days=14)).isoformat(),
                "platform": "tiktok",
                "creators_needed": 1,
                "collaboration_type": "barter"
            }
        )
        assert create_resp.status_code == 200
        collab_id = create_resp.json()["collab_id"]
        
        # Mark as completed (should go directly to completed)
        status_resp = requests.patch(
            f"{API}/collaborations/{collab_id}/status",
            headers={"Authorization": f"Bearer {brand_token}", "Content-Type": "application/json"},
            json={"status": "completed"}
        )
        
        assert status_resp.status_code == 200, f"Expected 200, got {status_resp.status_code}: {status_resp.text}"
        
        # Verify collaboration is directly completed
        collab_resp = requests.get(f"{API}/collaborations/{collab_id}")
        collab = collab_resp.json()
        assert collab["status"] == "completed", f"Barter collab status should be 'completed', got {collab.get('status')}"
        assert collab["payment_status"] == "none", f"Barter collab payment_status should be 'none', got {collab.get('payment_status')}"
        
        print(f"✅ Barter collaboration {collab_id} directly completed without escrow")


# ============ ESCROW RELEASE TESTS ============

class TestEscrowRelease:
    """Test escrow release and refund functionality"""
    
    @pytest.fixture
    def brand_token(self):
        return TestAuthHelpers.get_brand_token()
    
    @pytest.fixture
    def influencer_token(self):
        return TestAuthHelpers.get_influencer_token()
    
    def test_release_escrow_creates_commission(self, brand_token, influencer_token):
        """Test 8: POST /api/escrow/{escrow_id}/release → releases funds, creates commission records, updates collaboration to 'completed'"""
        unique_id = uuid.uuid4().hex[:8]
        
        # Create paid collaboration
        create_resp = requests.post(
            f"{API}/collaborations",
            headers={"Authorization": f"Bearer {brand_token}", "Content-Type": "application/json"},
            json={
                "brand_name": "TEST RELEASE",
                "title": f"TEST_RELEASE_{unique_id}",
                "description": "Test release flow",
                "deliverables": ["1 Post"],
                "budget_min": 500,
                "deadline": (datetime.now() + timedelta(days=14)).isoformat(),
                "platform": "instagram",
                "creators_needed": 1,
                "collaboration_type": "paid"
            }
        )
        assert create_resp.status_code == 200
        collab_id = create_resp.json()["collab_id"]
        
        # Create and secure escrow
        escrow_resp = requests.post(
            f"{API}/escrow/create/{collab_id}",
            headers={"Authorization": f"Bearer {brand_token}", "Content-Type": "application/json"}
        )
        escrow_id = escrow_resp.json()["escrow_id"]
        
        requests.post(
            f"{API}/escrow/{escrow_id}/secure",
            headers={"Authorization": f"Bearer {brand_token}", "Content-Type": "application/json"}
        )
        
        # Mark completed → pending release
        requests.patch(
            f"{API}/collaborations/{collab_id}/status",
            headers={"Authorization": f"Bearer {brand_token}", "Content-Type": "application/json"},
            json={"status": "completed"}
        )
        
        # Release escrow
        release_resp = requests.post(
            f"{API}/escrow/{escrow_id}/release",
            headers={"Authorization": f"Bearer {brand_token}", "Content-Type": "application/json"}
        )
        
        assert release_resp.status_code == 200, f"Expected 200, got {release_resp.status_code}: {release_resp.text}"
        data = release_resp.json()
        
        assert data["status"] == "released"
        assert data["success"] == True
        
        # Verify collaboration status is now 'completed'
        collab_resp = requests.get(f"{API}/collaborations/{collab_id}")
        collab = collab_resp.json()
        assert collab["status"] == "completed", f"After release, status should be 'completed', got {collab.get('status')}"
        assert collab["payment_status"] == "released", f"payment_status should be 'released', got {collab.get('payment_status')}"
        
        print(f"✅ Escrow {escrow_id} released successfully, collaboration now 'completed' with payment_status='released'")
    
    def test_refund_escrow(self, brand_token):
        """Test 14: POST /api/escrow/{escrow_id}/refund → refunds escrow"""
        unique_id = uuid.uuid4().hex[:8]
        
        # Create paid collaboration
        create_resp = requests.post(
            f"{API}/collaborations",
            headers={"Authorization": f"Bearer {brand_token}", "Content-Type": "application/json"},
            json={
                "brand_name": "TEST REFUND",
                "title": f"TEST_REFUND_{unique_id}",
                "description": "Test refund flow",
                "deliverables": ["1 Post"],
                "budget_min": 200,
                "deadline": (datetime.now() + timedelta(days=14)).isoformat(),
                "platform": "instagram",
                "creators_needed": 1,
                "collaboration_type": "paid"
            }
        )
        assert create_resp.status_code == 200
        collab_id = create_resp.json()["collab_id"]
        
        # Create and secure escrow
        escrow_resp = requests.post(
            f"{API}/escrow/create/{collab_id}",
            headers={"Authorization": f"Bearer {brand_token}", "Content-Type": "application/json"}
        )
        escrow_id = escrow_resp.json()["escrow_id"]
        
        requests.post(
            f"{API}/escrow/{escrow_id}/secure",
            headers={"Authorization": f"Bearer {brand_token}", "Content-Type": "application/json"}
        )
        
        # Refund escrow
        refund_resp = requests.post(
            f"{API}/escrow/{escrow_id}/refund",
            headers={"Authorization": f"Bearer {brand_token}", "Content-Type": "application/json"}
        )
        
        assert refund_resp.status_code == 200, f"Expected 200, got {refund_resp.status_code}: {refund_resp.text}"
        data = refund_resp.json()
        
        assert data["status"] == "refunded"
        assert data["success"] == True
        
        # Verify collaboration payment_status is refunded
        collab_resp = requests.get(f"{API}/collaborations/{collab_id}")
        collab = collab_resp.json()
        assert collab["payment_status"] == "refunded", f"payment_status should be 'refunded', got {collab.get('payment_status')}"
        
        print(f"✅ Escrow {escrow_id} refunded successfully")


# ============ REVIEW SYSTEM TESTS ============

class TestReviewSystem:
    """Test mutual review reveal system"""
    
    @pytest.fixture
    def brand_token(self):
        return TestAuthHelpers.get_brand_token()
    
    @pytest.fixture
    def influencer_token(self):
        return TestAuthHelpers.get_influencer_token()
    
    def test_review_requires_released_payment_for_paid(self, brand_token, influencer_token):
        """Test 9: POST /api/reviews → should fail if paid collab payment_status != 'released'"""
        unique_id = uuid.uuid4().hex[:8]
        
        # Create paid collaboration
        create_resp = requests.post(
            f"{API}/collaborations",
            headers={"Authorization": f"Bearer {brand_token}", "Content-Type": "application/json"},
            json={
                "brand_name": "TEST REVIEW PAID",
                "title": f"TEST_REVIEW_PAID_{unique_id}",
                "description": "Test review restriction",
                "deliverables": ["1 Post"],
                "budget_min": 300,
                "deadline": (datetime.now() + timedelta(days=14)).isoformat(),
                "platform": "instagram",
                "creators_needed": 1,
                "collaboration_type": "paid"
            }
        )
        assert create_resp.status_code == 200
        collab_id = create_resp.json()["collab_id"]
        
        # Secure escrow but DON'T release
        escrow_resp = requests.post(
            f"{API}/escrow/create/{collab_id}",
            headers={"Authorization": f"Bearer {brand_token}", "Content-Type": "application/json"}
        )
        escrow_id = escrow_resp.json()["escrow_id"]
        
        requests.post(
            f"{API}/escrow/{escrow_id}/secure",
            headers={"Authorization": f"Bearer {brand_token}", "Content-Type": "application/json"}
        )
        
        # Apply as influencer
        apply_resp = requests.post(
            f"{API}/applications",
            headers={"Authorization": f"Bearer {influencer_token}", "Content-Type": "application/json"},
            json={
                "collab_id": collab_id,
                "message": "I want to collaborate!",
                "selected_deliverables": ["1 Post"],
                "proposed_price": 300
            }
        )
        # It's ok if application fails due to profile requirement
        if apply_resp.status_code != 200:
            print(f"⚠️ Application creation failed (may need influencer profile): {apply_resp.text}")
            pytest.skip("Influencer profile required for application")
            return
        
        app_id = apply_resp.json()["application_id"]
        
        # Accept application
        requests.patch(
            f"{API}/applications/{app_id}/status",
            headers={"Authorization": f"Bearer {brand_token}", "Content-Type": "application/json"},
            json={"status": "accepted"}
        )
        
        # Mark completed (goes to pending_release)
        requests.patch(
            f"{API}/collaborations/{collab_id}/status",
            headers={"Authorization": f"Bearer {brand_token}", "Content-Type": "application/json"},
            json={"status": "completed"}
        )
        
        # Try to create review WITHOUT releasing funds (should fail)
        review_resp = requests.post(
            f"{API}/reviews",
            headers={"Authorization": f"Bearer {brand_token}", "Content-Type": "application/json"},
            json={
                "application_id": app_id,
                "rating": 5,
                "comment": "Great work!"
            }
        )
        
        # Should fail because payment not released
        assert review_resp.status_code == 400, f"Expected 400 (review blocked), got {review_resp.status_code}: {review_resp.text}"
        
        print(f"✅ Review correctly blocked for paid collab without released payment")
    
    def test_review_works_for_completed_barter(self, brand_token, influencer_token):
        """Test 10: POST /api/reviews → should work for barter collab if status is 'completed'"""
        unique_id = uuid.uuid4().hex[:8]
        
        # Create barter collaboration
        create_resp = requests.post(
            f"{API}/collaborations",
            headers={"Authorization": f"Bearer {brand_token}", "Content-Type": "application/json"},
            json={
                "brand_name": "TEST REVIEW BARTER",
                "title": f"TEST_REVIEW_BARTER_{unique_id}",
                "description": "Test review for barter",
                "deliverables": ["1 Video"],
                "budget_min": 0,
                "deadline": (datetime.now() + timedelta(days=14)).isoformat(),
                "platform": "tiktok",
                "creators_needed": 1,
                "collaboration_type": "barter"
            }
        )
        assert create_resp.status_code == 200
        collab_id = create_resp.json()["collab_id"]
        
        # Apply as influencer
        apply_resp = requests.post(
            f"{API}/applications",
            headers={"Authorization": f"Bearer {influencer_token}", "Content-Type": "application/json"},
            json={
                "collab_id": collab_id,
                "message": "Barter sounds great!",
                "selected_deliverables": ["1 Video"]
            }
        )
        if apply_resp.status_code != 200:
            print(f"⚠️ Application creation failed: {apply_resp.text}")
            pytest.skip("Influencer profile required for application")
            return
        
        app_id = apply_resp.json()["application_id"]
        
        # Accept application
        requests.patch(
            f"{API}/applications/{app_id}/status",
            headers={"Authorization": f"Bearer {brand_token}", "Content-Type": "application/json"},
            json={"status": "accepted"}
        )
        
        # Mark completed (directly completed for barter)
        requests.patch(
            f"{API}/collaborations/{collab_id}/status",
            headers={"Authorization": f"Bearer {brand_token}", "Content-Type": "application/json"},
            json={"status": "completed"}
        )
        
        # Create review (should work)
        review_resp = requests.post(
            f"{API}/reviews",
            headers={"Authorization": f"Bearer {brand_token}", "Content-Type": "application/json"},
            json={
                "application_id": app_id,
                "rating": 4,
                "comment": "Good barter exchange!"
            }
        )
        
        assert review_resp.status_code == 200, f"Expected 200, got {review_resp.status_code}: {review_resp.text}"
        review = review_resp.json()
        
        # Review should be created but NOT revealed yet (mutual reveal)
        assert review.get("is_revealed") == False, f"New review should have is_revealed=false, got {review.get('is_revealed')}"
        
        print(f"✅ Review created for barter collab with is_revealed=false")
        return app_id
    
    def test_mutual_reveal_both_reviews(self, brand_token, influencer_token):
        """Test 11: Reviews mutual reveal: when both parties submit reviews, both should have is_revealed=true"""
        unique_id = uuid.uuid4().hex[:8]
        
        # Create barter collaboration (simpler flow)
        create_resp = requests.post(
            f"{API}/collaborations",
            headers={"Authorization": f"Bearer {brand_token}", "Content-Type": "application/json"},
            json={
                "brand_name": "TEST MUTUAL REVEAL",
                "title": f"TEST_MUTUAL_{unique_id}",
                "description": "Test mutual reveal",
                "deliverables": ["1 Post"],
                "budget_min": 0,
                "deadline": (datetime.now() + timedelta(days=14)).isoformat(),
                "platform": "instagram",
                "creators_needed": 1,
                "collaboration_type": "barter"
            }
        )
        assert create_resp.status_code == 200
        collab_id = create_resp.json()["collab_id"]
        
        # Apply as influencer
        apply_resp = requests.post(
            f"{API}/applications",
            headers={"Authorization": f"Bearer {influencer_token}", "Content-Type": "application/json"},
            json={
                "collab_id": collab_id,
                "message": "Test mutual reveal",
                "selected_deliverables": ["1 Post"]
            }
        )
        if apply_resp.status_code != 200:
            pytest.skip("Influencer profile required")
            return
        
        app_id = apply_resp.json()["application_id"]
        
        # Accept and complete
        requests.patch(
            f"{API}/applications/{app_id}/status",
            headers={"Authorization": f"Bearer {brand_token}", "Content-Type": "application/json"},
            json={"status": "accepted"}
        )
        requests.patch(
            f"{API}/collaborations/{collab_id}/status",
            headers={"Authorization": f"Bearer {brand_token}", "Content-Type": "application/json"},
            json={"status": "completed"}
        )
        
        # Brand submits review first
        brand_review = requests.post(
            f"{API}/reviews",
            headers={"Authorization": f"Bearer {brand_token}", "Content-Type": "application/json"},
            json={"application_id": app_id, "rating": 5, "comment": "Great creator!"}
        )
        assert brand_review.status_code == 200
        brand_review_data = brand_review.json()
        
        # Check brand review is NOT revealed yet
        assert brand_review_data.get("is_revealed") == False, "First review should not be revealed"
        
        # Influencer submits review second
        inf_review = requests.post(
            f"{API}/reviews",
            headers={"Authorization": f"Bearer {influencer_token}", "Content-Type": "application/json"},
            json={"application_id": app_id, "rating": 4, "comment": "Good brand!"}
        )
        assert inf_review.status_code == 200
        
        # After both submit, check reviews for this application
        reviews_resp = requests.get(
            f"{API}/reviews/application/{app_id}",
            headers={"Authorization": f"Bearer {brand_token}"}
        )
        assert reviews_resp.status_code == 200
        reviews_data = reviews_resp.json()
        
        # Both reviews should now be revealed
        for review in reviews_data.get("reviews", []):
            assert review.get("is_revealed") == True, f"Review {review.get('review_id')} should be revealed after both submit"
        
        print(f"✅ Mutual reveal works: both reviews are now is_revealed=true")
    
    def test_single_review_not_revealed(self, brand_token, influencer_token):
        """Test 12: Reviews before both submit should have is_revealed=false"""
        # This is tested in test_review_works_for_completed_barter
        # When only brand reviews, is_revealed should be false
        print("✅ Already tested in test_review_works_for_completed_barter - single review has is_revealed=false")
    
    def test_get_user_reviews_only_revealed(self, brand_token):
        """Test 13: GET /api/reviews/user/{user_id} → returns only revealed reviews"""
        # Get influencer profile to get user_id
        inf_login = requests.post(f"{API}/auth/login", json={
            "email": INFLUENCER_EMAIL,
            "password": INFLUENCER_PASSWORD
        })
        assert inf_login.status_code == 200
        inf_user_id = inf_login.json()["user"]["user_id"]
        
        # Get user reviews
        response = requests.get(f"{API}/reviews/user/{inf_user_id}")
        assert response.status_code == 200
        reviews = response.json()
        
        # All returned reviews should have is_revealed=true
        for review in reviews:
            assert review.get("is_revealed", True) == True, f"All returned reviews should be revealed"
        
        print(f"✅ GET /api/reviews/user/{inf_user_id} returns only revealed reviews")


# ============ HEALTH CHECK ============

class TestHealthCheck:
    """Basic health check"""
    
    def test_api_health(self):
        """Test API is healthy"""
        response = requests.get(f"{API}/health")
        assert response.status_code == 200
        assert response.json()["status"] == "healthy"
        print("✅ API is healthy")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
