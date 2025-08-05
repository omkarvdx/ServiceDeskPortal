from django.core.management.base import BaseCommand
from tickets.models import Ticket, FewShotExample, CTIRecord
from tickets.services.few_shot_service import FewShotExampleService

class Command(BaseCommand):
    help = 'Migrate historical tickets to few-shot examples'

    def add_arguments(self, parser):
        parser.add_argument('--create-examples', action='store_true')
        parser.add_argument('--regenerate-embeddings', action='store_true')
        parser.add_argument('--min-confidence', type=float, default=0.6)
        parser.add_argument('--dry-run', action='store_true')

    def handle(self, *args, **options):
        service = FewShotExampleService()
        if options['create_examples']:
            tickets = Ticket.objects.filter(predicted_cti__isnull=False, prediction_confidence__gte=options['min_confidence'])
            for t in tickets:
                if options['dry_run']:
                    self.stdout.write(f"Would add example for ticket {t.ticket_id}")
                else:
                    service.add_successful_example(t, t.predicted_cti, 'ai')
        if options['regenerate_embeddings']:
            for cti in CTIRecord.objects.all():
                if options['dry_run']:
                    self.stdout.write(f"Would regenerate embedding for CTI {cti.id}")
                else:
                    service.regenerate_cti_embedding_from_examples(cti)
        self.stdout.write(self.style.SUCCESS('Migration complete'))
