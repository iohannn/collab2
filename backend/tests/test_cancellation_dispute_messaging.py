"""
Test suite for Iteration 6: Cancellation, Dispute, and Messaging features
- Cancellation system (before work = instant refund, in_progress = admin review)
- Dispute system (only in completed_pending_release, blocks escrow release, locks messaging)
- Collaboration-based messaging (only after acceptance, locked during dispute)
"""

import pytest
import requests
import os
import uuid
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
API = f"{BASE_URL}/api"

# Test credentials
BRAND_EMAIL = "testbrand_new@test.com"
BRAND_PASSWORD = "TestPass123"
INFLUENCER_EMAIL = "testinfluencer_new@test.com"
INFLUENCER_PASSWORD = "TestPass123"
ADMIN_EMAIL = "admin2@colaboreaza.ro"
ADMIN_PASSWORD = "AdminPass123"


class TestSetup:
    """Helper class for test setup and authentication"""
    
    @staticmethod
    def login(email: str, password: str) -> tuple:
        """Login and return (token, user)"""
        response = requests.post(f"{API}/auth/login", json={
            "email": email,
            "password": password
        })
        assert response.status_code == 200, f"Login failed for {email}: {response.text}"
        data = response.json()
        return data.get('token'), data.get('user')
    
    @staticmethod
    def get_auth_headers(token: str) -> dict:
        return {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }
    
    @staticmethod
    def create_paid_collaboration(token: str, title_prefix: str = "TEST_CANCEL") -> dict:
        """Create a paid collaboration for testing"""
        headers = TestSetup.get_auth_headers(token)
        unique_id = uuid.uuid4().hex[:8]
        collab_data = {
            "brand_name": "Test Brand",
            "title": f"{title_prefix}_{unique_id}",
            "description": "Test collaboration for cancellation/dispute testing",
            "deliverables": ["1 Instagram post", "2 Stories"],
            "budget_min": 200,
            "budget_max": 400,
            "deadline": (datetime.now().replace(year=2026, month=6, day=1)).isoformat(),
            "platform": "instagram",
            "creators_needed": 1,
            "collaboration_type": "paid"
        }
        response = requests.post(f"{API}/collaborations", headers=headers, json=collab_data)
        assert response.status_code == 200, f"Create collab failed: {response.text}"
        return response.json()
    
    @staticmethod
    def apply_to_collaboration(token: str, collab_id: str, proposed_price: float = 300) -> dict:
        """Apply to a collaboration as influencer"""
        headers = TestSetup.get_auth_headers(token)
        app_data = {
            "collab_id": collab_id,
            "message": "Test application for messaging testing",
            "selected_deliverables": ["1 Instagram post"],
            "proposed_price": proposed_price
        }
        response = requests.post(f"{API}/applications", headers=headers, json=app_data)
        assert response.status_code == 200, f"Apply failed: {response.text}"
        return response.json()
    
    @staticmethod
    def accept_application(token: str, application_id: str) -> dict:
        """Accept an application"""
        headers = TestSetup.get_auth_headers(token)
        response = requests.patch(
            f"{API}/applications/{application_id}/status",
            headers=headers,
            json={"status": "accepted"}
        )
        assert response.status_code == 200, f"Accept application failed: {response.text}"
        return response.json()
    
    @staticmethod
    def secure_escrow(token: str, collab_id: str) -> dict:
        """Create and secure escrow for a collaboration"""
        headers = TestSetup.get_auth_headers(token)
        # Create escrow
        create_res = requests.post(f"{API}/escrow/create/{collab_id}", headers=headers)
        assert create_res.status_code == 200, f"Create escrow failed: {create_res.text}"
        escrow = create_res.json()
        
        # Secure escrow
        secure_res = requests.post(f"{API}/escrow/{escrow['escrow_id']}/secure", headers=headers)
        assert secure_res.status_code == 200, f"Secure escrow failed: {secure_res.text}"
        return secure_res.json()


