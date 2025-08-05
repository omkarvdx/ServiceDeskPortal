# Automated Ticket Classification System

A comprehensive proof-of-concept for an AI-powered service desk that automatically classifies support tickets using OpenAI's embeddings and language models.

## 🎯 Features

- **Dual User Roles**: End users submit tickets, support engineers manage and correct classifications
- **AI-Powered Classification**: 5-step pipeline using OpenAI embeddings and GPT-4o
- **Continuous Learning**: Corrections feed back into the training system
- **Professional UI**: ManageEngine ServiceDesk-inspired interface
- **Real-time Updates**: Tickets are classified immediately upon creation
- **BU Awareness**: Business Unit numbers are included in predictions and training examples
- **Contextual Fields**: Request type, SLA and service description are factored into predictions and training

## 🎯 New Features: Advanced Ticket Queue

### Support Engineer Queue View

The ticket queue provides support engineers with a powerful interface for managing tickets:

**Key Features:**
- **Advanced Filtering**: Filter by status, assignment, classification, age, priority, and category
- **Bulk Operations**: Assign, change status, or classify multiple tickets at once
- **Auto-Assignment**: Automatically distribute unassigned tickets among available engineers
- **Priority Indicators**: Visual indicators for tickets needing immediate attention
- **Real-time Stats**: Live dashboard showing queue metrics and performance
- **Smart Sorting**: Sort by age, confidence, status, or custom criteria

**Queue Views:**
- **All Tickets**: Complete ticket overview
- **Open & Unassigned**: Tickets waiting for assignment
- **My Assigned**: Tickets assigned to current user
- **Needs Review**: Unclassified or low-confidence tickets
- **High Priority**: Urgent tickets requiring immediate attention

**Bulk Actions:**
- **Bulk Assignment**: Assign multiple tickets to support engineers
- **Status Updates**: Change status of multiple tickets simultaneously
- **Bulk Classification**: Apply same CTI classification to multiple tickets
- **Auto-Assignment**: Smart distribution based on current workloads

**Performance Features:**
- **Database Indexing**: Optimized queries for fast queue loading
- **Smart Pagination**: Efficient handling of large ticket volumes
- **Real-time Updates**: Live statistics and queue status
- **Export Options**: Download queue data for reporting

### Usage Examples

```bash
# Access queue as support engineer
1. Login with support1 / support123
2. Click "Ticket Queue" tab
3. Use filters to find relevant tickets
4. Select multiple tickets for bulk actions
5. Use auto-assign for optimal distribution
```

## 🎯 New Features: Admin CTI Master Data Management

### Comprehensive CTI Administration

The admin CTI management module provides complete control over Configuration and Taxonomy Information:

**Key Features:**
- **Full CRUD Operations**: Create, read, update, delete CTI records
- **Advanced Filtering**: Filter by category, type, resolver group, embeddings, usage
- **Smart Search**: Search across all CTI fields
- **Pagination**: Handle large datasets efficiently
- **Bulk Operations**: Mass updates, embedding regeneration, bulk delete
- **CSV Import/Export**: Import from spreadsheets, export for reporting
- **Auto-Embedding**: Automatic AI embedding generation on create/update

**Admin Capabilities:**

### 🔧 **CTI Record Management**
- **Create New Records**: Add CTI records with automatic embedding generation
- **Edit Existing**: Update any field with automatic embedding refresh
- **Validation**: Ensure data integrity with required field validation
- **Duplicate Detection**: Prevent duplicate CTI combinations

### 📊 **Advanced Filtering & Search**
- **Multi-Filter Support**: Category, Type, Resolver Group, SLA, Request Type
- **Embedding Status**: Filter by records with/without embeddings
- **Usage Analytics**: Filter by used/unused records in ticket classification
- **Smart Search**: Full-text search across all CTI fields
- **Custom Sorting**: Sort by any column, creation date, usage

