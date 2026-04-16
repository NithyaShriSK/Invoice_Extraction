# Invoice OCR - Full Stack AI Application

A complete full-stack web application for extracting and correcting text from invoice images using AI-powered OCR and LLM correction. Features user upload system, admin dashboard, and JWT authentication.

## 🎯 Features

### User Features
- ✅ **Image Upload**: Upload JPG, PNG, GIF, TIFF files (max 10MB)
- ✅ **Camera Capture**: Real-time camera capture and processing
- ✅ **OCR Processing**: Extracts text using DeepSeek OCR 2
- ✅ **LLM Correction**: Automatically corrects OCR errors using Qwen 2.5 LLM
- ✅ **JSON Extraction**: Structures results into JSON format
- ✅ **Result Editing**: Edit corrected text manually
- ✅ **Download Results**: Export results as JSON

### Admin Features
- 👨‍💼 **Dashboard**: Real-time stats (users, uploads, results)
- 👥 **User Management**: View and manage user accounts
- 📁 **Upload Management**: View all uploads with user details
- 🔍 **Search**: Search across users, files, and results
- ✏️ **Edit Results**: Manually edit corrected text
- 🗑️ **Delete Records**: Remove uploads and results
- 🔐 **Admin Control**: Grant/revoke admin privileges

## 🏗️ Project Structure

```
invoice/
├── frontend/                    # React.js + Tailwind CSS
│   ├── public/                 # Static files
│   ├── src/
│   │   ├── components/
│   │   │   ├── common/         # Shared components
│   │   │   ├── user/           # User-specific components
│   │   │   └── admin/          # Admin-specific components
│   │   ├── pages/              # Page components
│   │   ├── services/           # API service layer
│   │   ├── context/            # Auth context
│   │   ├── App.js              # Main app
│   │   └── index.js            # Entry point
│   ├── package.json
│   └── .env.local              # Frontend environment
│
├── backend/                     # Python FastAPI
│   ├── app/
│   │   ├── models/             # MongoDB models
│   │   ├── schemas/            # Pydantic schemas
│   │   ├── routes/             # API routes
│   │   │   ├── auth.py         # Authentication
│   │   │   ├── upload.py       # File upload
│   │   │   ├── results.py      # Result management
│   │   │   └── admin.py        # Admin endpoints
│   │   ├── services/           # Business logic
│   │   │   └── ocr_service.py  # OCR integration
│   │   ├── main.py             # FastAPI app
│   │   ├── database.py         # MongoDB connection
│   │   └── auth.py             # JWT authentication
│   ├── requirements.txt        # Python dependencies
│   ├── run.py                  # Start server
│   └── .env                    # Backend environment
│
├── scripts/                     # Existing OCR scripts
│   ├── deep.py                 # DeepSeek OCR (existing)
│   ├── llm_correct.py          # LLM correction (existing)
│   └── integration.py          # Integration helper
│
├── uploads/                     # User uploads directory
├── output/                      # OCR output directory
└── README.md                    # This file
```

## 🚀 Tech Stack

| Layer | Technology |
|-------|-------------|
| **Frontend** | React 18, React Router, Tailwind CSS, Axios |
| **Backend** | FastAPI, Uvicorn, PyMongo |
| **Database** | MongoDB |
| **Authentication** | JWT (PyJWT) |
| **OCR** | DeepSeek OCR 2 |
| **LLM** | Ollama (Qwen 2.5) |
| **Password Hashing** | Passlib, bcrypt |