class TestCancellationSystem:
    """Test cancellation endpoints and flows"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup tokens for all tests in this class"""
        self.brand_token, self.brand_user = TestSetup.login(BRAND_EMAIL, BRAND_PASSWORD)
        self.influencer_token, self.influencer_user = TestSetup.login(INFLUENCER_EMAIL, INFLUENCER_PASSWORD)
        self.admin_token, self.admin_user = TestSetup.login(ADMIN_EMAIL, ADMIN_PASSWORD)
    
    def test_01_cancel_active_collab_with_secured_escrow_instant_refund(self):
        """
        Test 1: POST /api/collaborations/{collab_id}/cancel
        When status=active and payment_status=secured → should cancel with instant refund
        """
        # Create paid collab
        collab = TestSetup.create_paid_collaboration(self.brand_token, "TEST_CANCEL_ACTIVE")
        collab_id = collab['collab_id']
        
        # Secure escrow
        TestSetup.secure_escrow(self.brand_token, collab_id)
        
        # Verify escrow is secured
        escrow_res = requests.get(
            f"{API}/escrow/collab/{collab_id}",
            headers=TestSetup.get_auth_headers(self.brand_token)
        )
        assert escrow_res.status_code == 200
        assert escrow_res.json()['status'] == 'secured'
        
        # Cancel the collaboration (before work starts)
        cancel_res = requests.post(
            f"{API}/collaborations/{collab_id}/cancel",
            headers=TestSetup.get_auth_headers(self.brand_token),
            json={"reason": "brand_changed_requirements", "details": "Requirements changed"}
        )
        
        assert cancel_res.status_code == 200, f"Cancel failed: {cancel_res.text}"
        data = cancel_res.json()
        assert data['success'] == True
        assert data['status'] == 'cancelled'
        
        # Verify collaboration is cancelled
        collab_res = requests.get(f"{API}/collaborations/{collab_id}")
        assert collab_res.status_code == 200
        collab_data = collab_res.json()
        assert collab_data['status'] == 'cancelled'
        assert collab_data['payment_status'] == 'refunded'
        
        print("✅ Test 1 PASSED: Cancel active collab with secured escrow → instant refund")
    
    def test_02_cancel_in_progress_collab_requires_admin_review(self):
        """
        Test 2: POST /api/collaborations/{collab_id}/cancel
        When status=in_progress → should create cancellation_requested status (admin review)
        """
        # Create paid collab
        collab = TestSetup.create_paid_collaboration(self.brand_token, "TEST_CANCEL_PROGRESS")
        collab_id = collab['collab_id']
        
        # Secure escrow
        TestSetup.secure_escrow(self.brand_token, collab_id)
        
        # Influencer applies and brand accepts
        app = TestSetup.apply_to_collaboration(self.influencer_token, collab_id)
        TestSetup.accept_application(self.brand_token, app['application_id'])
        
        # Change status to in_progress
        status_res = requests.patch(
            f"{API}/collaborations/{collab_id}/status",
            headers=TestSetup.get_auth_headers(self.brand_token),
            json={"status": "in_progress"}
        )
        assert status_res.status_code == 200
        
        # Cancel the collaboration (during work)
        cancel_res = requests.post(
            f"{API}/collaborations/{collab_id}/cancel",
            headers=TestSetup.get_auth_headers(self.brand_token),
            json={"reason": "quality_concerns", "details": "Quality not as expected"}
        )
        
        assert cancel_res.status_code == 200, f"Cancel failed: {cancel_res.text}"
        data = cancel_res.json()
        assert data['success'] == True
        assert 'cancellation_requested' in data['status']
        
        # Verify collaboration has pending admin review status
        collab_res = requests.get(f"{API}/collaborations/{collab_id}")
        assert collab_res.status_code == 200
        collab_data = collab_res.json()
        assert collab_data['status'] in ['cancellation_requested_by_brand', 'cancellation_requested_by_influencer']
        
        print("✅ Test 2 PASSED: Cancel in_progress collab → requires admin review")
    
    def test_03_cancel_completed_pending_release_should_fail(self):
        """
        Test 3: POST /api/collaborations/{collab_id}/cancel
        When status=completed_pending_release → should fail (use disputes instead)
        """
        # Create paid collab
        collab = TestSetup.create_paid_collaboration(self.brand_token, "TEST_CANCEL_PENDING")
        collab_id = collab['collab_id']
        
        # Secure escrow
        TestSetup.secure_escrow(self.brand_token, collab_id)
        
        # Influencer applies and brand accepts
        app = TestSetup.apply_to_collaboration(self.influencer_token, collab_id)
        TestSetup.accept_application(self.brand_token, app['application_id'])
        
        # Complete the collaboration → goes to completed_pending_release
        complete_res = requests.patch(
            f"{API}/collaborations/{collab_id}/status",
            headers=TestSetup.get_auth_headers(self.brand_token),
            json={"status": "completed"}
        )
        assert complete_res.status_code == 200
        
        # Try to cancel → should fail
        cancel_res = requests.post(
            f"{API}/collaborations/{collab_id}/cancel",
            headers=TestSetup.get_auth_headers(self.brand_token),
            json={"reason": "other", "details": "Trying to cancel after completion"}
        )
        
        assert cancel_res.status_code == 400, f"Expected 400, got {cancel_res.status_code}"
        error = cancel_res.json()
        assert "dispută" in error.get('detail', '').lower() or "dispute" in error.get('detail', '').lower()
        
        print("✅ Test 3 PASSED: Cancel completed_pending_release → fails with dispute suggestion")


