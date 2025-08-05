#!/bin/bash

# Production deployment script

set -e

echo "🚀 Deploying to production..."

# Build frontend
echo "📦 Building frontend..."
cd frontend
npm run build
cd ..

# Collect static files
echo "📦 Collecting static files..."
cd backend
source venv/bin/activate
python manage.py collectstatic --noinput
cd ..

# Run database migrations
echo "🗄️ Running migrations..."
cd backend
python manage.py migrate
cd ..

echo "✅ Deployment complete!"
