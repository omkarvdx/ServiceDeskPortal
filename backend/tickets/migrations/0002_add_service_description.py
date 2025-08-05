from django.db import migrations, models

class Migration(migrations.Migration):
    dependencies = [
        ('tickets', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='ctirecord',
            name='service_description',
            field=models.TextField(blank=True),
        ),
    ]