### ⚡ **Bulk Operations**
- **Bulk Embedding Regeneration**: Update AI embeddings for multiple records
- **Bulk Field Updates**: Update resolver groups, SLAs, request types in bulk
- **Bulk Delete**: Remove unused records (with safety checks)
- **Smart Selection**: Select all, select by criteria, individual selection

### 📁 **Import/Export**
- **CSV Import**: Bulk import with template download
- **Data Validation**: Validate imported data with error reporting
- **Duplicate Handling**: Update existing or create new records
- **CSV Export**: Export filtered data for reporting
- **Template Download**: Pre-formatted CSV template

### 🤖 **AI Integration**
- **Auto-Embedding**: Generate embeddings automatically on save
- **Embedding Status**: Visual indicators for embedding presence
- **Regeneration**: Force regenerate embeddings for better accuracy
- **Performance Tracking**: Monitor embedding coverage and usage

## 📈 **Usage Examples**

### **Admin Workflow:**
```bash
1. Login as support engineer (support1 / support123)
2. Navigate to "CTI Management" tab
3. Use filters to find specific records
4. Edit records with automatic embedding generation
5. Bulk import new records via CSV
6. Monitor usage statistics and embedding coverage
```

### **CSV Import Format:**
```csv
bu_number,bu_description,category,type,item,resolver_group,resolver_group_description,request_type,sla,service_description
753,"BU 753","Managed Workspace","Access Management","Password Reset","EOH Remote Support iOCO","Remote support team","Incident","P3","Password reset assistance"
753,"BU 753","End User Computing","Hardware Support","Laptop Issues","EOH Hardware Support iOCO","Hardware team","Incident","P3","Physical laptop problems"
```

### **API Endpoints:**
```javascript
// Admin CTI Management
GET /api/admin/cti/ - List CTI records with filtering
POST /api/admin/cti/ - Create new CTI record
PUT /api/admin/cti/{id}/ - Update CTI record
DELETE /api/admin/cti/{id}/ - Delete CTI record
POST /api/admin/cti/{id}/regenerate-embedding/ - Regenerate embedding
POST /api/admin/cti/bulk-actions/ - Bulk operations
POST /api/admin/cti/import-csv/ - CSV import
GET /api/admin/cti/export-csv/ - CSV export
```

### **Performance Features:**
- **Database Indexing**: Optimized queries for fast filtering and sorting
- **Pagination**: Efficient handling of large CTI datasets
- **Caching**: Smart caching for filter options and statistics
- **Background Processing**: Embedding generation doesn't block UI

### **Data Integrity:**
- **Validation**: Required field validation and format checking
- **Duplicate Prevention**: Unique constraints on CTI combinations
- **Referential Integrity**: Prevent deletion of records in use by tickets
- **Audit Trail**: Track creation, updates, and usage statistics

## 🛠️ **Database Migrations**

Run these commands to set up the admin features:

```bash
# Apply new indexes for performance
python manage.py migrate

# Regenerate all embeddings (one-time setup)
python manage.py shell
>>> from tickets.ai_service import classification_service
>>> classification_service.precompute_cti_embeddings()
```

The admin CTI management system provides everything needed to maintain master data professionally while ensuring optimal AI classification performance through automatic embedding management.

## 🏗️ Architecture

### Backend (Django + PostgreSQL)
- **Models**: User, Ticket, CTIRecord, ClassificationCorrection, TrainingExample
- **AI Service**: Complete classification pipeline with embedding pre-filter and LLM ranking
- **REST API**: Authentication, ticket management, CTI records, admin endpoints

### Frontend (React + Tailwind CSS)
- **Components**: Login, Dashboard, Ticket List/Detail, CTI Selector
- **Services**: API client with error handling and authentication
- **Responsive Design**: Professional, modern interface

### AI Classification Pipeline
1. **Taxonomy Manifest**: Structured CTI records with embeddings
2. **Embedding Pre-filter**: Find top 5-10 similar records using cosine similarity
3. **LLM Ranking**: GPT-4o selects best match with few-shot examples
4. **Auto-fill**: Populate all fields from selected CTI record
5. **Continuous Learning**: Store corrections for model improvement

