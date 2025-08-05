from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import (
    User,
    Ticket,
    CTIRecord,
    ClassificationCorrection,
    TrainingExample,
    FewShotExample,
)


@admin.register(User)
class CustomUserAdmin(UserAdmin):
    list_display = ('username', 'email', 'role', 'department', 'is_active')
    list_filter = ('role', 'department', 'is_active')
    search_fields = ('username', 'email', 'first_name', 'last_name')
    fieldsets = UserAdmin.fieldsets + (
        ('Custom Fields', {'fields': ('role', 'department')}),
    )


@admin.register(CTIRecord)
class CTIRecordAdmin(admin.ModelAdmin):
    list_display = (
        'category',
        'type',
        'item',
        'resolver_group',
        'request_type',
        'sla',
        'example_count',
        'has_sufficient_examples',
        'created_at',
    )
    list_filter = ('category', 'type', 'resolver_group', 'request_type', 'sla')
    search_fields = ('category', 'type', 'item', 'resolver_group')
    readonly_fields = ('created_at', 'updated_at')
    actions = ['regenerate_embeddings_from_examples']

    fieldsets = (
        ('Basic Information', {'fields': ('bu_number', 'category', 'type', 'item')}),
        ('Assignment & SLA', {'fields': ('resolver_group', 'request_type', 'sla')}),
        (
            'Timestamps',
            {
                'fields': ('created_at', 'updated_at'),
                'classes': ('collapse',),
            },
        ),
    )

    def regenerate_embeddings_from_examples(self, request, queryset):
        from .services.few_shot_service import FewShotExampleService
        service = FewShotExampleService()
        for cti in queryset:
            service.regenerate_cti_embedding_from_examples(cti)
        self.message_user(request, f'Regenerated embeddings for {queryset.count()} records')


@admin.register(Ticket)
class TicketAdmin(admin.ModelAdmin):
    list_display = (
        'ticket_id',
        'summary',
        'status',
        'created_by',
        'assigned_to',
        'predicted_cti',
        'created_at',
    )
    list_filter = (
        'status',
        'created_at',
        'predicted_cti__category',
        'assigned_to',
    )
    search_fields = (
        'ticket_id',
        'summary',
        'description',
        'created_by__username',
    )
    readonly_fields = (
        'ticket_id',
        'created_at',
        'updated_at',
        'prediction_confidence',
        'prediction_justification',
    )

    fieldsets = (
        ('Ticket Information', {'fields': ('ticket_id', 'summary', 'description', 'status')}),
        ('Users', {'fields': ('created_by', 'assigned_to')}),
        (
            'AI Classification',
            {
                'fields': (
                    'predicted_cti',
                    'prediction_confidence',
                    'prediction_justification',
                ),
                'classes': ('collapse',),
            },
        ),
        (
            'Corrections',
            {
                'fields': ('corrected_cti', 'corrected_by', 'corrected_at'),
                'classes': ('collapse',),
            },
        ),
        (
            'Timestamps',
            {
                'fields': ('created_at', 'updated_at'),
                'classes': ('collapse',),
            },
        ),
    )


@admin.register(ClassificationCorrection)
class ClassificationCorrectionAdmin(admin.ModelAdmin):
    list_display = (
        'ticket',
        'original_prediction',
        'corrected_to',
        'corrected_by',
        'corrected_at',
    )
    list_filter = (
        'corrected_at',
        'corrected_by',
        'original_prediction__category',
        'corrected_to__category',
    )
    search_fields = ('ticket__ticket_id', 'ticket_summary', 'notes')
    readonly_fields = ('corrected_at', 'confidence_before')

    fieldsets = (
        (
            'Correction Details',
            {
                'fields': (
                    'ticket',
                    'original_prediction',
                    'corrected_to',
                    'corrected_by',
                )
            },
        ),
        (
            'Ticket Content',
            {
                'fields': ('ticket_summary', 'ticket_description'),
                'classes': ('collapse',),
            },
        ),
        (
            'Metadata',
            {
                'fields': ('confidence_before', 'notes', 'corrected_at'),
                'classes': ('collapse',),
            },
        ),
    )


@admin.register(TrainingExample)
class TrainingExampleAdmin(admin.ModelAdmin):
    list_display = ('correct_cti', 'source', 'weight', 'created_at')
    list_filter = ('source', 'created_at', 'correct_cti__category', 'weight')
    search_fields = ('ticket_content', 'correct_cti__item')

    fieldsets = (
        (
            'Training Data',
            {
                'fields': ('ticket_content', 'correct_cti', 'source', 'weight'),
            },
        ),
        (
            'Metadata',
            {
                'fields': ('created_at',),
                'classes': ('collapse',),
            },
        ),
    )


@admin.register(FewShotExample)
class FewShotExampleAdmin(admin.ModelAdmin):
    list_display = ('cti_record', 'original_summary', 'classification_source', 'confidence_score', 'user_department', 'created_at')
    list_filter = ('classification_source', 'created_at', 'user_department', 'cti_record__category')
    search_fields = ('original_summary', 'original_description', 'cti_record__item')
