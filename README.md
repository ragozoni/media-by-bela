# Media by Bela

Site de links (estilo link-in-bio) + portfólio + painel administrativo da Media by Bela.

Front-end estático (HTML/CSS/JS puro) servido via **nginx**, com um **backend em Flask** para autenticação e edição de conteúdo (links, portfólio, imagens) sem precisar mexer em código. Os dois rodam em containers Docker separados.

---

## Stack

- **Front-end:** HTML, CSS e JavaScript puro (sem framework/build step)
- **Backend:** Python (Flask) + sessão via cookie
- **Dados:** arquivos JSON (`backend/data/`) — sem banco de dados. Imagens ficam em disco (`backend/uploads/`), e só o *caminho* delas é salvo no JSON
- **Infra:** Docker + Docker Compose, nginx como proxy reverso (serve o front e repassa `/api` e `/uploads` pro backend)

---

## Estrutura do projeto

```
maryele/
├── css/
│   ├── tokens.css          # paleta de cores e tipografia (fonte única)
│   ├── links.css
│   ├── portfolio.css
│   └── admin.css
├── html/
│   ├── links_page.html          # página pública de links
│   ├── portfolio-design_page.html
│   ├── admin-login.html
│   └── admin-dashboard.html
├── js/
│   ├── api-config.js         # URL base da API (compartilhada)
│   ├── links-loader.js       # busca /api/links e preenche a página
│   ├── portfolio.js          # busca /api/portfolio e renderiza os cards
│   ├── auth-guard.js         # protege o dashboard (redireciona se não logado)
│   ├── admin-login.js
│   └── admin-dashboard.js    # CRUD do painel (links, portfólio, upload)
├── backend/
│   ├── app.py                 # entrada Flask
│   ├── auth.py                # login/logout/sessão
│   ├── storage.py             # leitura/escrita atômica de JSON + upload de imagem
│   ├── routes_public.py       # GET /api/portfolio e /api/links (sem login)
│   ├── routes_admin.py        # CRUD protegido por login
│   ├── manage.py              # cria usuário admin via terminal
│   ├── data/
│   │   ├── portfolio.json
│   │   └── links.json
│   ├── uploads/                # imagens enviadas pelo admin
│   ├── users.json              # usuários (senha com hash) — nunca versionado
│   └── requirements.txt
├── nginx/
│   └── nginx.conf              # proxy reverso: /api e /uploads → backend
├── index.html                  # redireciona para html/links_page.html
├── Dockerfile                  # imagem do front (nginx)
├── docker-compose.yml
└── .env                         # SECRET_KEY do Flask (nunca versionado)
```

---

## Como rodar pela primeira vez

### 1. Configurar a `SECRET_KEY`
```bash
cp backend/.env.example .env
```
Edite o `.env` e gere uma chave forte:
```bash
python3 -c "import secrets; print(secrets.token_hex(32))"
```

### 2. Criar o usuário admin
O `users.json` precisa existir **antes** do primeiro `docker compose up` (senão o Docker cria uma pasta no lugar dele, e o login quebra).

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python manage.py create-admin
deactivate
cd ..
```

### 3. Subir os containers
```bash
docker compose up --build
```

- Site público: http://localhost:8080/html/links_page.html
- Portfólio: http://localhost:8080/html/portfolio-design_page.html
- Admin: http://localhost:8080/html/admin-login.html

---

## Como editar o conteúdo do site

Tudo (links do link-in-bio, clientes do portfólio, imagens, carrosséis) é editado pelo **painel admin** — não é mais necessário mexer em arquivo de configuração nem fazer deploy pra atualizar conteúdo.

1. Acesse `/html/admin-login.html` e entre com o usuário criado no passo 2 acima
2. Aba **Links** — edita Instagram, WhatsApp, Behance e os links dos cards
3. Abas **Estáticos / Carrosséis / Stories** — adiciona/edita/remove clientes e itens do portfólio, com upload de imagem direto pela interface

As mudanças são salvas nos arquivos JSON dentro de `backend/data/` (montados como volume Docker), então **persistem entre rebuilds** do container.

---

## Arquitetura — como as peças se conectam

```
Navegador
   │
   ▼
nginx (porta 8080)
   ├── serve os arquivos estáticos (css/, js/, html/)
   ├── /api/*      → proxy reverso → backend Flask (porta 5000)
   └── /uploads/*  → proxy reverso → backend Flask
```

O nginx atua como proxy reverso pra que o front e a API fiquem na **mesma origem** do ponto de vista do navegador — isso evita configuração de CORS e faz o cookie de sessão do login funcionar sem complicação. Por causa disso, **as chamadas de API só funcionam rodando via `docker compose`** (o proxy depende do nome do serviço `backend` resolvido pela rede interna do Docker).

---

## Backend — comandos úteis

```bash
# Criar um novo usuário admin
docker compose exec backend python manage.py create-admin

# Ver logs do backend
docker compose logs -f backend

# Ver logs do site (nginx)
docker compose logs -f site
```

---

## Segurança / dados sensíveis

Nunca são versionados no Git (já cobertos pelo `.gitignore`):
- `.env` (SECRET_KEY)
- `backend/users.json` (senhas — mesmo com hash)
- `backend/uploads/*` (imagens enviadas)
- `.idea/`, `__pycache__/`, `venv/`

Os arquivos `backend/data/portfolio.json` e `backend/data/links.json` **são versionados** — funcionam como um "estado inicial" (seed) do conteúdo, mas o conteúdo real em produção evolui via volume Docker, independente do que está no Git.

---

## Troubleshooting

**403 Forbidden ao acessar qualquer página**
Geralmente é permissão de arquivo — o nginx roda como usuário sem privilégio dentro do container. Se algum arquivo estático tiver permissão `600` (só o dono lê), o container não consegue servir. Corrija com:
```bash
find . -type f -not -path './.git/*' -not -path '*/venv/*' -not -path './backend/data/*' -not -path './backend/uploads/*' -exec chmod 644 {} \;
find . -type d -not -path './.git/*' -not -path '*/venv/*' -not -path './backend/data' -not -path './backend/uploads' -exec chmod 755 {} \;
docker compose up --build
```

**Login retorna erro 500 / não autentica**
Confira se `backend/users.json` é um **arquivo** e não uma pasta (`ls -la backend/users.json`). Se for pasta, remova e recrie com `python manage.py create-admin` antes de subir o Docker de novo.

**Editei conteúdo no admin, mas o site continua mostrando o valor antigo**
Provavelmente é cache do navegador — testa com hard refresh (`Ctrl+Shift+R`) ou aba anônima antes de suspeitar do Docker/backend.

**Alterações no admin sumiram depois de um rebuild**
Confirme que os volumes do `docker-compose.yml` (`backend/data`, `backend/uploads`, `backend/users.json`) estão configurados — sem eles, o `COPY` do Dockerfile sobrescreve tudo a cada build.

---

## Roadmap / pendências conhecidas

- Aba **Stories** do portfólio está desativada no front (comentada) — Instagram não oferece API pública pra embutir stories reais; a alternativa é linkar destaques (highlights) permanentes via o campo `link` de cada item
- Sem testes automatizados ainda