## 🚀 Getting Started

Follow the steps below to run the application locally.

### Prerequisites
- Python 3.8+
- Node.js 16+
- PostgreSQL 12+
- OpenAI API Key

### 1. Clone the repository

```bash
git clone <repository-url>
cd automated-ticket-classification
```

### 2. Create your environment file

```bash
cp .env.example .env
# edit .env and add your OPENAI_API_KEY and database credentials
```

### 3. Choose a setup method

#### Option A – Docker (recommended)

```bash
docker-compose up -d
```

Once the containers are running, visit:

- Frontend: http://localhost:3000
- Backend API: http://localhost:8000/api
- Admin: http://localhost:8000/admin

#### Option B – Manual setup

**Backend**
```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows use "venv\Scripts\activate"
pip install -r requirements.txt
cp ../.env.example .env
# edit .env with your settings
createdb ticket_classification_db
python manage.py migrate
python manage.py populate_sample_data
python manage.py shell -c "from tickets.ai_service import classification_service; classification_service.precompute_cti_embeddings()"
python manage.py runserver
```

**Frontend**
```bash
cd frontend
npm install
npm start
```

After either setup method is running, open the URLs listed above to access the
application.

## 👤 Demo Accounts

| Role | Username | Password | Description |
|------|----------|----------|-------------|
| End User | `user1` | `user123` | Can create and view own tickets |
| Support Engineer | `support1` | `support123` | Can view all tickets and make corrections |
| Admin | `admin` | `admin123` | Full system access |

## 🔧 Configuration

### Environment Variables

```env
# Required
OPENAI_API_KEY=your_openai_api_key_here

# Database
DB_NAME=ticket_classification_db
DB_USER=postgres
DB_PASSWORD=password
DB_HOST=localhost
DB_PORT=5432

# Django
SECRET_KEY=your_secret_key_here
DEBUG=True
ALLOWED_HOSTS=localhost,127.0.0.1
```

### AI Model Configuration

Edit `backend/tickets/ai_service.py`:

```python
class TicketClassificationService:
    def __init__(self):
        self.embedding_model = "text-embedding-3-large"  # or text-embedding-3-small
        self.llm_model = "gpt-4o"                        # or gpt-4o-mini
        self.similarity_threshold = 0.2                  # Adjust as needed
```

## 📊 Testing the System

### Sample Tickets for Testing

Try creating tickets with these descriptions:

1. **Password Reset**: "Cannot login to my account, forgot password and reset link not working"
2. **Hardware Issue**: "Laptop screen flickering and sometimes goes black"
3. **Software Problem**: "Excel crashes when opening large spreadsheets"
4. **Network Issue**: "Cannot connect to internet from workstation"
5. **Email Problem**: "Outlook not syncing emails properly"

### Running Unit Tests

Run the backend tests to verify your environment:

```bash
cd backend
python manage.py test
```

### Monitoring Classification Accuracy

```sql
-- View classification statistics
SELECT 
    COUNT(*) as total_tickets,
    COUNT(predicted_cti_id) as classified_tickets,
    COUNT(corrected_cti_id) as corrected_tickets,
    ROUND(AVG(prediction_confidence), 3) as avg_confidence
FROM tickets_ticket;

-- View most common corrections
SELECT 
    pc.category as predicted_category,
    cc.category as corrected_category,
    COUNT(*) as correction_count
FROM tickets_classificationcorrection cor
JOIN tickets_ctirecord pc ON cor.original_prediction_id = pc.id
JOIN tickets_ctirecord cc ON cor.corrected_to_id = cc.id
GROUP BY pc.category, cc.category
ORDER BY correction_count DESC;
```

## 🛠️ Development

