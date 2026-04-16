from fastapi import APIRouter, File, UploadFile, HTTPException, status, Header
from fastapi.responses import FileResponse
import os
import json
from datetime import datetime
import shutil

from app.models.database_models import Upload, Result, User
from app.services.ocr_service import OCRService
from app.auth import get_user_from_token

router = APIRouter(prefix="/upload", tags=["Upload"])

UPLOAD_FOLDER = os.getenv("UPLOAD_FOLDER", "./uploads")
OUTPUT_FOLDER = os.getenv("OUTPUT_FOLDER", "./output")

os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(OUTPUT_FOLDER, exist_ok=True)

def verify_token_and_get_user(authorization: str = Header(None)):
    """Extract and verify user from token"""
    if not authorization:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing authorization header"
        )

    try:
        token = authorization.strip()
        if token.lower().startswith("bearer "):
            token = token[7:].strip()
        user_id = get_user_from_token(token)
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired token"
            )
        return user_id
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token format"
        )

@router.post("/file")
async def upload_file(file: UploadFile = File(...), authorization: str = Header(None)):
    """
    Upload image file and trigger OCR pipeline
    """
    user_id = verify_token_and_get_user(authorization)
    
    # Validate file type
    allowed_types = ["image/jpeg", "image/png", "image/gif", "image/tiff"]
    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid file type. Allowed: JPG, PNG, GIF, TIFF"
        )
    
    try:
        # Save uploaded file
        timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
        filename = f"{timestamp}_{file.filename}"
        file_path = os.path.join(UPLOAD_FOLDER, filename)
        
        with open(file_path, "wb") as f:
            content = await file.read()
            f.write(content)
        
        # Create upload record
        upload_id = Upload.create(
            user_id=user_id,
            filename=file.filename,
            file_path=file_path,
            file_type=file.content_type
        )
        
        print(f"\n[API] Upload created: {upload_id}")
        print(f"[API] Starting OCR pipeline for {filename}...")
        
        # Run OCR pipeline
        pipeline_result = OCRService.process_full_pipeline(file_path)
        
        if not pipeline_result["success"]:
            raise Exception(pipeline_result.get("details", "Pipeline failed"))

        corrected_json = pipeline_result.get("raw_json") or {}
        corrected_json_text = json.dumps(corrected_json, ensure_ascii=False, indent=2)
        
        # Create result record
        result_id = Result.create(
            upload_id=upload_id,
            user_id=user_id,
            ocr_text=pipeline_result["ocr_text"],
            corrected_text=corrected_json_text,
            raw_json=corrected_json,
            status="completed"
        )
        
        print(f"[API] Result created: {result_id}")
        
        return {
            "success": True,
            "upload_id": upload_id,
            "result_id": result_id,
            "corrected_json": corrected_json
        }
    
    except Exception as e:
        print(f"[API ERROR] {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Processing failed: {str(e)}"
        )

@router.get("/history")
async def get_upload_history(authorization: str = Header(None)):
    """Get user's upload history"""
    user_id = verify_token_and_get_user(authorization)
    
    uploads = Upload.find_by_user_id(user_id)
    
    history = []
    for upload in uploads:
        result = Result.find_by_upload_id(str(upload["_id"]))
        history.append({
            "upload_id": str(upload["_id"]),
            "filename": upload["filename"],
            "created_at": upload["created_at"],
            "has_result": result is not None,
            "result_id": str(result["_id"]) if result else None
        })
    
    return {
        "success": True,
        "total": len(history),
        "uploads": history
    }

@router.post("/camera")
async def upload_from_camera(image_data: dict, authorization: str = Header(None)):
    """
    Upload image from camera (base64 encoded)
    """
    user_id = verify_token_and_get_user(authorization)
    
    try:
        import base64
        from PIL import Image
        import io
        
        # Decode base64 image
        image_bytes = base64.b64decode(image_data.get("image", ""))
        image = Image.open(io.BytesIO(image_bytes))
        
        # Save image
        timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
        filename = f"camera_{timestamp}.png"
        file_path = os.path.join(UPLOAD_FOLDER, filename)
        image.save(file_path)
        
        # Create upload record
        upload_id = Upload.create(
            user_id=user_id,
            filename=filename,
            file_path=file_path,
            file_type="image/png"
        )
        
        print(f"\n[API] Camera upload created: {upload_id}")
        
        # Run OCR pipeline
        pipeline_result = OCRService.process_full_pipeline(file_path)
        
        if not pipeline_result["success"]:
            raise Exception(pipeline_result.get("details", "Pipeline failed"))

        corrected_json = pipeline_result.get("raw_json") or {}
        corrected_json_text = json.dumps(corrected_json, ensure_ascii=False, indent=2)
        
        # Create result record
        result_id = Result.create(
            upload_id=upload_id,
            user_id=user_id,
            ocr_text=pipeline_result["ocr_text"],
            corrected_text=corrected_json_text,
            raw_json=corrected_json,
            status="completed"
        )
        
        return {
            "success": True,
            "upload_id": upload_id,
            "result_id": result_id,
            "corrected_json": corrected_json
        }
    
    except Exception as e:
        print(f"[API ERROR] {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Processing failed: {str(e)}"
        )
