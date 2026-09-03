"""
routes_admin.py
-----------------------------------------------------------------
Endpoints PROTEGIDOS por login (@login_required). É o que o painel
admin vai chamar para editar os links e o portfólio, e para subir
imagens novas.
-----------------------------------------------------------------
"""

from flask import Blueprint, jsonify, request

from auth import login_required
from storage import read_json, save_image, write_json

admin_bp = Blueprint("admin", __name__, url_prefix="/api/admin")

EMPTY_PORTFOLIO = {"estaticos": [], "carrosseis": [], "stories": []}
VALID_TABS = {"estaticos", "carrosseis", "stories"}


# ---------- Links ----------

@admin_bp.get("/links")
@login_required
def get_links():
    return jsonify(read_json("links.json", default={}))


@admin_bp.put("/links")
@login_required
def update_links():
    """Substitui o objeto de links inteiro — o painel manda o objeto
    completo já editado (mais simples que PATCH por chave)."""
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return jsonify({"error": "payload inválido, esperado um objeto"}), 400

    write_json("links.json", data)
    return jsonify(data)


# ---------- Portfólio ----------

@admin_bp.get("/portfolio")
@login_required
def get_portfolio():
    return jsonify(read_json("portfolio.json", default=EMPTY_PORTFOLIO))


def _load_portfolio():
    return read_json("portfolio.json", default=dict(EMPTY_PORTFOLIO))


@admin_bp.post("/portfolio/<tab>/groups")
@login_required
def add_group(tab):
    """Cria um novo grupo de cliente numa aba."""
    if tab not in VALID_TABS:
        return jsonify({"error": "aba inválida"}), 400

    body = request.get_json(silent=True) or {}
    portfolio = _load_portfolio()

    new_group = {
        "client": body.get("client", "Nome do Cliente"),
        "meta": body.get("meta", ""),
        "items": [],
    }
    if tab in ("carrosseis", "stories"):
        new_group["handle"] = body.get("handle", "")

    portfolio.setdefault(tab, []).append(new_group)
    write_json("portfolio.json", portfolio)

    return jsonify({"index": len(portfolio[tab]) - 1, "group": new_group}), 201


@admin_bp.put("/portfolio/<tab>/groups/<int:index>")
@login_required
def update_group(tab, index):
    """Edita client/meta/handle de um grupo já existente (não mexe
    nos items — use as rotas de item para isso)."""
    if tab not in VALID_TABS:
        return jsonify({"error": "aba inválida"}), 400

    body = request.get_json(silent=True) or {}
    portfolio = _load_portfolio()
    groups = portfolio.get(tab, [])

    if index < 0 or index >= len(groups):
        return jsonify({"error": "grupo não encontrado"}), 404

    for field in ("client", "meta", "handle"):
        if field in body:
            groups[index][field] = body[field]

    write_json("portfolio.json", portfolio)
    return jsonify(groups[index])


@admin_bp.delete("/portfolio/<tab>/groups/<int:index>")
@login_required
def delete_group(tab, index):
    if tab not in VALID_TABS:
        return jsonify({"error": "aba inválida"}), 400

    portfolio = _load_portfolio()
    groups = portfolio.get(tab, [])

    if index < 0 or index >= len(groups):
        return jsonify({"error": "grupo não encontrado"}), 404

    removed = groups.pop(index)
    write_json("portfolio.json", portfolio)

    return jsonify(removed)


def _build_item(tab, body):
    """Monta um item novo já no formato certo pra cada aba —
    mesma estrutura que o portfolio.js do site já espera."""
    if tab == "carrosseis":
        return {"images": body.get("images", []), "caption": body.get("caption", "")}
    if tab == "stories":
        return {
            "image": body.get("image"),
            "caption": body.get("caption", ""),
            "count": body.get("count", 0),
            "link": body.get("link"),
        }
    return {"image": body.get("image"), "caption": body.get("caption", "")}


@admin_bp.post("/portfolio/<tab>/groups/<int:group_index>/items")
@login_required
def add_item(tab, group_index):
    if tab not in VALID_TABS:
        return jsonify({"error": "aba inválida"}), 400

    body = request.get_json(silent=True) or {}
    portfolio = _load_portfolio()
    groups = portfolio.get(tab, [])

    if group_index < 0 or group_index >= len(groups):
        return jsonify({"error": "grupo não encontrado"}), 404

    new_item = _build_item(tab, body)
    groups[group_index]["items"].append(new_item)
    write_json("portfolio.json", portfolio)

    return jsonify({"index": len(groups[group_index]["items"]) - 1, "item": new_item}), 201


@admin_bp.put("/portfolio/<tab>/groups/<int:group_index>/items/<int:item_index>")
@login_required
def update_item(tab, group_index, item_index):
    if tab not in VALID_TABS:
        return jsonify({"error": "aba inválida"}), 400

    body = request.get_json(silent=True) or {}
    portfolio = _load_portfolio()
    groups = portfolio.get(tab, [])

    if group_index < 0 or group_index >= len(groups):
        return jsonify({"error": "grupo não encontrado"}), 404

    items = groups[group_index]["items"]
    if item_index < 0 or item_index >= len(items):
        return jsonify({"error": "item não encontrado"}), 404

    items[item_index] = {**items[item_index], **_build_item(tab, {**items[item_index], **body})}
    write_json("portfolio.json", portfolio)

    return jsonify(items[item_index])


@admin_bp.delete("/portfolio/<tab>/groups/<int:group_index>/items/<int:item_index>")
@login_required
def delete_item(tab, group_index, item_index):
    if tab not in VALID_TABS:
        return jsonify({"error": "aba inválida"}), 400

    portfolio = _load_portfolio()
    groups = portfolio.get(tab, [])

    if group_index < 0 or group_index >= len(groups):
        return jsonify({"error": "grupo não encontrado"}), 404

    items = groups[group_index]["items"]
    if item_index < 0 or item_index >= len(items):
        return jsonify({"error": "item não encontrado"}), 404

    removed = items.pop(item_index)
    write_json("portfolio.json", portfolio)

    return jsonify(removed)


# ---------- Upload de imagem ----------

@admin_bp.post("/upload")
@login_required
def upload_image():
    """Recebe um arquivo (multipart/form-data, campo 'file') e devolve
    o path para usar em 'image' ou dentro de 'images' no portfólio."""
    file = request.files.get("file")
    try:
        path = save_image(file)
    except ValueError as e:
        return jsonify({"error": str(e)}), 400

    return jsonify({"path": path}), 201