class TestDisputeSystem:
    """Test dispute endpoints and flows"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup tokens for all tests in this class"""
        self.brand_token, self.brand_user = TestSetup.login(BRAND_EMAIL, BRAND_PASSWORD)
        self.influencer_token, self.influencer_user = TestSetup.login(INFLUENCER_EMAIL, INFLUENCER_PASSWORD)
        self.admin_token, self.admin_user = TestSetup.login(ADMIN_EMAIL, ADMIN_PASSWORD)
    
    def test_04_create_dispute_in_completed_pending_release(self):
        """
        Test 4: POST /api/disputes/create/{collab_id}
        When status=completed_pending_release → creates dispute, blocks escrow, sets status=disputed
        """
        # Create paid collab
        collab = TestSetup.create_paid_collaboration(self.brand_token, "TEST_DISPUTE_CPR")
        collab_id = collab['collab_id']
        
        # Secure escrow
        TestSetup.secure_escrow(self.brand_token, collab_id)
        
        # Influencer applies and brand accepts
        app = TestSetup.apply_to_collaboration(self.influencer_token, collab_id)
        TestSetup.accept_application(self.brand_token, app['application_id'])
        
        # Complete the collaboration → goes to completed_pending_release
        complete_res = requests.patch(
            f"{API}/collaborations/{collab_id}/status",
            headers=TestSetup.get_auth_headers(self.brand_token),
            json={"status": "completed"}
        )
        assert complete_res.status_code == 200
        
        # Verify it's in completed_pending_release
        collab_res = requests.get(f"{API}/collaborations/{collab_id}")
        assert collab_res.json()['status'] == 'completed_pending_release'
        
        # Create dispute
        dispute_res = requests.post(
            f"{API}/disputes/create/{collab_id}",
            headers=TestSetup.get_auth_headers(self.brand_token),
            json={"reason": "content_not_delivered", "details": "Content quality below expectations"}
        )
        
        assert dispute_res.status_code == 200, f"Create dispute failed: {dispute_res.text}"
        dispute = dispute_res.json()
        assert 'dispute_id' in dispute
        assert dispute['status'] == 'open'
        assert dispute['collab_id'] == collab_id
        
        # Verify collaboration is now disputed
        collab_res = requests.get(f"{API}/collaborations/{collab_id}")
        collab_data = collab_res.json()
        assert collab_data['status'] == 'disputed'
        assert collab_data['payment_status'] == 'disputed'
        
        # Verify escrow is disputed
        escrow_res = requests.get(
            f"{API}/escrow/collab/{collab_id}",
            headers=TestSetup.get_auth_headers(self.brand_token)
        )
        assert escrow_res.status_code == 200
        escrow = escrow_res.json()
        assert escrow['status'] == 'disputed'
        
        print("✅ Test 4 PASSED: Create dispute in completed_pending_release → status=disputed, escrow blocked")
    
    def test_05_create_dispute_wrong_status_should_fail(self):
        """
        Test 5: POST /api/disputes/create/{collab_id}
        When status != completed_pending_release → should fail
        """
        # Create paid collab
        collab = TestSetup.create_paid_collaboration(self.brand_token, "TEST_DISPUTE_WRONG")
        collab_id = collab['collab_id']
        
        # Secure escrow
        TestSetup.secure_escrow(self.brand_token, collab_id)
        
        # Try to create dispute on 'active' status → should fail
        dispute_res = requests.post(
            f"{API}/disputes/create/{collab_id}",
            headers=TestSetup.get_auth_headers(self.brand_token),
            json={"reason": "quality_issues", "details": "Test"}
        )
        
        assert dispute_res.status_code == 400, f"Expected 400, got {dispute_res.status_code}"
        error = dispute_res.json()
        assert "completed_pending_release" in error.get('detail', '').lower() or "verificare" in error.get('detail', '').lower()
        
        print("✅ Test 5 PASSED: Dispute creation fails when not in completed_pending_release")
    
    def test_06_release_escrow_when_disputed_should_fail(self):
        """
        Test 6: POST /api/escrow/{escrow_id}/release when disputed → should fail
        """
        # Create paid collab
        collab = TestSetup.create_paid_collaboration(self.brand_token, "TEST_DISPUTE_RELEASE")
        collab_id = collab['collab_id']
        
        # Secure escrow and get escrow_id
        secure_res = TestSetup.secure_escrow(self.brand_token, collab_id)
        escrow_id = secure_res['escrow_id']
        
        # Influencer applies and brand accepts
        app = TestSetup.apply_to_collaboration(self.influencer_token, collab_id)
        TestSetup.accept_application(self.brand_token, app['application_id'])
        
        # Complete → completed_pending_release
        complete_res = requests.patch(
            f"{API}/collaborations/{collab_id}/status",
            headers=TestSetup.get_auth_headers(self.brand_token),
            json={"status": "completed"}
        )
        assert complete_res.status_code == 200
        
        # Open dispute
        dispute_res = requests.post(
            f"{API}/disputes/create/{collab_id}",
            headers=TestSetup.get_auth_headers(self.brand_token),
            json={"reason": "quality_issues", "details": "Not satisfied"}
        )
        assert dispute_res.status_code == 200
        
        # Try to release escrow → should fail
        release_res = requests.post(
            f"{API}/escrow/{escrow_id}/release",
            headers=TestSetup.get_auth_headers(self.brand_token)
        )
        
        assert release_res.status_code == 400, f"Expected 400, got {release_res.status_code}"
        
        print("✅ Test 6 PASSED: Release escrow when disputed → fails")