### Project Structure
```
automated-ticket-classification/
├── backend/                 # Django backend
│   ├── myproject/          # Django project settings
│   ├── tickets/            # Main application
│   │   ├── models.py       # Database models
│   │   ├── views.py        # API endpoints
│   │   ├── ai_service.py   # AI classification logic
│   │   └── management/     # Custom commands
│   └── requirements.txt    # Python dependencies
├── frontend/               # React frontend
│   ├── src/
│   │   ├── components/     # React components
│   │   ├── services/       # API client
│   │   └── utils/          # Constants and utilities
│   └── package.json        # Node dependencies
├── docker-compose.yml      # Docker configuration
└── README.md              # This file
```

### API Endpoints

#### Authentication
- `POST /api/auth/login/` - User login
- `POST /api/auth/logout/` - User logout
- `GET /api/auth/user/` - Get current user

#### Tickets
- `GET /api/tickets/` - List tickets
- `POST /api/tickets/create/` - Create ticket (triggers AI classification)
- `GET /api/tickets/{id}/` - Get ticket details
- `PATCH /api/tickets/{id}/` - Update ticket (supports corrections)

#### CTI Records
- `GET /api/cti-records/` - List CTI records (support engineers only)

#### Admin
- `POST /api/admin/precompute-embeddings/` - Trigger embedding computation
- `GET /api/admin/stats/` - Get classification statistics

#### Queue endpoints
GET /api/queue/ - Get filtered ticket queue
GET /api/queue/stats/ - Get queue statistics  
GET /api/queue/filters/ - Get available filter options
POST /api/queue/bulk-update/ - Perform bulk operations
POST /api/queue/auto-assign/ - Auto-assign tickets

### Queue Statistics

The queue provides real-time metrics:
- **Total Tickets**: All tickets in system
- **Open Tickets**: Currently open tickets
- **Unassigned**: Tickets without assignment
- **Needs Attention**: High-priority tickets
- **My Assigned**: User's assigned tickets
- **Average Age**: Average ticket age in hours
- **AI Accuracy**: Classification accuracy percentage

### Adding Custom CTI Records

```python
# Via Django shell
python manage.py shell

from tickets.models import CTIRecord

CTIRecord.objects.create(
    bu_number='753',
    category='Custom Category',
    type='Custom Type', 
    item='Custom Item',
    resolver_group='Custom Resolver Group',
    request_type='Request',
    sla='P3'
)
```

## 📈 Continuous Learning

The system implements continuous learning in two ways:

1. **Structured Data**: Corrections stored in `TrainingExample` model with higher weights
2. **Document Files**: Monthly JSONL files in `backend/media/learning_data/`

### Learning Data Format

```json
{
  "timestamp": "2024-01-15T10:30:00",
  "ticket_id": "TKT-000001",
  "ticket_content": "Cannot access email...",
  "original_prediction": {
    "id": 15,
    "category": "Infrastructure",
    "type": "Network"
  },
  "corrected_to": {
    "id": 8,
    "category": "Communication",
    "type": "Email"
  },
  "corrected_by": "support1",
  "confidence_before": 0.75
}
```

## 🤖 OpenAI API Call Scenarios and Prompts

### 1. Embedding Generation
Triggered when:
- Creating new CTI records (automatic embedding generation)
- Precomputing embeddings for existing CTI records
- Regenerating embeddings manually
- Few-shot example-based embedding generation

API Call:
```python
openai.embeddings.create(
    model="text-embedding-3-large",
    input=text
)
```

Input Text Format:
```python
# For CTI records:
cti_text = f"{cti.bu_number} {cti.category} {cti.type} {cti.item} {cti.request_type} {cti.sla} {cti.service_description} {cti.bu_description} {cti.resolver_group_description}"
```

### 2. Ticket Classification (Main LLM Call)
Triggered when:
- New ticket is created and needs automatic classification
- Manual reclassification is requested

API Call:
```python
openai.chat.completions.create(
    model="gpt-4o",
    messages=[
        {"role": "system", "content": "You are an expert IT service desk classifier. Always respond with valid JSON only."},
        {"role": "user", "content": prompt}
    ],
    temperature=0.1,
    max_tokens=500
)
```

