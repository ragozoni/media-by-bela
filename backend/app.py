"""
app.py — ponto de entrada do backend.
-----------------------------------------------------------------
Roda com:
    dev:  python app.py
    prod: gunicorn -w 2 -b 0.0.0.0:5000 app:app   (já configurado no Dockerfile)
-----------------------------------------------------------------
"""

import os
from datetime import timedelta
from pathlib import Path

from flask import Flask, send_from_directory
from flask_cors import CORS

from auth import auth_bp
from routes_admin import admin_bp
from routes_public import public_bp

UPLOADS_DIR = Path(__file__).parent / "uploads"


def create_app():
    app = Flask(__name__)

    # SECRET_KEY assina o cookie de sessão — MUDE isso em produção via
    # variável de ambiente. O valor abaixo só existe para não quebrar
    # em desenvolvimento local.
    app.config["SECRET_KEY"] = os.environ.get("SECRET_KEY", "dev-only-change-me")
    app.config["PERMANENT_SESSION_LIFETIME"] = timedelta(days=7)
    app.config["SESSION_COOKIE_HTTPONLY"] = True
    app.config["SESSION_COOKIE_SAMESITE"] = "Lax"
    # Em produção, atrás de HTTPS, isso deve ficar True (via FLASK_ENV=production)
    app.config["SESSION_COOKIE_SECURE"] = os.environ.get("FLASK_ENV") == "production"

    # Permite que o front-end (servido em outra porta/domínio pelo
    # nginx) chame essa API mandando o cookie de sessão junto
    origins = os.environ.get("CORS_ORIGINS", "*").split(",")
    CORS(app, supports_credentials=True, origins=origins)

    app.register_blueprint(auth_bp)
    app.register_blueprint(public_bp)
    app.register_blueprint(admin_bp)

    @app.get("/uploads/<path:filename>")
    def serve_upload(filename):
        return send_from_directory(UPLOADS_DIR, filename)

    @app.get("/api/health")
    def health():
        return {"status": "ok"}

    return app


app = create_app()

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=os.environ.get("FLASK_ENV") != "production")
