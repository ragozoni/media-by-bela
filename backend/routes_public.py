"""
routes_public.py
-----------------------------------------------------------------
Endpoints SEM autenticação — é o que o site principal (links_page.html,
portfolio-design_page.html) vai chamar para montar as páginas
dinamicamente, no lugar de importar portfolio-config.js/links-config.js
como arquivo fixo.
-----------------------------------------------------------------
"""

from flask import Blueprint, jsonify

from storage import read_json

public_bp = Blueprint("public", __name__)

EMPTY_PORTFOLIO = {"estaticos": [], "carrosseis": [], "stories": []}


@public_bp.get("/api/portfolio")
def get_portfolio():
    return jsonify(read_json("portfolio.json", default=EMPTY_PORTFOLIO))


@public_bp.get("/api/links")
def get_links():
    return jsonify(read_json("links.json", default={}))
