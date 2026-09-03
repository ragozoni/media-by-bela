"""
storage.py
-----------------------------------------------------------------
Funções de acesso a dados. Não usamos banco de dados — o conteúdo
fica em arquivos JSON (data/portfolio.json, data/links.json) e as
imagens em uploads/, exatamente como decidido: só o CAMINHO da
imagem é salvo no JSON, nunca o arquivo em si.
-----------------------------------------------------------------
"""

import json
import os
import uuid
from pathlib import Path

BASE_DIR = Path(__file__).parent
DATA_DIR = BASE_DIR / "data"
UPLOADS_DIR = BASE_DIR / "uploads"

ALLOWED_EXTENSIONS = {"jpg", "jpeg", "png", "webp", "gif"}
MAX_FILE_SIZE_BYTES = 8 * 1024 * 1024  # 8 MB


def _resolve(filename):
    # users.json fica na raiz do backend (fora de data/), pra reforçar
    # que é um arquivo sensível — nunca é servido nem versionado.
    if filename == "users.json":
        return BASE_DIR / filename
    return DATA_DIR / filename


def read_json(filename, default=None):
    path = _resolve(filename)
    if not path.exists():
        return default if default is not None else {}
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def write_json(filename, data):
    """Escrita atômica: grava num arquivo temporário e só então
    substitui o original (os.replace é atômico no SO). Evita que o
    JSON fique corrompido se duas requisições escreverem ao mesmo
    tempo, ou se o processo cair no meio da escrita."""
    path = _resolve(filename)
    path.parent.mkdir(parents=True, exist_ok=True)

    tmp_path = path.with_suffix(f".tmp-{uuid.uuid4().hex}")
    with open(tmp_path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    os.replace(tmp_path, path)


def allowed_file(filename):
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS


def save_image(file_storage):
    """Salva a imagem enviada com um nome único (evita conflito entre
    uploads de nomes iguais) e devolve o path público, no formato que
    o front-end usa para exibir a imagem: '/uploads/<nome>.jpg'."""
    if not file_storage or file_storage.filename == "":
        raise ValueError("nenhum arquivo enviado")

    if not allowed_file(file_storage.filename):
        raise ValueError("formato não permitido (use jpg, jpeg, png, webp ou gif)")

    file_storage.seek(0, os.SEEK_END)
    size = file_storage.tell()
    file_storage.seek(0)
    if size > MAX_FILE_SIZE_BYTES:
        raise ValueError("arquivo muito grande (máximo 8 MB)")

    ext = file_storage.filename.rsplit(".", 1)[1].lower()
    unique_name = f"{uuid.uuid4().hex}.{ext}"

    UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
    file_storage.save(UPLOADS_DIR / unique_name)

    return f"/uploads/{unique_name}"
