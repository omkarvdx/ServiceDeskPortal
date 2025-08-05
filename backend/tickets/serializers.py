from rest_framework import serializers
from django.contrib.auth import authenticate
from django.db.models import Avg
from .models import (
    User,
    Ticket,
    CTIRecord,
    ClassificationCorrection,
    TrainingExample,
)


class UserRegistrationSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=True, style={'input_type': 'password'})
    confirm_password = serializers.CharField(write_only=True, required=True, style={'input_type': 'password'})

    class Meta:
        model = User
        fields = [
            'username',
            'email',
            'password',
            'confirm_password',
            'role',
            'department',
            'first_name',
            'last_name',
        ]
        extra_kwargs = {
            'role': {'default': 'admin'},
            'first_name': {'required': True},
            'last_name': {'required': True},
            'email': {'required': True}
        }

    def validate(self, attrs):
        if attrs['password'] != attrs.pop('confirm_password'):
            raise serializers.ValidationError({"password": "Password fields didn't match."})
        
        request = self.context.get('request')
        
        # If no users exist, first user becomes admin
        if not User.objects.exists():
            attrs['role'] = 'admin'
            return attrs
            
        # If request is from an admin, allow any role
        if request and request.user.is_authenticated and request.user.role == 'admin':
            # If role is not specified, default to end_user
            if 'role' not in attrs:
                attrs['role'] = 'admin'
            return attrs
            
        # For all other cases, force end_user role
        attrs['role'] = 'admin'
        return attrs

    def create(self, validated_data):
        user = User.objects.create_user(
            username=validated_data['username'],
            email=validated_data['email'],
            password=validated_data['password'],
            role=validated_data['role'],
            department=validated_data.get('department', ''),
            first_name=validated_data['first_name'],
            last_name=validated_data['last_name'],
        )
        return user


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = [
            'id',
            'username',
            'email',
            'role',
            'department',
            'first_name',
            'last_name',
        ]


class LoginSerializer(serializers.Serializer):
    username = serializers.CharField()
    password = serializers.CharField()

    def validate(self, data):
        username = data.get('username')
        password = data.get('password')

        if username and password:
            user = authenticate(username=username, password=password)
            if user:
                if user.is_active:
                    data['user'] = user
                else:
                    raise serializers.ValidationError('User account is disabled.')
            else:
                raise serializers.ValidationError('Invalid username or password.')
        else:
            raise serializers.ValidationError('Must include username and password.')

        return data


class CTIRecordSerializer(serializers.ModelSerializer):
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
            'example_count',
            'has_sufficient_examples',
        ]


class TrainingExampleSerializer(serializers.ModelSerializer):
    correct_cti = CTIRecordSerializer(read_only=True)
    created_at_formatted = serializers.SerializerMethodField()

    class Meta:
        model = TrainingExample
        fields = [
            'id',
            'ticket_content',
            'correct_cti',
            'source',
            'created_at',
            'created_at_formatted',
            'weight',
        ]

    def get_created_at_formatted(self, obj):
        return obj.created_at.strftime('%Y-%m-%d %H:%M')


class TrainingExampleCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = TrainingExample
        fields = ['ticket_content', 'correct_cti', 'source', 'weight']


class TicketCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Ticket
        fields = ['summary', 'description']

    def create(self, validated_data):
        validated_data['created_by'] = self.context['request'].user
        return super().create(validated_data)


class TicketListSerializer(serializers.ModelSerializer):
    created_by = UserSerializer(read_only=True)
    assigned_to = UserSerializer(read_only=True)
    predicted_cti = CTIRecordSerializer(read_only=True)
    corrected_cti = CTIRecordSerializer(read_only=True)
    final_cti = CTIRecordSerializer(read_only=True)

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
            'similar_cti_records',  # Include similar CTI records in list view
        ]


class TicketDetailSerializer(serializers.ModelSerializer):
    created_by = UserSerializer(read_only=True)
    assigned_to = UserSerializer(read_only=True)
    predicted_cti = CTIRecordSerializer(read_only=True)
    corrected_cti = CTIRecordSerializer(read_only=True)
    final_cti = CTIRecordSerializer(read_only=True)
    corrected_by = UserSerializer(read_only=True)

    class Meta:
        model = Ticket
        fields = '__all__'


