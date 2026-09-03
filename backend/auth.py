"""
auth.py
-----------------------------------------------------------------
Login por sessão (cookie), sem token JWT — mais simples de manter
para um painel admin pequeno. Senhas nunca ficam em texto puro:
users.json guarda só o hash (werkzeug.security).
-----------------------------------------------------------------
"""

import functools

from flask import Blueprint, jsonify, request, session
from werkzeug.security import check_password_hash

from storage import read_json

auth_bp = Blueprint("auth", __name__)

USERS_FILE = "users.json"


def login_required(view):
    """Decorator para proteger rotas admin. Devolve 401 se não
    houver sessão válida — o front-end deve redirecionar pro login
    quando receber isso."""

    @functools.wraps(view)
    def wrapped(*args, **kwargs):
        if not session.get("user_id"):
            return jsonify({"error": "não autenticado"}), 401
        return view(*args, **kwargs)

    return wrapped


@auth_bp.post("/api/login")
def login():
    body = request.get_json(silent=True) or {}
    username = (body.get("username") or "").strip()
    password = body.get("password") or ""

    users = read_json(USERS_FILE, default=[])
    user = next((u for u in users if u["username"] == username), None)

    if not user or not check_password_hash(user["password_hash"], password):
        return jsonify({"error": "usuário ou senha inválidos"}), 401

    session.clear()
    session["user_id"] = user["id"]
    session["username"] = user["username"]
    session.permanent = True

    return jsonify({"username": user["username"]})


@auth_bp.post("/api/logout")
def logout():
    session.clear()
    return jsonify({"ok": True})


@auth_bp.get("/api/me")
def me():
    if not session.get("user_id"):
        return jsonify({"authenticated": False})
    return jsonify({"authenticated": True, "username": session.get("username")})
