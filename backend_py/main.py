from pathlib import Path
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from app.db import Base, engine
from app.api.materials import router as materials_router
from app.api.frameworks import router as frameworks_router
from app.api.users import router as users_router

# Load environment variables
load_dotenv()

app = FastAPI(title="Valorie Framework Builder API")

# ================= CORS 配置 =================
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Docker 模式下允许所有来源
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


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
    # Mount static files (CSS, JS, images, etc.)
    app.mount(
        "/assets", StaticFiles(directory=str(static_dir / "assets")), name="assets"
    )

    # Serve index.html for all other routes (SPA routing support)
    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        """
        Catch-all route to serve index.html for all frontend routes.
        This enables SPA (Single Page Application) routing - when users
        refresh the page or directly access a route like /new-framework,
        the server returns index.html and React Router handles the routing.

        Note: This route is registered AFTER all API routes, so API requests
        will be handled first. Only unmatched routes (frontend pages) reach here.
        """
        # Skip if this looks like an API request
        if full_path.startswith("api/"):
            return {"detail": "Not Found"}

        # Serve index.html for all frontend routes
        index_file = static_dir / "index.html"
        if index_file.exists():
            return FileResponse(index_file)
        return {"detail": "Frontend not found"}

    print("✅ Serving frontend from /app/static/frontend")
else:
    print("⚠️  Frontend static files not found (development mode)")