class TestMessagingSystem:
    """Test messaging endpoints and flows"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup tokens for all tests in this class"""
        self.brand_token, self.brand_user = TestSetup.login(BRAND_EMAIL, BRAND_PASSWORD)
        self.influencer_token, self.influencer_user = TestSetup.login(INFLUENCER_EMAIL, INFLUENCER_PASSWORD)
        self.admin_token, self.admin_user = TestSetup.login(ADMIN_EMAIL, ADMIN_PASSWORD)
    
    def test_07_send_message_after_acceptance_works(self):
        """
        Test 7: POST /api/messages/{collab_id} after acceptance → should work
        """
        # Create paid collab
        collab = TestSetup.create_paid_collaboration(self.brand_token, "TEST_MSG_ACCEPT")
        collab_id = collab['collab_id']
        
        # Secure escrow
        TestSetup.secure_escrow(self.brand_token, collab_id)
        
        # Influencer applies and brand accepts
        app = TestSetup.apply_to_collaboration(self.influencer_token, collab_id)
        TestSetup.accept_application(self.brand_token, app['application_id'])
        
        # Brand sends message
        msg_res = requests.post(
            f"{API}/messages/{collab_id}",
            headers=TestSetup.get_auth_headers(self.brand_token),
            json={"content": "Hello! Let's discuss the collaboration."}
        )
        
        assert msg_res.status_code == 200, f"Send message failed: {msg_res.text}"
        msg = msg_res.json()
        assert 'message_id' in msg
        assert msg['content'] == "Hello! Let's discuss the collaboration."
        assert msg['sender_type'] == 'brand'
        
        # Influencer sends message
        msg_res2 = requests.post(
            f"{API}/messages/{collab_id}",
            headers=TestSetup.get_auth_headers(self.influencer_token),
            json={"content": "Hi! I'm excited to work together."}
        )
        
        assert msg_res2.status_code == 200, f"Influencer message failed: {msg_res2.text}"
        msg2 = msg_res2.json()
        assert msg2['sender_type'] == 'influencer'
        
        print("✅ Test 7 PASSED: Send message after acceptance → works")
    
    def test_08_send_message_when_disputed_fails(self):
        """
        Test 8: POST /api/messages/{collab_id} when disputed → should fail (locked)
        """
        # Create paid collab
        collab = TestSetup.create_paid_collaboration(self.brand_token, "TEST_MSG_DISPUTED")
        collab_id = collab['collab_id']
        
        # Secure escrow
        TestSetup.secure_escrow(self.brand_token, collab_id)
        
        # Influencer applies and brand accepts
        app = TestSetup.apply_to_collaboration(self.influencer_token, collab_id)
        TestSetup.accept_application(self.brand_token, app['application_id'])
        
        # Complete → completed_pending_release
        complete_res = requests.patch(
            f"{API}/collaborations/{collab_id}/status",
            headers=TestSetup.get_auth_headers(self.brand_token),
            json={"status": "completed"}
        )
        assert complete_res.status_code == 200
        
        # Open dispute
        dispute_res = requests.post(
            f"{API}/disputes/create/{collab_id}",
            headers=TestSetup.get_auth_headers(self.brand_token),
            json={"reason": "content_not_delivered", "details": "Content missing"}
        )
        assert dispute_res.status_code == 200
        
        # Try to send message → should fail
        msg_res = requests.post(
            f"{API}/messages/{collab_id}",
            headers=TestSetup.get_auth_headers(self.brand_token),
            json={"content": "Trying to send message during dispute"}
        )
        
        assert msg_res.status_code == 400, f"Expected 400, got {msg_res.status_code}"
        error = msg_res.json()
        assert "blocat" in error.get('detail', '').lower() or "dispută" in error.get('detail', '').lower()
        
        print("✅ Test 8 PASSED: Send message when disputed → fails (locked)")
    
    def test_09_get_messages_when_disputed_shows_locked(self):
        """
        Test 9: GET /api/messages/{collab_id} when disputed → is_locked=true
        """
        # Create paid collab with messages first
        collab = TestSetup.create_paid_collaboration(self.brand_token, "TEST_MSG_LOCK")
        collab_id = collab['collab_id']
        
        # Secure escrow
        TestSetup.secure_escrow(self.brand_token, collab_id)
        
        # Influencer applies and brand accepts
        app = TestSetup.apply_to_collaboration(self.influencer_token, collab_id)
        TestSetup.accept_application(self.brand_token, app['application_id'])
        
        # Send a message while active
        requests.post(
            f"{API}/messages/{collab_id}",
            headers=TestSetup.get_auth_headers(self.brand_token),
            json={"content": "Message before dispute"}
        )
        
        # Complete → completed_pending_release
        complete_res = requests.patch(
            f"{API}/collaborations/{collab_id}/status",
            headers=TestSetup.get_auth_headers(self.brand_token),
            json={"status": "completed"}
        )
        assert complete_res.status_code == 200
        
        # Open dispute
        dispute_res = requests.post(
            f"{API}/disputes/create/{collab_id}",
            headers=TestSetup.get_auth_headers(self.brand_token),
            json={"reason": "quality_issues", "details": "Test"}
        )
        assert dispute_res.status_code == 200
        
        # Get messages
        get_res = requests.get(
            f"{API}/messages/{collab_id}",
            headers=TestSetup.get_auth_headers(self.brand_token)
        )
        
        assert get_res.status_code == 200
        data = get_res.json()
        assert data['is_locked'] == True
        assert isinstance(data['messages'], list)
        
        print("✅ Test 9 PASSED: GET messages when disputed → is_locked=true")


