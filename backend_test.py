#!/usr/bin/env python3

import requests
import sys
import json
from datetime import datetime, timedelta
from typing import Dict, Any

class ColaboreazaAPITester:
    def __init__(self, base_url="https://fastviral.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.token = None
        self.session_token = None
        self.user_id = None
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []

    def log_test(self, name: str, success: bool, details: str = ""):
        """Log test result"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {name}")
        else:
            print(f"❌ {name} - {details}")
        
        self.test_results.append({
            "test": name,
            "success": success,
            "details": details
        })

    def make_request(self, method: str, endpoint: str, data: Dict = None, headers: Dict = None) -> tuple:
        """Make HTTP request and return (success, response_data, status_code)"""
        url = f"{self.api_url}/{endpoint}"
        request_headers = {'Content-Type': 'application/json'}
        
        if headers:
            request_headers.update(headers)
            
        if self.token:
            request_headers['Authorization'] = f'Bearer {self.token}'

        try:
            if method == 'GET':
                response = requests.get(url, headers=request_headers)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=request_headers)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=request_headers)
            elif method == 'PATCH':
                response = requests.patch(url, json=data, headers=request_headers)
            elif method == 'DELETE':
                response = requests.delete(url, headers=request_headers)
            else:
                return False, {}, 0

            try:
                response_data = response.json()
            except:
                response_data = {"text": response.text}

            return response.status_code < 400, response_data, response.status_code

        except Exception as e:
            return False, {"error": str(e)}, 0

    def test_health_endpoints(self):
        """Test basic health endpoints"""
        print("\n🔍 Testing Health Endpoints...")
        
        # Test root endpoint
        success, data, status = self.make_request('GET', '')
        self.log_test("Root endpoint (/api/)", success and status == 200, 
                     f"Status: {status}, Response: {data}")
        
        # Test health endpoint
        success, data, status = self.make_request('GET', 'health')
        self.log_test("Health endpoint", success and status == 200,
                     f"Status: {status}, Response: {data}")

    def test_public_endpoints(self):
        """Test public endpoints that don't require auth"""
        print("\n🔍 Testing Public Endpoints...")
        
        # Test public stats
        success, data, status = self.make_request('GET', 'stats/public')
        self.log_test("Public stats", success and status == 200,
                     f"Status: {status}, Stats: {data}")
        
        # Test public collaborations
        success, data, status = self.make_request('GET', 'collaborations?limit=5')
        self.log_test("Public collaborations", success and status == 200,
                     f"Status: {status}, Count: {len(data) if isinstance(data, list) else 'N/A'}")
        
        # Test public influencers
        success, data, status = self.make_request('GET', 'influencers?limit=5')
        self.log_test("Public influencers", success and status == 200,
                     f"Status: {status}, Count: {len(data) if isinstance(data, list) else 'N/A'}")

    def test_auth_registration(self):
        """Test user registration"""
        print("\n🔍 Testing Authentication - Registration...")
        
        timestamp = int(datetime.now().timestamp())
        test_email = f"test.brand.{timestamp}@example.com"
        test_password = "TestPass123!"
        test_name = f"Test Brand {timestamp}"
        
        # Test brand registration
        success, data, status = self.make_request('POST', 'auth/register', {
            "email": test_email,
            "password": test_password,
            "name": test_name,
            "user_type": "brand"
        })
        
        if success and status == 200 and 'token' in data:
            self.token = data['token']
            self.user_id = data['user']['user_id']
            self.log_test("Brand registration", True, f"User ID: {self.user_id}")
        else:
            self.log_test("Brand registration", False, f"Status: {status}, Response: {data}")

    def test_auth_login(self):
        """Test user login"""
        print("\n🔍 Testing Authentication - Login...")
        
        if not self.user_id:
            self.log_test("Login test", False, "No user registered for login test")
            return
            
        # We'll test with a fresh registration for login
        timestamp = int(datetime.now().timestamp())
        test_email = f"test.login.{timestamp}@example.com"
        test_password = "TestPass123!"
        
        # Register first
        success, data, status = self.make_request('POST', 'auth/register', {
            "email": test_email,
            "password": test_password,
            "name": f"Test Login {timestamp}",
            "user_type": "influencer"
        })
        
        if not success:
            self.log_test("Login test setup", False, "Failed to create user for login test")
            return
            
        # Now test login
        success, data, status = self.make_request('POST', 'auth/login', {
            "email": test_email,
            "password": test_password
        })
        
        self.log_test("User login", success and status == 200 and 'token' in data,
                     f"Status: {status}, Has token: {'token' in data}")

    def test_auth_me(self):
        """Test getting current user info"""
        print("\n🔍 Testing Authentication - Get Me...")
        
        if not self.token:
            self.log_test("Get current user", False, "No auth token available")
            return
            
        success, data, status = self.make_request('GET', 'auth/me')
        self.log_test("Get current user", success and status == 200 and 'user_id' in data,
                     f"Status: {status}, User: {data.get('name', 'N/A')}")

    def test_brand_profile(self):
        """Test brand profile operations"""
        print("\n🔍 Testing Brand Profile...")
        
        if not self.token:
            self.log_test("Brand profile test", False, "No auth token available")
            return
            
        # Get brand profile (should be empty initially)
        success, data, status = self.make_request('GET', 'brands/profile')
        self.log_test("Get brand profile", success and status == 200,
                     f"Status: {status}, Profile: {data}")
        
        # Create/update brand profile
        brand_data = {
            "user_id": self.user_id,
            "company_name": "Test Company Ltd",
            "website": "https://testcompany.com",
            "industry": "Technology",
            "description": "A test company for API testing",
            "verified": False
        }
        
        success, data, status = self.make_request('POST', 'brands/profile', brand_data)
        self.log_test("Create brand profile", success and status == 200,
                     f"Status: {status}, Company: {data.get('company_name', 'N/A')}")

    def test_collaboration_crud(self):
        """Test collaboration CRUD operations"""
        print("\n🔍 Testing Collaboration CRUD...")
        
        if not self.token:
            self.log_test("Collaboration CRUD", False, "No auth token available")
            return
            
        # Create collaboration
        collab_data = {
            "brand_name": "Test Brand",
            "title": "Test Instagram Campaign",
            "description": "A test collaboration for API testing purposes",
            "deliverables": ["1 Instagram post", "3 Instagram stories"],
            "budget_min": 100.0,
            "budget_max": 200.0,
            "deadline": (datetime.now() + timedelta(days=7)).isoformat(),
            "platform": "instagram",
            "creators_needed": 2,
            "is_public": True
        }
        
        success, data, status = self.make_request('POST', 'collaborations', collab_data)
        collab_id = None
        if success and status == 200 and 'collab_id' in data:
            collab_id = data['collab_id']
            self.log_test("Create collaboration", True, f"Collab ID: {collab_id}")
        else:
            self.log_test("Create collaboration", False, f"Status: {status}, Response: {data}")
            return
            
        # Get collaboration
        success, data, status = self.make_request('GET', f'collaborations/{collab_id}')
        self.log_test("Get collaboration", success and status == 200,
                     f"Status: {status}, Title: {data.get('title', 'N/A')}")
        
        # Get my collaborations
        success, data, status = self.make_request('GET', 'collaborations/my')
        self.log_test("Get my collaborations", success and status == 200,
                     f"Status: {status}, Count: {len(data) if isinstance(data, list) else 'N/A'}")
        
        # Update collaboration status
        success, data, status = self.make_request('PATCH', f'collaborations/{collab_id}/status', 
                                                 {"status": "closed"})
        self.log_test("Update collaboration status", success and status == 200,
                     f"Status: {status}, Response: {data}")

    def test_influencer_profile(self):
        """Test influencer profile operations"""
        print("\n🔍 Testing Influencer Profile...")
        
        # Create influencer user first
        timestamp = int(datetime.now().timestamp())
        test_email = f"test.influencer.{timestamp}@example.com"
        
        success, data, status = self.make_request('POST', 'auth/register', {
            "email": test_email,
            "password": "TestPass123!",
            "name": f"Test Influencer {timestamp}",
            "user_type": "influencer"
        })
        
        if not success:
            self.log_test("Influencer profile test setup", False, "Failed to create influencer user")
            return
            
        # Use influencer token
        influencer_token = data['token']
        original_token = self.token
        self.token = influencer_token
        
        # Create influencer profile
        profile_data = {
            "username": f"testinfluencer{timestamp}",
            "bio": "Test influencer for API testing",
            "niches": ["Fashion", "Lifestyle"],
            "platforms": ["instagram", "tiktok"],
            "audience_size": 10000,
            "engagement_rate": 3.5,
            "price_per_post": 150.0,
            "price_per_story": 75.0,
            "instagram_url": "https://instagram.com/testinfluencer"
        }
        
        success, data, status = self.make_request('POST', 'influencers/profile', profile_data)
        self.log_test("Create influencer profile", success and status == 200,
                     f"Status: {status}, Username: {data.get('username', 'N/A')}")
        
        # Get influencer profile
        success, data, status = self.make_request('GET', 'influencers/profile')
        self.log_test("Get influencer profile", success and status == 200,
                     f"Status: {status}, Username: {data.get('username', 'N/A')}")
        
        # Test public influencer profile
        if success and 'username' in data:
            username = data['username']
            success, data, status = self.make_request('GET', f'influencers/{username}')
            self.log_test("Get public influencer profile", success and status == 200,
                         f"Status: {status}, Username: {data.get('username', 'N/A')}")
        
        # Restore original token
        self.token = original_token

    def test_application_flow(self):
        """Test application creation and management"""
        print("\n🔍 Testing Application Flow...")
        
        # This test requires both brand and influencer users
        # We'll skip if we don't have proper setup
        if not self.token:
            self.log_test("Application flow", False, "No auth setup for application test")
            return
            
        # For now, just test getting applications (should be empty)
        success, data, status = self.make_request('GET', 'applications/my')
        self.log_test("Get my applications", success and status == 200,
                     f"Status: {status}, Count: {len(data) if isinstance(data, list) else 'N/A'}")

    def test_payment_endpoints(self):
        """Test payment-related endpoints"""
        print("\n🔍 Testing Payment Endpoints...")
        
        if not self.token:
            self.log_test("Payment endpoints", False, "No auth token available")
            return
            
        # Test checkout creation (should work but we won't complete payment)
        success, data, status = self.make_request('POST', 'payments/checkout', {
            "plan_id": "pro_monthly",
            "origin_url": "https://fastviral.preview.emergentagent.com"
        })
        
        # This might fail due to Stripe configuration, but we test the endpoint
        self.log_test("Create checkout session", success and status == 200,
                     f"Status: {status}, Has URL: {'url' in data}")

    def test_search_functionality(self):
        """Test full-text search functionality"""
        print("\n🔍 Testing Search Functionality...")
        
        # Test search without query (should return all)
        success, data, status = self.make_request('GET', 'collaborations?limit=5')
        self.log_test("Collaborations without search", success and status == 200,
                     f"Status: {status}, Count: {len(data) if isinstance(data, list) else 'N/A'}")
        
        # Test search with query
        success, data, status = self.make_request('GET', 'collaborations?search=Instagram&limit=5')
        self.log_test("Search collaborations (Instagram)", success and status == 200,
                     f"Status: {status}, Count: {len(data) if isinstance(data, list) else 'N/A'}")
        
        # Test search with different terms
        success, data, status = self.make_request('GET', 'collaborations?search=brand&limit=5')
        self.log_test("Search collaborations (brand)", success and status == 200,
                     f"Status: {status}, Count: {len(data) if isinstance(data, list) else 'N/A'}")
        
        # Test search with URL parameters
        success, data, status = self.make_request('GET', 'collaborations?q=test&platform=instagram')
        self.log_test("Search with URL parameters", success and status == 200,
                     f"Status: {status}, Count: {len(data) if isinstance(data, list) else 'N/A'}")

    def test_admin_endpoints(self):
        """Test admin panel endpoints"""
        print("\n🔍 Testing Admin Endpoints...")
        
        # Test with admin credentials
        admin_success, admin_data, admin_status = self.make_request('POST', 'auth/login', {
            "email": "admin@colaboreaza.ro",
            "password": "admin123"
        })
        
        if not admin_success or admin_status != 200:
            self.log_test("Admin login", False, f"Status: {admin_status}, Response: {admin_data}")
            return
            
        # Store original token and use admin token
        original_token = self.token
        self.token = admin_data.get('token')
        
        # Test admin stats
        success, data, status = self.make_request('GET', 'admin/stats')
        self.log_test("Admin stats", success and status == 200,
                     f"Status: {status}, Users: {data.get('users', {}).get('total', 'N/A') if isinstance(data, dict) else 'N/A'}")
        
        # Test admin users list
        success, data, status = self.make_request('GET', 'admin/users?limit=10')
        self.log_test("Admin users list", success and status == 200,
                     f"Status: {status}, Count: {len(data.get('users', [])) if isinstance(data, dict) else 'N/A'}")
        
        # Test admin users with search
        success, data, status = self.make_request('GET', 'admin/users?search=test&limit=10')
        self.log_test("Admin users search", success and status == 200,
                     f"Status: {status}, Count: {len(data.get('users', [])) if isinstance(data, dict) else 'N/A'}")
        
        # Test admin users with filters
        success, data, status = self.make_request('GET', 'admin/users?user_type=brand&limit=10')
        self.log_test("Admin users filter", success and status == 200,
                     f"Status: {status}, Count: {len(data.get('users', [])) if isinstance(data, dict) else 'N/A'}")
        
        # Test admin collaborations
        success, data, status = self.make_request('GET', 'admin/collaborations?limit=10')
        self.log_test("Admin collaborations list", success and status == 200,
                     f"Status: {status}, Count: {len(data.get('collaborations', [])) if isinstance(data, dict) else 'N/A'}")
        
        # Test admin reports
        success, data, status = self.make_request('GET', 'admin/reports?limit=10')
        self.log_test("Admin reports list", success and status == 200,
                     f"Status: {status}, Count: {len(data.get('reports', [])) if isinstance(data, dict) else 'N/A'}")
        
        # Restore original token
        self.token = original_token

    def test_analytics_endpoints(self):
        """Test analytics endpoints (PRO feature)"""
        print("\n🔍 Testing Analytics Endpoints...")
        
        # Test with regular PRO user
        pro_success, pro_data, pro_status = self.make_request('POST', 'auth/login', {
            "email": "test@test.com",
            "password": "test123"
        })
        
        if not pro_success or pro_status != 200:
            self.log_test("PRO user login", False, f"Status: {pro_status}, Response: {pro_data}")
            return
            
        # Store original token and use PRO token
        original_token = self.token
        self.token = pro_data.get('token')
        
        # Test brand analytics (assuming test@test.com is a brand)
        success, data, status = self.make_request('GET', 'analytics/brand')
        if status == 200:
            self.log_test("Brand analytics (PRO)", True, f"Status: {status}, Overview: {data.get('overview', {}) if isinstance(data, dict) else 'N/A'}")
        elif status == 403:
            # Try influencer analytics instead
            success, data, status = self.make_request('GET', 'analytics/influencer')
            self.log_test("Influencer analytics (PRO)", success and status == 200,
                         f"Status: {status}, Overview: {data.get('overview', {}) if isinstance(data, dict) else 'N/A'}")
        else:
            self.log_test("Analytics endpoints", False, f"Status: {status}, Response: {data}")
        
        # Restore original token
        self.token = original_token
        
        # Test analytics without PRO (should fail)
        if original_token:
            success, data, status = self.make_request('GET', 'analytics/brand')
            self.log_test("Analytics without PRO", status == 403,
                         f"Status: {status} (should be 403), Response: {data}")

    def test_non_admin_access(self):
        """Test that non-admin users cannot access admin endpoints"""
        print("\n🔍 Testing Non-Admin Access Restrictions...")
        
        if not self.token:
            self.log_test("Non-admin access test", False, "No auth token available")
            return
            
        # Test admin endpoints with regular user token (should fail)
        success, data, status = self.make_request('GET', 'admin/stats')
        self.log_test("Non-admin stats access", status == 403,
                     f"Status: {status} (should be 403), Response: {data}")
        
        success, data, status = self.make_request('GET', 'admin/users')
        self.log_test("Non-admin users access", status == 403,
                     f"Status: {status} (should be 403), Response: {data}")

    def test_review_system(self):
        """Test review system functionality"""
        print("\n🔍 Testing Review System...")
        
        # Test top influencers endpoint
        success, data, status = self.make_request('GET', 'influencers/top?limit=10')
        self.log_test("Top influencers endpoint", success and status == 200,
                     f"Status: {status}, Count: {len(data) if isinstance(data, list) else 'N/A'}")
        
        # Test pending reviews endpoint (requires auth)
        if self.token:
            success, data, status = self.make_request('GET', 'reviews/pending')
            self.log_test("Pending reviews endpoint", success and status == 200,
                         f"Status: {status}, Count: {len(data) if isinstance(data, list) else 'N/A'}")
        
        # Test creating a review (requires completed collaboration)
        # This will likely fail as we need proper setup, but we test the endpoint
        if self.token:
            success, data, status = self.make_request('POST', 'reviews', {
                "application_id": "test_app_id",
                "rating": 5,
                "comment": "Test review"
            })
            # Expect 404 or 400 since application doesn't exist
            self.log_test("Create review endpoint", status in [400, 404],
                         f"Status: {status} (expected 400/404), Response: {data}")
        
        # Test getting reviews for a user
        success, data, status = self.make_request('GET', 'reviews/user/test_user_id')
        self.log_test("Get user reviews", success and status == 200,
                     f"Status: {status}, Count: {len(data) if isinstance(data, list) else 'N/A'}")

    def test_collaboration_status_update(self):
        """Test updating collaboration status to completed for review testing"""
        print("\n🔍 Testing Collaboration Status Updates...")
        
        if not self.token:
            self.log_test("Collaboration status test", False, "No auth token available")
            return
            
        # Get my collaborations first
        success, data, status = self.make_request('GET', 'collaborations/my')
        if not success or not isinstance(data, list) or len(data) == 0:
            self.log_test("Get collaborations for status update", False, "No collaborations found")
            return
            
        # Try to update first collaboration to completed
        collab_id = data[0].get('collab_id')
        if collab_id:
            success, response_data, status = self.make_request('PATCH', f'collaborations/{collab_id}/status', 
                                                             {"status": "completed"})
            self.log_test("Update collaboration to completed", success and status == 200,
                         f"Status: {status}, Collab ID: {collab_id}")
        else:
            self.log_test("Update collaboration status", False, "No valid collaboration ID found")

    def run_all_tests(self):
        """Run all test suites"""
        print("🚀 Starting colaboreaza.ro API Tests...")
        print(f"Testing against: {self.api_url}")
        
        try:
            self.test_health_endpoints()
            self.test_public_endpoints()
            self.test_auth_registration()
            self.test_auth_login()
            self.test_auth_me()
            self.test_brand_profile()
            self.test_collaboration_crud()
            self.test_influencer_profile()
            self.test_application_flow()
            self.test_payment_endpoints()
            
            # NEW FEATURE TESTS
            self.test_search_functionality()
            self.test_admin_endpoints()
            self.test_analytics_endpoints()
            self.test_non_admin_access()
            
            # REVIEW SYSTEM TESTS
            self.test_review_system()
            self.test_collaboration_status_update()
            
        except Exception as e:
            print(f"❌ Test suite failed with error: {e}")
            
        # Print summary
        print(f"\n📊 Test Results: {self.tests_passed}/{self.tests_run} passed")
        
        if self.tests_passed == self.tests_run:
            print("🎉 All tests passed!")
            return 0
        else:
            print("⚠️  Some tests failed. Check details above.")
            return 1

def main():
    tester = ColaboreazaAPITester()
    return tester.run_all_tests()

if __name__ == "__main__":
    sys.exit(main())