class TicketUpdateSerializer(serializers.ModelSerializer):
    corrected_cti_id = serializers.IntegerField(write_only=True, required=False)
    correction_notes = serializers.CharField(write_only=True, required=False, allow_blank=True)

    class Meta:
        model = Ticket
        fields = ['status', 'assigned_to', 'corrected_cti_id', 'correction_notes']

    def update(self, instance, validated_data):
        from .ai_service import classification_service
        from django.utils import timezone

        corrected_cti_id = validated_data.pop('corrected_cti_id', None)
        correction_notes = validated_data.pop('correction_notes', '')
        
        # Check if summary or description is being updated
        summary_changed = 'summary' in validated_data and validated_data['summary'] != instance.summary
        description_changed = 'description' in validated_data and validated_data['description'] != instance.description
        
        # Handle CTI correction
        if corrected_cti_id and corrected_cti_id != getattr(instance.predicted_cti, 'id', None):
            try:
                corrected_cti = CTIRecord.objects.get(id=corrected_cti_id)
                instance.corrected_cti = corrected_cti
                instance.corrected_by = self.context['request'].user
                instance.corrected_at = timezone.now()

                # Record the correction for continuous learning only if there was
                # an existing prediction. Otherwise treat it as a manual
                # classification success.
                if instance.predicted_cti:
                    classification_service.record_correction(
                        ticket=instance,
                        original_prediction=instance.predicted_cti,
                        corrected_cti=corrected_cti,
                        corrected_by=self.context['request'].user,
                        notes=correction_notes,
                    )
                else:
                    classification_service.record_successful_classification(
                        instance, corrected_cti, "manual"
                    )
            except CTIRecord.DoesNotExist:
                raise serializers.ValidationError("Invalid CTI record ID")
        # If summary or description changed, re-run classification
        elif summary_changed or description_changed:
            instance.predicted_cti = None
            instance.prediction_confidence = None
            instance.prediction_justification = None
            instance.similar_cti_records = []  # Reset similar CTI records
            
            # Save the instance first to update the fields
            instance.save()
            
            # Re-run classification with the updated ticket data
            try:
                predicted_cti, confidence, justification = classification_service.classify_ticket(
                    instance.summary if not summary_changed else validated_data.get('summary', instance.summary),
                    instance.description if not description_changed else validated_data.get('description', instance.description),
                    ticket_instance=instance  # Pass the ticket instance to save similar CTI records
                )
                
                if predicted_cti:
                    instance.predicted_cti = predicted_cti
                    instance.prediction_confidence = confidence
                    instance.prediction_justification = justification
            except Exception as e:
                logger.error(f"Error re-classifying ticket {instance.id}: {str(e)}")

        return super().update(instance, validated_data)


class TicketQueueSerializer(serializers.ModelSerializer):
    """Lightweight serializer for ticket queue view"""
    created_by = UserSerializer(read_only=True)
    assigned_to = UserSerializer(read_only=True)
    predicted_cti = CTIRecordSerializer(read_only=True)
    corrected_cti = CTIRecordSerializer(read_only=True)
    final_cti = CTIRecordSerializer(read_only=True)

    # Computed fields for queue view
    age_in_hours = serializers.SerializerMethodField()
    needs_attention = serializers.SerializerMethodField()
    classification_status = serializers.SerializerMethodField()

    class Meta:
        model = Ticket
        fields = [
            'id', 'ticket_id', 'summary', 'status', 'created_at', 'updated_at',
            'created_by', 'assigned_to', 'predicted_cti', 'corrected_cti', 'final_cti',
            'prediction_confidence', 'age_in_hours', 'needs_attention', 'classification_status'
        ]

    def get_age_in_hours(self, obj):
        from django.utils import timezone
        delta = timezone.now() - obj.created_at
        return round(delta.total_seconds() / 3600, 1)

    def get_needs_attention(self, obj):
        """Determine if ticket needs immediate attention"""
        from django.utils import timezone

        # Tickets open for more than 24 hours
        age_hours = (timezone.now() - obj.created_at).total_seconds() / 3600

        # High priority conditions
        conditions = [
            age_hours > 24 and obj.status == 'open',  # Old open tickets
            obj.prediction_confidence is not None and obj.prediction_confidence < 0.3,  # Low confidence
            not obj.predicted_cti,  # Unclassified tickets
            obj.status == 'open' and not obj.assigned_to,  # Unassigned open tickets
        ]

        return any(conditions)

    def get_classification_status(self, obj):
        """Get classification status"""
        if obj.corrected_cti:
            return 'corrected'
        elif obj.predicted_cti:
            return 'predicted'
        else:
            return 'unclassified'