class TestAdminDisputeResolution:
    """Test admin dispute resolution endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup tokens for all tests in this class"""
        self.brand_token, self.brand_user = TestSetup.login(BRAND_EMAIL, BRAND_PASSWORD)
        self.influencer_token, self.influencer_user = TestSetup.login(INFLUENCER_EMAIL, INFLUENCER_PASSWORD)
        self.admin_token, self.admin_user = TestSetup.login(ADMIN_EMAIL, ADMIN_PASSWORD)
    
    def test_10_admin_resolve_dispute_release_to_influencer(self):
        """
        Test 10: PATCH /api/admin/disputes/{id}/resolve
        resolution=release_to_influencer → releases funds to creator
        """
        # Create paid collab
        collab = TestSetup.create_paid_collaboration(self.brand_token, "TEST_ADMIN_DISPUTE_REL")
        collab_id = collab['collab_id']
        
        # Secure escrow
        TestSetup.secure_escrow(self.brand_token, collab_id)
        
        # Influencer applies and brand accepts
        app = TestSetup.apply_to_collaboration(self.influencer_token, collab_id)
        TestSetup.accept_application(self.brand_token, app['application_id'])
        
        # Complete → completed_pending_release
        complete_res = requests.patch(
            f"{API}/collaborations/{collab_id}/status",
            headers=TestSetup.get_auth_headers(self.brand_token),
            json={"status": "completed"}
        )
        assert complete_res.status_code == 200
        
        # Open dispute
        dispute_res = requests.post(
            f"{API}/disputes/create/{collab_id}",
            headers=TestSetup.get_auth_headers(self.brand_token),
            json={"reason": "content_not_delivered", "details": "Testing admin resolution"}
        )
        assert dispute_res.status_code == 200
        dispute = dispute_res.json()
        dispute_id = dispute['dispute_id']
        
        # Admin resolves: release to influencer
        resolve_res = requests.patch(
            f"{API}/admin/disputes/{dispute_id}/resolve",
            headers=TestSetup.get_auth_headers(self.admin_token),
            json={"resolution": "release_to_influencer", "admin_notes": "Creator delivered satisfactory work"}
        )
        
        assert resolve_res.status_code == 200, f"Resolve failed: {resolve_res.text}"
        data = resolve_res.json()
        assert data['success'] == True
        assert data['resolution'] == 'release_to_influencer'
        
        # Verify collaboration is completed and released
        collab_res = requests.get(f"{API}/collaborations/{collab_id}")
        collab_data = collab_res.json()
        assert collab_data['status'] == 'completed'
        assert collab_data['payment_status'] == 'released'
        
        print("✅ Test 10 PASSED: Admin resolve dispute → release_to_influencer → funds released")


