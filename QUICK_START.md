# 🎯 Quick Start Guide (5 Minutes)

For experienced developers or Docker users.

## Option 1: Quick Local Setup

### Prerequisites
- Python 3.10+, Node.js 16+, MongoDB running locally

### Backend (Terminal 1)
```bash
cd backend
python -m venv venv
# On Windows: venv\Scripts\activate
# On Linux/Mac: source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
python run.py
```

Backend runs on `http://localhost:8000`

### Frontend (Terminal 2)
```bash
cd frontend
npm install
cp .env.example .env.local
npm start
```

Frontend opens at `http://localhost:3000`

### Admin Setup (Terminal 3)
```bash
# Create admin user via MongoDB
mongosh
use invoice_app
db.users.insertOne({
  email: "admin@invoiceocr.com",
  full_name: "Admin",
  password_hash: "$2b$12$...", // Generated via passlib
  is_admin: true,
  is_active: true,
  created_at: new Date(),
  updated_at: new Date()
})
```

**Or use API:**
```bash
# Register via frontend or cURL
curl -X POST http://localhost:8000/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@invoiceocr.com",
    "full_name": "Admin User",
    "password": "admin123456"
  }'

# Then set is_admin in MongoDB
```

### Test
- Open `http://localhost:3000`
- Register → Upload image → View results
- Login as admin → Access `/admin`

---

## Option 2: Docker Setup (Recommended)

Create `docker-compose.yml` in project root:

```yaml
version: '3.8'

services:
  mongodb:
    image: mongo:6.0
    ports:
      - "27017:27017"
    volumes:
      - mongodb_data:/data/db
    environment:
      MONGO_INITDB_DATABASE: invoice_app

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    ports:
      - "8000:8000"
    environment:
      MONGODB_URL: mongodb://mongodb:27017
      DATABASE_NAME: invoice_app
      SECRET_KEY: ${SECRET_KEY:-your-secret-key}
      DEBUG: "True"
      ALLOWED_ORIGINS: http://localhost:3000,http://localhost:5173
    depends_on:
      - mongodb
    volumes:
      - ./backend:/app
      - ./uploads:/app/uploads
      - ./output:/app/output

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    ports:
      - "3000:3000"
    environment:
      REACT_APP_API_URL: http://localhost:8000
    depends_on:
      - backend

volumes:
  mongodb_data:
```

Create `backend/Dockerfile`:
```dockerfile
FROM python:3.10-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

CMD ["python", "run.py"]
```

Create `frontend/Dockerfile`:
```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

EXPOSE 3000
CMD ["npm", "start"]
```

### Run with Docker
```bash
docker-compose up
```

- Backend: `http://localhost:8000`
- Frontend: `http://localhost:3000`
- MongoDB: `localhost:27017`

---

## Environment Variables Quick Reference

### Backend (.env)
```
MONGODB_URL=mongodb://localhost:27017
DATABASE_NAME=invoice_app
SECRET_KEY=change-this-in-production
DEBUG=True
ALLOWED_ORIGINS=http://localhost:3000
```

### Frontend (.env.local)
```
REACT_APP_API_URL=http://localhost:8000
REACT_APP_ENV=development
```

---

## Test File Upload

### Get Test Image
Download any invoice image or use this command to create a test image:
```bash
# Create a simple test image
python -c "
from PIL import Image, ImageDraw
img = Image.new('RGB', (400, 300), color='white')
draw = ImageDraw.Draw(img)
draw.text((50, 50), 'INVOICE NO. 001', fill='black')
draw.text((50, 100), 'Amount: Rs. 1000', fill='black')
img.save('test_invoice.jpg')
"
```

### Login Flow
1. Register user at `/register`
2. Login at `/login`
3. Upload `test_invoice.jpg`
4. Wait for OCR processing (30-60 seconds first run)
5. View results

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Port 8000 in use | Change `PORT=8001 python run.py` |
| Port 3000 in use | Change `PORT=3001 npm start` |
| MongoDB connection error | Ensure `mongod` is running |
| OCR model not loading | First run downloads model (~2GB) |
| CORS error | Check `ALLOWED_ORIGINS` in backend .env |

---

## Next Steps

1. ✅ Application running
2. 📖 Read [API_DOCUMENTATION.md](API_DOCUMENTATION.md)
3. 🔒 Change SECRET_KEY in production
4. 🚀 Deploy to server
5. 📱 Enable mobile features (camera)

---

## Performance Tips

- **First OCR run**: Slow (downloading 2GB model)
- **Subsequent runs**: 30-60 seconds per image
- **GPU enabled**: 10-15 seconds per image
- **Enable browser caching**: Reduce frontend load

---

## Security Checklist

- [ ] Change SECRET_KEY in production
- [ ] Use HTTPS in production
- [ ] Update ALLOWED_ORIGINS
- [ ] Set DEBUG=False
- [ ] Use environment variables for secrets
- [ ] Regular MongoDB backups
- [ ] Rate limiting on endpoints
- [ ] CSRF protection enabled

---

Happy coding! 🚀