Full Prompt Structure:
```python
prompt = f"""You are an expert IT service desk classifier. Your task is to classify a support ticket into the most appropriate category from the given candidates.

Here are some examples of correct classifications:

{few_shot_examples}

Now classify this ticket:
TICKET: {ticket_text}

CANDIDATE CATEGORIES:
{candidates_text}

Analyze the ticket content and select the MOST APPROPRIATE category ID. Consider:
1. The specific technical issue described
2. The type of request (incident vs request)
3. The service area involved
4. The appropriate resolver group
5. The business unit (BU) associated with the category
6. The SLA priority and service description

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
```

Few-Shot Examples Format:
```python
few_shot_text = f"""
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
```

Candidate Categories Format:
```python
candidates_text = f"""
ID: {cti.id}
BU: {cti.bu_number}
Category: {cti.category}
Type: {cti.type}
Item: {cti.item}
Resolver Group: {cti.resolver_group}
Resolver Group Description: {cti.resolver_group_description}
Request Type: {cti.request_type}
SLA: {cti.sla}
Service Description: {cti.service_description}
BU Description: {cti.bu_description}
Similarity Score: {similarity:.3f}
"""
```

### Complete Classification Pipeline
**Step 1: Embedding-based Pre-filtering**
1. Generate embedding for incoming ticket text
2. Compare with pre-computed CTI embeddings using cosine similarity
3. Filter candidates with similarity above threshold (0.2)
4. Return top 8 most similar CTI records

**Step 2: LLM-based Final Classification**
1. Use the filtered candidates from Step 1
2. Include few-shot examples from training data
3. Send comprehensive prompt to GPT-4o
4. Receive JSON response with classification decision

**Step 3: Learning and Feedback**
When corrections are made:
- Store correction in ClassificationCorrection model
- Add to training examples with higher weight (1.5x)
- Append to learning file for future model improvements
- Update few-shot examples for improved future classifications

**Key Prompt Engineering Features**
- Structured JSON Output: Enforced through system prompt and explicit format requirements
- Few-Shot Learning: Uses real examples from training data for context
- Multi-factor Analysis: Guides the model to consider technical issues, request types, service areas, etc.
- Confidence Scoring: Requires the model to assess its own confidence
- Fallback Handling: Explicit instructions for when no suitable match exists
- Temperature Control: Low temperature (0.1) for consistent, deterministic responses

This system uses a hybrid approach combining semantic similarity (embeddings) for efficiency with contextual understanding (LLM) for accuracy, making it both fast and reliable for automated ticket routing.

## 🚀 Deployment

### Production Environment

1. **Update Settings**:
   ```python
   DEBUG = False
   ALLOWED_HOSTS = ['your-domain.com']
   DATABASES = {
       'default': {
           'ENGINE': 'django.db.backends.postgresql',
           'HOST': 'your-db-host',
           # ... other production settings
       }
   }
   ```

2. **Static Files**:
   ```bash
   python manage.py collectstatic
   ```

3. **Frontend Build**:
   ```bash
   cd frontend
   npm run build
   ```

4. **Web Server**: Configure nginx/Apache to serve static files and proxy API requests

### Scaling Considerations

- **Caching**: Add Redis for embedding caching
- **Background Tasks**: Use Celery for AI processing
- **Database**: Connection pooling for high traffic
- **File Storage**: S3 for learning data files

## 📝 Release Notes

- Admin users can now access ticket queue endpoints previously limited to support engineers.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- OpenAI for embeddings and language model APIs
- ManageEngine for UI/UX inspiration
- Django and React communities for excellent frameworks

## 📞 Support

For questions or issues:
1. Check the troubleshooting section in the setup documentation
2. Review Django and React logs for error details
3. Ensure OpenAI API key has sufficient credits
4. Test with provided sample data first

---

**Note**: This is a proof-of-concept system demonstrating automated ticket classification with continuous learning. For production use, consider additional security, monitoring, and performance optimizations.
