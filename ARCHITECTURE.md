# 📄 Project Architecture & Design

Complete technical documentation for Invoice OCR system architecture.

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Frontend (React)                         │
│   ┌────────────────────────────────────────────────────────┐   │
│   │  User Dashboard  │  Admin Dashboard  │  Auth Pages      │   │
│   │  - Upload        │  - Stats          │  - Login         │   │
│   │  - Camera        │  - Users          │  - Register      │   │
│   │  - Results       │  - Uploads        │                  │   │
│   │  - Download      │  - Results        │                  │   │
│   │  - Edit          │  - Search         │                  │   │
│   └────────────────────────────────────────────────────────┘   │
│                            ↓ (Axios)                             │
│                    REST API (JSON)                               │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                      Backend (FastAPI)                           │
│   ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│   │ Auth Routes  │  │ Upload Routes│  │ Results      │         │
│   │              │  │              │  │ Routes       │         │
│   │ - Register   │  │ - POST file  │  │              │         │
│   │ - Login      │  │ - POST cam   │  │ - GET all    │         │
│   │ - Get user   │  │ - GET history│  │ - GET one    │         │
│   └──────────────┘  └──────────────┘  │ - PUT text   │         │
│                                       └──────────────┘         │
│   ┌──────────────────────────────────────────────────┐         │
│   │ Admin Routes                                     │         │
│   │ - GET stats, users, uploads, results            │         │
│   │ - DELETE result                                 │         │
│   │ - PUT toggle admin                              │         │
│   └──────────────────────────────────────────────────┘         │
│                                                                 │
│   ┌──────────────────────────────────────────────────┐         │
│   │ OCR Service                                      │         │
│   │ Pipeline: File → deep.py → llm_correct.py →    │         │
│   │ JSON extraction                                  │         │
│   └──────────────────────────────────────────────────┘         │
└─────────────────────────────────────────────────────────────────┘
      ↓                  ↓                  ↓
  ┌────────────┐   ┌─────────────┐   ┌──────────────┐
  │  MongoDB   │   │ Ollama LLM  │   │ DeepSeek OCR │
  │            │   │             │   │              │
  │ - Users    │   │ qwen2.5:7b  │   │ ocr-2        │
  │ - Uploads  │   │             │   │              │
  │ - Results  │   │ Correction  │   │ Text Extract │
  └────────────┘   └─────────────┘   └──────────────┘
```

## Data Flow

### User Upload Flow
```
User uploads image
      ↓
Frontend sends to backend (/upload/file)
      ↓
Backend saves file to disk
      ↓
Create Upload record in MongoDB
      ↓
Call OCRService.process_full_pipeline()
      ├─→ preprocess_image()
      ├─→ deep.py → extract OCR text
      ├─→ llm_correct.py → correct text
      └─→ extract_json() → structure data
      ↓
Create Result record in MongoDB
      ↓
Return result to frontend
      ↓
Display OCR + Corrected text + JSON
```

### Admin Dashboard Flow
```
Admin accesses /admin
      ↓
Frontend requests /admin/dashboard/stats
      ↓
Backend queries MongoDB:
  - users.count()
  - uploads.count()
  - results.count()
  - recent uploads/results
      ↓
Return aggregated data
      ↓
Display dashboard with stats
      ↓
Admin searches: /admin/search?query=...
      ↓
Backend regex search in MongoDB
      ↓
Display results in table
```

## Component Hierarchy

### Frontend Components
```
App
├── AuthProvider (Context)
├── Router
│   ├── LoginPage
│   │   └── Form (email, password)
│   ├── RegisterPage
│   │   └── Form (email, name, password)
│   ├── DashboardPage (Protected Route)
│   │   ├── Tabs
│   │   ├── FileUpload
│   │   │   └── Dropzone
│   │   ├── CameraCapture
│   │   │   └── Video element
│   │   └── ResultDisplay
│   │       ├── OCR Text panel
│   │       ├── Corrected Text panel
│   │       │   └── Edit mode
│   │       ├── JSON Data panel
│   │       └── Download button
│   └── AdminPage (Protected + Admin Only)
│       ├── AdminDashboard
│       │   ├── Stat Cards
│       │   └── Recent Uploads Table
│       └── ManageUsers
│           └── Users Table
└── Navbar
    └── Logout button
