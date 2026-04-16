from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List, Dict, Any
from datetime import datetime

# ==================== Auth Schemas ====================
class UserRegister(BaseModel):
    email: EmailStr
    full_name: str
    password: str = Field(..., min_length=6)

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    id: str = Field(alias="_id")
    email: str
    full_name: str
    is_admin: bool
    created_at: datetime

class TokenResponse(BaseModel):
    access_token: str
    token_type: str
    user: UserResponse

# ==================== Upload Schemas ====================
class UploadResponse(BaseModel):
    id: str = Field(alias="_id")
    filename: str
    file_type: str
    status: str
    created_at: datetime

class UploadListResponse(BaseModel):
    uploads: List[UploadResponse]
    total: int

# ==================== Result Schemas ====================
class ResultResponse(BaseModel):
    id: str = Field(alias="_id")
    upload_id: str
    ocr_text: str
    corrected_text: str
    raw_json: Dict[str, Any]
    status: str
    created_at: datetime
    updated_at: datetime

class UpdateCorrectedText(BaseModel):
    corrected_text: str

class ResultDetailResponse(BaseModel):
    upload: UploadResponse
    result: ResultResponse

# ==================== Admin Schemas ====================
class AdminDataResponse(BaseModel):
    id: str = Field(alias="_id")
    filename: str
    user_email: str
    ocr_text: str
    corrected_text: str
    created_at: datetime

class AdminAllDataResponse(BaseModel):
    total_uploads: int
    total_users: int
    recent_uploads: List[AdminDataResponse]

# ==================== Error Schemas ====================
class ErrorResponse(BaseModel):
    error: str
    detail: Optional[str] = None
