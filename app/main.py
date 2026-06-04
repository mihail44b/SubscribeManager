import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware

from app.database import init_db
from app.routes import router as api_router

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize DB (create tables, insert defaults)
    try:
        await init_db()
        print("Database initialized successfully.")
    except Exception as e:
        print(f"Error during database initialization: {e}")
    yield

app = FastAPI(
    title="Subscription Manager",
    description="A lightweight, high-performance web panel for tracking subscriptions and regular payments.",
    version="1.0.0",
    lifespan=lifespan
)

# Enable CORS for local development testing
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API Router
app.include_router(api_router, prefix="/api")

# Static files mounting
static_dir = os.path.join(os.path.dirname(__file__), "static")
os.makedirs(static_dir, exist_ok=True)

# Mount /static for JS, CSS, images, etc.
app.mount("/static", StaticFiles(directory=static_dir), name="static")

# Catch-all to serve index.html for SPA routes (e.g. /, /dashboard)
@app.get("/{catchall:path}")
async def serve_spa(catchall: str):
    # If the user is requesting specific files in static that aren't routed to /static, we might check.
    # But generally, SPA routes are clean paths like /, /login, /dashboard, which should return index.html.
    index_file = os.path.join(static_dir, "index.html")
    if os.path.exists(index_file):
        return FileResponse(index_file)
    return {"message": "Subscription Manager API is running. Frontend static/index.html is missing."}
