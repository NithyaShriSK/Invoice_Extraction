from fastapi import APIRouter, HTTPException, status, Header
from app.schemas.schemas import UserRegister, UserLogin, TokenResponse, ErrorResponse
from app.models.database_models import User
from app.auth import hash_password, verify_password, create_access_token
from datetime import datetime

router = APIRouter(prefix="/auth", tags=["Authentication"])

@router.post("/register", response_model=TokenResponse)
async def register(user_data: UserRegister):
    """Register a new user"""
    # Check if user exists
    existing_user = User.find_by_email(user_data.email)
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    
    # Create user
    hashed_password = hash_password(user_data.password)
    user_id = User.create(
        email=user_data.email,
        full_name=user_data.full_name,
        password_hash=hashed_password
    )
    
    # Create token
    access_token = create_access_token(data={"user_id": user_id, "email": user_data.email})
    
    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        user={
            "_id": user_id,
            "email": user_data.email,
            "full_name": user_data.full_name,
            "is_admin": False,
            "created_at": datetime.utcnow()
        }
    )

@router.post("/login", response_model=TokenResponse)
async def login(user_data: UserLogin):
    """Login user"""
    user = User.find_by_email(user_data.email)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )
    
    if not verify_password(user_data.password, user["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )
    
    if not user.get("is_active", True):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is inactive"
        )
    
    # Create token
    access_token = create_access_token(
        data={"user_id": str(user["_id"]), "email": user["email"]}
    )
    
    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        user={
            "_id": str(user["_id"]),
            "email": user["email"],
            "full_name": user["full_name"],
            "is_admin": user.get("is_admin", False),
            "created_at": user["created_at"]
        }
    )

@router.get("/me")
async def get_current_user(authorization: str = Header(None), token: str = None):
    """Get current user info from token"""
    raw_token = authorization or token
    if not raw_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="No token provided"
        )
    
    from app.auth import get_user_from_token
    cleaned_token = raw_token.strip()
    if cleaned_token.lower().startswith("bearer "):
        cleaned_token = cleaned_token[7:].strip()

    user_id = get_user_from_token(cleaned_token)
    
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token"
        )
    
    user = User.find_by_id(user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    return {
        "_id": str(user["_id"]),
        "email": user["email"],
        "full_name": user["full_name"],
        "is_admin": user.get("is_admin", False)
    }
