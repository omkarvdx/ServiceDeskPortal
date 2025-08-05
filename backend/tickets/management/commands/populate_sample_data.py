from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from tickets.models import CTIRecord, TrainingExample
import json

User = get_user_model()


class Command(BaseCommand):
    help = 'Populate database with sample CTI records and users'

    def handle(self, *args, **options):
        self.stdout.write('Creating sample data...')

        # Create sample users
        self.create_users()

        # Create CTI records
        self.create_cti_records()

        # Create initial training examples
        self.create_training_examples()

        self.stdout.write(self.style.SUCCESS('Successfully populated sample data'))

    def create_users(self):
        # Create superuser if not exists
        if not User.objects.filter(username='admin').exists():
            User.objects.create_superuser(
                username='admin',
                email='admin@company.com',
                password='admin123',
                first_name='System',
                last_name='Administrator',
                role='admin',
            )
            self.stdout.write('Created admin user')

        # Create support engineers
        support_engineers = [
            {'username': 'support1', 'email': 'support1@company.com', 'name': ('John', 'Smith')},
            {'username': 'support2', 'email': 'support2@company.com', 'name': ('Jane', 'Doe')},
        ]

        for eng in support_engineers:
            if not User.objects.filter(username=eng['username']).exists():
                User.objects.create_user(
                    username=eng['username'],
                    email=eng['email'],
                    password='support123',
                    first_name=eng['name'][0],
                    last_name=eng['name'][1],
                    role='support_engineer',
                    department='IT Support',
                )
                self.stdout.write(f'Created support engineer: {eng["username"]}')

        # Create end users
        end_users = [
            {'username': 'user1', 'email': 'user1@company.com', 'name': ('Alice', 'Johnson'), 'dept': 'Marketing'},
            {'username': 'user2', 'email': 'user2@company.com', 'name': ('Bob', 'Wilson'), 'dept': 'Sales'},
            {'username': 'user3', 'email': 'user3@company.com', 'name': ('Carol', 'Brown'), 'dept': 'Finance'},
        ]

        for user in end_users:
            if not User.objects.filter(username=user['username']).exists():
                User.objects.create_user(
                    username=user['username'],
                    email=user['email'],
                    password='user123',
                    first_name=user['name'][0],
                    last_name=user['name'][1],
                    role='end_user',
                    department=user['dept'],
                )
                self.stdout.write(f'Created end user: {user["username"]}')

    def create_cti_records(self):
        cti_data = [
            # Access Management
            {
                'bu_number': '753',
                'category': 'Managed Workspace',
                'type': 'Access Management',
                'item': 'Profile - AD',
                'resolver_group': 'EOH MYHR-AD Support iOCO',
                'request_type': 'Request',
                'sla': 'P4',
                'service_description': 'Active Directory profile management'
            },
            {
                'bu_number': '753',
                'category': 'Managed Workspace',
                'type': 'Access Management',
                'item': 'MyHR Error',
                'resolver_group': 'EOH MYHR-AD Support iOCO',
                'request_type': 'Request',
                'sla': 'P3',
                'service_description': 'MyHR application errors'
            },
            {
                'bu_number': '753',
                'category': 'Managed Workspace',
                'type': 'Access Management',
                'item': 'AD Updates',
                'resolver_group': 'EOH MYHR-AD Support iOCO',
                'request_type': 'Request',
                'sla': 'P4',
                'service_description': 'Active Directory update requests'
            },
            {
                'bu_number': '753',
                'category': 'Managed Workspace',
                'type': 'Access Management',
                'item': 'Application',
                'resolver_group': 'EOH Remote Support iOCO',
                'request_type': 'Request',
                'sla': 'P4',
                'service_description': 'General application access requests'
            },
            {
                'bu_number': '753',
                'category': 'Managed Workspace',
                'type': 'Access Management',
                'item': 'Map Network Drive (File/Print)',
                'resolver_group': 'EOH Remote Support iOCO',
                'request_type': 'Request',
                'sla': 'P4',
                'service_description': 'Mapping network drives'
            },
            {
                'bu_number': '753',
                'category': 'Managed Workspace',
                'type': 'Access Management',
                'item': 'Disabled Users',
                'resolver_group': 'EOH Remote Support iOCO',
                'request_type': 'Request',
                'sla': 'P4',
                'service_description': 'Enable or disable user accounts'
            },
            {
                'bu_number': '753',
                'category': 'Managed Workspace',
                'type': 'Access Management',
                'item': 'Password Reset',
                'resolver_group': 'EOH Remote Support iOCO',
                'request_type': 'Incident',
                'sla': 'P3',
                'service_description': 'Password reset assistance'
            },
            # Hardware Support
            {
                'bu_number': '753',
                'category': 'End User Computing',
                'type': 'Hardware Support',
                'item': 'Laptop Issues',
                'resolver_group': 'EOH Hardware Support iOCO',
                'request_type': 'Incident',
                'sla': 'P3',
                'service_description': 'Physical laptop hardware problems'
            },
            {
                'bu_number': '753',
                'category': 'End User Computing',
                'type': 'Hardware Support',
                'item': 'Monitor Problems',
                'resolver_group': 'EOH Hardware Support iOCO',
                'request_type': 'Incident',
                'sla': 'P3',
                'service_description': 'Issues with desktop monitors'
            },
            {
                'bu_number': '753',
                'category': 'End User Computing',
                'type': 'Hardware Support',
                'item': 'Keyboard/Mouse',
                'resolver_group': 'EOH Hardware Support iOCO',
                'request_type': 'Request',
                'sla': 'P4',
                'service_description': 'Peripheral replacements'
            },
            # Software Support
            {
                'bu_number': '753',
                'category': 'Applications',
                'type': 'Software Support',
                'item': 'Microsoft Office',
                'resolver_group': 'EOH Software Support iOCO',
                'request_type': 'Incident',
                'sla': 'P3',
                'service_description': 'Microsoft Office application issues'
            },
            {
                'bu_number': '753',
                'category': 'Applications',
                'type': 'Software Support',
                'item': 'Business Applications',
                'resolver_group': 'EOH Software Support iOCO',
                'request_type': 'Incident',
                'sla': 'P2',
                'service_description': 'Support for business-specific apps'
            },
            {
                'bu_number': '753',
                'category': 'Applications',
                'type': 'Software Support',
                'item': 'Software Installation',
                'resolver_group': 'EOH Software Support iOCO',
                'request_type': 'Request',
                'sla': 'P4',
                'service_description': 'Install or remove software packages'
            },
            # Network Issues
            {
                'bu_number': '753',
                'category': 'Infrastructure',
                'type': 'Network',
                'item': 'Internet Connectivity',
                'resolver_group': 'EOH Network Support iOCO',
                'request_type': 'Incident',
                'sla': 'P2',
                'service_description': 'Issues with wired network connectivity'
            },
            {
                'bu_number': '753',
                'category': 'Infrastructure',
                'type': 'Network',
                'item': 'VPN Access',
                'resolver_group': 'EOH Network Support iOCO',
                'request_type': 'Request',
                'sla': 'P3',
                'service_description': 'Setup and troubleshooting of VPN'
            },
            {
                'bu_number': '753',
                'category': 'Infrastructure',
                'type': 'Network',
                'item': 'Wireless Issues',
                'resolver_group': 'EOH Network Support iOCO',
                'request_type': 'Incident',
                'sla': 'P3',
                'service_description': 'Problems with Wi-Fi connectivity'
            },
            # Email and Communication
            {
                'bu_number': '753',
                'category': 'Communication',
                'type': 'Email',
                'item': 'Outlook Issues',
                'resolver_group': 'EOH Email Support iOCO',
                'request_type': 'Incident',
                'sla': 'P3',
                'service_description': 'Outlook and email client problems'
            },
            {
                'bu_number': '753',
                'category': 'Communication',
                'type': 'Email',
                'item': 'Distribution Lists',
                'resolver_group': 'EOH Email Support iOCO',
                'request_type': 'Request',
                'sla': 'P4',
                'service_description': 'Create or modify distribution lists'
            },
            {
                'bu_number': '753',
                'category': 'Communication',
                'type': 'Telephony',
                'item': 'Phone System',
                'resolver_group': 'EOH Telecom Support iOCO',
                'request_type': 'Incident',
                'sla': 'P2',
                'service_description': 'Issues with office phone systems'
            },
        ]

        for cti_data_item in cti_data:
            cti, created = CTIRecord.objects.get_or_create(
                bu_number=cti_data_item['bu_number'],
                category=cti_data_item['category'],
                type=cti_data_item['type'],
                item=cti_data_item['item'],
                defaults={
                    'resolver_group': cti_data_item['resolver_group'],
                    'request_type': cti_data_item['request_type'],
                    'sla': cti_data_item['sla'],
                    'service_description': cti_data_item.get('service_description', ''),
                    'bu_description': f"Business unit {cti_data_item['bu_number']}",
                    'resolver_group_description': f"Description for {cti_data_item['resolver_group']}"
                },
            )
            if created:
                self.stdout.write(
                    f'Created CTI record: {cti.category} - {cti.type} - {cti.item}'
                )

    def create_training_examples(self):
        """Create initial training examples for better AI classification"""
        training_data = [
            {
                'content': 'Cannot access my Active Directory profile. Getting authentication errors when trying to log into MyHR system.',
                'cti_lookup': {
                    'bu_number': '753',
                    'category': 'Managed Workspace',
                    'type': 'Access Management',
                    'item': 'Profile - AD',
                },
            },
            {
                'content': 'Forgot my password and cannot reset it. Need help accessing my account.',
                'cti_lookup': {
                    'bu_number': '753',
                    'category': 'Managed Workspace',
                    'type': 'Access Management',
                    'item': 'Password Reset',
                },
            },
            {
                'content': 'Need to map a network drive to access shared files. Cannot find the printer folder.',
                'cti_lookup': {
                    'bu_number': '753',
                    'category': 'Managed Workspace',
                    'type': 'Access Management',
                    'item': 'Map Network Drive (File/Print)',
                },
            },
            {
                'content': 'My laptop screen is flickering and sometimes goes black. Hardware issue with the display.',
                'cti_lookup': {
                    'bu_number': '753',
                    'category': 'End User Computing',
                    'type': 'Hardware Support',
                    'item': 'Laptop Issues',
                },
            },
            {
                'content': 'Monitor is not working properly. No display showing up when I connect to laptop.',
                'cti_lookup': {
                    'bu_number': '753',
                    'category': 'End User Computing',
                    'type': 'Hardware Support',
                    'item': 'Monitor Problems',
                },
            },
            {
                'content': 'Microsoft Excel is crashing when I try to open large spreadsheets. Office suite problems.',
                'cti_lookup': {
                    'bu_number': '753',
                    'category': 'Applications',
                    'type': 'Software Support',
                    'item': 'Microsoft Office',
                },
            },
            {
                'content': 'Cannot connect to the internet. Network connectivity issues from my workstation.',
                'cti_lookup': {
                    'bu_number': '753',
                    'category': 'Infrastructure',
                    'type': 'Network',
                    'item': 'Internet Connectivity',
                },
            },
            {
                'content': 'Outlook is not syncing emails properly. Email client issues.',
                'cti_lookup': {
                    'bu_number': '753',
                    'category': 'Communication',
                    'type': 'Email',
                    'item': 'Outlook Issues',
                },
            },
            {
                'content': 'VPN connection keeps dropping. Need help with remote access setup.',
                'cti_lookup': {
                    'bu_number': '753',
                    'category': 'Infrastructure',
                    'type': 'Network',
                    'item': 'VPN Access',
                },
            },
            {
                'content': 'Phone system is down. Cannot make or receive calls from my desk phone.',
                'cti_lookup': {
                    'bu_number': '753',
                    'category': 'Communication',
                    'type': 'Telephony',
                    'item': 'Phone System',
                },
            },
        ]

        for training_item in training_data:
            try:
                cti_record = CTIRecord.objects.get(**training_item['cti_lookup'])
                training_example, created = TrainingExample.objects.get_or_create(
                    ticket_content=training_item['content'],
                    correct_cti=cti_record,
                    defaults={'source': 'initial', 'weight': 1.0},
                )
                if created:
                    self.stdout.write(
                        f'Created training example for: {cti_record.item}'
                    )
            except CTIRecord.DoesNotExist:
                self.stdout.write(
                    f"CTI record not found for: {training_item['cti_lookup']}"
                )
