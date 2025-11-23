from pathlib import Path
from dotenv import load_dotenv
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware  # 🆕 添加
import re  # 🆕 添加

from app.db import Base, engine
from app.api.materials import router as materials_router
from app.api.frameworks import router as frameworks_router
from app.api.users import router as users_router

# Load environment variables
load_dotenv()

app = FastAPI(title="Valorie Framework Builder API")

# ================= 🆕 自定义 CORS 配置（多域名支持） =================
ALLOWED_ORIGINS = [
    r'^https://expert\.valorie\.ai$',
    r'^https://[\w-]+\.valorie\.ai$',
    r'^http://localhost:\d+$',
    r'^http://127\.0\.0\.1:\d+$',
]

def is_valid_origin(origin: str) -> bool:
    if not origin:
        return False
    for pattern in ALLOWED_ORIGINS:
        if re.match(pattern, origin):
            return True
    return False

class CustomCORSMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        origin = request.headers.get('origin')
        
        # OPTIONS 预检请求
        if request.method == 'OPTIONS':
            if origin and is_valid_origin(origin):
                return JSONResponse(
                    status_code=200,
                    headers={
                        'Access-Control-Allow-Origin': origin,
                        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS, PATCH',
                        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Tenant-ID',
                        'Access-Control-Allow-Credentials': 'true',
                        'Access-Control-Max-Age': '3600',
                    }
                )
        
        # 正常请求
        response = await call_next(request)
        
        if origin and is_valid_origin(origin):
            response.headers['Access-Control-Allow-Origin'] = origin
            response.headers['Access-Control-Allow-Credentials'] = 'true'
            response.headers['Vary'] = 'Origin'
        
        return response

app.add_middleware(CustomCORSMiddleware)
# ================= 🆕 结束 =================

# ❌ 删除或注释掉这段旧的 CORS 配置
# app.add_middleware(
#     CORSMiddleware,
#     allow_origins=["*"],
#     allow_credentials=True,
#     allow_methods=["*"],
#     allow_headers=["*"],
# )


# ================= 健康检查 =================
@app.get("/health")
def health():
    return {"status": "healthy", "message": "Backend is running!", "version": "1.0.0"}


# ================= 数据库初始化 =================
Base.metadata.create_all(bind=engine)

# ================= 注册路由 =================
app.include_router(materials_router)
app.include_router(frameworks_router)
app.include_router(users_router)

# ================= Serve Frontend Static Files (Docker mode) =================
static_dir = Path("/app/static/frontend")
if static_dir.exists():
    app.mount(
        "/assets", StaticFiles(directory=str(static_dir / "assets")), name="assets"
    )

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        if full_path.startswith("api/"):
            return {"detail": "Not Found"}

        index_file = static_dir / "index.html"
        if index_file.exists():
            return FileResponse(index_file)
        return {"detail": "Frontend not found"}

    print("Serving frontend from /app/static/frontend")
else:
    print("Frontend static files not found (development mode)")