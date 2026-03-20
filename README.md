# AI-Powered Invoice Management System

A full-stack web application that uses AI to automatically extract, process, and manage invoice data using OCR and machine learning technologies.

## 🚀 Features

- **AI-Powered OCR**: DeepSeek OCR2 integration for accurate text extraction
- **Intelligent Data Correction**: LLM-based correction and structuring of OCR output
- **Multi-Language Support**: Automatic language detection and processing
- **User Management**: Role-based authentication (User/Admin)
- **Real-time Analytics**: Comprehensive dashboards with charts and insights
- **Email Notifications**: Automatic email alerts for processed invoices
- **Camera Integration**: Capture invoices directly from camera
- **Editable Interface**: Modify extracted data before saving
- **Accuracy Tracking**: Monitor OCR accuracy and processing performance

## 🛠 Tech Stack

### Backend
- **Node.js** with Express.js
- **MongoDB Atlas** with Mongoose ODM
- **JWT Authentication**
- **Multer** for file uploads
- **Nodemailer** for email notifications
- **Python Integration** via child_process

### Frontend
- **React.js** with React Router
- **Tailwind CSS** for styling
- **Recharts** for data visualization
- **Lucide React** for icons
- **Axios** for API calls
- **React Hot Toast** for notifications

### AI/ML
- **DeepSeek OCR2** for text extraction
- **DeepSeek LLM** for data correction
- **Python** scripts for AI processing

## 📁 Project Structure

```
invoice/
├── backend/
│   ├── src/
│   │   ├── controllers/     # API controllers
│   │   ├── middleware/      # Auth middleware
│   │   ├── models/         # Mongoose schemas
│   │   ├── routes/         # API routes
│   │   └── utils/          # Utility functions
│   ├── uploads/            # File upload directory
│   ├── .env                # Environment variables
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/     # React components
│   │   ├── contexts/       # React contexts
│   │   ├── pages/          # Page components
│   │   ├── services/       # API services
│   │   └── utils/          # Utility functions
│   ├── public/
│   ├── .env                # Environment variables
│   └── package.json
├── python/
│   ├── deep.py             # OCR processing script
│   └── llm_correct.py      # LLM correction script
└── README.md
```

## 🚀 Getting Started

### Prerequisites

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
   conda create -n ocr python=3.8
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

### Authentication
- `POST /api/auth/signup` - User registration
- `POST /api/auth/login` - User login
- `GET /api/auth/profile` - Get user profile
- `PUT /api/auth/profile` - Update user profile
- `PUT /api/auth/change-password` - Change password

### Invoice Management
- `POST /api/invoice/upload` - Upload and process invoice
- `PUT /api/invoice/:id/save` - Save edited invoice
- `GET /api/invoice/my` - Get user's invoices
- `GET /api/invoice/:id` - Get specific invoice
- `DELETE /api/invoice/:id` - Delete invoice
- `GET /api/invoice/analytics/my` - Get user analytics

### Admin APIs
- `GET /api/admin/users` - Get all users
- `GET /api/admin/invoices` - Get all invoices
- `GET /api/admin/analytics` - Get system analytics
- `PUT /api/admin/users/:userId/status` - Update user status
- `PUT /api/admin/users/:userId/role` - Update user role
- `GET /api/admin/health` - Get system health

## 🤖 AI Processing Pipeline

1. **Image Upload**: User uploads invoice image or captures via camera
2. **OCR Processing**: `deep.py` extracts raw text using DeepSeek OCR2
3. **Data Correction**: `llm_correct.py` structures and corrects OCR output
4. **Accuracy Calculation**: Compare original vs corrected data
5. **Data Storage**: Save structured data with metadata to MongoDB
6. **Email Notification**: Send processing summary to user

## 🔧 Configuration

### Python Scripts

**deep.py**:
- Input: Image file path
- Output: Raw OCR text with metadata
- Integration: DeepSeek OCR2 API

**llm_correct.py**:
- Input: Raw OCR text
- Output: Structured JSON data
- Features: Field extraction, validation, language detection

### Database Schema

**User Model**:
```javascript
{
  username: String,
  email: String,
  password: String,
  role: String, // 'user' | 'admin'
  profile: {
    firstName: String,
    lastName: String,
    phone: String,
    company: String
  },
  preferences: {
    language: String,
    emailNotifications: Boolean,
    theme: String
  }
}
```

**Invoice Model**:
```javascript
{
  userId: ObjectId,
  originalOCR: String,
  correctedData: Object,
  accuracyScore: Number,
  languageDetected: String,
  fileName: String,
  filePath: String,
  processingTime: Number,
  status: String,
  extractedFields: Object,
  metadata: Object
}
```

## 📈 Analytics Features

### User Dashboard
- Total invoices processed
- Average OCR accuracy
- Processing time metrics
- Vendor insights
- Spending analytics

### Admin Dashboard
- System-wide metrics
- User management
- Invoice volume trends
- Accuracy distribution
- Language distribution
- System health monitoring

## 🔐 Security Features

- JWT-based authentication
- Role-based access control
- Input validation and sanitization
- File upload security
- Rate limiting
- CORS protection
- Helmet.js security headers

## 📧 Email Integration

- Automatic notifications on invoice processing
- Processing summaries with accuracy metrics
- Configurable email templates
- Support for Gmail SMTP

## 🎨 UI/UX Features

- Responsive design for all devices
- Modern, clean interface with Tailwind CSS
- Interactive charts and data visualizations
- Real-time form validation
- Loading states and error handling
- Toast notifications
- Camera integration for mobile devices

## 🚀 Deployment

### Production Setup

1. **Environment Variables**:
   - Set `NODE_ENV=production`
   - Update MongoDB URI with production database
   - Configure production email settings
   - Set strong JWT secret

2. **Build Frontend**:
   ```bash
   cd frontend
   npm run build
   ```

3. **Deploy Backend**:
   - Use PM2 for process management
   - Configure reverse proxy (Nginx)
   - Set up SSL certificates
   - Configure firewall rules

### Docker Deployment (Optional)

```dockerfile
# Backend Dockerfile
FROM node:16-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 5000
CMD ["npm", "start"]
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📝 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Troubleshooting

### Common Issues

1. **Python Scripts Not Found**:
   - Ensure conda environment is activated: `conda activate ocr`
   - Check Python path in backend .env file

2. **MongoDB Connection Error**:
   - Verify MongoDB URI and credentials
   - Check network connectivity
   - Ensure IP is whitelisted in MongoDB Atlas

3. **Email Not Sending**:
   - Verify Gmail app password
   - Check SMTP settings
   - Ensure less secure apps are enabled

4. **OCR Processing Fails**:
   - Check Python script permissions
   - Verify image file format
   - Check DeepSeek API credentials

### Debug Mode

Enable debug logging by setting:
```env
NODE_ENV=development
DEBUG=invoice:*
```

## 📞 Support

For support and questions:
- Create an issue in the repository
- Check the troubleshooting section
- Review the API documentation

---

**Built with ❤️ using Node.js, React, and AI technologies**
