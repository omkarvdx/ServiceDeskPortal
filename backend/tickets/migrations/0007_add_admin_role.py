from django.db import migrations


def add_admin_role(apps, schema_editor):
    User = apps.get_model('tickets', 'User')
    User.objects.filter(username='admin').update(role='admin')


def reverse_admin_role(apps, schema_editor):
    User = apps.get_model('tickets', 'User')
    User.objects.filter(role='admin').update(role='support_engineer')


class Migration(migrations.Migration):

    dependencies = [
        ('tickets', '0006_merge_20250727_1352'),
    ]

    operations = [
        migrations.RunPython(add_admin_role, reverse_admin_role),
    ]