class TestAdminCancellationResolution:
    """Test admin cancellation resolution endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup tokens for all tests in this class"""
        self.brand_token, self.brand_user = TestSetup.login(BRAND_EMAIL, BRAND_PASSWORD)
        self.influencer_token, self.influencer_user = TestSetup.login(INFLUENCER_EMAIL, INFLUENCER_PASSWORD)
        self.admin_token, self.admin_user = TestSetup.login(ADMIN_EMAIL, ADMIN_PASSWORD)
    
    def test_11_admin_resolve_cancellation_full_refund(self):
        """
        Test 11: PATCH /api/admin/cancellations/{id}/resolve
        resolution=full_refund → refunds to brand
        """
        # Create paid collab
        collab = TestSetup.create_paid_collaboration(self.brand_token, "TEST_ADMIN_CANCEL_REF")
        collab_id = collab['collab_id']
        
        # Secure escrow
        TestSetup.secure_escrow(self.brand_token, collab_id)
        
        # Influencer applies and brand accepts
        app = TestSetup.apply_to_collaboration(self.influencer_token, collab_id)
        TestSetup.accept_application(self.brand_token, app['application_id'])
        
        # Change to in_progress
        status_res = requests.patch(
            f"{API}/collaborations/{collab_id}/status",
            headers=TestSetup.get_auth_headers(self.brand_token),
            json={"status": "in_progress"}
        )
        assert status_res.status_code == 200
        
        # Brand requests cancellation (requires admin review)
        cancel_res = requests.post(
            f"{API}/collaborations/{collab_id}/cancel",
            headers=TestSetup.get_auth_headers(self.brand_token),
            json={"reason": "quality_concerns", "details": "Work quality below expectations"}
        )
        assert cancel_res.status_code == 200
        
        # Get cancellation from admin endpoint
        cancellations_res = requests.get(
            f"{API}/admin/cancellations",
            headers=TestSetup.get_auth_headers(self.admin_token)
        )
        assert cancellations_res.status_code == 200
        cancellations = cancellations_res.json()['cancellations']
        
        # Find the cancellation for this collab
        this_cancellation = None
        for c in cancellations:
            if c['collab_id'] == collab_id:
                this_cancellation = c
                break
        
        assert this_cancellation is not None, "Cancellation not found"
        cancellation_id = this_cancellation['cancellation_id']
        
        # Admin resolves: full refund
        resolve_res = requests.patch(
            f"{API}/admin/cancellations/{cancellation_id}/resolve",
            headers=TestSetup.get_auth_headers(self.admin_token),
            json={"resolution": "full_refund", "admin_notes": "Brand justified, full refund approved"}
        )
        
        assert resolve_res.status_code == 200, f"Resolve failed: {resolve_res.text}"
        data = resolve_res.json()
        assert data['success'] == True
        assert data['resolution'] == 'full_refund'
        
        # Verify collaboration is cancelled and refunded
        collab_res = requests.get(f"{API}/collaborations/{collab_id}")
        collab_data = collab_res.json()
        assert collab_data['status'] == 'cancelled'
        assert collab_data['payment_status'] == 'refunded'
        
        print("✅ Test 11 PASSED: Admin resolve cancellation → full_refund → status=cancelled, refunded")
    
    def test_12_admin_get_disputes_with_message_history(self):
        """
        Test 12: GET /api/admin/disputes → returns disputes with message history and escrow info
        """
        # Get disputes
        disputes_res = requests.get(
            f"{API}/admin/disputes",
            headers=TestSetup.get_auth_headers(self.admin_token)
        )
        
        assert disputes_res.status_code == 200, f"Get disputes failed: {disputes_res.text}"
        data = disputes_res.json()
        assert 'disputes' in data
        assert 'total' in data
        
        # If there are disputes, verify they have enriched data
        if len(data['disputes']) > 0:
            dispute = data['disputes'][0]
            # Should have collaboration info
            assert 'collaboration' in dispute or 'collab_id' in dispute
            # Should have escrow info
            assert 'escrow' in dispute or 'escrow_id' not in dispute  # optional if escrow doesn't exist
            # Should have message_history if messages were sent
            assert 'message_history' in dispute
        
        print(f"✅ Test 12 PASSED: Admin get disputes → returns {data['total']} disputes with enriched data")


