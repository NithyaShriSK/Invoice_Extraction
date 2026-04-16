from datetime import datetime
from typing import Optional, List, Dict, Any
from bson import ObjectId

class User:
    """User model for MongoDB"""
    
    @staticmethod
    def create(email: str, full_name: str, password_hash: str, is_admin: bool = False):
        """Create a new user"""
        from app.database import MongoDBConnection
        db = MongoDBConnection.get_db()
        
        user_data = {
            "email": email,
            "full_name": full_name,
            "password_hash": password_hash,
            "is_admin": is_admin,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow(),
            "is_active": True
        }
        
        result = db["users"].insert_one(user_data)
        return str(result.inserted_id)
    
    @staticmethod
    def find_by_email(email: str):
        """Find user by email"""
        from app.database import MongoDBConnection
        db = MongoDBConnection.get_db()
        return db["users"].find_one({"email": email})
    
    @staticmethod
    def find_by_id(user_id: str):
        """Find user by ID"""
        from app.database import MongoDBConnection
        db = MongoDBConnection.get_db()
        try:
            return db["users"].find_one({"_id": ObjectId(user_id)})
        except:
            return None


class Upload:
    """Upload model for storing file information"""
    
    @staticmethod
    def create(user_id: str, filename: str, file_path: str, file_type: str):
        """Create upload record"""
        from app.database import MongoDBConnection
        db = MongoDBConnection.get_db()
        
        upload_data = {
            "user_id": ObjectId(user_id),
            "filename": filename,
            "file_path": file_path,
            "file_type": file_type,
            "status": "uploaded",
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        }
        
        result = db["uploads"].insert_one(upload_data)
        return str(result.inserted_id)
    
    @staticmethod
    def find_by_id(upload_id: str):
        """Find upload by ID"""
        from app.database import MongoDBConnection
        db = MongoDBConnection.get_db()
        try:
            return db["uploads"].find_one({"_id": ObjectId(upload_id)})
        except:
            return None
    
    @staticmethod
    def find_by_user_id(user_id: str):
        """Find all uploads by user"""
        from app.database import MongoDBConnection
        db = MongoDBConnection.get_db()
        try:
            return list(db["uploads"].find({"user_id": ObjectId(user_id)}).sort("created_at", -1))
        except:
            return []


class Result:
    """Result model for storing OCR and correction results"""
    
    @staticmethod
    def create(upload_id: str, user_id: str, ocr_text: str, corrected_text: str, 
               raw_json: Dict[str, Any], status: str = "completed"):
        """Create result record"""
        from app.database import MongoDBConnection
        db = MongoDBConnection.get_db()
        
        result_data = {
            "upload_id": ObjectId(upload_id),
            "user_id": ObjectId(user_id),
            "ocr_text": ocr_text,
            "corrected_text": corrected_text,
            "raw_json": raw_json,
            "status": status,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        }
        
        result = db["results"].insert_one(result_data)
        return str(result.inserted_id)
    
    @staticmethod
    def find_by_upload_id(upload_id: str):
        """Find result by upload ID"""
        from app.database import MongoDBConnection
        db = MongoDBConnection.get_db()
        try:
            return db["results"].find_one({"upload_id": ObjectId(upload_id)})
        except:
            return None

    @staticmethod
    def find_by_id(result_id: str):
        """Find result by result document ID"""
        from app.database import MongoDBConnection
        db = MongoDBConnection.get_db()
        try:
            return db["results"].find_one({"_id": ObjectId(result_id)})
        except:
            return None
    
    @staticmethod
    def find_by_user_id(user_id: str):
        """Find all results by user"""
        from app.database import MongoDBConnection
        db = MongoDBConnection.get_db()
        try:
            return list(db["results"].find({"user_id": ObjectId(user_id)}).sort("created_at", -1))
        except:
            return []
    
    @staticmethod
    def update_corrected_text(result_id: str, corrected_text: str, raw_json: Optional[Dict[str, Any]] = None):
        """Update corrected text and optional corrected JSON payload."""
        from app.database import MongoDBConnection
        db = MongoDBConnection.get_db()
        try:
            update_data = {
                "corrected_text": corrected_text,
                "updated_at": datetime.utcnow()
            }
            if raw_json is not None:
                update_data["raw_json"] = raw_json

            db["results"].update_one(
                {"_id": ObjectId(result_id)},
                {"$set": update_data}
            )
            return True
        except:
            return False
