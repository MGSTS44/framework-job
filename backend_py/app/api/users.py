"""
User Authentication API
处理用户注册、登录等认证相关操作
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr, validator
from nanoid import generate
from datetime import datetime

from ..db import get_db
from ..models import User
from ..auth import (
    hash_password,
    verify_password,
    create_access_token,
    get_current_user_id,
)


router = APIRouter(prefix="/api/users", tags=["users"])


# ============= Request/Response Models =============


class UserRegisterRequest(BaseModel):
    email: EmailStr
    username: str
    password: str

    @validator("username")
    def username_validation(cls, v):
        if len(v) < 3:
            raise ValueError("Username must be at least 3 characters long")
        if len(v) > 30:
            raise ValueError("Username must be less than 30 characters")
        if not v.replace("_", "").replace("-", "").isalnum():
            raise ValueError(
                "Username can only contain letters, numbers, hyphens and underscores"
            )
        return v

    @validator("password")
    def password_validation(cls, v):
        if len(v) < 6:
            raise ValueError("Password must be at least 6 characters long")
        return v


class UserLoginRequest(BaseModel):
    email: EmailStr
    password: str


class UserResponse(BaseModel):
    id: str
    email: str
    username: str
    created_at: datetime

    class Config:
        from_attributes = True


class AuthResponse(BaseModel):
    success: bool
    message: str
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


# ============= API Endpoints =============


@router.post(
    "/register", response_model=AuthResponse, status_code=status.HTTP_201_CREATED
)
def register_user(request: UserRegisterRequest, db: Session = Depends(get_db)):
    """
    用户注册

    创建新用户账号并返回 JWT token

    **验证规则:**
    - Email: 必须是有效的邮箱格式
    - Username: 3-30 字符，只能包含字母、数字、横杠、下划线
    - Password: 至少 6 字符

    **返回:**
    - access_token: JWT token（用于后续 API 调用）
    - user: 用户基本信息
    """

    # 检查邮箱是否已存在
    existing_user_by_email = db.query(User).filter(User.email == request.email).first()
    if existing_user_by_email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered"
        )

    # 检查用户名是否已存在
    existing_user_by_username = (
        db.query(User).filter(User.username == request.username).first()
    )
    if existing_user_by_username:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Username already taken"
        )

    # 创建新用户
    user_id = f"user_{generate(size=12)}"
    hashed_password = hash_password(request.password)

    new_user = User(
        id=user_id,
        email=request.email,
        username=request.username,
        password_hash=hashed_password,
        created_at=datetime.utcnow(),
    )

    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    # 生成 JWT token
    access_token = create_access_token(
        data={
            "sub": new_user.id,
            "email": new_user.email,
            "username": new_user.username,
        }
    )

    return AuthResponse(
        success=True,
        message="User registered successfully",
        access_token=access_token,
        user=UserResponse.from_orm(new_user),
    )


@router.post("/login", response_model=AuthResponse)
def login_user(request: UserLoginRequest, db: Session = Depends(get_db)):
    """
    用户登录

    验证用户凭证并返回 JWT token

    **参数:**
    - email: 注册时使用的邮箱
    - password: 密码

    **返回:**
    - access_token: JWT token（有效期 7 天）
    - user: 用户基本信息
    """

    # 查找用户
    user = db.query(User).filter(User.email == request.email).first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password"
        )

    # 验证密码
    if not verify_password(request.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password"
        )

    # 更新最后登录时间
    user.last_login = datetime.utcnow()
    db.commit()

    # 生成 JWT token
    access_token = create_access_token(
        data={"sub": user.id, "email": user.email, "username": user.username}
    )

    return AuthResponse(
        success=True,
        message="Login successful",
        access_token=access_token,
        user=UserResponse.from_orm(user),
    )


@router.get("/me", response_model=UserResponse)
def get_current_user_info(
    user_id: str = Depends(get_current_user_id), db: Session = Depends(get_db)
):
    """
    获取当前登录用户的信息

    **需要认证:** 必须在 Authorization header 中提供有效的 JWT token

    **返回:** 当前用户的基本信息
    """

    user = db.query(User).filter(User.id == user_id).first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="User not found"
        )

    return UserResponse.from_orm(user)


@router.get("/check-email/{email}")
def check_email_availability(email: str, db: Session = Depends(get_db)):
    """
    检查邮箱是否可用（用于前端实时验证）

    **返回:**
    - available: true/false
    """

    existing = db.query(User).filter(User.email == email).first()

    return {"email": email, "available": existing is None}


@router.get("/check-username/{username}")
def check_username_availability(username: str, db: Session = Depends(get_db)):
    """
    检查用户名是否可用（用于前端实时验证）

    **返回:**
    - available: true/false
    """

    existing = db.query(User).filter(User.username == username).first()

    return {"username": username, "available": existing is None}


@router.post("/logout")
def logout_user(user_id: str = Depends(get_current_user_id)):
    """
    用户登出

    注意：由于使用 JWT，实际的 logout 逻辑在前端完成（删除 token）
    这个端点主要用于记录日志或执行其他清理操作

    **需要认证**
    """

    # 可以在这里记录登出日志
    print(f"User {user_id} logged out")

    return {"success": True, "message": "Logged out successfully"}
