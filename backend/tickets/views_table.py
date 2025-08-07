from rest_framework import viewsets, status, filters, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from django.db.models import Q, Prefetch
from django.utils import timezone

from .models import Ticket, CTIRecord
from .serializers import (
    TicketUpdateSerializer,
    CTIRecordCreateUpdateSerializer
)
from .serializers_table import TicketTableSerializer, CTITableSerializer
from .permissions import IsAdminOnly

class TicketTableViewSet(viewsets.ModelViewSet):
    """
    ViewSet for table-based ticket management with pagination, filtering, and bulk actions.
    """
    serializer_class = TicketTableSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = {
        'status': ['exact', 'in'],
        'created_at': ['gte', 'lte', 'exact'],
        'predicted_cti__category': ['exact', 'icontains'],
        'assigned_to__id': ['exact'],
    }
    search_fields = ['ticket_id', 'summary', 'description']
    ordering_fields = ['created_at', 'updated_at', 'status', 'ticket_id']
    ordering = ['-created_at']
    # Allow POST for bulk actions
    http_method_names = ['get', 'post', 'patch', 'delete', 'head', 'options']

    def get_queryset(self):
        queryset = Ticket.objects.select_related(
            'created_by', 'assigned_to', 'predicted_cti', 'corrected_cti'
        )
        
        # Apply role-based filtering
        user = self.request.user
        if user.role == 'end_user':
            queryset = queryset.filter(created_by=user)
        
        # Handle unclassified filter
        unclassified = self.request.query_params.get('unclassified', '').lower() == 'true'
        if unclassified:
            queryset = queryset.filter(
                Q(predicted_cti__isnull=True) | 
                Q(predicted_cti__resolver_group__isnull=True) |
                Q(predicted_cti__resolver_group__exact='')
            )
            
        return queryset

    def get_serializer_class(self):
        if self.action in ['partial_update', 'update']:
            return TicketUpdateSerializer
        return self.serializer_class

    @action(detail=False, methods=['post'])
    def bulk_update(self, request):
        """Bulk update tickets with the same changes."""
        ticket_ids = request.data.get('ids', [])
        changes = request.data.get('changes', {})
        
        if not ticket_ids or not changes:
            return Response(
                {'error': 'Ticket IDs and changes are required'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Filter queryset based on user permissions
        queryset = self.filter_queryset(self.get_queryset())
        tickets = queryset.filter(id__in=ticket_ids)
        
        if not tickets.exists():
            return Response(
                {'error': 'No valid tickets found'}, 
                status=status.HTTP_404_NOT_FOUND
            )
        
        updated_count = 0
        for ticket in tickets:
            serializer = self.get_serializer(ticket, data=changes, partial=True)
            if serializer.is_valid():
                serializer.save()
                updated_count += 1
        
        return Response({
            'message': f'Successfully updated {updated_count} tickets',
            'updated_count': updated_count
        })

    @action(detail=False, methods=['post'])
    def bulk_delete(self, request):
        """Bulk delete tickets."""
        ticket_ids = request.data.get('ids', [])
        
        if not ticket_ids:
            return Response(
                {'error': 'Ticket IDs are required'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Filter queryset based on user permissions
        queryset = self.filter_queryset(self.get_queryset())
        tickets = queryset.filter(id__in=ticket_ids)
        
        if not tickets.exists():
            return Response(
                {'error': 'No valid tickets found'}, 
                status=status.HTTP_404_NOT_FOUND
            )
        
        deleted_count, _ = tickets.delete()
        
        return Response({
            'message': f'Successfully deleted {deleted_count} tickets',
            'deleted_count': deleted_count
        })


class CTITableViewSet(viewsets.ModelViewSet):
    """
    ViewSet for table-based CTI record management with pagination, filtering, and bulk actions.
    """
    serializer_class = CTITableSerializer
    permission_classes = [IsAdminOnly]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = {
        'category': ['exact', 'icontains'],
        'type': ['exact', 'icontains'],
        'item': ['exact', 'icontains'],
        'resolver_group': ['exact', 'icontains'],
        'request_type': ['exact'],
        'sla': ['exact'],
    }
    search_fields = ['category', 'type', 'item', 'resolver_group', 'service_description']
    ordering_fields = ['category', 'type', 'item', 'resolver_group', 'created_at']
    ordering = ['category', 'type', 'item']

    def get_queryset(self):
        """Optimize queryset for table view with related data"""
        return CTIRecord.objects.prefetch_related(
            'predicted_tickets',
            'corrected_tickets',
            'training_examples',
            'corrections',
        ).all()

    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            return CTIRecordCreateUpdateSerializer
        return self.serializer_class

    @action(detail=False, methods=['post'])
    def bulk_update(self, request):
        """Bulk update CTI records with the same changes."""
        record_ids = request.data.get('ids', [])
        changes = request.data.get('changes', {})
        
        if not record_ids or not changes:
            return Response(
                {'error': 'Record IDs and changes are required'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        records = self.filter_queryset(self.get_queryset()).filter(id__in=record_ids)
        
        if not records.exists():
            return Response(
                {'error': 'No valid records found'}, 
                status=status.HTTP_404_NOT_FOUND
            )
        
        updated_count = 0
        for record in records:
            serializer = self.get_serializer(record, data=changes, partial=True)
            if serializer.is_valid():
                serializer.save()
                updated_count += 1
        
        return Response({
            'message': f'Successfully updated {updated_count} records',
            'updated_count': updated_count
        })

    @action(detail=False, methods=['post'])
    def bulk_delete(self, request):
        """Bulk delete CTI records."""
        record_ids = request.data.get('ids', [])
        
        if not record_ids:
            return Response(
                {'error': 'Record IDs are required'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        records = self.filter_queryset(self.get_queryset()).filter(id__in=record_ids)
        
        if not records.exists():
            return Response(
                {'error': 'No valid records found'}, 
                status=status.HTTP_404_NOT_FOUND
            )
        
        deleted_count, _ = records.delete()
        
        return Response({
            'message': f'Successfully deleted {deleted_count} records',
            'deleted_count': deleted_count
        })
