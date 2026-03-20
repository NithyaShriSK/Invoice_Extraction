#!/bin/bash

# AI-Powered Invoice Management System Setup Script
# This script sets up the entire development environment

echo "🚀 Setting up AI-Powered Invoice Management System..."

# Check if conda is installed
if ! command -v conda &> /dev/null; then
    echo "❌ Conda is not installed. Please install Anaconda or Miniconda first."
    exit 1
fi

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js first."
    exit 1
fi

# Create conda environment
if conda env list | awk '{print $1}' | grep -qx "ocr"; then
    echo "ℹ️  Conda environment 'ocr' already exists; skipping creation"
else
    echo "📦 Creating conda environment 'ocr'..."
    conda create -n ocr python=3.8 -y
fi

# Activate conda environment
echo "🔄 Activating conda environment..."
eval "$(conda shell.bash hook)"
conda activate ocr

# Install Python dependencies
echo "🐍 Installing Python dependencies..."
cd python

# Install pip packages first
echo "📦 Installing pip dependencies..."
pip install --only-binary :all: -r requirements.txt

# Install spacy separately from conda to avoid Cython compilation issues on Windows
echo "📦 Installing spacy from conda..."
conda install -c conda-forge spacy -y

# Download english model for spacy
echo "📥 Downloading spacy English model..."
python -m spacy download en_core_web_sm

cd ..

# Install backend dependencies
echo "📚 Installing backend dependencies..."
cd backend
npm install
if [ -f .env.example ]; then
    cp .env.example .env
    echo "⚠️  Please update backend/.env with your MongoDB URI and email settings"
elif [ -f .env ]; then
    echo "ℹ️  backend/.env already exists; keeping existing configuration"
else
    echo "⚠️  No backend/.env.example found. Create backend/.env manually."
fi
cd ..

# Install frontend dependencies
echo "🎨 Installing frontend dependencies..."
cd frontend
npm install
if [ -f .env.example ]; then
    cp .env.example .env
    echo "⚠️  Please update frontend/.env if needed"
elif [ -f .env ]; then
    echo "ℹ️  frontend/.env already exists; keeping existing configuration"
else
    echo "⚠️  No frontend/.env.example found. Create frontend/.env manually."
fi
cd ..

# Create uploads directory
echo "📁 Creating uploads directory..."
mkdir -p backend/uploads

# Set permissions
echo "🔐 Setting permissions..."
if command -v chmod &> /dev/null; then
    chmod +x python/deep.py
    chmod +x python/llm_correct.py
else
    echo "ℹ️  chmod not available on this shell; skipping execute permission updates"
fi

echo ""
echo "✅ Setup completed successfully!"
echo ""
echo "📋 Next steps:"
echo "1. Update backend/.env with your MongoDB URI and email settings"
echo "2. Update frontend/.env if needed"
echo "3. Start backend in Terminal 1:"
echo "   conda activate ocr"
echo "   cd backend"
echo "   npm run dev"
echo "4. Start frontend in Terminal 2:"
echo "   conda activate ocr"
echo "   cd frontend"
echo "   npm start"
echo "5. Open http://localhost:3000 in your browser"
echo ""
echo "🐳 Docker alternative (recommended for quick start):"
echo "   docker compose up --build"
echo "   Frontend: http://localhost:3001"
echo "   Backend:  http://localhost:5001/api/health"
echo ""
echo "🎉 Your AI-Powered Invoice Management System is ready to use!"
