# API Documentation

Complete API reference for Invoice OCR system.

## Base URL
```
http://localhost:8000
```

## Authentication

All protected endpoints require JWT token in header:
```
Authorization: Bearer <access_token>
```

---

## Authentication Routes

### Register User
```http
POST /auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "full_name": "John Doe",
  "password": "securepass123"
}
```

**Response (201):**
```json
{
  "access_token": "eyJ0eXAiOiJKV1QiLCJhbGc...",
  "token_type": "bearer",
  "user": {
    "_id": "507f1f77bcf86cd799439011",
    "email": "user@example.com",
    "full_name": "John Doe",
    "is_admin": false,
    "created_at": "2024-01-15T10:30:00"
  }
}
```

### Login User
```http
POST /auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "securepass123"
}
```

**Response (200):**
```json
{
  "access_token": "eyJ0eXAiOiJKV1QiLCJhbGc...",
  "token_type": "bearer",
  "user": {
    "_id": "507f1f77bcf86cd799439011",
    "email": "user@example.com",
    "full_name": "John Doe",
    "is_admin": false,
    "created_at": "2024-01-15T10:30:00"
  }
}
```

---

## Upload Routes

### Upload Image File
```http
POST /upload/file
Authorization: Bearer <token>
Content-Type: multipart/form-data

file: <image_file>
```

**Response (200):**
```json
{
  "success": true,
  "upload_id": "507f1f77bcf86cd799439011",
  "result_id": "507f1f77bcf86cd799439012",
  "message": "File processed successfully",
  "data": {
    "ocr_text": "Invoice No. 001...",
    "corrected_text": "Invoice No. 001...",
    "has_json": true
  }
}
```

### Upload from Camera
```http
POST /upload/camera
Authorization: Bearer <token>
Content-Type: application/json

{
  "image": "iVBORw0KGgoAAAANSUhEUgAAAAUA..."
}
```

**Response (200):**
```json
{
  "success": true,
  "upload_id": "507f1f77bcf86cd799439011",
  "result_id": "507f1f77bcf86cd799439012",
  "message": "Camera image processed successfully"
}
```

### Get Upload History
```http
GET /upload/history
Authorization: Bearer <token>
```

**Response (200):**
```json
{
  "success": true,
  "total": 5,
  "uploads": [
    {
      "upload_id": "507f1f77bcf86cd799439011",
      "filename": "invoice1.jpg",
      "created_at": "2024-01-15T10:30:00",
      "has_result": true,
      "result_id": "507f1f77bcf86cd799439012"
    }
  ]
}
```

---

## Results Routes

### Get All Results
```http
GET /results/
Authorization: Bearer <token>
```

**Response (200):**
```json
{
 "success": true,
  "total": 3,
  "results": [
    {
      "_id": "507f1f77bcf86cd799439012",
      "upload_id": "507f1f77bcf86cd799439011",
      "filename": "invoice1.jpg",
      "ocr_text": "Invoice No. 001...",
      "corrected_text": "Invoice No. 001...",
      "status": "completed",
      "created_at": "2024-01-15T10:30:00"
    }
  ]
}
```

### Get Specific Result
```http
GET /results/{upload_id}
Authorization: Bearer <token>
```

**Response (200):**
```json
{
  "success": true,
  "result": {
    "_id": "507f1f77bcf86cd799439012",
    "upload_id": "507f1f77bcf86cd799439011",
    "ocr_text": "Full OCR text here...",
    "corrected_text": "Corrected text here...",
    "raw_json": {
      "seller_name": "ABC Corp",
      "invoice_number": "001",
      "total_amount": "1000.00"
    },
    "status": "completed",
    "created_at": "2024-01-15T10:30:00",
    "updated_at": "2024-01-15T10:30:00"
  }
}
```

### Update Corrected Text
```http
PUT /results/{result_id}/corrected-text
Authorization: Bearer <token>
Content-Type: application/json

{
  "corrected_text": "Updated corrected text here..."
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Result updated successfully",
  "corrected_text": "Updated corrected text here..."
}
```

