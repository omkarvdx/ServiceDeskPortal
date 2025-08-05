from django.db import migrations, models

class Migration(migrations.Migration):
    dependencies = [
        ('tickets', '0001_initial'),
    ]

    operations = [
        migrations.RunSQL(
            "CREATE INDEX IF NOT EXISTS tickets_ticket_status_assigned_idx ON tickets_ticket(status, assigned_to_id);",
            reverse_sql="DROP INDEX IF EXISTS tickets_ticket_status_assigned_idx;"
        ),
        migrations.RunSQL(
            "CREATE INDEX IF NOT EXISTS tickets_ticket_created_status_idx ON tickets_ticket(created_at, status);",
            reverse_sql="DROP INDEX IF EXISTS tickets_ticket_created_status_idx;"
        ),
        migrations.RunSQL(
            "CREATE INDEX IF NOT EXISTS tickets_ticket_cti_idx ON tickets_ticket(predicted_cti_id, corrected_cti_id);",
            reverse_sql="DROP INDEX IF EXISTS tickets_ticket_cti_idx;"
        ),
        migrations.RunSQL(
            "CREATE INDEX IF NOT EXISTS tickets_ticket_confidence_idx ON tickets_ticket(prediction_confidence);",
            reverse_sql="DROP INDEX IF EXISTS tickets_ticket_confidence_idx;"
        ),
        migrations.RunSQL(
            "CREATE INDEX IF NOT EXISTS tickets_ctirecord_category_type_idx ON tickets_ctirecord(category, type);",
            reverse_sql="DROP INDEX IF EXISTS tickets_ctirecord_category_type_idx;"
        ),
        migrations.RunSQL(
            "CREATE INDEX IF NOT EXISTS tickets_ctirecord_resolver_idx ON tickets_ctirecord(resolver_group);",
            reverse_sql="DROP INDEX IF EXISTS tickets_ctirecord_resolver_idx;"
        ),
    ]
