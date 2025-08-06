from rest_framework import serializers
from .models import Ticket, CTIRecord
from .serializers import UserSerializer, CTIRecordSerializer

class TicketTableSerializer(serializers.ModelSerializer):
    """Serializer for ticket table view with optimized fields"""
    created_by = UserSerializer(read_only=True)
    assigned_to = UserSerializer(read_only=True)
    predicted_cti = CTIRecordSerializer(read_only=True)
    corrected_cti = CTIRecordSerializer(read_only=True)
    final_cti = CTIRecordSerializer(read_only=True)
    
    # Add computed fields for the table
    age_in_hours = serializers.SerializerMethodField()
    needs_attention = serializers.SerializerMethodField()
    classification_status = serializers.SerializerMethodField()

    class Meta:
        model = Ticket
        fields = [
            'id',
            'ticket_id',
            'summary',
            'description',
            'status',
            'created_at',
            'updated_at',
            'created_by',
            'assigned_to',
            'predicted_cti',
            'corrected_cti',
            'final_cti',
            'prediction_confidence',
            'prediction_justification',
            'age_in_hours',
            'needs_attention',
            'classification_status',
            'similar_cti_records',
        ]
        read_only_fields = fields

    def get_age_in_hours(self, obj):
        """Calculate ticket age in hours"""
        from django.utils import timezone
        if not obj.created_at:
            return 0
        duration = timezone.now() - obj.created_at
        return round(duration.total_seconds() / 3600, 1)

    def get_needs_attention(self, obj):
        """Determine if ticket needs attention"""
        return any([
            obj.status == 'open' and not obj.assigned_to,
            obj.prediction_confidence is not None and obj.prediction_confidence < 0.3,
            not obj.predicted_cti,
        ])

    def get_classification_status(self, obj):
        """Get classification status"""
        if obj.corrected_cti:
            return 'corrected'
        elif obj.predicted_cti:
            return 'predicted'
        return 'unclassified'


class CTITableSerializer(serializers.ModelSerializer):
    """Serializer for CTI record table view with optimized fields"""
    has_embedding = serializers.SerializerMethodField()
    created_at_formatted = serializers.SerializerMethodField()
    updated_at_formatted = serializers.SerializerMethodField()
    predicted_tickets_count = serializers.SerializerMethodField()
    corrected_tickets_count = serializers.SerializerMethodField()
    training_examples_count = serializers.SerializerMethodField()
    avg_training_weight = serializers.SerializerMethodField()
    accuracy = serializers.SerializerMethodField()
    usage_count = serializers.SerializerMethodField()
    correction_count = serializers.SerializerMethodField()

    class Meta:
        model = CTIRecord
        fields = [
            'id',
            'bu_number',
            'category',
            'type',
            'item',
            'resolver_group',
            'request_type',
            'sla',
            'service_description',
            'bu_description',
            'resolver_group_description',
            'has_embedding',
            'created_at',
            'updated_at',
            'created_at_formatted',
            'updated_at_formatted',
            'predicted_tickets_count',
            'corrected_tickets_count',
            'training_examples_count',
            'avg_training_weight',
            'accuracy',
            'usage_count',
            'correction_count',
        ]
        read_only_fields = fields

    def get_has_embedding(self, obj):
        """Check if embedding exists"""
        return bool(obj.embedding_vector)

    def get_created_at_formatted(self, obj):
        """Format created_at date"""
        return obj.created_at.strftime('%Y-%m-%d %H:%M') if obj.created_at else ''

    def get_updated_at_formatted(self, obj):
        """Format updated_at date"""
        return obj.updated_at.strftime('%Y-%m-%d %H:%M') if obj.updated_at else ''

    def get_predicted_tickets_count(self, obj):
        """Get count of tickets where this is the predicted CTI"""
        return obj.predicted_tickets.count()

    def get_corrected_tickets_count(self, obj):
        """Get count of tickets where this is the corrected CTI"""
        return obj.corrected_tickets.count()

    def get_training_examples_count(self, obj):
        """Get count of training examples for this CTI"""
        return obj.training_examples.count()

    def get_avg_training_weight(self, obj):
        """Get average weight of training examples"""
        from django.db.models import Avg
        return obj.training_examples.aggregate(avg_weight=Avg('weight'))['avg_weight'] or 0

    def get_accuracy(self, obj):
        """Calculate classification accuracy for this CTI record"""
        total_predictions = obj.predicted_tickets.count()
        corrections = obj.corrections.count()

        if total_predictions == 0:
            return 1.0

        return 1.0 - (corrections / total_predictions)

    def get_usage_count(self, obj):
        """Get total usage count (predictions + corrections)"""
        return obj.predicted_tickets.count() + obj.corrected_tickets.count()

    def get_correction_count(self, obj):
        """Get number of times this CTI was corrected"""
        return obj.corrections.count()
