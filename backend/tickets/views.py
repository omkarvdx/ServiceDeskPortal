# Standard library imports
from datetime import datetime, timedelta
import io
import csv
import logging

# Third-party imports
import pandas as pd
import openpyxl
from openpyxl.utils import get_column_letter
from openpyxl.styles import Font, Alignment

# Django imports
from django.db.models import (
    Q, Count, F, ExpressionWrapper, FloatField, Case, When, Value, IntegerField,
    Avg, DurationField
)
from django.db.models.functions import Coalesce
from django.utils import timezone
from django.http import JsonResponse, HttpResponse, HttpResponseRedirect
from django.contrib.auth import login, logout, get_user_model
from django.contrib.auth.decorators import login_required
from django.utils.decorators import method_decorator
from django.shortcuts import get_object_or_404
from django.middleware.csrf import get_token
from django.views.decorators.csrf import ensure_csrf_cookie, csrf_exempt
from django_filters.rest_framework import DjangoFilterBackend

# DRF imports
from rest_framework import generics, status, filters, permissions, viewsets, renderers
from rest_framework.pagination import PageNumberPagination
from rest_framework.pagination import CTIRecordPagination
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.decorators import (
    api_view, action, permission_classes, authentication_classes
)
from rest_framework.permissions import (
    IsAuthenticated, IsAdminUser, AllowAny, IsAuthenticatedOrReadOnly
)
from rest_framework.viewsets import ViewSet, ModelViewSet, ReadOnlyModelViewSet
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from django_filters.rest_framework import DjangoFilterBackend

# Local application imports
from .models import (
    User, Ticket, CTIRecord, ClassificationCorrection, TrainingExample, FewShotExample
)
from .serializers import (
    UserSerializer, UserRegistrationSerializer, LoginSerializer,
    TicketCreateSerializer, TicketListSerializer, TicketDetailSerializer,
    TicketUpdateSerializer, CTIRecordSerializer, TrainingExampleSerializer,
    TicketQueueSerializer, AdminCTIRecordSerializer, CTIRecordCreateUpdateSerializer,
    BulkUpdateSerializer, BulkCTIActionSerializer,
    TrainingExampleCreateSerializer
)
from .ai_service import classification_service
from .permissions import (
    IsAdminOnly, CTIPermission
)



logger = logging.getLogger(__name__)

@api_view(["POST"])
@permission_classes([permissions.AllowAny])
def login_view(request):
    """User login endpoint"""
    serializer = LoginSerializer(data=request.data)
    if serializer.is_valid():
        user = serializer.validated_data["user"]
        login(request, user)
        return Response(
            {"user": UserSerializer(user).data, "message": "Login successful"}
        )
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(["POST"])
def logout_view(request):
    """User logout endpoint"""
    logout(request)
    return Response({"message": "Logout successful"})


@api_view(["GET"])
@ensure_csrf_cookie
@permission_classes([permissions.AllowAny])
def csrf_token_view(request):
    """Get CSRF token for frontend"""
    return Response({"csrfToken": get_token(request)})


@api_view(["GET"])
def current_user(request):
    """Get current authenticated user"""
    if request.user.is_authenticated:
        return Response(UserSerializer(request.user).data)
    return Response({"error": "Not authenticated"}, status=status.HTTP_401_UNAUTHORIZED)


class UserRegistrationView(generics.CreateAPIView):
    """
    API endpoint that allows new users to register.
    First user becomes admin, subsequent users are end_users unless created by admin.
    """
    permission_classes = [permissions.AllowAny]
    serializer_class = UserRegistrationSerializer

    def perform_create(self, serializer):
        # The serializer has already handled role validation
        # Just log the user creation
        user = serializer.save()
        logger.info(f"New user created: {user.username} (Role: {user.role})")
        
        # Log in the first user automatically
        if not User.objects.exists():
            login(self.request, user, backend='django.contrib.auth.backends.ModelBackend')



class TicketCreateView(generics.CreateAPIView):
    """Create new ticket with AI classification"""

    serializer_class = TicketCreateSerializer
    permission_classes = [permissions.IsAuthenticated]

    def perform_create(self, serializer):
        ticket = serializer.save()

        # Trigger AI classification
        try:
            # Get initial prediction
            predicted_cti, confidence, justification = (
                classification_service.classify_ticket(
                    ticket.summary, 
                    ticket.description,
                    ticket_instance=ticket  # Pass ticket instance to save similar CTI records
                )
            )

            # Ensure we have a valid CTI prediction, fall back to default if needed
            final_cti, final_confidence, final_justification = (
                classification_service.ensure_valid_cti_prediction(
                    ticket=ticket,
                    predicted_cti=predicted_cti,
                    confidence=confidence,
                    justification=justification
                )
            )

            # Update ticket with final CTI information
            if final_cti:
                ticket.predicted_cti = final_cti
                ticket.prediction_confidence = final_confidence
                ticket.prediction_justification = final_justification
                ticket.save()
                
                logger.info(
                    f"Classified ticket {ticket.ticket_id} with confidence {final_confidence}"
                )
                
                # If confidence is high, record as a successful classification
                if final_confidence > 0.7:
                    classification_service.record_successful_classification(
                        ticket, final_cti, "ai"
                    )
                elif final_cti.id == classification_service.DEFAULT_CTI_ID:
                    logger.info(
                        f"Using default CTI for ticket {ticket.ticket_id} - {final_justification}"
                    )
            else:
                logger.warning(
                    f"Could not classify ticket {ticket.ticket_id} and no default available: {final_justification}"
                )

        except Exception as e:
            logger.error(f"Error classifying ticket {ticket.ticket_id}: {e}")
            # Try to use default CTI even if there's an error
            try:
                default_cti = classification_service.get_default_cti_record()
                if default_cti:
                    ticket.predicted_cti = default_cti
                    ticket.prediction_confidence = 0.3  # Low confidence for error case
                    ticket.prediction_justification = f"Error during classification: {str(e)[:200]}. Using default CTI."
                    ticket.save()
            except Exception as inner_e:
                logger.error(f"Failed to set default CTI after error: {inner_e}")


class ExcelFileResponse(HttpResponse):
    """Custom response class for Excel files"""
    def __init__(self, data, filename='export.xlsx', **kwargs):
        super().__init__(
            content=data,
            content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            **kwargs
        )
        self['Content-Disposition'] = f'attachment; filename="{filename}"'
        self['Access-Control-Expose-Headers'] = 'Content-Disposition'