class BulkUpdateSerializer(serializers.Serializer):
    """Serializer for bulk ticket operations"""
    ticket_ids = serializers.ListField(
        child=serializers.IntegerField(),
        min_length=1,
        max_length=100
    )
    action = serializers.ChoiceField(choices=[
        ('assign', 'Assign to User'),
        ('status', 'Change Status'),
        ('classify', 'Bulk Classify'),
    ])

    # Optional fields based on action
    assigned_to_id = serializers.IntegerField(required=False, allow_null=True)
    status = serializers.CharField(required=False)
    cti_id = serializers.IntegerField(required=False)

    def validate(self, data):
        action = data.get('action')

        if action == 'assign' and 'assigned_to_id' not in data:
            raise serializers.ValidationError("assigned_to_id is required for assign action")

        if action == 'status' and 'status' not in data:
            raise serializers.ValidationError("status is required for status action")

        if action == 'classify' and 'cti_id' not in data:
            raise serializers.ValidationError("cti_id is required for classify action")

        return data


class QueueStatsSerializer(serializers.Serializer):
    """Serializer for queue statistics"""
    total_tickets = serializers.IntegerField()
    open_tickets = serializers.IntegerField()
    unassigned_tickets = serializers.IntegerField()
    needs_attention = serializers.IntegerField()
    avg_age_hours = serializers.FloatField()
    classification_accuracy = serializers.FloatField()
    my_assigned = serializers.IntegerField()


class AdminCTIRecordSerializer(serializers.ModelSerializer):
    """Full serializer for CTI record management"""
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
            'bu_description',
            'category',
            'type',
            'item',
            'resolver_group',
            'resolver_group_description',
            'request_type',
            'sla',
            'service_description',
            'has_embedding',
            'example_count',
            'has_sufficient_examples',
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

    def get_has_embedding(self, obj):
        return obj.embedding_vector is not None

    def get_created_at_formatted(self, obj):
        return obj.created_at.strftime('%Y-%m-%d %H:%M')

    def get_updated_at_formatted(self, obj):
        return obj.updated_at.strftime('%Y-%m-%d %H:%M')

    def get_predicted_tickets_count(self, obj):
        return obj.predicted_tickets.count()

    def get_corrected_tickets_count(self, obj):
        return obj.corrected_tickets.count()

    def get_training_examples_count(self, obj):
        return obj.trainingexample_set.count()

    def get_avg_training_weight(self, obj):
        avg = obj.trainingexample_set.aggregate(Avg('weight'))['weight__avg']
        return round(avg, 2) if avg else 0

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


class CTIRecordCreateUpdateSerializer(serializers.ModelSerializer):
    """Serializer for creating/updating CTI records"""
    auto_generate_embedding = serializers.BooleanField(default=True, write_only=True)

    class Meta:
        model = CTIRecord
        fields = [
            'bu_number', 'category', 'type', 'item', 'resolver_group',
            'request_type', 'sla', 'service_description',
            'bu_description', 'resolver_group_description',
            'auto_generate_embedding'
        ]

    def create(self, validated_data):
        auto_generate_embedding = validated_data.pop('auto_generate_embedding', True)
        instance = super().create(validated_data)

        if auto_generate_embedding:
            self._generate_embedding(instance)

        return instance

    def update(self, instance, validated_data):
        auto_generate_embedding = validated_data.pop('auto_generate_embedding', True)

        embedding_fields = [
            'category', 'type', 'item', 'service_description',
            'bu_description', 'resolver_group_description'
        ]
        embedding_changed = any(
            getattr(instance, field) != validated_data.get(field, getattr(instance, field))
            for field in embedding_fields
        )

        instance = super().update(instance, validated_data)

        if auto_generate_embedding and embedding_changed:
            self._generate_embedding(instance)

        return instance

    def _generate_embedding(self, instance):
        """Generate embedding for CTI record"""
        try:
            from .ai_service import classification_service
            cti_text = (
                f"{instance.bu_number} {instance.category} {instance.type} {instance.item} "
                f"{instance.request_type} {instance.sla} {instance.service_description} "
                f"{instance.bu_description} {instance.resolver_group_description}"
            )
            embedding = classification_service.get_embedding(cti_text)

            if embedding:
                instance.embedding_vector = embedding
                instance.save(update_fields=['embedding_vector'])

        except Exception as e:
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"Failed to generate embedding for CTI {instance.id}: {e}")


class BulkCTIActionSerializer(serializers.Serializer):
    """Serializer for bulk CTI operations"""
    cti_ids = serializers.ListField(
        child=serializers.IntegerField(),
        min_length=1,
        max_length=100
    )
    action = serializers.ChoiceField(choices=[
        ('regenerate_embeddings', 'Regenerate Embeddings'),
        ('delete', 'Delete Records'),
        ('bulk_update', 'Bulk Update'),
    ])

    resolver_group = serializers.CharField(required=False, allow_blank=True)
    request_type = serializers.CharField(required=False, allow_blank=True)
    sla = serializers.CharField(required=False, allow_blank=True)

