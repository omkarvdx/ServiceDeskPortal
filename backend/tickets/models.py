from django.contrib.auth.models import AbstractUser
from django.db import models
from django.utils import timezone
import json

class User(AbstractUser):
    """Custom user model with role-based access"""
    ROLE_CHOICES = [
        ('end_user', 'End User'),
        ('support_engineer', 'Support Engineer'),
        ('admin', 'Administrator'),
    ]
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='end_user')
    department = models.CharField(max_length=100, blank=True)
    
    def __str__(self):
        return f"{self.username} ({self.get_role_display()})"

class CTIRecord(models.Model):
    """Configuration and Taxonomy Information Records"""
    bu_number = models.CharField(max_length=10)
    category = models.CharField(max_length=100)  # Service Name
    type = models.CharField(max_length=100)      # Service Category
    item = models.CharField(max_length=200)
    resolver_group = models.CharField(max_length=100)
    request_type = models.CharField(max_length=50)
    sla = models.CharField(max_length=10)
    service_description = models.TextField(blank=True)
    bu_description = models.TextField(blank=True)
    resolver_group_description = models.TextField(blank=True)
    
    # For AI processing
    embedding_vector = models.JSONField(null=True, blank=True)
    # Few-shot example based embedding aggregated from examples
    example_based_embedding = models.JSONField(null=True, blank=True)
    example_count = models.IntegerField(default=0)
    last_example_added = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        unique_together = ['bu_number', 'category', 'type', 'item']
        verbose_name = "CTI Record"
        verbose_name_plural = "CTI Records"
        indexes = [
            models.Index(fields=['category', 'type']),
            models.Index(fields=['resolver_group']),
        ]
    
    def __str__(self):
        return f"{self.category} - {self.type} - {self.item}"

    @property
    def has_sufficient_examples(self):
        return self.example_count >= 3

class Ticket(models.Model):
    """Support ticket model with AI classification"""
    STATUS_CHOICES = [
        ('open', 'Open'),
        ('in_progress', 'In Progress'),
        ('resolved', 'Resolved'),
        ('closed', 'Closed'),
    ]
    
    PRIORITY_CHOICES = [
        ('P1', 'Critical'),
        ('P2', 'High'),
        ('P3', 'Medium'),
        ('P4', 'Low'),
    ]
    
    # Basic ticket info
    ticket_id = models.CharField(max_length=20, unique=True)
    summary = models.CharField(max_length=200)
    description = models.TextField()
    created_by = models.ForeignKey(User, on_delete=models.CASCADE, related_name='created_tickets')
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='open')
    
    # AI Predictions
    predicted_cti = models.ForeignKey(CTIRecord, on_delete=models.SET_NULL, null=True, blank=True, related_name='predicted_tickets')
    prediction_confidence = models.FloatField(null=True, blank=True)
    prediction_justification = models.TextField(blank=True)
    
    # Support Engineer Assignment
    assigned_to = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='assigned_tickets')
    
    # Corrected values (if support engineer makes changes)
    corrected_cti = models.ForeignKey(CTIRecord, on_delete=models.SET_NULL, null=True, blank=True, related_name='corrected_tickets')
    corrected_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='corrected_tickets_by')
    corrected_at = models.DateTimeField(null=True, blank=True)
    
    # Similar CTI records for reference
    similar_cti_records = models.JSONField(default=list, help_text='Top 5 similar CTI records in JSON format')
    
    class Meta:
        ordering = ['-created_at']
        verbose_name = "Support Ticket"
        verbose_name_plural = "Support Tickets"
        indexes = [
            models.Index(fields=['status', 'assigned_to']),
            models.Index(fields=['created_at', 'status']),
            models.Index(fields=['predicted_cti', 'corrected_cti']),
            models.Index(fields=['prediction_confidence']),
            models.Index(fields=['assigned_to', 'status']),
        ]
    
    def save(self, *args, **kwargs):
        if not self.ticket_id:
            # Find the highest existing ticket number
            max_id = Ticket.objects.aggregate(
                max_id=models.Max(
                    models.functions.Cast(
                        models.functions.Substr('ticket_id', 5),
                        models.IntegerField()
                    )
                )
            )['max_id']
            
            # If no tickets exist yet, start from 1, otherwise increment the max ID
            next_id = 1 if max_id is None else max_id + 1
            self.ticket_id = f"TKT-{next_id:06d}"
        super().save(*args, **kwargs)
    
    @property
    def final_cti(self):
        """Returns the corrected CTI if available, otherwise the predicted CTI"""
        return self.corrected_cti if self.corrected_cti else self.predicted_cti
    
    def __str__(self):
        return f"{self.ticket_id} - {self.summary}"

class ClassificationCorrection(models.Model):
    """Store corrections for continuous learning"""
    ticket = models.ForeignKey(Ticket, on_delete=models.CASCADE)
    original_prediction = models.ForeignKey(CTIRecord, on_delete=models.CASCADE, related_name='original_predictions')
    corrected_to = models.ForeignKey(CTIRecord, on_delete=models.CASCADE, related_name='corrections')
    corrected_by = models.ForeignKey(User, on_delete=models.CASCADE)
    corrected_at = models.DateTimeField(default=timezone.now)
    
    # Store the ticket content for training
    ticket_summary = models.CharField(max_length=200)
    ticket_description = models.TextField()
    
    # Additional metadata
    confidence_before = models.FloatField(null=True, blank=True)
    notes = models.TextField(blank=True)
    
    class Meta:
        verbose_name = "Classification Correction"
        verbose_name_plural = "Classification Corrections"
        ordering = ['-corrected_at']
    
    def __str__(self):
        return f"Correction for {self.ticket.ticket_id} by {self.corrected_by.username}"

class TrainingExample(models.Model):
    """Structured training data for continuous learning"""
    ticket_content = models.TextField()  # summary + description
    correct_cti = models.ForeignKey(CTIRecord, on_delete=models.CASCADE)
    source = models.CharField(max_length=50, choices=[
        ('initial', 'Initial Training'),
        ('correction', 'User Correction'),
        ('manual', 'Manual Addition')
    ])
    created_at = models.DateTimeField(default=timezone.now)
    weight = models.FloatField(default=1.0)  # For weighted training
    
    class Meta:
        verbose_name = "Training Example"
        verbose_name_plural = "Training Examples"
        ordering = ['-created_at']
    
    def __str__(self):
        return f"Training example for {self.correct_cti}"


class FewShotExample(models.Model):
    """Store real ticket examples for each CTI record"""
    cti_record = models.ForeignKey(
        CTIRecord,
        on_delete=models.CASCADE,
        related_name="few_shot_examples",
    )
    ticket_content = models.TextField()  # Combined summary + description
    original_summary = models.CharField(max_length=200)
    original_description = models.TextField()
    classification_source = models.CharField(
        max_length=20,
        choices=[
            ("ai", "AI Classified"),
            ("confirmed", "Agent Confirmed"),
            ("corrected", "Agent Corrected"),
        ],
        default="ai",
    )
    confidence_score = models.FloatField(default=1.0)
    created_by = models.ForeignKey("User", on_delete=models.SET_NULL, null=True, blank=True)
    user_department = models.CharField(max_length=100, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    embedding_diversity_score = models.FloatField(null=True, blank=True)
    usage_count = models.IntegerField(default=0)

    class Meta:
        ordering = ["-confidence_score", "-created_at"]
        indexes = [
            models.Index(fields=["cti_record", "classification_source"]),
            models.Index(fields=["created_at"]),
            models.Index(fields=["confidence_score"]),
        ]