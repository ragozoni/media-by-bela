/* admin-login.js */

document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("login-form");
    const errorEl = document.getElementById("login-error");
    const submitBtn = form.querySelector("button[type=submit]");

    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        errorEl.textContent = "";
        submitBtn.disabled = true;
        submitBtn.textContent = "Entrando...";

        const username = form.username.value.trim();
        const password = form.password.value;

        try {
            const res = await fetch(`${API_BASE}/api/login`, {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ username, password })
            });

            const data = await res.json();

            if (!res.ok) {
                errorEl.textContent = data.error || "Não foi possível entrar.";
                return;
            }

            window.location.href = "admin-dashboard.html";
        } catch (err) {
            errorEl.textContent = "Erro de conexão com o servidor.";
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = "Entrar";
        }
    });
});
