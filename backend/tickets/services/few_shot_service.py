import numpy as np
from datetime import datetime, timedelta
from django.conf import settings
from django.db.models import Q
from sklearn.metrics.pairwise import cosine_similarity
import logging
import openai

from ..models import FewShotExample, CTIRecord

logger = logging.getLogger(__name__)


class FewShotExampleService:
    """Service for managing few-shot learning examples."""

    MAX_EXAMPLES_PER_CTI = 10
    DUPLICATE_THRESHOLD = 0.9

    def __init__(self, embedding_service=None):
        # embedding_service should implement get_embedding(text)
        self.embedding_service = embedding_service

    def _get_embedding(self, text):
        try:
            if self.embedding_service:
                return self.embedding_service.get_embedding(text)
            response = openai.embeddings.create(model="text-embedding-3-large", input=text)
            return response.data[0].embedding
        except Exception as exc:
            logger.error("Failed to get embedding: %s", exc)
            return None

    def _is_duplicate_example(self, ticket_content, cti_record, similarity_threshold=DUPLICATE_THRESHOLD):
        """Check if ticket_content is duplicate of existing examples."""
        new_emb = self._get_embedding(ticket_content)
        if not new_emb:
            return False
        existing = cti_record.few_shot_examples.all()
        if not existing:
            return False
        new_emb = np.array(new_emb).reshape(1, -1)
        for ex in existing:
            emb = self._get_embedding(ex.ticket_content)
            if not emb:
                continue
            sim = cosine_similarity(new_emb, np.array(emb).reshape(1, -1))[0][0]
            if sim >= similarity_threshold:
                return True
        return False

    def add_successful_example(self, ticket, cti_record, classification_source="ai"):
        """Add a successful classification as few-shot example."""
        ticket_content = f"{ticket.summary}. {ticket.description}"
        if self._is_duplicate_example(ticket_content, cti_record):
            return None
        example = FewShotExample.objects.create(
            cti_record=cti_record,
            ticket_content=ticket_content,
            original_summary=ticket.summary,
            original_description=ticket.description,
            classification_source=classification_source,
            confidence_score=ticket.prediction_confidence or 1.0,
            created_by=ticket.created_by,
            user_department=ticket.created_by.department if ticket.created_by else "",
        )
        # Update counters
        cti_record.example_count = cti_record.few_shot_examples.count()
        cti_record.last_example_added = datetime.now()
        cti_record.save(update_fields=["example_count", "last_example_added"])

        # Trim old examples if needed
        excess = cti_record.few_shot_examples.order_by("confidence_score", "created_at")
        if cti_record.few_shot_examples.count() > self.MAX_EXAMPLES_PER_CTI:
            for ex in excess[: cti_record.few_shot_examples.count() - self.MAX_EXAMPLES_PER_CTI]:
                ex.delete()
        return example

    def regenerate_cti_embedding_from_examples(self, cti_record):
        """Regenerate CTI embedding from stored examples."""
        examples = list(cti_record.few_shot_examples.order_by("-confidence_score", "-created_at")[:8])
        if len(examples) < 3:
            # Fallback: keep existing embedding_vector as example_based_embedding
            cti_record.example_based_embedding = cti_record.embedding_vector
            cti_record.save(update_fields=["example_based_embedding"])
            return cti_record.example_based_embedding

        embeddings = []
        weights = []
        now = datetime.now()
        for ex in examples:
            emb = self._get_embedding(ex.ticket_content)
            if not emb:
                continue
            age_days = (now - ex.created_at).days
            recency_weight = 0.5 ** (age_days / 90)
            weight = (ex.confidence_score or 1.0) * recency_weight
            embeddings.append(np.array(emb))
            weights.append(weight)
        if not embeddings:
            return None
        embeddings = np.array(embeddings)
        weights = np.array(weights).reshape(-1, 1)
        weighted_emb = np.average(embeddings, axis=0, weights=weights.flatten())
        cti_record.example_based_embedding = weighted_emb.tolist()
        cti_record.embedding_vector = weighted_emb.tolist()
        cti_record.save(update_fields=["example_based_embedding", "embedding_vector"])
        return weighted_emb.tolist()

    def get_examples_for_llm_prompt(self, cti_record, max_examples=3):
        examples = cti_record.few_shot_examples.order_by("-confidence_score", "-created_at")[:max_examples]
        result = []
        for ex in examples:
            result.append({
                "summary": ex.original_summary,
                "description": ex.original_description,
                "source": ex.classification_source,
                "confidence": ex.confidence_score,
                "department": ex.user_department,
                "date": ex.created_at.strftime("%Y-%m-%d"),
            })
        return result

    def enhanced_llm_classification_with_examples(self, ticket_text, candidate_records):
        """Placeholder for advanced LLM classification using few-shot examples."""
        # For now just call base service llm_classification
        base_service = self.embedding_service
        return base_service.llm_classification(ticket_text, candidate_records)

