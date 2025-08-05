from django.db import migrations, models
import json


def set_default_similar_cti_records():
    return json.dumps([])


class Migration(migrations.Migration):

    dependencies = [
        ('tickets', '0009_alter_user_role'),
    ]

    operations = [
        migrations.AddField(
            model_name='ticket',
            name='similar_cti_records',
            field=models.JSONField(default=set_default_similar_cti_records, help_text='Top 5 similar CTI records in JSON format'),
        ),
    ]