### Download Result
```http
GET /results/{result_id}/download
Authorization: Bearer <token>
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "upload_id": "507f1f77bcf86cd799439011",
    "ocr_text": "...",
    "corrected_text": "...",
    "raw_json": {...},
    "created_at": "2024-01-15T10:30:00"
  }
}
```

---

## Admin Routes

### Get Dashboard Stats
```http
GET /admin/dashboard/stats
Authorization: Bearer <admin_token>
```

**Response (200):**
```json
{
  "success": true,
  "stats": {
    "total_users": 15,
    "total_uploads": 47,
    "total_results": 47
  },
  "recent_uploads": [
    {
      "_id": "507f1f77bcf86cd799439011",
      "filename": "invoice.jpg",
      "user_email": "user@example.com",
      "created_at": "2024-01-15T10:30:00",
      "has_result": true
    }
  ],
  "recent_results_count": 5
}
```

### Get All Users
```http
GET /admin/users?skip=0&limit=10
Authorization: Bearer <admin_token>
```

**Response (200):**
```json
{
  "success": true,
  "total": 15,
  "users": [
    {
      "_id": "507f1f77bcf86cd799439011",
      "email": "user@example.com",
      "full_name": "John Doe",
      "is_admin": false,
      "is_active": true,
      "created_at": "2024-01-15T10:30:00",
      "upload_count": 5
    }
  ]
}
```

### Get All Uploads
```http
GET /admin/uploads?skip=0&limit=20
Authorization: Bearer <admin_token>
```

### Get All Results
```http
GET /admin/results?skip=0&limit=20
Authorization: Bearer <admin_token>
```

### Search Data
```http
GET /admin/search?query=invoice&search_type=filename
Authorization: Bearer <admin_token>
```

Query Parameters:
- `query` (required): Search term
- `search_type`: `all`, `user`, `filename`, or `email`

**Response (200):**
```json
{
  "success": true,
  "query": "invoice",
  "results": {
    "users": [],
    "uploads": [
      {
        "_id": "507f1f77bcf86cd799439011",
        "filename": "invoice.jpg",
        "user_email": "user@example.com",
        "created_at": "2024-01-15T10:30:00"
      }
    ],
    "results": []
  }
}
```

### Delete Result
```http
DELETE /admin/results/{result_id}
Authorization: Bearer <admin_token>
```

**Response (200):**
```json
{
  "success": true,
  "message": "Result deleted successfully"
}
```

### Toggle Admin Status
```http
PUT /admin/users/{user_id}/toggle-admin
Authorization: Bearer <admin_token>
```

**Response (200):**
```json
{
  "success": true,
  "message": "User admin status changed to true",
  "is_admin": true
}
```

---

## Error Responses

### 400 Bad Request
```json
{
  "error": "Validation error",
  "detail": "File size must be less than 10MB"
}
```

### 401 Unauthorized
```json
{
  "error": "Unauthorized",
  "detail": "Invalid or expired token"
}
```

### 403 Forbidden
```json
{
  "error": "Forbidden",
  "detail": "Admin access required"
}
```

### 404 Not Found
```json
{
  "error": "Not found",
  "detail": "Result not found"
}
```

### 500 Internal Server Error
```json
{
  "error": "Server error",
  "detail": "Processing failed: ..."
}
```

---

## Rate Limiting

Currently no rate limiting implemented. Consider adding for production.

## Pagination

Use `skip` and `limit` parameters:
```
GET /admin/users?skip=0&limit=10
GET /admin/uploads?skip=20&limit=10
```

---

## Testing with cURL

### Register
```bash
curl -X POST http://localhost:8000/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "full_name": "Test User",
    "password": "test123456"
  }'
```

### Login
```bash
curl -X POST http://localhost:8000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "test123456"
  }'
```

### Upload File
```bash
curl -X POST http://localhost:8000/upload/file \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@invoice.jpg"
```

---

## WebSocket Support

Not currently implemented. Consider adding for real-time OCR progress updates in future versions.
