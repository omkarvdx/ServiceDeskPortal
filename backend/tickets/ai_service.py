import openai
import numpy as np
from sklearn.metrics.pairwise import cosine_similarity
from django.conf import settings
from django.core.cache import cache
from django.core.exceptions import ImproperlyConfigured
from .models import CTIRecord, TrainingExample, ClassificationCorrection
from .services.few_shot_service import FewShotExampleService
import json
import logging
import os
from datetime import datetime

logger = logging.getLogger(__name__)

class TicketClassificationService:
    """AI service for automated ticket classification using OpenAI APIs"""
    
    MAX_CANDIDATE_EXAMPLES = 2  # Examples per candidate in prompt
    INCLUDE_CANDIDATE_EXAMPLES = True  # Feature flag
    FALLBACK_TO_GLOBAL_ONLY = False  # If candidate examples fail

    def __init__(self):
        api_key = getattr(settings, "OPENAI_API_KEY", None)
        if not api_key:
            raise ImproperlyConfigured("OPENAI_API_KEY is not set")
        openai.api_key = api_key
        self.embedding_model = "text-embedding-3-large"
        self.llm_model = "gpt-4o"
        self.similarity_threshold = 0.2
        # May be overridden by subclasses
        self.few_shot_service = None
        
    def get_embedding(self, text):
        """Get embedding for text using OpenAI"""
        try:
            response = openai.embeddings.create(
                model=self.embedding_model,
                input=text
            )
            return response.data[0].embedding
        except Exception as e:
            logger.error(f"Error getting embedding: {e}")
            return None
    
    def precompute_cti_embeddings(self):
        """Precompute embeddings for all CTI records"""
        cti_records = CTIRecord.objects.filter(embedding_vector__isnull=True)
        
        for cti in cti_records:

            # Create text representation of CTI record including BU and other metadata
            cti_text = (
                f"{cti.bu_number} {cti.category} {cti.type} {cti.item} "
                f"{cti.request_type} {cti.sla} {cti.service_description} "
                f"{cti.bu_description} {cti.resolver_group_description}"
            )

            embedding = self.get_embedding(cti_text)
            
            if embedding:
                cti.embedding_vector = embedding
                cti.save()
                logger.info(f"Computed embedding for CTI: {cti.id}")
    
    def find_similar_cti_records(self, ticket_text, top_k=8, save_to_ticket=None):
        """
        Find similar CTI records using embeddings.
        
        Args:
            ticket_text (str): The ticket text to find similar records for
            top_k (int): Number of similar records to return
            save_to_ticket (Ticket, optional): If provided, will save top 5 similar records to this ticket
            
        Returns:
            list: List of tuples (cti_record, similarity_score)
        """
        ticket_embedding = self.get_embedding(ticket_text)
        if not ticket_embedding:
            return []
        
        # Get all CTI records with embeddings
        cti_records = CTIRecord.objects.exclude(embedding_vector__isnull=True) 
        
        similarities = []
        ticket_embedding = np.array(ticket_embedding).reshape(1, -1)
        
        for cti in cti_records:
            cti_embedding = np.array(cti.embedding_vector).reshape(1, -1)
            similarity = cosine_similarity(ticket_embedding, cti_embedding)[0][0]
            similarities.append((cti, float(similarity)))  # Convert numpy float to Python float for JSON serialization
        
        # Sort by similarity and get top K
        similarities.sort(key=lambda x: x[1], reverse=True)
        top_similar = similarities[:top_k]
        
        # If a ticket is provided, save top 5 similar records to it
        if save_to_ticket is not None and top_similar:
            top_5_similar = [
                {
                    'cti_id': cti.id,
                    'bu_number': cti.bu_number,
                    'category': cti.category,
                    'type': cti.type,
                    'item': cti.item,
                    'resolver_group': cti.resolver_group,
                    'request_type': cti.request_type,
                    'sla': cti.sla,
                    'similarity_score': float(similarity)  # Convert numpy float to Python float
                }
                for cti, similarity in top_similar[:5]  # Only save top 5
            ]
            save_to_ticket.similar_cti_records = top_5_similar
            save_to_ticket.save(update_fields=['similar_cti_records'])
        
        return top_similar
    
    def llm_classification(self, ticket_text, candidate_records):
        """Step 2: Few-shot LLM ranking (soft positive selection)"""
        
        # Prepare global few-shot examples for context
        few_shot_examples = self.get_few_shot_examples()

        # Build enhanced candidate section including candidate-specific examples
        candidates_text = ""
        for i, (cti, similarity) in enumerate(candidate_records):
            specific_examples = []
            if self.INCLUDE_CANDIDATE_EXAMPLES and getattr(self, "few_shot_service", None):
                try:
                    specific_examples = self.few_shot_service.get_examples_for_llm_prompt(
                        cti, max_examples=self.MAX_CANDIDATE_EXAMPLES
                    )
                except Exception as exc:
                    logger.error("Error retrieving examples for CTI %s: %s", cti.id, exc)
                    if self.FALLBACK_TO_GLOBAL_ONLY:
                        specific_examples = []

            candidates_text += f"""
ID: {cti.id}
Category: {cti.category}
Type: {cti.type}
Item: {cti.item}
Resolver Group: {cti.resolver_group}
Request Type: {cti.request_type}
SLA: {cti.sla}
Similarity Score: {similarity:.3f}

REAL TICKET EXAMPLES FOR THIS CATEGORY:
{self._format_candidate_examples(specific_examples)}
---
"""
        
        prompt = f"""You are an expert IT service desk classifier. Your task is to classify a support ticket into the most appropriate category from the given candidates.

GENERAL CLASSIFICATION EXAMPLES:
{few_shot_examples}

Now classify this ticket:
TICKET: {ticket_text}

CANDIDATE CATEGORIES (each with real ticket examples):
{candidates_text}

Analyze the ticket content and select the MOST APPROPRIATE category ID. Consider:
1. The specific technical issue described
2. The type of request (incident vs request)
3. The service area involved
4. The appropriate resolver group
5. How similar the ticket is to the REAL EXAMPLES shown for each candidate
6. The quality and quantity of examples available for each candidate

Pay special attention to the "REAL TICKET EXAMPLES" for each candidate - these show you exactly what types of tickets belong to each category.

Respond with EXACTLY this JSON format:
{{
    "selected_id": <ID_NUMBER>,
    "confidence": <0.0_to_1.0>,
    "justification": "<brief explanation of why this category was selected>"
}}

If none of the candidates are appropriate, respond with:
{{
    "selected_id": null,
    "confidence": 0.0,
    "justification": "No suitable category found among candidates"
}}"""

        try:
            response = openai.chat.completions.create(
                model=self.llm_model,
                messages=[
                    {"role": "system", "content": "You are an expert IT service desk classifier. Always respond with valid JSON only."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.1,
                max_tokens=500
            )
            
            result_text = response.choices[0].message.content.strip()
            # Clean up response if it has markdown formatting
            if result_text.startswith('```json'):
                result_text = result_text.replace('```json', '').replace('```', '').strip()
            
            result = json.loads(result_text)
            return result
            
        except Exception as e:
            logger.error(f"Error in LLM classification: {e}")
            return {"selected_id": None, "confidence": 0.0, "justification": f"Error: {str(e)}"}
    
    def get_few_shot_examples(self, max_examples=5):
        """Get few-shot examples from training data"""
        examples = TrainingExample.objects.select_related('correct_cti').order_by('-weight', '-created_at')[:max_examples]
        
        few_shot_text = ""
        for example in examples:
            cti = example.correct_cti
            few_shot_text += f"""
TICKET: {example.ticket_content}
CORRECT CLASSIFICATION:
- BU: {cti.bu_number}
- Category: {cti.category}
- Type: {cti.type}
- Item: {cti.item}
- Resolver Group: {cti.resolver_group}
- Resolver Group Description: {cti.resolver_group_description}
- Request Type: {cti.request_type}
- SLA: {cti.sla}
- Service Description: {cti.service_description}
- BU Description: {cti.bu_description}

"""
        
        return few_shot_text

    def _format_candidate_examples(self, examples_data):
        """Format candidate-specific examples for prompt"""
        if not examples_data:
            return "No specific examples available for this category."

        formatted = ""
        for i, example in enumerate(examples_data, 1):
            formatted += f"\nExample {i}:\n- Summary: {example['summary']}\n- Source: {example['source']}\n- Confidence: {example['confidence']}\n- Department: {example['department']}\n"
        return formatted
    
    def classify_ticket(self, ticket_summary, ticket_description, ticket_instance=None):
        """
        Main classification pipeline
        
        Args:
            ticket_summary (str): The summary of the ticket
            ticket_description (str): The description of the ticket
            ticket_instance (Ticket, optional): The ticket instance to save similar CTI records to
            
        Returns:
            tuple: (selected_cti, confidence, justification)
        """
        # Combine summary and description
        ticket_text = f"{ticket_summary}. {ticket_description}"
        
        # Step 1: Pre-filter with embeddings and save top 5 similar records to ticket
        similar_records = self.find_similar_cti_records(
            ticket_text, 
            top_k=8, 
            save_to_ticket=ticket_instance  # Pass ticket instance to save similar records
        )
        
        if not similar_records:
            return None, 0.0, "No similar CTI records found"
        
        # Check similarity threshold
        best_similarity = similar_records[0][1] if similar_records else 0
        if best_similarity < self.similarity_threshold:
            return None, 0.0, f"Best similarity ({best_similarity:.3f}) below threshold ({self.similarity_threshold})"
        
        # Step 2: LLM ranking
        llm_result = self.llm_classification(ticket_text, similar_records)
        
        if llm_result.get('selected_id'):
            try:
                selected_cti = CTIRecord.objects.get(id=llm_result['selected_id'])
                return selected_cti, llm_result['confidence'], llm_result['justification']
            except CTIRecord.DoesNotExist:
                return None, 0.0, "Selected CTI record not found"
        
        return None, 0.0, llm_result.get('justification', 'No suitable classification found')
    
    def record_correction(self, ticket, original_prediction, corrected_cti, corrected_by, notes=""):
        """Record a correction for continuous learning (Step 5)"""
        # Create correction record
        correction = ClassificationCorrection.objects.create(
            ticket=ticket,
            original_prediction=original_prediction,
            corrected_to=corrected_cti,
            corrected_by=corrected_by,
            ticket_summary=ticket.summary,
            ticket_description=ticket.description,
            confidence_before=ticket.prediction_confidence,
            notes=notes
        )
        
        # Add to structured training data
        ticket_content = f"{ticket.summary}. {ticket.description}"
        TrainingExample.objects.create(
            ticket_content=ticket_content,
            correct_cti=corrected_cti,
            source='correction',
            weight=1.5  # Give corrections higher weight
        )
        
        # Append to document file for additional learning
        self.append_to_learning_file(ticket, original_prediction, corrected_cti, corrected_by)
        
        logger.info(f"Recorded correction for ticket {ticket.ticket_id}")
        return correction
    
    def append_to_learning_file(self, ticket, original_prediction, corrected_cti, corrected_by):
        """Append correction to document file"""
        try:
            learning_dir = settings.MEDIA_ROOT / 'learning_data'
            learning_dir.mkdir(exist_ok=True)
            
            filename = f"corrections_{datetime.now().strftime('%Y_%m')}.jsonl"
            filepath = learning_dir / filename
            
            correction_data = {
                "timestamp": datetime.now().isoformat(),
                "ticket_id": ticket.ticket_id,
                "ticket_content": f"{ticket.summary}. {ticket.description}",
                "original_prediction": {
                    "id": original_prediction.id,
                    "bu_number": original_prediction.bu_number,
                    "category": original_prediction.category,
                    "type": original_prediction.type,
                    "item": original_prediction.item,
                    "resolver_group": original_prediction.resolver_group,
                    "resolver_group_description": original_prediction.resolver_group_description,
                    "request_type": original_prediction.request_type,
                    "sla": original_prediction.sla,
                    "service_description": original_prediction.service_description,
                    "bu_description": original_prediction.bu_description
                } if original_prediction else None,
                "corrected_to": {
                    "id": corrected_cti.id,
                    "bu_number": corrected_cti.bu_number,
                    "category": corrected_cti.category,
                    "type": corrected_cti.type,
                    "item": corrected_cti.item,
                    "resolver_group": corrected_cti.resolver_group,
                    "resolver_group_description": corrected_cti.resolver_group_description,
                    "request_type": corrected_cti.request_type,
                    "sla": corrected_cti.sla,
                    "service_description": corrected_cti.service_description,
                    "bu_description": corrected_cti.bu_description
                },
                "corrected_by": corrected_by.username,
                "confidence_before": ticket.prediction_confidence
            }
            
            with open(filepath, 'a', encoding='utf-8') as f:
                f.write(json.dumps(correction_data) + '\n')
                
        except Exception as e:
            logger.error(f"Error writing to learning file: {e}")
    
    def retrain_embeddings(self):
        """Periodic retraining of embeddings"""
        # This could be enhanced with more sophisticated retraining
        self.precompute_cti_embeddings()
        logger.info("Retrained embeddings for all CTI records")


class EnhancedTicketClassificationService(TicketClassificationService):
    """Classification service with few-shot example enhancements."""
    
    # Default CTI record ID to use when no good match is found
    DEFAULT_CTI_ID = 1198  # Default CTI record ID
    MIN_CONFIDENCE_THRESHOLD = 0.3  # Minimum confidence to accept a prediction

    def __init__(self):
        super().__init__()
        self.few_shot_service = FewShotExampleService(self)
        self._default_cti = None
        
    def get_default_cti_record(self):
        """Get the default CTI record, caching it for performance"""
        if self._default_cti is None:
            try:
                self._default_cti = CTIRecord.objects.get(id=self.DEFAULT_CTI_ID)
                logger.info(f"Successfully loaded default CTI record: {self._default_cti}")
            except CTIRecord.DoesNotExist as e:
                logger.error(f"Default CTI record with ID {self.DEFAULT_CTI_ID} not found: {e}")
                return None
        return self._default_cti  # Fixed typo: was _default_ctn
        
    def ensure_valid_cti_prediction(self, ticket, predicted_cti, confidence, justification):
        """Ensure the predicted CTI is valid, fall back to default if needed"""
        if predicted_cti and confidence >= self.MIN_CONFIDENCE_THRESHOLD:
            return predicted_cti, confidence, justification
            
        # Fall back to default CTI
        default_cti = self.get_default_cti_record()
        if not default_cti:
            return None, 0.0, "No valid prediction and default CTI not available"
            
        # Create a correction record if we had a prediction
        if predicted_cti and ticket.id:
            self.record_correction(
                ticket=ticket,
                original_prediction=predicted_cti,
                corrected_to=default_cti,
                corrected_by=None,  # System correction
                notes=f"Auto-corrected to default CTI due to low confidence ({confidence:.2f})"
            )
            
        return default_cti, 0.5, f"Using default CTI (ID: {default_cti.id}) - {justification}"

    def find_similar_cti_records(self, ticket_text, top_k=8, save_to_ticket=None):
        ticket_embedding = self.get_embedding(ticket_text)
        if not ticket_embedding:
            if save_to_ticket is not None:
                save_to_ticket.similar_cti_records = []
                save_to_ticket.save(update_fields=['similar_cti_records'])
            return []

        cti_records = CTIRecord.objects.exclude(embedding_vector__isnull=True)

        similarities = []
        ticket_embedding = np.array(ticket_embedding).reshape(1, -1)

        for cti in cti_records:
            cti_embedding_vector = cti.example_based_embedding or cti.embedding_vector
            cti_embedding = np.array(cti_embedding_vector).reshape(1, -1)
            similarity = cosine_similarity(ticket_embedding, cti_embedding)[0][0]
            if cti.has_sufficient_examples:
                similarity *= 1.1
            similarities.append((cti, float(similarity)))

        # Sort by similarity score in descending order
        similarities.sort(key=lambda x: x[1], reverse=True)
        top_similar = similarities[:top_k]
        
        # Save top 5 similar CTI records to the ticket if save_to_ticket is provided
        if save_to_ticket is not None and top_similar:
            top_5_similar = [
                {
                    'cti_id': cti.id,
                    'bu_number': cti.bu_number,
                    'category': cti.category,
                    'type': cti.type,
                    'item': cti.item,
                    'resolver_group': cti.resolver_group,
                    'request_type': cti.request_type,
                    'sla': cti.sla,
                    'similarity_score': similarity
                }
                for cti, similarity in top_similar[:5]  # Get top 5 most similar
            ]
            save_to_ticket.similar_cti_records = top_5_similar
            save_to_ticket.save(update_fields=['similar_cti_records'])
        
        return top_similar

    def record_correction(self, ticket, original_prediction, corrected_cti, corrected_by, notes=""):
        correction = super().record_correction(ticket, original_prediction, corrected_cti, corrected_by, notes)
        try:
            self.few_shot_service.add_successful_example(ticket, corrected_cti, "corrected")
        except Exception as exc:
            logger.error("Failed to add few shot example: %s", exc)
        return correction

    def record_successful_classification(self, ticket, cti_record, source="ai"):
        try:
            self.few_shot_service.add_successful_example(ticket, cti_record, source)
        except Exception as exc:
            logger.error("Failed to store few shot example: %s", exc)

# Initialize global service instance
classification_service = EnhancedTicketClassificationService()