class TestMessagingBeforeAcceptance:
    """Test messaging before application acceptance fails"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup tokens for all tests in this class"""
        self.brand_token, self.brand_user = TestSetup.login(BRAND_EMAIL, BRAND_PASSWORD)
        self.influencer_token, self.influencer_user = TestSetup.login(INFLUENCER_EMAIL, INFLUENCER_PASSWORD)
    
    def test_13_send_message_before_acceptance_fails(self):
        """
        Test 13: POST /api/messages/{collab_id} before acceptance → should fail
        """
        # Create paid collab
        collab = TestSetup.create_paid_collaboration(self.brand_token, "TEST_MSG_NO_ACCEPT")
        collab_id = collab['collab_id']
        
        # Try to send message without any accepted application
        msg_res = requests.post(
            f"{API}/messages/{collab_id}",
            headers=TestSetup.get_auth_headers(self.brand_token),
            json={"content": "Trying to message before acceptance"}
        )
        
        assert msg_res.status_code == 400, f"Expected 400, got {msg_res.status_code}"
        error = msg_res.json()
        assert "acceptare" in error.get('detail', '').lower() or "application" in error.get('detail', '').lower()
        
        print("✅ Test 13 PASSED: Send message before acceptance → fails")


def test_run_all():
    """Run all tests"""
    print("\n" + "="*60)
    print("ITERATION 6: Cancellation, Dispute, and Messaging Tests")
    print("="*60 + "\n")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
