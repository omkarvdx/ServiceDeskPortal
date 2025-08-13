from django.db import migrations

class Migration(migrations.Migration):
    dependencies = [
        ('tickets', '0007_add_admin_role'),
    ]

    operations = [
        migrations.RunSQL(
            "CREATE INDEX IF NOT EXISTS tickets_ticket_prediction_confidence_idx ON tickets_ticket(prediction_confidence);",
            reverse_sql="DROP INDEX IF EXISTS tickets_ticket_prediction_confidence_idx;"
        ),
        migrations.RunSQL(
            "CREATE INDEX IF NOT EXISTS tickets_ticket_created_at_idx ON tickets_ticket(created_at);",
            reverse_sql="DROP INDEX IF EXISTS tickets_ticket_created_at_idx;"
        ),
        migrations.RunSQL(
            "CREATE INDEX IF NOT EXISTS tickets_ctirecord_usage_idx ON tickets_ctirecord(id) WHERE embedding_vector IS NOT NULL;",
            reverse_sql="DROP INDEX IF EXISTS tickets_ctirecord_usage_idx;"
        ),
    ]
