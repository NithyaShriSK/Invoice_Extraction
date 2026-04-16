from fastapi import APIRouter, HTTPException, status, Header, Query
from app.models.database_models import User, Upload, Result
from app.auth import get_user_from_token
from app.database import MongoDBConnection
from bson import ObjectId

router = APIRouter(prefix="/admin", tags=["Admin"])

def verify_admin_token(authorization: str = Header(None)):
    """Verify admin access"""
    if not authorization:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing authorization header"
        )
    
    try:
        token = authorization.replace("Bearer ", "")
        user_id = get_user_from_token(token)
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired token"
            )
        
        # Verify user is admin
        user = User.find_by_id(user_id)
        if not user or not user.get("is_admin", False):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Admin access required"
            )
        
        return user_id
    except HTTPException:
        raise
    except:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token format"
        )

@router.get("/dashboard/stats")
async def get_dashboard_stats(authorization: str = Header(None)):
    """Get admin dashboard statistics"""
    admin_id = verify_admin_token(authorization)
    
    db = MongoDBConnection.get_db()
    
    total_users = db["users"].count_documents({})
    total_uploads = db["uploads"].count_documents({})
    total_results = db["results"].count_documents({})
    
    # Get recent uploads
    recent_uploads = list(db["uploads"].find().sort("created_at", -1).limit(10))
    
    # Get recent results
    recent_results = list(db["results"].find().sort("created_at", -1).limit(10))
    
    formatted_uploads = []
    for upload in recent_uploads:
        user = User.find_by_id(str(upload["user_id"]))
        result = Result.find_by_upload_id(str(upload["_id"]))
        
        formatted_uploads.append({
            "_id": str(upload["_id"]),
            "filename": upload["filename"],
            "user_email": user.get("email") if user else "Unknown",
            "created_at": upload["created_at"],
            "has_result": result is not None
        })
    
    return {
        "success": True,
        "stats": {
            "total_users": total_users,
            "total_uploads": total_uploads,
            "total_results": total_results
        },
        "recent_uploads": formatted_uploads,
        "recent_results_count": len(recent_results)
    }

@router.get("/users")
async def get_all_users(
    authorization: str = Header(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(10, ge=1, le=100)
):
    """Get all users"""
    admin_id = verify_admin_token(authorization)
    
    db = MongoDBConnection.get_db()
    
    users = list(db["users"].find().skip(skip).limit(limit))
    total = db["users"].count_documents({})
    
    formatted_users = []
    for user in users:
        upload_count = db["uploads"].count_documents({"user_id": user["_id"]})
        formatted_users.append({
            "_id": str(user["_id"]),
            "email": user["email"],
            "full_name": user["full_name"],
            "is_admin": user.get("is_admin", False),
            "is_active": user.get("is_active", True),
            "created_at": user["created_at"],
            "upload_count": upload_count
        })
    
    return {
        "success": True,
        "total": total,
        "users": formatted_users
    }

@router.get("/uploads")
async def get_all_uploads(
    authorization: str = Header(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100)
):
    """Get all uploads"""
    admin_id = verify_admin_token(authorization)
    
    db = MongoDBConnection.get_db()
    
    uploads = list(db["uploads"].find().sort("created_at", -1).skip(skip).limit(limit))
    total = db["uploads"].count_documents({})
    
    formatted_uploads = []
    for upload in uploads:
        user = User.find_by_id(str(upload["user_id"]))
        result = Result.find_by_upload_id(str(upload["_id"]))
        
        formatted_uploads.append({
            "_id": str(upload["_id"]),
            "filename": upload["filename"],
            "user_email": user.get("email") if user else "Unknown",
            "file_type": upload["file_type"],
            "created_at": upload["created_at"],
            "has_result": result is not None,
            "result_id": str(result["_id"]) if result else None
        })
    
    return {
        "success": True,
        "total": total,
        "uploads": formatted_uploads
    }

@router.get("/results")
async def get_all_results(
    authorization: str = Header(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100)
):
    """Get all results"""
    admin_id = verify_admin_token(authorization)
    
    db = MongoDBConnection.get_db()
    
    results = list(db["results"].find().sort("created_at", -1).skip(skip).limit(limit))
    total = db["results"].count_documents({})
    
    formatted_results = []
    for result in results:
        upload = Upload.find_by_id(str(result["upload_id"]))
        user = User.find_by_id(str(result["user_id"]))
        
        formatted_results.append({
            "_id": str(result["_id"]),
            "upload_id": str(result["upload_id"]),
            "filename": upload.get("filename") if upload else "Unknown",
            "user_email": user.get("email") if user else "Unknown",
            "ocr_text": result["ocr_text"][:100],
            "corrected_text": result["corrected_text"][:100],
            "status": result["status"],
            "created_at": result["created_at"]
        })
    
    return {
        "success": True,
        "total": total,
        "results": formatted_results
    }

@router.get("/search")
async def search_data(
    authorization: str = Header(None),
    query: str = Query(..., min_length=1),
    search_type: str = Query("all", regex="^(all|user|filename|email)$")
):
    """Search across uploads and users"""
    admin_id = verify_admin_token(authorization)
    
    db = MongoDBConnection.get_db()
    
    results = {
        "users": [],
        "uploads": [],
        "results": []
    }
    
    # Search users
    if search_type in ["all", "user", "email"]:
        users = list(db["users"].find({
            "$or": [
                {"email": {"$regex": query, "$options": "i"}},
                {"full_name": {"$regex": query, "$options": "i"}}
            ]
        }).limit(10))
        
        for user in users:
            results["users"].append({
                "_id": str(user["_id"]),
                "email": user["email"],
                "full_name": user["full_name"]
            })
    
    # Search uploads
    if search_type in ["all", "filename"]:
        uploads = list(db["uploads"].find({
            "filename": {"$regex": query, "$options": "i"}
        }).limit(10))
        
        for upload in uploads:
            user = User.find_by_id(str(upload["user_id"]))
            results["uploads"].append({
                "_id": str(upload["_id"]),
                "filename": upload["filename"],
                "user_email": user.get("email") if user else "Unknown",
                "created_at": upload["created_at"]
            })
    
    return {
        "success": True,
        "query": query,
        "results": results
    }

@router.delete("/results/{result_id}")
async def delete_result(result_id: str, authorization: str = Header(None)):
    """Delete a result (admin only)"""
    admin_id = verify_admin_token(authorization)
    
    db = MongoDBConnection.get_db()
    
    result = db["results"].delete_one({"_id": ObjectId(result_id)})
    
    if result.deleted_count == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Result not found"
        )
    
    return {
        "success": True,
        "message": "Result deleted successfully"
    }

@router.put("/users/{user_id}/toggle-admin")
async def toggle_admin(user_id: str, authorization: str = Header(None)):
    """Toggle admin status for a user"""
    admin_id = verify_admin_token(authorization)
    
    db = MongoDBConnection.get_db()
    
    user = db["users"].find_one({"_id": ObjectId(user_id)})
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    new_admin_status = not user.get("is_admin", False)
    
    db["users"].update_one(
        {"_id": ObjectId(user_id)},
        {"$set": {"is_admin": new_admin_status}}
    )
    
    return {
        "success": True,
        "message": f"User admin status changed to {new_admin_status}",
        "is_admin": new_admin_status
    }