<<<<<<< HEAD
## 📋 API Endpoints
=======
- Node.js (v14 or higher)
- Python (v3.7 or higher)
- MongoDB Atlas account
- Conda environment (recommended)

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd invoice
   ```

2. **Set up Python Environment**
   ```bash
   conda create -n ocr python=3.10
   conda activate ocr
   ```

3. **Install Python Dependencies**
   ```bash
   cd python
   pip install -r requirements.txt
   ```

4. **Install Backend Dependencies**
   ```bash
   cd ../backend
   npm install
   ```

5. **Install Frontend Dependencies**
   ```bash
   cd ../frontend
   npm install
   ```

6. **Environment Setup**

   **Backend (.env)**:
   ```env
   # MongoDB Configuration
   MONGODB_URI=mongodb+srv://nithyashriskcs24_db_user:<password>@cluster0.tg9qtt0.mongodb.net/invoice_management
   
   # JWT Configuration
   JWT_SECRET=your-super-secret-jwt-key
   JWT_EXPIRE=7d
   
   # Server Configuration
   PORT=5000
   NODE_ENV=development
   
   # Email Configuration
   EMAIL_HOST=smtp.gmail.com
   EMAIL_PORT=587
   EMAIL_USER=your-email@gmail.com
   EMAIL_PASS=your-app-password
   
   # Python Scripts Path
   PYTHON_PATH=python
   DEEP_SCRIPT_PATH=../python/deep.py
   LLM_CORRECT_SCRIPT_PATH=../python/llm_correct.py
   ```

   **Frontend (.env)**:
   ```env
   REACT_APP_API_URL=http://localhost:5000/api
   REACT_APP_ENV=development
   ```

### Running the Application

1. **Start the Backend Server**
   ```bash
   cd backend
   npm run dev
   ```

2. **Start the Frontend Development Server**
   ```bash
   cd frontend
   npm start
   ```

3. **Access the Application**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:5000
   - API Health Check: http://localhost:5000/api/health

## 📊 API Endpoints
>>>>>>> 48ae5275ed715d7d4f9609e13ee9dcf1a1e25520

### Authentication
- `POST /auth/register` - Register new user
- `POST /auth/login` - User login
- `GET /auth/me` - Get current user info

### Upload & Processing
- `POST /upload/file` - Upload image file
- `POST /upload/camera` - Upload from camera
- `GET /upload/history` - Get user's upload history

### Results
- `GET /results/` - Get all user results
- `GET /results/{upload_id}` - Get specific result
- `PUT /results/{result_id}/corrected-text` - Update corrected text
- `GET /results/{result_id}/download` - Download result as JSON

### Admin
- `GET /admin/dashboard/stats` - Dashboard statistics
- `GET /admin/users` - List all users
- `GET /admin/uploads` - List all uploads
- `GET /admin/results` - List all results
- `GET /admin/search` - Search data
- `DELETE /admin/results/{result_id}` - Delete result
- `PUT /admin/users/{user_id}/toggle-admin` - Toggle admin status

## 🗄️ MongoDB Schema

### Users Collection
```javascript
{
  _id: ObjectId,
  email: String (unique),
  full_name: String,
  password_hash: String,
  is_admin: Boolean,
  is_active: Boolean,
  created_at: DateTime,
  updated_at: DateTime
}
```

### Uploads Collection
```javascript
{
  _id: ObjectId,
  user_id: ObjectId (ref: users),
  filename: String,
  file_path: String,
  file_type: String,
  status: String (uploaded|processing|completed),
  created_at: DateTime,
  updated_at: DateTime
}
```

### Results Collection
```javascript
{
  _id: ObjectId,
  upload_id: ObjectId (ref: uploads),
  user_id: ObjectId (ref: users),
  ocr_text: String,
  corrected_text: String,
  raw_json: Object,
  status: String,
  created_at: DateTime,
  updated_at: DateTime
}
```

## 🔐 Security Features

- JWT-based authentication
- Password hashing using bcrypt
- Protected routes with token verification
- Role-based access (admin/user)
- Input validation with Pydantic
- CORS protection
- Environment variable configuration

## 📦 Dependencies

### Backend
```
fastapi==0.104.1
uvicorn==0.24.0
pymongo==4.6.0
pydantic==2.5.0
pyjwt==2.8.1
passlib==1.7.4
python-dotenv==1.0.0
```

### Frontend
```
react==18.2.0
react-dom==18.2.0
react-router-dom==6.20.0
axios==1.6.0
tailwindcss==3.4.0
```

### System Requirements
- Python 3.10+
- Node.js 16+
- MongoDB 5.0+
- Ollama (for LLM)
- CUDA GPU (optional, for faster OCR)

## 📝 License

This project is built as an integration layer for existing OCR and LLM correction scripts.

## 🤝 Support

For issues or questions, refer to the SETUP_INSTRUCTIONS.md file.
