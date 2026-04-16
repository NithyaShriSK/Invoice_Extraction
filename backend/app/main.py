from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os
from dotenv import load_dotenv

from app.database import MongoDBConnection, init_collections
from app.routes import auth, upload, results, admin

load_dotenv()

# Initialize FastAPI
app = FastAPI(
    title=os.getenv("API_TITLE", "Invoice OCR API"),
    version=os.getenv("API_VERSION", "1.0.0"),
    description="AI-powered invoice OCR and text correction system"
)

# CORS middleware
allowed_origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize database
@app.on_event("startup")
async def startup_event():
    """Initialize database on startup"""
    try:
        MongoDBConnection.connect_db()
        init_collections()
        print("✓ Application startup complete")
    except Exception as e:
        print(f"✗ Startup error: {str(e)}")

@app.on_event("shutdown")
async def shutdown_event():
    """Close database connection on shutdown"""
    MongoDBConnection.close_db()
    print("✓ Application shutdown complete")

# Include routes
app.include_router(auth.router)
app.include_router(upload.router)
app.include_router(results.router)
app.include_router(admin.router)

# Root endpoint
@app.get("/")
async def root():
    return {
        "message": "Invoice OCR API",
        "version": "1.0.0",
        "docs": "/docs"
    }

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "database": "connected"
    }

# Error handlers
@app.exception_handler(ValueError)
async def value_error_handler(request, exc):
    return {
        "error": "Validation error",
        "detail": str(exc)
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True
    )
