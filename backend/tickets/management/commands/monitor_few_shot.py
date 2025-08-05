from django.core.management.base import BaseCommand
from django.db import models
from tickets.models import CTIRecord, FewShotExample

class Command(BaseCommand):
    help = 'Show few-shot example statistics'

    def handle(self, *args, **options):
        total_examples = FewShotExample.objects.count()
        by_source = FewShotExample.objects.values('classification_source').annotate(count=models.Count('id'))
        self.stdout.write(f"Total examples: {total_examples}")
        for row in by_source:
            self.stdout.write(f"{row['classification_source']}: {row['count']}")
        sufficient = CTIRecord.objects.filter(example_count__gte=3).count()
        self.stdout.write(f"CTIs with >=3 examples: {sufficient}")
