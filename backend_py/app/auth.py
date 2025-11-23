"""
JWT Authentication utilities (简化版)
使用 Python 内置的 hashlib 进行密码加密
"""

from datetime import datetime, timedelta
from typing import Optional
import hashlib
import secrets
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from .db import get_db
from .models import User


# ============= 配置 =============

# JWT 配置
SECRET_KEY = "your-secret-key-change-this-in-production-min-32-chars"  # 生产环境必须更改！
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_DAYS = 7

# HTTP Bearer 认证
security = HTTPBearer()


# ============= 密码加密/验证 (使用 hashlib) =============


def hash_password(password: str) -> str:
    """
    使用 SHA-256 + salt 加密密码

    Args:
        password: 明文密码

    Returns:
        加密后的密码哈希 (格式: salt$hash)
    """
    # 生成随机 salt
    salt = secrets.token_hex(16)

    # 使用 SHA-256 加密
    pwd_hash = hashlib.sha256((salt + password).encode("utf-8")).hexdigest()

    # 返回格式: salt$hash
    return f"{salt}${pwd_hash}"


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    验证密码

    Args:
        plain_password: 明文密码
        hashed_password: 加密后的密码哈希 (格式: salt$hash)

    Returns:
        密码是否匹配
    """
    try:
        # 分离 salt 和 hash
        salt, stored_hash = hashed_password.split("$")

        # 使用相同的 salt 重新计算 hash
        pwd_hash = hashlib.sha256((salt + plain_password).encode("utf-8")).hexdigest()

        # 比较 hash
        return pwd_hash == stored_hash
    except Exception as e:
        print(f"Password verification error: {e}")
        return False


# ============= JWT Token 操作 =============


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """
    创建 JWT access token

    Args:
        data: 要编码到 token 中的数据（通常包含 user_id）
        expires_delta: token 过期时间（默认 7 天）

    Returns:
        JWT token 字符串
    """
    to_encode = data.copy()

    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(days=ACCESS_TOKEN_EXPIRE_DAYS)

    to_encode.update({"exp": expire, "iat": datetime.utcnow()})

    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


def decode_access_token(token: str) -> dict:
    """
    解码并验证 JWT token

    Args:
        token: JWT token 字符串

    Returns:
        解码后的 payload 数据

    Raises:
        HTTPException: token 无效或过期
    """
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except JWTError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )


# ============= 依赖注入 - 获取当前用户 =============


def get_current_user_id(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> str:
    """
    从 JWT token 中提取当前用户 ID

    用于路由的依赖注入，自动验证 Authorization header 中的 token

    Args:
        credentials: HTTP Bearer token

    Returns:
        用户 ID

    Raises:
        HTTPException: token 无效或缺失
    """
    token = credentials.credentials

    try:
        payload = decode_access_token(token)
        user_id: str = payload.get("sub")

        if user_id is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token payload"
            )

        return user_id

    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
        )


def get_current_user(
    user_id: str = Depends(get_current_user_id), db: Session = Depends(get_db)
) -> User:
    """
    获取当前登录用户的完整信息

    用于需要访问完整用户对象的路由

    Args:
        user_id: 从 token 中提取的用户 ID
        db: 数据库会话

    Returns:
        User 对象

    Raises:
        HTTPException: 用户不存在
    """
    user = db.query(User).filter(User.id == user_id).first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="User not found"
        )

    return user


# ============= 可选认证（用于公开和私有端点混合） =============


def get_optional_user_id(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(
        HTTPBearer(auto_error=False)
    ),
) -> Optional[str]:
    """
    可选的用户认证

    如果提供了有效 token 则返回用户 ID，否则返回 None
    用于某些既可以公开访问也可以私有访问的端点

    Args:
        credentials: 可选的 HTTP Bearer token

    Returns:
        用户 ID 或 None
    """
    if not credentials:
        return None

    try:
        payload = decode_access_token(credentials.credentials)
        return payload.get("sub")
    except:
        return None