```

### Backend Routes Structure
```
FastAPI App
├── @app.on_event("startup")
│   └── Database initialization
├── /docs (Swagger UI)
├── /health
└── Routers
    ├── /auth (auth.py)
    │   ├── /register (POST)
    │   ├── /login (POST)
    │   └── /me (GET)
    ├── /upload (upload.py)
    │   ├── /file (POST)
    │   ├── /camera (POST)
    │   └── /history (GET)
    ├── /results (results.py)
    │   ├── / (GET all)
    │   ├── /{id} (GET one)
    │   ├── /{id}/corrected-text (PUT)
    │   └── /{id}/download (GET)
    └── /admin (admin.py)
        ├── /dashboard/stats (GET)
        ├── /users (GET)
        ├── /uploads (GET)
        ├── /results (GET)
        ├── /search (GET)
        ├── /results/{id} (DELETE)
        └── /users/{id}/toggle-admin (PUT)
```

## Database Schema Relationships

```
users (1) ──────────────→ (Many) uploads
 id                              user_id
                                    ↓
                            (1) upload ──────→ (1) result
                                 id          upload_id
```

## Authentication Flow

```
POST /auth/register or /auth/login
      ↓
Validate email/password
      ↓
Hash password (bcrypt)
      ↓
Store in MongoDB
      ↓
Generate JWT token
      ├─ Payload: {user_id, email}
      ├─ Secret: SECRET_KEY
      └─ Algorithm: HS256
      ↓
Return token + user info
      ↓
Frontend stores token in localStorage
      ↓
Subsequent requests include:
Authorization: Bearer <token>
      ↓
Backend decodes token
      ├─ Verify signature
      ├─ Check expiration
      └─ Extract user_id
      ↓
Grant access if valid
```

## Security Layers

```
Frontend
├── Stored JWT in localStorage
├── Token sent in every API request
└── Protected routes

Backend
├── Token validation middleware
├── Role-based access (admin/user)
├── Input validation (Pydantic)
├── Password hashing (bcrypt)
├── CORS protection
└── Environment variables for secrets
```

## Performance Considerations

### OCR Processing
- **First run**: ~2 minutes (model download + processing)
- **Subsequent runs**: ~30-60 seconds per image
- **With GPU**: ~10-15 seconds per image
- **Recommended**: Use GPU for production

### Frontend
- **Bundle size**: ~200KB gzipped
- **Lazy loading**: Components load on demand
- **Caching**: Browser cache API responses
- **Optimization**: React.memo for components

### Backend
- **Database indexes**: emails, user_id, created_at
- **Pagination**: Limit 20 results per page
- **Caching**: Could implement Redis for session data
- **Async**: FastAPI handles concurrent requests

### Database
- **Collections**: 3 (users, uploads, results)
- **Indexes**: 3 (email unique, user_id, created_at)
- **Growth**: ~1KB per result record

## Error Handling

```
Frontend
├── Try-catch blocks
├── Display error alerts
└── Graceful fallbacks

Backend
├── HTTP status codes
│   ├─ 200: Success
│   ├─ 400: Bad request
│   ├─ 401: Unauthorized
│   ├─ 403: Forbidden
│   ├─ 404: Not found
│   └─ 500: Server error
├── JSON error responses
└── Logging

OCR Service
├── Catch model loading errors
├── Fallback to text if JSON extraction fails
├── Handle image preprocessing errors
└── Log all failures
```

## Deployment Checklist

### Pre-Deployment
- [ ] Test all routes with Postman
- [ ] Run load testing
- [ ] Security audit
- [ ] Database backup

### Deployment
- [ ] Use HTTPS
- [ ] Enable CORS only for prod domain
- [ ] Set DEBUG=False
- [ ] Change SECRET_KEY
- [ ] Use environment variables
- [ ] Set up error logging (Sentry)
- [ ] Configure MongoDB backups
- [ ] Set up monitoring

### Post-Deployment
- [ ] Monitor error logs
- [ ] Track performance metrics
- [ ] User feedback collection
- [ ] Regular security updates

## Future Enhancements

1. **WebSocket Support**
   - Real-time OCR progress updates
   - Live notifications for admin

2. **Batch Processing**
   - Upload multiple files at once
   - Queue system with Celery

3. **Advanced Analytics**
   - OCR accuracy metrics
   - Most common errors
   - Performance dashboard

4. **Model Selection**
   - Allow users to choose OCR model
   - Support for multiple LLMs
   - Fine-tuned models per industry

5. **Export Formats**
   - PDF export
   - Excel export
   - CSV export

6. **Mobile App**
   - React Native or Flutter
   - Offline support

7. **Advanced Search**
   - Full-text search with Elasticsearch
   - Date range filters
   - Advanced filtering UI

8. **Integrations**
   - Webhook support
   - Integration with accounting software
   - API for third-party apps
