/* auth-guard.js
   Confere se existe sessão válida chamando /api/me. Se não estiver
   logado, redireciona pro login. Usado pelo dashboard antes de
   renderizar qualquer coisa. */

async function requireAuth() {
    try {
        const res = await fetch(`${API_BASE}/api/me`, { credentials: "include" });
        const data = await res.json();

        if (!data.authenticated) {
            window.location.href = "admin-login.html";
            return null;
        }
        return data.username;
    } catch (err) {
        window.location.href = "admin-login.html";
        return null;
    }
}
