"""
Test Social Media Posts & Commission System Features
Tests for colaboreaza.ro iteration 4 - New Features:
- oEmbed endpoint for social media post embedding
- Featured posts in influencer profiles 
- Commission system (admin only)
- Commission auto-calculation on collaboration completion
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://mern-collab.preview.emergentagent.com')
API = f"{BASE_URL}/api"

# Test credentials
ADMIN_EMAIL = "admin2@colaboreaza.ro"
ADMIN_PASSWORD = "AdminPass123"
INFLUENCER_EMAIL = "testinfluencer_new@test.com"
INFLUENCER_PASSWORD = "TestPass123"
BRAND_EMAIL = "testbrand_new@test.com"
BRAND_PASSWORD = "TestPass123"


class TestAuth:
    """Authentication tests"""
    
    def test_admin_login(self):
        """Test admin user login"""
        response = requests.post(f"{API}/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        assert data["user"]["is_admin"] == True
        assert data["user"]["email"] == ADMIN_EMAIL

    def test_influencer_login(self):
        """Test influencer user login"""
        response = requests.post(f"{API}/auth/login", json={
            "email": INFLUENCER_EMAIL,
            "password": INFLUENCER_PASSWORD
        })
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        assert data["user"]["email"] == INFLUENCER_EMAIL

    def test_brand_login(self):
        """Test brand user login"""
        response = requests.post(f"{API}/auth/login", json={
            "email": BRAND_EMAIL,
            "password": BRAND_PASSWORD
        })
        assert response.status_code == 200
        data = response.json()
        assert "token" in data


class TestOEmbed:
    """oEmbed endpoint tests for social media embedding"""
    
    def test_oembed_youtube_url(self):
        """Test oEmbed fetches YouTube video data correctly"""
        youtube_url = "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
        response = requests.get(f"{API}/oembed", params={"url": youtube_url})
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify required fields
        assert data["platform"] == "youtube"
        assert "title" in data
        assert "html" in data
        assert "thumbnail_url" in data
        assert data["thumbnail_url"] is not None
        assert "iframe" in data["html"].lower()
    
    def test_oembed_tiktok_url(self):
        """Test oEmbed handles TikTok URLs"""
        tiktok_url = "https://www.tiktok.com/@charlidamelio/video/7000000000000000000"
        response = requests.get(f"{API}/oembed", params={"url": tiktok_url})
        
        assert response.status_code == 200
        data = response.json()
        assert data["platform"] == "tiktok"
    
    def test_oembed_unsupported_url(self):
        """Test oEmbed rejects unsupported URLs"""
        unsupported_url = "https://example.com/video"
        response = requests.get(f"{API}/oembed", params={"url": unsupported_url})
        
        assert response.status_code == 400
        data = response.json()
        assert "detail" in data
        assert "Unsupported" in data["detail"]


class TestInfluencerFeaturedPosts:
    """Featured posts in influencer profiles"""
    
    @pytest.fixture
    def influencer_token(self):
        """Get influencer auth token"""
        response = requests.post(f"{API}/auth/login", json={
            "email": INFLUENCER_EMAIL,
            "password": INFLUENCER_PASSWORD
        })
        return response.json()["token"]
    
    def test_get_influencer_profile_with_featured_posts(self, influencer_token):
        """Test GET /api/influencers/profile returns featured_posts"""
        response = requests.get(
            f"{API}/influencers/profile",
            headers={"Authorization": f"Bearer {influencer_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        # featured_posts should exist in profile
        assert "featured_posts" in data
        assert isinstance(data["featured_posts"], list)
    
    def test_get_public_profile_with_featured_posts(self):
        """Test GET /api/influencers/{username} returns featured_posts"""
        response = requests.get(f"{API}/influencers/testcreator")
        
        assert response.status_code == 200
        data = response.json()
        
        assert "featured_posts" in data
        assert isinstance(data["featured_posts"], list)
        # testcreator should have pre-seeded featured posts
        assert len(data["featured_posts"]) >= 1
    
    def test_save_profile_with_featured_posts(self, influencer_token):
        """Test POST /api/influencers/profile saves featured_posts"""
        # First get current profile
        current = requests.get(
            f"{API}/influencers/profile",
            headers={"Authorization": f"Bearer {influencer_token}"}
        ).json()
        
        # Update with new featured posts
        test_posts = [
            "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
            "https://www.youtube.com/watch?v=9bZkp7q19f0"
        ]
        
        profile_data = {
            "username": current.get("username", "testcreator"),
            "bio": current.get("bio", "Test bio"),
            "niches": current.get("niches", ["Tech"]),
            "platforms": current.get("platforms", ["youtube"]),
            "featured_posts": test_posts
        }
        
        response = requests.post(
            f"{API}/influencers/profile",
            headers={"Authorization": f"Bearer {influencer_token}"},
            json=profile_data
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify featured_posts were saved
        assert "featured_posts" in data
        assert data["featured_posts"] == test_posts


class TestCommissionSystem:
    """Commission system tests (admin only)"""
    
    @pytest.fixture
    def admin_token(self):
        """Get admin auth token"""
        response = requests.post(f"{API}/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        return response.json()["token"]
    
    @pytest.fixture
    def influencer_token(self):
        """Get influencer auth token"""
        response = requests.post(f"{API}/auth/login", json={
            "email": INFLUENCER_EMAIL,
            "password": INFLUENCER_PASSWORD
        })
        return response.json()["token"]
    
    def test_get_commission_rate_admin(self, admin_token):
        """Test admin can GET commission rate"""
        response = requests.get(
            f"{API}/settings/commission",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "commission_rate" in data
        assert isinstance(data["commission_rate"], (int, float))
        assert 0 <= data["commission_rate"] <= 100
    
    def test_get_commission_rate_non_admin_forbidden(self, influencer_token):
        """Test non-admin cannot GET commission rate"""
        response = requests.get(
            f"{API}/settings/commission",
            headers={"Authorization": f"Bearer {influencer_token}"}
        )
        
        assert response.status_code == 403
    
    def test_update_commission_rate_admin(self, admin_token):
        """Test admin can PUT commission rate"""
        # Update to 15%
        response = requests.put(
            f"{API}/settings/commission",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"commission_rate": 15}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["commission_rate"] == 15
        
        # Verify it was saved
        verify = requests.get(
            f"{API}/settings/commission",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert verify.json()["commission_rate"] == 15
        
        # Reset back to 10%
        requests.put(
            f"{API}/settings/commission",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"commission_rate": 10}
        )
    
    def test_update_commission_invalid_rate(self, admin_token):
        """Test commission rate validation (0-100)"""
        response = requests.put(
            f"{API}/settings/commission",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"commission_rate": 150}  # Invalid: > 100
        )
        
        assert response.status_code == 400
    
    def test_update_commission_rate_non_admin_forbidden(self, influencer_token):
        """Test non-admin cannot PUT commission rate"""
        response = requests.put(
            f"{API}/settings/commission",
            headers={"Authorization": f"Bearer {influencer_token}"},
            json={"commission_rate": 20}
        )
        
        assert response.status_code == 403
    
    def test_get_admin_commissions(self, admin_token):
        """Test admin can GET commissions list"""
        response = requests.get(
            f"{API}/admin/commissions",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert "commissions" in data
        assert "total" in data
        assert "summary" in data
        assert "total_commission" in data["summary"]
        assert "total_gross" in data["summary"]
    
    def test_get_admin_commissions_non_admin_forbidden(self, influencer_token):
        """Test non-admin cannot GET commissions list"""
        response = requests.get(
            f"{API}/admin/commissions",
            headers={"Authorization": f"Bearer {influencer_token}"}
        )
        
        assert response.status_code == 403


class TestCommissionCalculation:
    """Test commission calculation helper endpoint"""
    
    @pytest.fixture
    def auth_token(self):
        """Get any auth token"""
        response = requests.post(f"{API}/auth/login", json={
            "email": INFLUENCER_EMAIL,
            "password": INFLUENCER_PASSWORD
        })
        return response.json()["token"]
    
    def test_calculate_commission(self, auth_token):
        """Test commission calculation endpoint"""
        response = requests.get(
            f"{API}/commission/calculate",
            params={"amount": 1000},
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert "gross_amount" in data
        assert "commission_rate" in data
        assert "commission_amount" in data
        assert "net_amount" in data
        
        # Verify calculation is correct (default 10% rate)
        assert data["gross_amount"] == 1000
        # commission = gross * rate / 100
        expected_commission = 1000 * data["commission_rate"] / 100
        assert data["commission_amount"] == expected_commission
        assert data["net_amount"] == 1000 - expected_commission


class TestAdminStats:
    """Admin stats endpoint tests"""
    
    @pytest.fixture
    def admin_token(self):
        """Get admin auth token"""
        response = requests.post(f"{API}/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        return response.json()["token"]
    
    def test_admin_stats(self, admin_token):
        """Test admin stats endpoint"""
        response = requests.get(
            f"{API}/admin/stats",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert "users" in data
        assert "collaborations" in data
        assert "applications" in data
        assert "revenue" in data


class TestHealthCheck:
    """Basic health check tests"""
    
    def test_api_root(self):
        """Test API root endpoint"""
        response = requests.get(f"{API}/")
        assert response.status_code == 200
    
    def test_health_endpoint(self):
        """Test health endpoint"""
        response = requests.get(f"{API}/health")
        assert response.status_code == 200
        assert response.json()["status"] == "healthy"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
