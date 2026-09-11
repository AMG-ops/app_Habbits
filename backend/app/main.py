from pathlib import Path

from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from .config import settings
from .routers import auth, circle, habits

app = FastAPI(
    title="Habitude",
    version="1.0.0",
    docs_url="/api/docs",
    openapi_url="/api/openapi.json",
)

# Only needed if the front end is ever served from another origin. The bundled
# build is served from this very app, so this stays empty by default.
if settings.cors_origin_list:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

app.include_router(auth.router, prefix="/api")
app.include_router(habits.router, prefix="/api")
app.include_router(circle.router, prefix="/api")


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


# --- the built single-page app ----------------------------------------------
# Present in the Docker image, absent when the API runs on its own next to the
# Vite dev server. Registered last so every /api route is matched first.

STATIC_DIR = Path(__file__).resolve().parent.parent / "static"

if STATIC_DIR.is_dir():
    ASSETS_DIR = STATIC_DIR / "assets"
    if ASSETS_DIR.is_dir():
        app.mount("/assets", StaticFiles(directory=ASSETS_DIR), name="assets")

    INDEX = STATIC_DIR / "index.html"

    @app.get("/{full_path:path}", include_in_schema=False)
    def serve_app(full_path: str) -> FileResponse:
        # An unknown API path is a missing endpoint, not a page of the app.
        if full_path.startswith("api/"):
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Endpoint inconnu.")

        if full_path:
            candidate = (STATIC_DIR / full_path).resolve()
            # Never serve anything outside the build directory.
            if candidate.is_file() and candidate.is_relative_to(STATIC_DIR):
                return FileResponse(candidate)

        # Every other path belongs to the router in the browser.
        return FileResponse(INDEX)
