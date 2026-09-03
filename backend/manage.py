"""
manage.py
-----------------------------------------------------------------
Uso:
    python manage.py create-admin

Pede usuário e senha no terminal (a senha não aparece na tela) e
salva com hash em users.json. Roda localmente ou dentro do
container já em produção:

    docker compose exec backend python manage.py create-admin
-----------------------------------------------------------------
"""

import getpass
import json
import sys
from pathlib import Path

from werkzeug.security import generate_password_hash

USERS_FILE = Path(__file__).parent / "users.json"


def load_users():
    if USERS_FILE.exists():
        with open(USERS_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    return []


def save_users(users):
    with open(USERS_FILE, "w", encoding="utf-8") as f:
        json.dump(users, f, ensure_ascii=False, indent=2)


def create_admin():
    users = load_users()

    username = input("Usuário: ").strip()
    if not username:
        print("Usuário não pode ser vazio.")
        sys.exit(1)

    if any(u["username"] == username for u in users):
        print(f"Já existe um usuário com o nome '{username}'.")
        sys.exit(1)

    password = getpass.getpass("Senha: ")
    confirm = getpass.getpass("Confirme a senha: ")

    if len(password) < 8:
        print("A senha precisa ter pelo menos 8 caracteres.")
        sys.exit(1)

    if password != confirm:
        print("As senhas não coincidem.")
        sys.exit(1)

    new_id = max((u["id"] for u in users), default=0) + 1
    users.append({
        "id": new_id,
        "username": username,
        "password_hash": generate_password_hash(password),
    })
    save_users(users)
    print(f"Usuário '{username}' criado com sucesso.")


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "create-admin":
        create_admin()
    else:
        print("Uso: python manage.py create-admin")
