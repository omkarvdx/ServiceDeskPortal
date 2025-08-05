from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase
from rest_framework import status
from .models import CTIRecord, Ticket, TrainingExample
from .ai_service import TicketClassificationService
from django.conf import settings

# Use in-memory SQLite database for tests
settings.DATABASES["default"] = {
    "ENGINE": "django.db.backends.sqlite3",
    "NAME": ":memory:",
}

User = get_user_model()


class UserModelTest(TestCase):
    def test_user_creation(self):
        user = User.objects.create_user(
            username="testuser",
            email="test@example.com",
            password="testpass123",
            role="end_user",
        )
        self.assertEqual(user.username, "testuser")
        self.assertEqual(user.role, "end_user")


class TicketAPITest(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="testuser",
            email="test@example.com",
            password="testpass123",
            role="end_user",
        )
        self.support_user = User.objects.create_user(
            username="support",
            email="support@example.com",
            password="testpass123",
            role="support_engineer",
        )

    def test_bulk_ticket_upload(self):
        admin = User.objects.create_user(
            username="adminuser", password="adminpass", role="admin"
        )
        self.client.force_authenticate(user=admin)

        csv_content = (
            "summary,description,created_by\n"
            "Bulk1,Desc1,testuser\n"
            "Bulk2,Desc2,testuser\n"
        )

        from django.core.files.uploadedfile import SimpleUploadedFile

        response = self.client.post(
            "/api/tickets/bulk-upload/",
            {"file": SimpleUploadedFile("tickets.csv", csv_content.encode())},
            format="multipart",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["created_count"], 2)
        self.assertEqual(Ticket.objects.count(), 2)

    def test_login(self):
        response = self.client.post(
            "/api/auth/login/",
            {
                "username": "testuser",
                "password": "testpass123",
            },
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_create_ticket(self):
        self.client.force_authenticate(user=self.user)
        response = self.client.post(
            "/api/tickets/create/",
            {
                "summary": "Test ticket",
                "description": "Test description",
            },
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_patch_unclassified_ticket(self):
        """Updating an unclassified ticket should not raise errors"""
        self.client.force_authenticate(user=self.support_user)

        ticket = Ticket.objects.create(
            summary="Needs help",
            description="Something broke",
            created_by=self.user,
        )

        cti = CTIRecord.objects.create(
            bu_number="001",
            category="Cat",
            type="Type",
            item="Item",
            resolver_group="RG",
            request_type="Incident",
            sla="P1",
            service_description="",
            bu_description="",
            resolver_group_description="",
        )

        response = self.client.patch(
            f"/api/tickets/{ticket.id}/",
            {"corrected_cti_id": cti.id},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        ticket.refresh_from_db()
        self.assertEqual(ticket.corrected_cti, cti)


class AIServiceTest(TestCase):
    def setUp(self):
        from django.conf import settings

        settings.OPENAI_API_KEY = "test"
        self.service = TicketClassificationService()

    def test_service_initialization(self):
        self.assertIsNotNone(self.service)
        self.assertEqual(self.service.embedding_model, "text-embedding-3-large")


class RolePermissionTest(APITestCase):
    def setUp(self):
        self.admin_user = User.objects.create_user(
            username="admin", password="test", role="admin"
        )
        self.support_user = User.objects.create_user(
            username="support", password="test", role="support_engineer"
        )
        self.end_user = User.objects.create_user(
            username="enduser", password="test", role="end_user"
        )

    def test_admin_can_create_cti(self):
        self.client.force_authenticate(user=self.admin_user)
        response = self.client.post(
            "/api/admin/cti/", {"category": "Test", "type": "Test", "item": "Test"}
        )
        self.assertEqual(response.status_code, 201)

    def test_support_engineer_cannot_create_cti(self):
        self.client.force_authenticate(user=self.support_user)
        response = self.client.post(
            "/api/admin/cti/", {"category": "Test", "type": "Test", "item": "Test"}
        )
        self.assertEqual(response.status_code, 403)

    def test_support_engineer_can_view_cti(self):
        self.client.force_authenticate(user=self.support_user)
        response = self.client.get("/api/cti/")
        self.assertEqual(response.status_code, 200)

    def test_admin_can_view_queue_endpoints(self):
        Ticket.objects.create(
            summary="Q1", description="Test", created_by=self.end_user
        )
        self.client.force_authenticate(user=self.admin_user)
        list_resp = self.client.get("/api/queue/")
        stats_resp = self.client.get("/api/queue/stats/")
        filters_resp = self.client.get("/api/queue/filters/")

        self.assertEqual(list_resp.status_code, 200)
        self.assertEqual(stats_resp.status_code, 200)
        self.assertEqual(filters_resp.status_code, 200)
