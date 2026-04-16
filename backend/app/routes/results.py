from fastapi import APIRouter, HTTPException, status, Header, Path
from app.models.database_models import Result, Upload, User
from app.schemas.schemas import UpdateCorrectedText
from app.auth import get_user_from_token
from bson import ObjectId
import json

router = APIRouter(prefix="/results", tags=["Results"])

def verify_token_and_get_user(authorization: str = Header(None)):
    """Extract and verify user from token"""
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
        return user_id
    except:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token format"
        )

@router.get("/{upload_id}")
async def get_result(upload_id: str = Path(...), authorization: str = Header(None)):
    """Get result for a specific upload"""
    user_id = verify_token_and_get_user(authorization)
    
    # Verify upload belongs to user
    upload = Upload.find_by_id(upload_id)
    if not upload:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Upload not found"
        )
    
    if str(upload["user_id"]) != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )
    
    # Get result
    result = Result.find_by_upload_id(upload_id)
    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Result not found"
        )
    
    return {
        "success": True,
        "result": {
            "_id": str(result["_id"]),
            "upload_id": str(result["upload_id"]),
            "corrected_json": result.get("raw_json", {}),
            "status": result["status"],
            "created_at": result["created_at"],
            "updated_at": result["updated_at"]
        }
    }

@router.get("/")
async def get_all_results(authorization: str = Header(None)):
    """Get all results for current user"""
    user_id = verify_token_and_get_user(authorization)
    
    results = Result.find_by_user_id(user_id)
    
    formatted_results = []
    for result in results:
        upload = Upload.find_by_id(str(result["upload_id"]))
        formatted_results.append({
            "_id": str(result["_id"]),
            "upload_id": str(result["upload_id"]),
            "filename": upload.get("filename") if upload else "Unknown",
            "corrected_json": result.get("raw_json", {}),
            "status": result["status"],
            "created_at": result["created_at"]
        })
    
    return {
        "success": True,
        "total": len(formatted_results),
        "results": formatted_results
    }

@router.put("/{result_id}/corrected-text")
async def update_corrected_text(
    result_id: str = Path(...),
    data: UpdateCorrectedText = None,
    authorization: str = Header(None)
):
    """
    Update corrected text (admin feature)
    This allows admin or user to manually edit corrected text
    """
    user_id = verify_token_and_get_user(authorization)
    
    # Get result by result _id and verify ownership
    result = Result.find_by_id(result_id)
    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Result not found"
        )
    
    if str(result["user_id"]) != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )
    
    corrected_payload = None
    try:
        corrected_payload = json.loads(data.corrected_text)
    except Exception:
        corrected_payload = None

    # Update corrected text and JSON payload
    success = Result.update_corrected_text(result_id, data.corrected_text, corrected_payload)
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update result"
        )
    
    return {
        "success": True,
        "message": "Result updated successfully"
    }

@router.get("/{result_id}/download")
async def download_result(result_id: str = Path(...), authorization: str = Header(None)):
    """Download result as JSON"""
    user_id = verify_token_and_get_user(authorization)
    
    result = Result.find_by_id(result_id)
    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Result not found"
        )
    
    if str(result["user_id"]) != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )
    
    return {
        "success": True,
        "data": {
            "upload_id": str(result["upload_id"]),
            "corrected_json": result.get("raw_json", {}),
            "created_at": str(result["created_at"])
        }
    }
