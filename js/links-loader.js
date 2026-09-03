/* links-loader.js
   Busca os links atuais em /api/links e preenche todo elemento
   marcado com data-link-key. A mesma key pode se repetir em quantos
   elementos quiser (ex: WhatsApp aparece no ícone e no card) — todos
   recebem o valor certo de uma vez. */

document.addEventListener("DOMContentLoaded", async () => {
    try {
        const res = await fetch(`${API_BASE}/api/links`);
        if (!res.ok) throw new Error("não foi possível carregar os links");
        const links = await res.json();

        document.querySelectorAll("[data-link-key]").forEach(el => {
            const key = el.dataset.linkKey;
            if (links[key]) el.href = links[key];
        });
    } catch (err) {
        console.error("Erro ao carregar links:", err);
    }
});
