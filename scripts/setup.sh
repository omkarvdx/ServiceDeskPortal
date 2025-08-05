#!/bin/bash

# Automated Ticket Classification Setup Script

set -e

echo "🚀 Setting up Automated Ticket Classification System..."

# Check prerequisites
check_prerequisites() {
    echo "📋 Checking prerequisites..."
    
    if ! command -v python3 &> /dev/null; then
        echo "❌ Python 3 is required but not installed"
        exit 1
    fi
    
    if ! command -v node &> /dev/null; then
        echo "❌ Node.js is required but not installed"
        exit 1
    fi
    
    if ! command -v psql &> /dev/null; then
        echo "❌ PostgreSQL is required but not installed"
        exit 1
    fi
    
    echo "✅ Prerequisites check passed"
}

# Setup backend
setup_backend() {
    echo "🔧 Setting up backend..."
    
    cd backend
    
    # Create virtual environment
    python3 -m venv venv
    source venv/bin/activate
    
    # Install dependencies
    pip install -r requirements.txt
    
    # Setup environment file
    if [ ! -f .env ]; then
        cp ../.env.example .env
        echo "⚠️  Please edit backend/.env with your configuration"
    fi
    
    # Create database
    createdb ticket_classification_db 2>/dev/null || echo "Database already exists"
    
    # Run migrations
    python manage.py migrate
    
    # Populate sample data
    python manage.py populate_sample_data
    
    echo "✅ Backend setup complete"
    cd ..
}

# Setup frontend
setup_frontend() {
    echo "🔧 Setting up frontend..."
    
    cd frontend
    
    # Install dependencies
    npm install
    
    echo "✅ Frontend setup complete"
    cd ..
}

# Main setup
main() {
    check_prerequisites
    setup_backend
    setup_frontend
    
    echo ""
    echo "🎉 Setup complete!"
    echo ""
    echo "Next steps:"
    echo "1. Edit backend/.env with your OpenAI API key"
    echo "2. Start backend: cd backend && source venv/bin/activate && python manage.py runserver"
    echo "3. Start frontend: cd frontend && npm start"
    echo "4. Visit http://localhost:3000"
    echo ""
    echo "Demo accounts:"
    echo "- End User: user1 / user123"
    echo "- Support: support1 / support123"
    echo "- Admin: admin / admin123"
}

main "$@"
