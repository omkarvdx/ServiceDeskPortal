from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views
from .views_table import TicketTableViewSet, CTITableViewSet
from .views import export_cti_records, export_cti_list

# Create a router and register our viewsets
router = DefaultRouter()
router.register(r'table/tickets', TicketTableViewSet, basename='ticket-table')
router.register(r'table/cti', CTITableViewSet, basename='cti-table')

urlpatterns = [
    # Include router URLs
    path('', include(router.urls)),
    
    # Authentication endpoints
    path("auth/register/", views.UserRegistrationView.as_view(), name="register"),
    path("auth/login/", views.login_view, name="login"),
    path("auth/logout/", views.logout_view, name="logout"),
    path("auth/user/", views.current_user, name="current_user"),
    path("auth/csrf/", views.csrf_token_view, name="csrf_token"),
    # Ticket endpoints
    path("tickets/", views.TicketListView.as_view(), name="ticket_list"),
    path("tickets/export/", views.TicketExportView.as_view(), name="ticket_export"),
    path("tickets/create/", views.TicketCreateView.as_view(), name="ticket_create"),
    path("tickets/bulk-upload/", views.BulkTicketUploadView.as_view(), name="ticket_bulk_upload"),
    path("tickets/<int:pk>/", views.TicketDetailView.as_view(), name="ticket_detail"),
    path("tickets/<int:pk>/delete/", views.TicketDeleteView.as_view(), name="ticket_delete"),
    # Ticket Queue endpoints (NEW)
    path(
        "queue/", views.TicketQueueViewSet.as_view({"get": "list"}), name="ticket_queue"
    ),
    path(
        "queue/stats/",
        views.TicketQueueViewSet.as_view({"get": "stats"}),
        name="queue_stats",
    ),
    path(
        "queue/bulk-update/",
        views.TicketQueueViewSet.as_view({"post": "bulk_update"}),
        name="queue_bulk_update",
    ),
    path(
        "queue/auto-assign/",
        views.TicketQueueViewSet.as_view({"post": "auto_assign"}),
        name="queue_auto_assign",
    ),
    path("queue/filters/", views.queue_filters, name="queue_filters"),
    # CTI and admin endpoints
    path("cti/", views.CTIRecordListView.as_view(), name="cti_list_readonly"),
    path("cti/<int:pk>/", views.CTIRecordDetailView.as_view(), name="cti_detail"),
    path(
        "admin/precompute-embeddings/",
        views.precompute_embeddings,
        name="precompute_embeddings",
    ),
    path("admin/stats/", views.classification_stats, name="classification_stats"),
    # Admin CTI Management (NEW)
    path(
        "admin/cti/",
        views.AdminCTIRecordViewSet.as_view({"get": "list", "post": "create"}),
        name="admin_cti_list",
    ),
    path(
        "admin/cti/<int:pk>/",
        views.AdminCTIRecordViewSet.as_view(
            {
                "get": "retrieve",
                "put": "update",
                "patch": "partial_update",
                "delete": "destroy",
            }
        ),
        name="admin_cti_detail",
    ),
    path(
        "admin/cti/<int:pk>/regenerate-embedding/",
        views.AdminCTIRecordViewSet.as_view({"post": "regenerate_embedding"}),
        name="admin_cti_regenerate_embedding",
    ),
    path(
        "admin/cti/bulk-actions/",
        views.AdminCTIRecordViewSet.as_view({"post": "bulk_actions"}),
        name="admin_cti_bulk_actions",
    ),
    path(
        "admin/cti/filter-options/",
        views.AdminCTIRecordViewSet.as_view({"get": "filter_options"}),
        name="admin_cti_filter_options",
    ),
    path(
        "admin/cti/import/",
        views.AdminCTIRecordViewSet.as_view({"post": "import_file"}),
        name="admin_cti_import",
    ),

    # Admin export endpoint
    path('admin/cti/export/', export_cti_records, name='cti-admin-export'),
    
    # Regular CTI list export endpoint
    path('cti/export/', export_cti_list, name='cti-export'),
    
    # Backward compatibility
    path(
        "admin/cti/import-csv/",
        views.AdminCTIRecordViewSet.as_view({"post": "import_file"}),
        name="admin_cti_import_csv",
    ),
    path("cti/<int:cti_id>/examples/", views.get_cti_examples, name="cti_examples"),
    # Training Examples Management
    path(
        "admin/training-examples/",
        views.TrainingExampleViewSet.as_view({"get": "list", "post": "create"}),
        name="training_examples_list",
    ),
    path(
        "admin/training-examples/<int:pk>/",
        views.TrainingExampleViewSet.as_view(
            {"get": "retrieve", "put": "update", "delete": "destroy"}
        ),
        name="training_example_detail",
    ),
    path(
        "cti/<int:cti_id>/training-examples/",
        views.get_cti_training_examples,
        name="cti_training_examples",
    ),
    path("admin/training-stats/", views.training_statistics, name="training_stats"),
    # AI Performance Analytics
    path(
        "admin/ai-performance-analytics/",
        views.ai_performance_analytics,
        name="ai_performance_analytics",
    ),
    path(
        "admin/cti-recommendations/",
        views.cti_recommendations,
        name="cti_recommendations",
    ),
    path(
        "admin/cti-recommendations/<str:recommendation_id>/apply/",
        views.apply_cti_recommendation,
        name="apply_cti_recommendation",
    ),
    path("admin/cti-trends/", views.cti_trends, name="cti_trends"),
]