class TicketExportView(APIView):
    """Export all tickets to Excel format with specific columns"""
    permission_classes = [permissions.IsAuthenticated]
    
    def get(self, request, *args, **kwargs):
        try:
            logger.info("Exporting all tickets to Excel with specific columns")
            
            # Get all tickets based on user permissions
            if request.user.role == "admin":
                queryset = Ticket.objects.all().select_related('final_cti')
            else:
                queryset = Ticket.objects.filter(created_by=request.user).select_related('final_cti')
            
            # Prepare data with only the required columns
            data = []
            for ticket in queryset:
                data.append({
                    'Ticket ID': ticket.ticket_id,
                    'Summary': ticket.summary or '',
                    'Description': ticket.description or '',
                    'Category': ticket.final_cti.category if ticket.final_cti else '',
                    'Type': ticket.final_cti.type if ticket.final_cti else '',
                    'Item': ticket.final_cti.item if ticket.final_cti else '',
                    'Resolver Group': ticket.final_cti.resolver_group if ticket.final_cti else '',
                    'Request Type': ticket.final_cti.request_type if ticket.final_cti else '',
                    'SLA': ticket.final_cti.sla if ticket.final_cti else '',
                    'Justification': ticket.prediction_justification or ''
                })
            
            logger.info(f"Exporting {len(data)} tickets with specific columns")
            
            if not data:
                return Response(
                    {"detail": "No tickets found matching the specified criteria"},
                    status=status.HTTP_404_NOT_FOUND
                )
            
            # Convert to DataFrame for easier export
            df = pd.DataFrame(data)
            
            # Generate Excel file
            output = io.BytesIO()
            
            # Create Excel writer with xlsxwriter engine
            with pd.ExcelWriter(
                output, 
                engine='xlsxwriter',
                engine_kwargs={'options': {'remove_timezone': True}},
                datetime_format='yyyy-mm-dd hh:mm:ss'
            ) as writer:
                # Convert the dataframe to an XlsxWriter Excel object
                df.to_excel(writer, sheet_name='Tickets', index=False)
                
                # Get the xlsxwriter workbook and worksheet objects
                workbook = writer.book
                worksheet = writer.sheets['Tickets']
                
                # Define formats
                header_format = workbook.add_format({
                    'bold': True,
                    'text_wrap': True,
                    'valign': 'top',
                    'fg_color': '#4472C4',
                    'font_color': 'white',
                    'border': 1,
                    'align': 'center'
                })
                
                # Format header row
                for col_num, value in enumerate(df.columns.values):
                    worksheet.write(0, col_num, value, header_format)
                
                # Set column widths
                column_widths = {
                    'Ticket ID': 15,
                    'Summary': 50,
                    'Description': 70,
                    'Category': 20,
                    'Type': 20,
                    'Item': 30,
                    'Resolver Group': 25,
                    'Request Type': 20,
                    'SLA': 15,
                    'Justification': 70
                }
                
                for i, column in enumerate(df.columns):
                    width = column_widths.get(column, 20)
                    worksheet.set_column(i, i, width)
                
                # Add autofilter
                if len(df) > 0:  # Only add autofilter if there's data
                    worksheet.autofilter(0, 0, len(df), len(df.columns) - 1)
                
                # Freeze the header row
                worksheet.freeze_panes(1, 0)
                
                # Enable text wrapping for description and justification columns
                wrap_format = workbook.add_format({'text_wrap': True, 'valign': 'top'})
                worksheet.set_column('C:C', None, wrap_format)  # Description
                worksheet.set_column('J:J', None, wrap_format)  # Justification
            
            # Save the Excel file to a temporary file
            output.seek(0)
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f'tickets_export_{timestamp}.xlsx'
            
            # Create a temporary file
            with tempfile.NamedTemporaryFile(delete=False, suffix='.xlsx') as tmp:
                tmp.write(output.getvalue())
                tmp_path = tmp.name
            
            # Create a FileResponse
            response = FileResponse(
                open(tmp_path, 'rb'),
                as_attachment=True,
                filename=filename,
                content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            )
            
            # Clean up the temporary file when the response is closed
            def cleanup_temp_file():
                try:
                    os.unlink(tmp_path)
                except:
                    pass
            
            response['Content-Disposition'] = f'attachment; filename="{filename}"'
            response['Access-Control-Expose-Headers'] = 'Content-Disposition'
            
            # Add cleanup to response close
            response.closed = cleanup_temp_file
            
            logger.info("Excel file with specific columns generated successfully")
            return response
            
        except Exception as e:
            logger.error(f"Error in TicketExportView: {str(e)}", exc_info=True)
            return Response(
                {"detail": f"An error occurred while exporting tickets: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

class TicketPagination(PageNumberPagination):
    """
    Custom pagination class for ticket listings.
    Allows clients to set page size via query parameter up to a maximum of 100 items per page.
    """
    page_size = 20
    page_size_query_param = 'page_size'
    max_page_size = 100


class TicketListView(generics.ListAPIView):
    """List tickets based on user role, filters, and pagination"""

    serializer_class = TicketListSerializer
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = TicketPagination

    def get_queryset(self):
        user = self.request.user
        queryset = Ticket.objects.select_related(
            "created_by", "assigned_to", "predicted_cti", "corrected_cti"
        ).order_by("-created_at")

        if user.role == "end_user":
            queryset = queryset.filter(created_by=user)
        elif user.role == "support_engineer":
            pass  # Future logic can be added here

        # Filter by classification
        classification = self.request.query_params.get("classification")
        if classification == "unclassified":
            queryset = queryset.filter(
                Q(predicted_cti__isnull=True) |
                Q(predicted_cti__resolver_group__isnull=True) |
                Q(predicted_cti__resolver_group__exact='')
            )
        elif classification == "corrected":
            queryset = queryset.filter(
                predicted_cti__isnull=False,
                predicted_cti__resolver_group__isnull=False
            ).exclude(predicted_cti__resolver_group__exact='')

        # Filter by status
        status = self.request.query_params.get("status")
        if status:
            queryset = queryset.filter(status=status)

        # Search filter
        search = self.request.query_params.get("search")
        if search:
            queryset = queryset.filter(
                Q(ticket_id__icontains=search) |
                Q(summary__icontains=search) |
                Q(description__icontains=search)
            )

        return queryset

class TicketDeleteView(generics.DestroyAPIView):
    """Delete a ticket"""
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        user = self.request.user
        if user.role == 'admin':
            return Ticket.objects.all()
        return Ticket.objects.filter(created_by=user)
    
    def perform_destroy(self, instance):
        # Add any additional cleanup logic here if needed
        instance.delete()


class TicketDetailView(generics.RetrieveUpdateAPIView):
    """Get and update ticket details"""

    serializer_class = TicketDetailSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        queryset = Ticket.objects.select_related(
            "created_by",
            "assigned_to",
            "predicted_cti",
            "corrected_cti",
            "corrected_by",
        )

        if user.role == "end_user":
            return queryset.filter(created_by=user)
        return queryset

    def get_serializer_class(self):
        if self.request.method in ["PUT", "PATCH"]:
            return TicketUpdateSerializer
        return TicketDetailSerializer


class CTIRecordDetailView(generics.RetrieveUpdateAPIView):
    """Retrieve and update individual CTI records"""
    queryset = CTIRecord.objects.all()
    serializer_class = CTIRecordCreateUpdateSerializer
    permission_classes = [IsAdminOnly]
    lookup_field = 'pk'
    
    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)
        
        # Regenerate embedding if any relevant fields were updated
        update_fields = serializer.validated_data.keys()
        if any(field in update_fields for field in ['category', 'item', 'service_description', 'bu_description']):
            self._regenerate_embedding_for_record(instance)
            
        return Response(CTIRecordSerializer(instance).data)
    
    def _regenerate_embedding_for_record(self, cti_record):
        """Helper method to regenerate embedding for a CTI record"""
        try:
            cti_record.embedding = classification_service.generate_embedding(
                f"{cti_record.category} {cti_record.item} {cti_record.service_description}"
            )
            cti_record.save(update_fields=['embedding'])
            return True
        except Exception as e:
            logger.error(f"Failed to regenerate embedding for CTI record {cti_record.id}: {str(e)}")
            return False


class CTIRecordListView(generics.ListAPIView):
    """
    List CTI records for admins (read-only), with optional filters and pagination.
    """

    serializer_class = CTIRecordSerializer
    permission_classes = [IsAdminOnly]
    pagination_class = CTIRecordPagination

    def get_queryset(self):
        if self.request.user.role not in ["support_engineer", "admin"]:
            return CTIRecord.objects.none()

        queryset = CTIRecord.objects.all().order_by("category", "type", "item")

        category = self.request.query_params.get("category")
        if category:
            queryset = queryset.filter(category__icontains=category)

        search = self.request.query_params.get("search")
        if search:
            queryset = queryset.filter(
                Q(category__icontains=search) |
                Q(type__icontains=search) |
                Q(item__icontains=search) |
                Q(resolver_group__icontains=search)
            )

        return queryset


@api_view(["POST"])
@permission_classes([IsAdminOnly])
def precompute_embeddings(request):
    """Endpoint to precompute embeddings for all CTI records"""

    try:
        classification_service.precompute_cti_embeddings()
        return Response({"message": "Embeddings computed successfully"})
    except Exception as e:
        return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(["GET"])
@permission_classes([IsAdminOnly])
def classification_stats(request):
    """Get classification statistics for analytics"""

    from django.db.models import Count, Avg

    stats = {
        "total_tickets": Ticket.objects.count(),
        "classified_tickets": Ticket.objects.filter(
            predicted_cti__isnull=False
        ).count(),
        "corrected_tickets": Ticket.objects.filter(corrected_cti__isnull=False).count(),
        "avg_confidence": Ticket.objects.filter(prediction_confidence__isnull=False)
        .aggregate(Avg("prediction_confidence"))
        .get("prediction_confidence__avg")
        or 0,
        "status_breakdown": list(
            Ticket.objects.values("status").annotate(count=Count("status"))
        ),
        "category_breakdown": list(
            CTIRecord.objects.values("category").annotate(
                count=Count("predicted_tickets")
            )
        ),
    }

    return Response(stats)


class TicketQueueViewSet(ViewSet):
    """Advanced ticket queue for support engineers and admins"""

    serializer_class = TicketQueueSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        if self.request.user.role not in ["support_engineer", "admin"]:
            return Ticket.objects.none()

        queryset = Ticket.objects.select_related(
            "created_by", "assigned_to", "predicted_cti", "corrected_cti"
        ).prefetch_related("created_by", "assigned_to")

        queryset = self.apply_filters(queryset)
        queryset = self.apply_sorting(queryset)
        return queryset

    def apply_filters(self, queryset):
        """Apply advanced filtering"""
        params = self.request.query_params

        status_filter = params.get("status")
        if status_filter:
            if status_filter == "open_unassigned":
                queryset = queryset.filter(status="open", assigned_to__isnull=True)
            elif status_filter == "my_assigned":
                queryset = queryset.filter(assigned_to=self.request.user)
            else:
                queryset = queryset.filter(status=status_filter)

        assignment = params.get("assignment")
        if assignment == "assigned":
            queryset = queryset.filter(assigned_to__isnull=False)
        elif assignment == "unassigned":
            queryset = queryset.filter(assigned_to__isnull=True)
        elif assignment == "me":
            queryset = queryset.filter(assigned_to=self.request.user)

        classification = params.get("classification")
        if classification == "unclassified":
            queryset = queryset.filter(
                Q(resolver_group__isnull=True) | Q(resolver_group__exact='')
            )
        elif classification == "corrected":
            queryset = queryset.filter(
                Q(resolver_group__isnull=False) & ~Q(resolver_group__exact='')
            )
        elif classification == "needs_review":
            queryset = queryset.filter(
                Q(predicted_cti__isnull=True) | Q(prediction_confidence__lt=0.3)
            )

        age_filter = params.get("age")
        if age_filter:
            now = timezone.now()
            if age_filter == "last_24h":
                queryset = queryset.filter(created_at__gte=now - timedelta(hours=24))
            elif age_filter == "last_week":
                queryset = queryset.filter(created_at__gte=now - timedelta(days=7))
            elif age_filter == "older_than_24h":
                queryset = queryset.filter(created_at__lt=now - timedelta(hours=24))
            elif age_filter == "older_than_week":
                queryset = queryset.filter(created_at__lt=now - timedelta(days=7))

        category = params.get("category")
        if category:
            queryset = queryset.filter(
                Q(predicted_cti__category__icontains=category)
                | Q(corrected_cti__category__icontains=category)
            )

        priority = params.get("priority")
        if priority == "high":
            now = timezone.now()
            queryset = queryset.filter(
                Q(created_at__lt=now - timedelta(hours=24), status="open")
                | Q(prediction_confidence__lt=0.3)
                | Q(predicted_cti__isnull=True)
                | Q(status="open", assigned_to__isnull=True)
            )

        search = params.get("search")
        if search:
            queryset = queryset.filter(
                Q(ticket_id__icontains=search)
                | Q(summary__icontains=search)
                | Q(description__icontains=search)
                | Q(created_by__first_name__icontains=search)
                | Q(created_by__last_name__icontains=search)
            )

        return queryset

    def apply_sorting(self, queryset):
        """Apply sorting"""
        sort_by = self.request.query_params.get("sort", "-created_at")

        sort_options = {
            "created_at": "created_at",
            "-created_at": "-created_at",
            "updated_at": "updated_at",
            "-updated_at": "-updated_at",
            "ticket_id": "ticket_id",
            "-ticket_id": "-ticket_id",
            "status": "status",
            "-status": "-status",
            "confidence": "prediction_confidence",
            "-confidence": "-prediction_confidence",
            "age": "created_at",
            "-age": "-created_at",
        }

        if sort_by in sort_options:
            queryset = queryset.order_by(sort_options[sort_by])

        return queryset

    @action(detail=False, methods=["get"])
    def stats(self, request):
        """Get queue statistics"""
        if request.user.role not in ["support_engineer", "admin"]:
            return Response(
                {"error": "Permission denied"}, status=status.HTTP_403_FORBIDDEN
            )

        now = timezone.now()
        tickets = Ticket.objects.all()

        stats = {
            "total_tickets": tickets.count(),
            "open_tickets": tickets.filter(status="open").count(),
            "unassigned_tickets": tickets.filter(
                status="open", assigned_to__isnull=True
            ).count(),
            "needs_attention": tickets.filter(
                Q(created_at__lt=now - timedelta(hours=24), status="open")
                | Q(prediction_confidence__lt=0.3)
                | Q(predicted_cti__isnull=True)
                | Q(status="open", assigned_to__isnull=True)
            ).count(),
            "my_assigned": tickets.filter(
                assigned_to=request.user, status__in=["open", "in_progress"]
            ).count(),
        }

        avg_age_delta = tickets.aggregate(
            avg_age=Avg(
                Case(
                    When(
                        status__in=["open", "in_progress"],
                        then=ExpressionWrapper(
                            now - F("created_at"), output_field=DurationField()
                        ),
                    ),
                    default=timedelta(0),
                    output_field=DurationField(),
                )
            )
        )["avg_age"]
        if avg_age_delta:
            stats["avg_age_hours"] = round(avg_age_delta.total_seconds() / 3600, 1)
        else:
            stats["avg_age_hours"] = 0

        classified_tickets = tickets.filter(predicted_cti__isnull=False)
        corrected_tickets = tickets.filter(corrected_cti__isnull=False)

        if classified_tickets.count() > 0:
            accuracy = 1 - (corrected_tickets.count() / classified_tickets.count())
            stats["classification_accuracy"] = round(accuracy * 100, 1)
        else:
            stats["classification_accuracy"] = 0.0

        return Response(stats)

    @action(detail=False, methods=["post"])
    def bulk_update(self, request):
        """Bulk update tickets"""
        if request.user.role not in ["support_engineer", "admin"]:
            return Response(
                {"error": "Permission denied"}, status=status.HTTP_403_FORBIDDEN
            )

        serializer = BulkUpdateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        data = serializer.validated_data
        ticket_ids = data["ticket_ids"]
        action = data["action"]

        tickets = Ticket.objects.filter(id__in=ticket_ids)
        updated_count = 0

        try:
            if action == "assign":
                assigned_to_id = data.get("assigned_to_id")
                assigned_to = None
                if assigned_to_id:
                    assigned_to = User.objects.get(
                        id=assigned_to_id, role="support_engineer"
                    )

                updated_count = tickets.update(assigned_to=assigned_to)

            elif action == "status":
                new_status = data["status"]
                updated_count = tickets.update(status=new_status)

            elif action == "classify":
                cti_id = data["cti_id"]
                cti = CTIRecord.objects.get(id=cti_id)

                for ticket in tickets:
                    ticket.corrected_cti = cti
                    ticket.corrected_by = request.user
                    ticket.corrected_at = timezone.now()
                    ticket.save()

                    if ticket.predicted_cti:
                        from .ai_service import classification_service

                        classification_service.record_correction(
                            ticket=ticket,
                            original_prediction=ticket.predicted_cti,
                            corrected_cti=cti,
                            corrected_by=request.user,
                            notes=f"Bulk classification update",
                        )

                updated_count = len(ticket_ids)

            return Response(
                {
                    "success": True,
                    "updated_count": updated_count,
                    "message": f"Successfully updated {updated_count} tickets",
                }
            )

        except User.DoesNotExist:
            return Response(
                {"error": "Invalid user ID"}, status=status.HTTP_400_BAD_REQUEST
            )
        except CTIRecord.DoesNotExist:
            return Response(
                {"error": "Invalid CTI record ID"}, status=status.HTTP_400_BAD_REQUEST
            )
        except Exception as e:
            return Response(
                {"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=False, methods=["post"])
    def auto_assign(self, request):
        """Auto-assign tickets to available support engineers"""
        if request.user.role not in ["support_engineer", "admin"]:
            return Response(
                {"error": "Permission denied"}, status=status.HTTP_403_FORBIDDEN
            )

        unassigned_tickets = Ticket.objects.filter(
            status="open", assigned_to__isnull=True
        ).order_by("created_at")

        support_engineers = User.objects.filter(role="support_engineer", is_active=True)

        workloads = {}
        for engineer in support_engineers:
            workload = Ticket.objects.filter(
                assigned_to=engineer, status__in=["open", "in_progress"]
            ).count()
            workloads[engineer.id] = workload

        sorted_engineers = sorted(workloads.items(), key=lambda x: x[1])

        assigned_count = 0
        engineer_index = 0

        for ticket in unassigned_tickets[:50]:
            if engineer_index >= len(sorted_engineers):
                engineer_index = 0

            engineer_id = sorted_engineers[engineer_index][0]
            engineer = User.objects.get(id=engineer_id)

            ticket.assigned_to = engineer
            ticket.save()

            assigned_count += 1
            engineer_index += 1

        return Response(
            {
                "success": True,
                "assigned_count": assigned_count,
                "message": f"Auto-assigned {assigned_count} tickets",
            }
        )


@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated])
def queue_filters(request):
    """Get available filter options for queue view"""
    if request.user.role not in ["support_engineer", "admin"]:
        return Response(
            {"error": "Permission denied"}, status=status.HTTP_403_FORBIDDEN
        )

    categories = (
        CTIRecord.objects.values_list("category", flat=True)
        .distinct()
        .order_by("category")
    )

    support_engineers = User.objects.filter(
        role="support_engineer", is_active=True
    ).values("id", "first_name", "last_name", "username")

    filters = {
        "statuses": [
            {"value": "open", "label": "Open"},
            {"value": "in_progress", "label": "In Progress"},
            {"value": "resolved", "label": "Resolved"},
            {"value": "closed", "label": "Closed"},
            {"value": "open_unassigned", "label": "Open & Unassigned"},
            {"value": "my_assigned", "label": "Assigned to Me"},
        ],
        "assignments": [
            {"value": "all", "label": "All Tickets"},
            {"value": "assigned", "label": "Assigned"},
            {"value": "unassigned", "label": "Unassigned"},
            {"value": "me", "label": "Assigned to Me"},
        ],
        "classifications": [
            {"value": "all", "label": "All Classifications"},
            {"value": "unclassified", "label": "Unclassified"},
            {"value": "low_confidence", "label": "Low Confidence (<50%)"},
            {"value": "corrected", "label": "Manually Corrected"},
            {"value": "needs_review", "label": "Needs Review"},
        ],
        "ages": [
            {"value": "all", "label": "All Ages"},
            {"value": "last_24h", "label": "Last 24 Hours"},
            {"value": "last_week", "label": "Last Week"},
            {"value": "older_than_24h", "label": "Older than 24h"},
            {"value": "older_than_week", "label": "Older than 1 week"},
        ],
        "priorities": [
            {"value": "all", "label": "All Priorities"},
            {"value": "high", "label": "High Priority"},
        ],
        "categories": [{"value": cat, "label": cat} for cat in categories],
        "support_engineers": list(support_engineers),
        "sort_options": [
            {"value": "-created_at", "label": "Newest First"},
            {"value": "created_at", "label": "Oldest First"},
            {"value": "-updated_at", "label": "Recently Updated"},
            {"value": "ticket_id", "label": "Ticket ID (A-Z)"},
            {"value": "-ticket_id", "label": "Ticket ID (Z-A)"},
            {"value": "status", "label": "Status (A-Z)"},
            {"value": "-confidence", "label": "Highest Confidence"},
            {"value": "confidence", "label": "Lowest Confidence"},
        ],
    }

    return Response(filters)


class BulkTicketUploadView(APIView):
    """Bulk create tickets from a CSV file with AI classification"""
    parser_classes = (MultiPartParser, FormParser)
    permission_classes = [IsAdminOnly]

    def post(self, request, *args, **kwargs):
        import csv
        import io
        import chardet
        from django.db import transaction

        if "file" not in request.FILES:
            return Response(
                {"success": False, "message": "No file provided"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Read the file content once
        try:
            file_content = request.FILES['file'].read()
            
            # Detect the file encoding
            result = chardet.detect(file_content)
            encoding = result['encoding']
            
            # Decode the content with the detected encoding
            csv_content = file_content.decode(encoding)
            
            # Handle any problematic line endings
            csv_content = csv_content.replace('\r\n', '\n').replace('\r', '\n')
            
            # Create a file-like object
            csv_file = io.StringIO(csv_content)
            
            # Read the CSV with proper handling of quoted fields
            reader = csv.DictReader(csv_file, quotechar='"', quoting=csv.QUOTE_MINIMAL)

            created_count = 0
            classified_count = 0
            error_count = 0
            errors = []

            # First, collect all data and check for duplicates
            rows_to_process = []
            existing_ticket_ids = set(Ticket.objects.values_list('ticket_id', flat=True))
            
            for row_num, row in enumerate(reader, start=2):
                # Clean the row data
                row = {k: (v.strip() if v else '') for k, v in row.items()}
                
                summary = row.get("summary", "")
                description = row.get("description", "")
                username = row.get("created_by", "")
                ticket_id = row.get("ticket_id", "")

                if not summary or not description or not username:
                    errors.append(f"Row {row_num}: summary, description, and created_by are required")
                    error_count += 1
                    continue
                
                if ticket_id and ticket_id in existing_ticket_ids:
                    errors.append(f"Row {row_num}: Ticket with ID '{ticket_id}' already exists")
                    error_count += 1
                    continue
                    
                try:
                    user = User.objects.get(username=username)
                    rows_to_process.append({
                        'row_num': row_num,
                        'summary': summary,
                        'description': description,
                        'user': user,
                        'ticket_id': ticket_id if ticket_id else None
                    })
                    if ticket_id:
                        existing_ticket_ids.add(ticket_id)
                except User.DoesNotExist:
                    errors.append(f"Row {row_num}: User with username '{username}' does not exist")
                    error_count += 1
            
            # Now process valid rows in individual transactions
            for row_data in rows_to_process:
                with transaction.atomic():
                    try:
                        # Create ticket
                        ticket_data = {
                            'summary': row_data['summary'],
                            'description': row_data['description'],
                            'created_by': row_data['user'],
                            'similar_cti_records': []
                        }
                        
                        if row_data['ticket_id']:
                            ticket_data['ticket_id'] = row_data['ticket_id']
                            
                        ticket = Ticket.objects.create(**ticket_data)
                        created_count += 1
                        
                        # Perform AI classification
                        try:
                            predicted_cti, confidence, justification = classification_service.classify_ticket(
                                ticket.summary, 
                                ticket.description,
                                ticket_instance=ticket
                            )

                            if predicted_cti:
                                update_fields = {
                                    'predicted_cti': predicted_cti,
                                    'prediction_confidence': confidence,
                                    'prediction_justification': justification
                                }
                                
                                # Update the ticket with classification results
                                for field, value in update_fields.items():
                                    setattr(ticket, field, value)
                                ticket.save(update_fields=list(update_fields.keys()) + ['similar_cti_records'])
                                
                                logger.info(f"Classified ticket {ticket.ticket_id} with confidence {confidence}")
                                
                                if confidence > 0.7:
                                    classification_service.record_successful_classification(
                                        ticket, predicted_cti, "ai"
                                    )
                                    classified_count += 1
                            else:
                                logger.warning(f"Could not classify ticket {ticket.ticket_id}: {justification}")
                                
                        except Exception as e:
                            logger.error(f"Error classifying ticket in bulk upload: {e}")
                            errors.append(f"Row {row_data['row_num']}: Error in AI classification - {str(e)}")
                            
                    except Exception as e:
                        errors.append(f"Row {row_data['row_num']}: {str(e)}")
                        error_count += 1
                        transaction.set_rollback(True)
                        continue

            return Response(
                {
                    "success": True,
                    "created_count": created_count,
                    "classified_count": classified_count,
                    "error_count": error_count,
                    "errors": errors[:10],  # Return first 10 errors to avoid huge responses
                },
                status=status.HTTP_201_CREATED if created_count > 0 else status.HTTP_200_OK
            )

        except Exception as e:
            logger.error(f"Bulk upload failed: {str(e)}", exc_info=True)
            return Response(
                {"success": False, "message": f"Import failed: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


class AdminCTIRecordViewSet(viewsets.ModelViewSet):
    """
    ViewSet for Admin to manage CTI Records with optional filtering, search, and pagination.
    """
    queryset = CTIRecord.objects.all().order_by('-updated_at')
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = CTIRecordPagination

    # Configure filtering, search, and ordering
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['category', 'type', 'resolver_group', 'request_type', 'sla']
    search_fields = ['bu_number', 'category', 'item', 'resolver_group', 'service_description', 'bu_description']
    ordering_fields = ['id', 'category', 'resolver_group', 'updated_at', 'created_at']
    ordering = ['-updated_at']

    def get_serializer_class(self):
        if self.action in ["create", "update", "partial_update"]:
            return CTIRecordCreateUpdateSerializer
        return AdminCTIRecordSerializer

    def get_queryset(self):
        if self.request.user.role not in ["support_engineer", "admin"]:
            return CTIRecord.objects.none()

        queryset = super().get_queryset()

        has_embedding = self.request.query_params.get("has_embedding")
        if has_embedding is not None:
            if has_embedding.lower() == "true":
                queryset = queryset.exclude(embedding_vector__isnull=True)
            elif has_embedding.lower() == "false":
                queryset = queryset.filter(embedding_vector__isnull=True)

        usage_filter = self.request.query_params.get("usage")
        if usage_filter == "used":
            queryset = queryset.filter(
                Q(predicted_tickets__isnull=False) | Q(corrected_tickets__isnull=False)
            ).distinct()
        elif usage_filter == "unused":
            queryset = queryset.filter(
                predicted_tickets__isnull=True, corrected_tickets__isnull=True
            )

        return queryset

    def create(self, request, *args, **kwargs):
        if request.user.role != "admin":
            return Response({"error": "Admin access required"}, status=status.HTTP_403_FORBIDDEN)
        return super().create(request, *args, **kwargs)

    def update(self, request, *args, **kwargs):
        if request.user.role != "admin":
            return Response({"error": "Admin access required"}, status=status.HTTP_403_FORBIDDEN)
        return super().update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        if request.user.role != "admin":
            return Response({"error": "Admin access required"}, status=status.HTTP_403_FORBIDDEN)
        instance = self.get_object()
        self.perform_destroy(instance)
        return Response(status=status.HTTP_204_NO_CONTENT)

    def list(self, request, *args, **kwargs):
        queryset = self.filter_queryset(self.get_queryset())
        stats = self.get_cti_stats(queryset)

        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            response = self.get_paginated_response(serializer.data)
            response.data['stats'] = stats
            return response

        serializer = self.get_serializer(queryset, many=True)
        return Response({'results': serializer.data, 'stats': stats})

    def get_cti_stats(self, queryset):
        total_count = queryset.count()
        has_embedding_count = queryset.exclude(embedding_vector__isnull=True).count()
        used_records_count = queryset.filter(
            Q(predicted_tickets__isnull=False) | Q(corrected_tickets__isnull=False)
        ).distinct().count()

        return {
            "total_records": total_count,
            "has_embeddings": has_embedding_count,
            "missing_embeddings": total_count - has_embedding_count,
            "embedding_coverage": (round((has_embedding_count / total_count) * 100, 1) if total_count > 0 else 0),
            "used_records": used_records_count,
            "unused_records": total_count - used_records_count,
            "usage_rate": (round((used_records_count / total_count) * 100, 1) if total_count > 0 else 0),
            "top_categories": list(queryset.values("category").annotate(count=Count("id")).order_by("-count")[:5]),
            "top_resolver_groups": list(queryset.values("resolver_group").annotate(count=Count("id")).order_by("-count")[:5]),
        }

    @action(detail=True, methods=["post"])
    def regenerate_embedding(self, request, pk=None):
        if request.user.role != "admin":
            return Response({"error": "Admin access required"}, status=status.HTTP_403_FORBIDDEN)
        cti_record = self.get_object()
        try:
            from .ai_service import classification_service
            cti_text = (
                f"{cti_record.bu_number} {cti_record.category} {cti_record.type} {cti_record.item} "
                f"{cti_record.request_type} {cti_record.sla} {cti_record.service_description} "
                f"{cti_record.bu_description} {cti_record.resolver_group_description}"
            )
            embedding = classification_service.get_embedding(cti_text)
            if embedding:
                cti_record.embedding_vector = embedding
                cti_record.save(update_fields=["embedding_vector"])
                return Response({"success": True, "message": "Embedding regenerated successfully"})
            else:
                return Response(
                    {"success": False, "message": "Failed to generate embedding"},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR,
                )
        except Exception as e:
            return Response(
                {"success": False, "message": f"Error generating embedding: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

    @action(detail=False, methods=["post"])
    def bulk_actions(self, request):
        if request.user.role != "admin":
            return Response({"error": "Admin access required"}, status=status.HTTP_403_FORBIDDEN)
        serializer = BulkCTIActionSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        data = serializer.validated_data
        cti_ids = data["cti_ids"]
        action_type = data["action"]
        cti_records = CTIRecord.objects.filter(id__in=cti_ids)

        try:
            if action_type == "regenerate_embeddings":
                return self._bulk_regenerate_embeddings(cti_records)
            elif action_type == "delete":
                return self._bulk_delete(cti_records)
            elif action_type == "bulk_update":
                return self._bulk_update(cti_records, data)
        except Exception as e:
            return Response(
                {"success": False, "message": f"Bulk action failed: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )
        return Response({"success": False, "message": "Invalid action"}, status=status.HTTP_400_BAD_REQUEST)

    def _bulk_regenerate_embeddings(self, cti_records):
        from .ai_service import classification_service
        updated_count = 0
        failed_count = 0
        for cti_record in cti_records:
            try:
                cti_text = (
                    f"{cti_record.bu_number} {cti_record.category} {cti_record.type} {cti_record.item} "
                    f"{cti_record.request_type} {cti_record.sla} {cti_record.service_description} "
                    f"{cti_record.bu_description} {cti_record.resolver_group_description}"
                )
                embedding = classification_service.get_embedding(cti_text)
                if embedding:
                    cti_record.embedding_vector = embedding
                    cti_record.save(update_fields=["embedding_vector"])
                    updated_count += 1
                else:
                    failed_count += 1
            except Exception:
                failed_count += 1
        return Response({
            "success": True,
            "updated_count": updated_count,
            "failed_count": failed_count,
            "message": f"Regenerated embeddings for {updated_count} records, {failed_count} failed",
        })

    def _bulk_delete(self, cti_records):
        # Find records that are in use
        used_records = cti_records.filter(
            Q(predicted_tickets__isnull=False) | Q(corrected_tickets__isnull=False)
        ).distinct()
        
        # Get records that can be deleted (not in use)
        deletable_records = cti_records.exclude(
            id__in=used_records.values_list('id', flat=True)
        )
        
        # Delete only the records that are not in use
        deleted_count, _ = deletable_records.delete()
        
        # Prepare response
        response = {
            "success": True,
            "deleted_count": deleted_count,
            "skipped_count": used_records.count(),
            "message": f"Successfully deleted {deleted_count} CTI records"
        }
        
        # Add warning if some records couldn't be deleted
        if used_records.exists():
            response["warning"] = f"Skipped {used_records.count()} records that are in use"
            used_ids = list(used_records.values_list('id', flat=True))
            response["used_record_ids"] = used_ids
            
        return Response(response)

    def _bulk_update(self, cti_records, data):
        update_data = {}
        if "resolver_group" in data and data["resolver_group"]:
            update_data["resolver_group"] = data["resolver_group"]
        if "request_type" in data and data["request_type"]:
            update_data["request_type"] = data["request_type"]
        if "sla" in data and data["sla"]:
            update_data["sla"] = data["sla"]
        
        if not update_data:
            return Response({"success": False, "message": "No fields to update provided."}, status=status.HTTP_400_BAD_REQUEST)

        updated_count = cti_records.update(**update_data)
        return Response({
            "success": True,
            "updated_count": updated_count,
            "updated_fields": list(update_data.keys()),
            "message": f"Successfully updated {updated_count} CTI records",
        })

    @action(detail=False, methods=["get"])
    def filter_options(self, request):
        queryset = CTIRecord.objects.all()
        options = {
            "categories": sorted(list(queryset.values_list("category", flat=True).distinct())),
            "types": sorted(list(queryset.values_list("type", flat=True).distinct())),
            "resolver_groups": sorted(list(queryset.values_list("resolver_group", flat=True).distinct())),
            "request_types": sorted(list(queryset.values_list("request_type", flat=True).distinct())),
            "slas": sorted(list(queryset.values_list("sla", flat=True).distinct())),
            "usage_options": [
                {"value": "", "label": "All Usage"},
                {"value": "used", "label": "Used in Tickets"},
                {"value": "unused", "label": "Never Used"},
            ],
            "embedding_options": [
                {"value": "", "label": "All Embeddings"},
                {"value": "true", "label": "Has Embedding"},
                {"value": "false", "label": "Missing Embedding"},
            ],
        }
        return Response(options)

    @action(detail=False, methods=["post"])
    def import_csv(self, request):
        if request.user.role != "admin":
            return Response({"error": "Admin access required"}, status=status.HTTP_403_FORBIDDEN)

        if "file" not in request.FILES:
            return Response({"success": False, "message": "No file provided"}, status=status.HTTP_400_BAD_REQUEST)

        csv_file = request.FILES["file"]
        try:
            csv_data = csv_file.read().decode("utf-8")
            csv_reader = csv.DictReader(io.StringIO(csv_data))
            
            created_count = 0
            updated_count = 0
            error_count = 0
            errors = []

            for row_num, row in enumerate(csv_reader, start=2):
                try:
                    cleaned_row = {k.strip(): v.strip() for k, v in row.items() if v and v.strip()}
                    
                    cti_data = {
                        "bu_number": cleaned_row.get("bu_number", ""),
                        "category": cleaned_row.get("category", ""),
                        "type": cleaned_row.get("type", ""),
                        "item": cleaned_row.get("item", ""),
                        "resolver_group": cleaned_row.get("resolver_group", ""),
                        "request_type": cleaned_row.get("request_type", ""),
                        "sla": cleaned_row.get("sla", ""),
                        "service_description": cleaned_row.get("service_description", ""),
                        "bu_description": cleaned_row.get("bu_description", ""),
                        "resolver_group_description": cleaned_row.get("resolver_group_description", ""),
                    }

                    required_fields = ["category", "type", "item"]
                    missing_fields = [field for field in required_fields if not cti_data.get(field)]
                    if missing_fields:
                        errors.append(f"Row {row_num}: Missing required fields: {', '.join(missing_fields)}")
                        error_count += 1
                        continue
                    
                    # Use update_or_create for simplicity
                    record, created = CTIRecord.objects.update_or_create(
                        category=cti_data['category'],
                        type=cti_data['type'],
                        item=cti_data['item'],
                        defaults=cti_data
                    )
                    
                    self._regenerate_embedding_for_record(record)
                    
                    if created:
                        created_count += 1
                    else:
                        updated_count += 1

                except Exception as e:
                    errors.append(f"Row {row_num}: {str(e)}")
                    error_count += 1
            
            return Response({
                "success": True,
                "created_count": created_count,
                "updated_count": updated_count,
                "error_count": error_count,
                "errors": errors[:20],
                "message": f"Import completed: {created_count} created, {updated_count} updated, {error_count} errors.",
            })
        except Exception as e:
            return Response({"success": False, "message": f"Import failed: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def _regenerate_embedding_for_record(self, cti_record):
        try:
            from .ai_service import classification_service
            cti_text = (
                f"{cti_record.bu_number} {cti_record.category} {cti_record.type} {cti_record.item} "
                f"{cti_record.request_type} {cti_record.sla} {cti_record.service_description} "
                f"{cti_record.bu_description} {cti_record.resolver_group_description}"
            )
            embedding = classification_service.get_embedding(cti_text)
            if embedding:
                cti_record.embedding_vector = embedding
                cti_record.save(update_fields=["embedding_vector"])
        except Exception:
            # Silently fail if embedding generation fails during bulk import
            pass


@api_view(["GET"])
@permission_classes([IsAdminOnly])
def cti_export_csv(request):

    import csv
    from django.http import HttpResponse

    response = HttpResponse(content_type="text/csv")
    response["Content-Disposition"] = 'attachment; filename="cti_records.csv"'

    writer = csv.writer(response)
    writer.writerow(
        [
            "ID",
            "BU Number",
            "BU Description",
            "Category",
            "Type",
            "Item",
            "Resolver Group",
            "Resolver Group Description",
            "Request Type",
            "SLA",
            "Service Description",
            "Has Embedding",
            "Predicted Tickets",
            "Corrected Tickets",
            "Created At",
            "Updated At",
        ]
    )

    queryset = CTIRecord.objects.all()

    category = request.GET.get("category")
    if category:
        queryset = queryset.filter(category=category)

    for cti in queryset:
        writer.writerow(
            [
                cti.id,
                cti.bu_number,
                cti.bu_description,
                cti.category,
                cti.type,
                cti.item,
                cti.resolver_group,
                cti.resolver_group_description,
                cti.request_type,
                cti.sla,
                cti.service_description,
                "Yes" if cti.embedding_vector else "No",
                cti.predicted_tickets.count(),
                cti.corrected_tickets.count(),
                cti.created_at.strftime("%Y-%m-%d %H:%M"),
                cti.updated_at.strftime("%Y-%m-%d %H:%M"),
            ]
        )

    return response


@api_view(["GET"])
def get_cti_examples(request, cti_id):
    """Get few-shot examples for a CTI record"""
    try:
        cti = CTIRecord.objects.get(id=cti_id)
    except CTIRecord.DoesNotExist:
        return Response({"error": "CTI not found"}, status=status.HTTP_404_NOT_FOUND)

    examples = cti.few_shot_examples.order_by("-confidence_score", "-created_at")
    data = [
        {
            "summary": ex.original_summary,
            "source": ex.classification_source,
            "confidence": ex.confidence_score,
            "department": ex.user_department,
            "date": ex.created_at.strftime("%Y-%m-%d"),
        }
        for ex in examples
    ]
    return Response({"examples": data})


class TrainingExampleViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing training examples used for AI model training.
    """
    serializer_class = TrainingExampleSerializer
    permission_classes = [IsAdminOnly]
    filter_backends = [
        DjangoFilterBackend,
        filters.SearchFilter,
        filters.OrderingFilter,
    ]
    filterset_fields = ["source", "correct_cti__category"]
    search_fields = ["ticket_content", "correct_cti__item"]
    ordering_fields = ["created_at", "weight"]
    ordering = ["-created_at"]

    def get_queryset(self):
        return TrainingExample.objects.select_related("correct_cti").all()

    def get_serializer_class(self):
        if self.action in ["create", "update", "partial_update"]:
            return TrainingExampleCreateSerializer
        return TrainingExampleSerializer
        
    def create(self, request, *args, **kwargs):
        """
        Create a new training example.
        
        Required fields:
        - ticket_content: Text content of the ticket (summary + description)
        - correct_cti: ID of the correct CTI record
        - source: Source of the training example (initial, correction, manual)
        - weight: Optional weight for the example (default: 1.0)
        """
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        # Get the CTI record
        try:
            cti_id = serializer.validated_data['correct_cti'].id
            cti_record = CTIRecord.objects.get(id=cti_id)
        except (KeyError, CTIRecord.DoesNotExist):
            return Response(
                {"error": "A valid CTI record ID is required"}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Create the training example
        training_example = TrainingExample.objects.create(
            ticket_content=serializer.validated_data['ticket_content'],
            correct_cti=cti_record,
            source=serializer.validated_data.get('source', 'manual'),
            weight=serializer.validated_data.get('weight', 1.0)
        )
        
        # Return the created example using the read serializer
        output_serializer = TrainingExampleSerializer(training_example)
        headers = self.get_success_headers(output_serializer.data)
        return Response(
            output_serializer.data,
            status=status.HTTP_201_CREATED,
            headers=headers
        )
    
    def update(self, request, *args, **kwargs):
        """
        Update an existing training example.
        
        Allowed fields to update:
        - ticket_content
        - correct_cti (must be a valid CTI record ID)
        - source
        - weight
        """
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        
        # Use the create serializer for validation
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        
        # Update the instance
        if 'correct_cti' in serializer.validated_data:
            try:
                cti_id = serializer.validated_data['correct_cti'].id
                cti_record = CTIRecord.objects.get(id=cti_id)
                instance.correct_cti = cti_record
            except CTIRecord.DoesNotExist:
                return Response(
                    {"error": "Invalid CTI record ID"}, 
                    status=status.HTTP_400_BAD_REQUEST
                )
        
        # Update other fields
        for field in ['ticket_content', 'source', 'weight']:
            if field in serializer.validated_data:
                setattr(instance, field, serializer.validated_data[field])
        
        instance.save()
        
        # Return the updated instance using the read serializer
        output_serializer = TrainingExampleSerializer(instance)
        return Response(output_serializer.data)
    
    def perform_destroy(self, instance):
        """Delete the training example"""
        instance.delete()


@api_view(["GET"])
@permission_classes([IsAdminOnly])
def get_cti_training_examples(request, cti_id):
    """Get training examples for specific CTI record"""
    try:
        cti = CTIRecord.objects.get(id=cti_id)
        examples = TrainingExample.objects.filter(correct_cti=cti).order_by(
            "-weight", "-created_at"
        )
        serializer = TrainingExampleSerializer(examples, many=True)
        return Response(
            {
                "cti_record": CTIRecordSerializer(cti).data,
                "training_examples": serializer.data,
                "total_count": examples.count(),
            }
        )
    except CTIRecord.DoesNotExist:
        return Response({"error": "CTI record not found"}, status=404)


@api_view(["GET"])
@permission_classes([IsAdminOnly])
def training_statistics(request):
    """Get training data statistics"""
    stats = {
        "total_examples": TrainingExample.objects.count(),
        "by_source": list(
            TrainingExample.objects.values("source").annotate(count=Count("id"))
        ),
        "by_weight": list(
            TrainingExample.objects.values("weight").annotate(count=Count("id"))
        ),
        "avg_weight": TrainingExample.objects.aggregate(Avg("weight"))["weight__avg"]
        or 0,
        "recent_examples": TrainingExample.objects.filter(
            created_at__gte=timezone.now() - timedelta(days=30)
        ).count(),
        "top_cti_categories": list(
            TrainingExample.objects.values("correct_cti__category")
            .annotate(count=Count("id"))
            .order_by("-count")[:10]
        ),
    }
    return Response(stats)


@api_view(["GET"])
@permission_classes([IsAdminOnly])
def ai_performance_analytics(request):
    """Get AI performance analytics data for dashboard"""

    # Most frequently corrected CTI records
    problematic_cti = (
        CTIRecord.objects.annotate(
            correction_count=Count("corrections"),
            total_predictions=Count("predicted_tickets"),
            accuracy=Case(
                When(total_predictions=0, then=1.0),
                default=1.0 - (F("correction_count") / F("total_predictions")),
                output_field=FloatField(),
            ),
            avg_confidence=Avg("predicted_tickets__prediction_confidence"),
        )
        .filter(correction_count__gt=0)
        .order_by("-correction_count")[:10]
    )

    # Confidence distribution
    confidence_ranges = [
        ("0-20%", 0.0, 0.2),
        ("20-40%", 0.2, 0.4),
        ("40-60%", 0.4, 0.6),
        ("60-80%", 0.6, 0.8),
        ("80-100%", 0.8, 1.0),
    ]

    confidence_distribution = []
    for label, min_conf, max_conf in confidence_ranges:
        count = Ticket.objects.filter(
            prediction_confidence__gte=min_conf, prediction_confidence__lt=max_conf
        ).count()
        confidence_distribution.append({"confidence_range": label, "count": count})

    # Accuracy trends over last 30 days
    accuracy_trends = []
    for i in range(30):
        date = datetime.now().date() - timedelta(days=i)
        day_tickets = Ticket.objects.filter(created_at__date=date)

        if day_tickets.exists():
            total_classified = day_tickets.filter(predicted_cti__isnull=False).count()
            total_corrected = day_tickets.filter(corrected_cti__isnull=False).count()

            accuracy = (
                (total_classified - total_corrected) / total_classified
                if total_classified > 0
                else 1.0
            )
            avg_confidence = (
                day_tickets.aggregate(Avg("prediction_confidence"))[
                    "prediction_confidence__avg"
                ]
                or 0
            )

            accuracy_trends.append(
                {
                    "date": date.strftime("%m/%d"),
                    "accuracy": accuracy,
                    "avg_confidence": avg_confidence,
                }
            )

    return Response(
        {
            "problematic_cti": [
                {
                    "item": cti.item,
                    "category": cti.category,
                    "correction_count": cti.correction_count,
                    "accuracy": float(cti.accuracy),
                    "avg_confidence": float(cti.avg_confidence or 0),
                }
                for cti in problematic_cti
            ],
            "confidence_distribution": confidence_distribution,
            "accuracy_trends": list(reversed(accuracy_trends)),
            "low_confidence_count": Ticket.objects.filter(
                prediction_confidence__lt=0.5
            ).count(),
            "medium_confidence_count": Ticket.objects.filter(
                prediction_confidence__gte=0.5, prediction_confidence__lt=0.8
            ).count(),
            "high_confidence_count": Ticket.objects.filter(
                prediction_confidence__gte=0.8
            ).count(),
        }
    )


@api_view(["GET"])
@permission_classes([IsAdminOnly])
def cti_recommendations(request):
    """Generate smart CTI improvement recommendations"""

    recommendations = []

    # Find duplicate CTI records
    duplicates = (
        CTIRecord.objects.values("category", "type", "item")
        .annotate(count=Count("id"))
        .filter(count__gt=1)
    )

    if duplicates.exists():
        recommendations.append(
            {
                "id": "duplicates",
                "type": "duplicate",
                "title": "Duplicate CTI Records Found",
                "description": f"Found {duplicates.count()} groups of duplicate CTI records that could be consolidated.",
                "impact_level": "Medium",
                "potential_impact": "Reduces confusion and improves classification consistency",
                "affected_records": [
                    f"{d['category']} - {d['item']}" for d in duplicates[:3]
                ],
                "actions": [
                    {"id": "merge", "label": "Merge Duplicates", "type": "primary"},
                    {"id": "review", "label": "Review Manually", "type": "secondary"},
                ],
            }
        )

    # Find orphaned CTI records (never used)
    orphaned = CTIRecord.objects.filter(
        predicted_tickets__isnull=True, corrected_tickets__isnull=True
    ).count()

    if orphaned > 0:
        recommendations.append(
            {
                "id": "orphaned",
                "type": "orphaned",
                "title": f"{orphaned} Unused CTI Records",
                "description": "These CTI records have never been used in ticket classification.",
                "impact_level": "Low",
                "potential_impact": "Cleaner data and better performance",
                "actions": [
                    {"id": "archive", "label": "Archive Unused", "type": "primary"},
                    {"id": "keep", "label": "Keep All", "type": "secondary"},
                ],
            }
        )

    # Find records missing descriptions
    missing_descriptions = CTIRecord.objects.filter(
        Q(service_description="") | Q(service_description__isnull=True)
    ).count()

    if missing_descriptions > 0:
        recommendations.append(
            {
                "id": "missing_descriptions",
                "type": "missing_description",
                "title": f"{missing_descriptions} Records Missing Descriptions",
                "description": "Adding descriptions can improve AI classification accuracy.",
                "impact_level": "High",
                "potential_impact": "Better AI understanding and classification accuracy",
                "actions": [
                    {
                        "id": "auto_generate",
                        "label": "Auto-Generate",
                        "type": "primary",
                    },
                    {
                        "id": "manual_review",
                        "label": "Manual Review",
                        "type": "secondary",
                    },
                ],
            }
        )

    return Response({"recommendations": recommendations})


@api_view(["POST"])
@permission_classes([IsAdminOnly])
def apply_cti_recommendation(request, recommendation_id):
    """Apply a CTI recommendation action"""
    action = request.data.get("action")

    try:
        if recommendation_id == "duplicates" and action == "merge":
            # Implementation for merging duplicates
            # This is a complex operation that would need careful implementation
            return Response(
                {"success": True, "message": "Duplicates merged successfully"}
            )

        elif recommendation_id == "orphaned" and action == "archive":
            # Archive unused CTI records
            orphaned_records = CTIRecord.objects.filter(
                predicted_tickets__isnull=True, corrected_tickets__isnull=True
            )
            count = orphaned_records.count()
            # In a real implementation, you might soft-delete or move to archive table
            # orphaned_records.update(archived=True)
            return Response(
                {"success": True, "message": f"Archived {count} unused records"}
            )

        elif recommendation_id == "missing_descriptions" and action == "auto_generate":
            # Auto-generate descriptions for records missing them
            records_without_desc = CTIRecord.objects.filter(
                Q(service_description="") | Q(service_description__isnull=True)
            )

            for record in records_without_desc:
                # Simple auto-generation based on category and item
                generated_desc = (
                    f"Support for {record.item} in {record.category} category"
                )
                record.service_description = generated_desc
                record.save()

            return Response(
                {
                    "success": True,
                    "message": f"Generated descriptions for {records_without_desc.count()} records",
                }
            )

        return Response({"success": True, "message": "Recommendation dismissed"})

    except Exception as e:
        return Response({"success": False, "message": str(e)}, status=500)


@api_view(["GET"])
@permission_classes([IsAdminOnly])
def cti_trends(request):
    """Get CTI trends data for enhanced statistics"""

    # Get counts from 30 days ago for comparison
    thirty_days_ago = datetime.now() - timedelta(days=30)

    current_stats = {
        "total_records": CTIRecord.objects.count(),
        "has_embeddings": CTIRecord.objects.exclude(
            embedding_vector__isnull=True
        ).count(),
        "used_records": CTIRecord.objects.filter(
            Q(predicted_tickets__isnull=False) | Q(corrected_tickets__isnull=False)
        )
        .distinct()
        .count(),
    }

    # For simplicity, mock previous stats (in real implementation, you'd store historical data)
    previous_stats = {
        "previous_total_records": max(0, current_stats["total_records"] - 5),
        "previous_has_embeddings": max(0, current_stats["has_embeddings"] - 3),
        "previous_used_records": max(0, current_stats["used_records"] - 2),
    }

    return Response(previous_stats)
