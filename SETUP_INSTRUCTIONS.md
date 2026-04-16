# 🚀 Complete Setup Instructions

Step-by-step guide to set up and run the Invoice OCR application.

## Prerequisites

Ensure you have installed:
- **Python 3.10+**: [Download](https://www.python.org/downloads/)
- **Node.js 16+**: [Download](https://nodejs.org/)
- **MongoDB 5.0+**: [Download](https://www.mongodb.com/try/download/community)
- **Ollama**: [Download](https://ollama.ai/) (for LLM)
- **Git**: [Download](https://git-scm.com/)

### Verify Installations
```bash
python --version
node --version
npm --version
mongod --version
```

---

## Part 1: Backend Setup

### Step 1: Navigate to Backend Directory
```bash
cd backend
```

### Step 2: Create Python Virtual Environment
```bash
# Windows
python -m venv venv
venv\Scripts\activate

# Linux/Mac
python3 -m venv venv
source venv/bin/activate
```

### Step 3: Install Python Dependencies
```bash
pip install -r requirements.txt
```

### Step 4: Create .env File
Copy `.env.example` to `.env` and update values:

```bash
cp .env.example .env
```

Edit `backend/.env`:
```
# MongoDB Configuration
MONGODB_URL=mongodb://localhost:27017
DATABASE_NAME=invoice_app

# JWT Configuration
SECRET_KEY=your-super-secret-key-change-this-in-production
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30

# FastAPI Configuration
API_TITLE=Invoice OCR API
API_VERSION=1.0.0
DEBUG=True

# CORS Configuration
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173

# File Upload Configuration
MAX_FILE_SIZE=10485760
UPLOAD_FOLDER=./uploads
OUTPUT_FOLDER=./output

# Admin Config (create first admin)
ADMIN_EMAIL=admin@invoiceocr.com
ADMIN_PASSWORD=admin123
```

### Step 5: Set Up Database

Ensure MongoDB is running:
```bash
# Windows
# MongoDB should be running as a service. Check in Services

# Linux/Mac
brew services start mongodb-community

# Or manually start
mongod
```

### Step 6: Start Backend Server
```bash
python run.py
```

Expected output:
```
INFO:     Uvicorn running on http://0.0.0.0:8000
✓ Application startup complete
✓ Collections initialized
```

Visit `http://localhost:8000/docs` to see API documentation.

---

## Part 2: Frontend Setup

Open a **new terminal** and navigate to frontend:

### Step 1: Navigate to Frontend Directory
```bash
cd frontend
```

### Step 2: Create .env.local File
```bash
cp .env.example .env.local
```

Edit `frontend/.env.local`:
```
REACT_APP_API_URL=http://localhost:8000
REACT_APP_ENV=development
```

### Step 3: Install Node Dependencies
```bash
npm install
```

### Step 4: Start React Development Server
```bash
npm start
```

The app will open at `http://localhost:3000`

---

## Part 3: OCR Environment Setup

Ensure your OCR conda environment is active and has all dependencies:

### Step 1: Activate OCR Environment
```bash
conda activate ocr
```

### Step 2: Verify Required Packages
```bash
# Check if DeepSeek OCR is installed
python -c "from transformers import AutoModel; print('✓ transformers installed')"

# Check if Ollama is installed
ollama --version
```

### Step 3: Pull Ollama Model
```bash
ollama pull qwen2.5:7b
```

---

## Part 4: Create Admin User

After starting the backend, create the first admin user:

### Option 1: Using API (via Postman or cURL)

```bash
curl -X POST "http://localhost:8000/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@invoiceocr.com",
    "full_name": "Admin User",
    "password": "admin123"
  }'
```

Then use MongoDB command to set is_admin to true:

```bash
mongosh  # or mongo for older versions

# In MongoDB shell
use invoice_app
db.users.updateOne(
  { email: "admin@invoiceocr.com" },
  { $set: { is_admin: true } }
)
```

---

## Part 5: Verify Everything Works

### 1. Check Backend Health
```bash
curl http://localhost:8000/health
```

Expected response:
```json
{"status": "healthy", "database": "connected"}
```

### 2. Check Frontend
Open `http://localhost:3000` in browser

### 3. Test Registration
- Click "Register"
- Create a test user account
- Verify email and password validation

### 4. Test File Upload
- Login
- Click "Upload File"
- Select an invoice image
- Wait for OCR processing
- View results

### 5. Test Admin Dashboard
- Login with admin account
- Click "Admin" in navbar
- View dashboard stats

---

## 🐛 Troubleshooting

### Backend Issues

**Port 8000 already in use**
```bash
# Find process using port 8000
# Windows
netstat -ano | findstr :8000

# Linux/Mac
lsof -i :8000

# Kill process
# Windows
taskkill /PID <PID> /F

# Linux/Mac
kill -9 <PID>
```

**MongoDB Connection Error**
```bash
# Ensure MongoDB is running
mongosh

# If not running, start it
mongod
```

**OCR Model Loading Error**
```bash
# Ensure you're in the ocr conda environment
conda activate ocr

# Try loading the model manually
python -c "from transformers import AutoModel; AutoModel.from_pretrained('deepseek-ai/DeepSeek-OCR-2', trust_remote_code=True)"
```

### Frontend Issues

**CORS Error**
- Ensure backend is running on port 8000
- Check ALLOWED_ORIGINS in backend/.env includes http://localhost:3000

**Cannot find module**
```bash
# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
```

**Port 3000 already in use**
```bash
# Use different port
PORT=3001 npm start
```

---

## 📊 Database Reset

To reset the database and start fresh:

```bash
# Connect to MongoDB
mongosh

# In MongoDB shell
use invoice_app
db.dropDatabase()

# Exit
exit
```

Then restart the backend server to recreate collections.

---

## 🔒 Production Deployment

### Before Going Live:

1. **Change SECRET_KEY**
   ```
   Generate random key: python -c "import secrets; print(secrets.token_urlsafe(32))"
   ```

2. **Update Environment**
   ```
   DEBUG=False
   ALLOWED_ORIGINS=https://yourdomain.com
   ```

3. **Use Production Database**
   ```
   MONGODB_URL=mongodb+srv://user:pass@cluster.mongodb.net/invoice_app
   ```

4. **Enable HTTPS**
   - Get SSL certificate
   - Configure with Nginx/Apache

5. **Deploy Backend**
   ```bash
   # Using Gunicorn + Nginx
   gunicorn -w 4 -k uvicorn.workers.UvicornWorker app.main:app
   ```

6. **Deploy Frontend**
   ```bash
   npm run build
   # Serve build folder via Nginx/Apache
   ```

---

## 📞 Support

### Common Questions

**Q: My OCR returns empty results**
A: Ensure image quality is good and lighting is proper. Try preprocessing with deep.py directly.

**Q: LLM correction is slow**
A: First run downloads model. Subsequent runs are faster. GPU acceleration helps.

**Q: Can I use different OCR model?**
A: Modify OCRService in `backend/app/services/ocr_service.py`

**Q: How do I backup my data?**
```bash
# Backup MongoDB
mongodump --db invoice_app --out ./backups/

# Restore MongoDB
mongorestore --db invoice_app ./backups/invoice_app/
```

---

## ✅ Checklist

- [ ] Python 3.10+ installed
- [ ] MongoDB running
- [ ] Node.js 16+ installed
- [ ] Python virtual environment created
- [ ] Backend dependencies installed
- [ ] Backend .env file created
- [ ] Frontend .env.local file created
- [ ] Frontend dependencies installed
- [ ] Backend server running on port 8000
- [ ] Frontend server running on port 3000
- [ ] Admin user created
- [ ] All health checks passing
- [ ] Test upload successful

---

## 🎉 You're All Set!

Your Invoice OCR application is ready to use!

**Quick Start:**
1. Terminal 1: `cd backend && python run.py`
2. Terminal 2: `cd frontend && npm start`
3. Open `http://localhost:3000`
4. Register/Login
5. Upload an invoice image
6. View OCR results
