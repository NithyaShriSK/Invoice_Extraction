#!/bin/bash

# Complete Setup Script for Invoice OCR Application
# Run this from the project root: bash setup.sh

set -e  # Exit on error

echo "🚀 Invoice OCR - Automated Setup Script"
echo "=========================================="

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

# Check prerequisites
echo -e "\n${YELLOW}Checking prerequisites...${NC}"

# Check Python
if command -v python &> /dev/null; then
    PYTHON_VERSION=$(python --version 2>&1 | awk '{print $2}')
    print_status "Python found: $PYTHON_VERSION"
else
    print_error "Python not found. Please install Python 3.10+"
    exit 1
fi

# Check Node.js
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    print_status "Node.js found: $NODE_VERSION"
else
    print_error "Node.js not found. Please install Node.js 16+"
    exit 1
fi

# Check MongoDB
if command -v mongosh &> /dev/null || command -v mongo &> /dev/null; then
    print_status "MongoDB found"
else
    print_warning "MongoDB not found. Please ensure MongoDB is installed and running"
fi

# Setup Backend
echo -e "\n${YELLOW}Setting up Backend...${NC}"

cd backend

# Create virtual environment
if [ ! -d "venv" ]; then
    print_status "Creating Python virtual environment..."
    python -m venv venv
else
    print_status "Virtual environment already exists"
fi

# Activate virtual environment
if [ -f "venv/bin/activate" ]; then
    source venv/bin/activate
elif [ -f "venv/Scripts/activate" ]; then
    source venv/Scripts/activate
else
    print_error "Could not find activate script"
    exit 1
fi

print_status "Virtual environment activated"

# Install Python dependencies
print_status "Installing Python dependencies..."
pip install --upgrade pip > /dev/null
pip install -r requirements.txt > /dev/null

# Create .env file
if [ ! -f ".env" ]; then
    print_status "Creating .env file..."
    cp .env.example .env
    print_warning "Please update backend/.env with your configuration"
else
    print_status ".env already exists"
fi

# Create uploads and output directories
mkdir -p ../uploads ../output

print_status "Backend setup complete"

# Setup Frontend
echo -e "\n${YELLOW}Setting up Frontend...${NC}"

cd ../frontend

# Create .env.local file
if [ ! -f ".env.local" ]; then
    print_status "Creating .env.local file..."
    cp .env.example .env.local
else
    print_status ".env.local already exists"
fi

# Install npm dependencies
print_status "Installing Node.js dependencies (this may take a few minutes)..."
npm install > /dev/null 2>&1

print_status "Frontend setup complete"

# Return to root
cd ..

# Summary
echo -e "\n${GREEN}=========================================="
echo "✓ Setup Complete!"
echo "=========================================${NC}"

echo -e "\n${YELLOW}Next steps:${NC}"
echo ""
echo "1. ${GREEN}Start MongoDB:${NC}"
echo "   mongod  (or ensure it's running as a service)"
echo ""
echo "2. ${GREEN}Start Backend (Terminal 1):${NC}"
echo "   cd backend"
echo "   source venv/bin/activate  # or venv\\Scripts\\activate on Windows"
echo "   python run.py"
echo ""
echo "3. ${GREEN}Start Frontend (Terminal 2):${NC}"
echo "   cd frontend"
echo "   npm start"
echo ""
echo "4. ${GREEN}Open in browser:${NC}"
echo "   http://localhost:3000"
echo ""
echo "5. ${GREEN}Test the application:${NC}"
echo "   - Register a new account"
echo "   - Upload an invoice image"
echo "   - View OCR results"
echo ""
echo -e "${YELLOW}For detailed instructions, see SETUP_INSTRUCTIONS.md${NC}"
echo ""
