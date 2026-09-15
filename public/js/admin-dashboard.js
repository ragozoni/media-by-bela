/* admin-dashboard.js
   -----------------------------------------------------------------
   Toda vez que uma ação de CRUD acontece (salvar, excluir, adicionar),
   o painel simplesmente recarrega os dados do zero (loadPortfolio()).
   É menos "otimizado" que atualizar só o pedacinho que mudou, mas é
   muito mais simples de manter e evita estado dessincronizado — para
   o volume de dados de um portfólio, a diferença é imperceptível.
   ----------------------------------------------------------------- */

let PORTFOLIO_CACHE = { estaticos: [], carrosseis: [], stories: [] };

/* ---------- Helpers de API ---------- */

async function apiFetch(path, options = {}) {
    const res = await fetch(`${API_BASE}${path}`, {
        credentials: "include",
        headers: { "Content-Type": "application/json", ...(options.headers || {}) },
        ...options
    });

    if (res.status === 401) {
        window.location.href = "admin-login.html";
        throw new Error("não autenticado");
    }

    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "erro na requisição");
    return data;
}

async function uploadImage(file) {
    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch(`${API_BASE}/api/admin/upload`, {
        method: "POST",
        credentials: "include",
        body: formData
    });

    if (res.status === 401) {
        window.location.href = "admin-login.html";
        throw new Error("não autenticado");
    }

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "falha no upload");
    return data.path;
}

/* ---------- Tabs ---------- */

function initAdminTabs() {
    const tabs = document.querySelectorAll(".admin-tab");
    tabs.forEach(tab => {
        tab.addEventListener("click", () => {
            tabs.forEach(t => t.classList.remove("active"));
            document.querySelectorAll(".admin-panel").forEach(p => p.classList.remove("active"));
            tab.classList.add("active");
            document.getElementById(`admin-panel-${tab.dataset.tab}`).classList.add("active");
        });
    });
}

/* ---------- Links ---------- */

async function loadLinks() {
    const links = await apiFetch("/api/admin/links");
    const form = document.getElementById("links-form");
    Object.entries(links).forEach(([key, value]) => {
        const input = form.querySelector(`[name="${key}"]`);
        if (input) input.value = value;
    });
}

function initLinksForm() {
    const form = document.getElementById("links-form");
    const status = document.getElementById("links-status");

    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const data = {};
        new FormData(form).forEach((value, key) => { data[key] = value; });

        status.textContent = "Salvando...";
        try {
            await apiFetch("/api/admin/links", { method: "PUT", body: JSON.stringify(data) });
            status.textContent = "Salvo!";
            setTimeout(() => { status.textContent = ""; }, 2000);
        } catch (err) {
            status.textContent = "Erro ao salvar: " + err.message;
        }
    });
}

/* ---------- Portfólio ---------- */

async function loadPortfolio() {
    PORTFOLIO_CACHE = await apiFetch("/api/admin/portfolio");
    ["estaticos", "carrosseis", "stories"].forEach(renderAdminTab);
}

function renderAdminTab(tab) {
    const panel = document.getElementById(`admin-panel-${tab}`);
    panel.innerHTML = "";

    const addGroupBtn = document.createElement("button");
    addGroupBtn.className = "btn-add-group";
    addGroupBtn.textContent = "+ Adicionar cliente";
    addGroupBtn.addEventListener("click", () => addGroup(tab));
    panel.appendChild(addGroupBtn);

    const groups = PORTFOLIO_CACHE[tab] || [];
    groups.forEach((group, groupIndex) => {
        panel.appendChild(renderGroupCard(tab, group, groupIndex));
    });
}

function renderGroupCard(tab, group, groupIndex) {
    const card = document.createElement("div");
    card.className = "admin-group";

    const header = document.createElement("div");
    header.className = "admin-group-header";

    const clientInput = document.createElement("input");
    clientInput.type = "text";
    clientInput.placeholder = "Nome do cliente";
    clientInput.value = group.client || "";
    header.appendChild(clientInput);

    const metaInput = document.createElement("input");
    metaInput.type = "text";
    metaInput.placeholder = "Categoria · descrição";
    metaInput.value = group.meta || "";
    header.appendChild(metaInput);

    let handleInput = null;
    if (tab === "carrosseis" || tab === "stories") {
        handleInput = document.createElement("input");
        handleInput.type = "text";
        handleInput.placeholder = "@handle";
        handleInput.value = group.handle || "";
        header.appendChild(handleInput);
    }

    const saveGroupBtn = document.createElement("button");
    saveGroupBtn.className = "btn-save";
    saveGroupBtn.textContent = "Salvar";
    saveGroupBtn.addEventListener("click", async () => {
        const body = { client: clientInput.value, meta: metaInput.value };
        if (handleInput) body.handle = handleInput.value;
        try {
            await apiFetch(`/api/admin/portfolio/${tab}/groups/${groupIndex}`, {
                method: "PUT",
                body: JSON.stringify(body)
            });
            await loadPortfolio();
        } catch (err) {
            alert("Erro ao salvar cliente: " + err.message);
        }
    });
    header.appendChild(saveGroupBtn);

    const deleteGroupBtn = document.createElement("button");
    deleteGroupBtn.className = "btn-delete";
    deleteGroupBtn.textContent = "Excluir";
    deleteGroupBtn.addEventListener("click", async () => {
        if (!confirm(`Excluir "${group.client}" e todos os itens dele?`)) return;
        await apiFetch(`/api/admin/portfolio/${tab}/groups/${groupIndex}`, { method: "DELETE" });
        await loadPortfolio();
    });
    header.appendChild(deleteGroupBtn);

    card.appendChild(header);

    const itemsWrap = document.createElement("div");
    itemsWrap.className = "admin-items";
    group.items.forEach((item, itemIndex) => {
        itemsWrap.appendChild(renderItemCard(tab, item, groupIndex, itemIndex));
    });
    card.appendChild(itemsWrap);

    const addItemBtn = document.createElement("button");
    addItemBtn.className = "btn-add-item";
    addItemBtn.textContent = "+ Adicionar item";
    addItemBtn.addEventListener("click", () => addItem(tab, groupIndex));
    card.appendChild(addItemBtn);

    return card;
}

function renderItemCard(tab, item, groupIndex, itemIndex) {
    const card = document.createElement("div");
    card.className = "admin-item";

    if (tab === "carrosseis") {
        return renderCarouselItemCard(item, groupIndex, itemIndex, card);
    }

    const preview = document.createElement("img");
    preview.className = "item-preview";
    if (item.image) {
        preview.src = item.image;
    } else {
        preview.style.display = "none";
    }
    card.appendChild(preview);

    let currentImage = item.image || null;

    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept = "image/*";
    fileInput.addEventListener("change", async () => {
        const file = fileInput.files[0];
        if (!file) return;
        try {
            currentImage = await uploadImage(file);
            preview.src = currentImage;
            preview.style.display = "block";
        } catch (err) {
            alert("Falha no upload: " + err.message);
        }
    });
    card.appendChild(fileInput);

    const captionInput = document.createElement("input");
    captionInput.type = "text";
    captionInput.placeholder = "Legenda";
    captionInput.value = item.caption || "";
    card.appendChild(captionInput);

    let countInput = null;
    let linkInput = null;
    if (tab === "stories") {
        countInput = document.createElement("input");
        countInput.type = "number";
        countInput.min = "0";
        countInput.placeholder = "Qtd. de stories";
        countInput.value = item.count || 0;
        card.appendChild(countInput);

        linkInput = document.createElement("input");
        linkInput.type = "text";
        linkInput.placeholder = "Link do destaque (opcional)";
        linkInput.value = item.link || "";
        card.appendChild(linkInput);
    }

    const saveBtn = document.createElement("button");
    saveBtn.className = "btn-save";
    saveBtn.textContent = "Salvar";
    saveBtn.addEventListener("click", async () => {
        const body = { image: currentImage, caption: captionInput.value };
        if (tab === "stories") {
            body.count = Number(countInput.value) || 0;
            body.link = linkInput.value || null;
        }
        try {
            await apiFetch(`/api/admin/portfolio/${tab}/groups/${groupIndex}/items/${itemIndex}`, {
                method: "PUT",
                body: JSON.stringify(body)
            });
            await loadPortfolio();
        } catch (err) {
            alert("Erro ao salvar item: " + err.message);
        }
    });
    card.appendChild(saveBtn);

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "btn-delete";
    deleteBtn.textContent = "Excluir";
    deleteBtn.addEventListener("click", async () => {
        if (!confirm("Excluir este item?")) return;
        await apiFetch(`/api/admin/portfolio/${tab}/groups/${groupIndex}/items/${itemIndex}`, { method: "DELETE" });
        await loadPortfolio();
    });
    card.appendChild(deleteBtn);

    return card;
}

function renderCarouselItemCard(item, groupIndex, itemIndex, card) {
    let images = Array.isArray(item.images) ? [...item.images] : [];

    const imagesWrap = document.createElement("div");
    imagesWrap.className = "carousel-images-list";

    function renderImagesList() {
        imagesWrap.innerHTML = "";
        images.forEach((src, i) => {
            const thumbWrap = document.createElement("div");
            thumbWrap.className = "carousel-image-thumb";

            const thumb = document.createElement("img");
            thumb.src = src;
            thumbWrap.appendChild(thumb);

            const removeBtn = document.createElement("button");
            removeBtn.type = "button";
            removeBtn.className = "btn-remove-thumb";
            removeBtn.textContent = "×";
            removeBtn.addEventListener("click", () => {
                images.splice(i, 1);
                renderImagesList();
            });
            thumbWrap.appendChild(removeBtn);

            imagesWrap.appendChild(thumbWrap);
        });
    }
    renderImagesList();
    card.appendChild(imagesWrap);

    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept = "image/*";
    fileInput.addEventListener("change", async () => {
        const file = fileInput.files[0];
        if (!file) return;
        try {
            const path = await uploadImage(file);
            images.push(path);
            renderImagesList();
            fileInput.value = "";
        } catch (err) {
            alert("Falha no upload: " + err.message);
        }
    });
    card.appendChild(fileInput);

    const captionInput = document.createElement("input");
    captionInput.type = "text";
    captionInput.placeholder = "Título do carrossel";
    captionInput.value = item.caption || "";
    card.appendChild(captionInput);

    const saveBtn = document.createElement("button");
    saveBtn.className = "btn-save";
    saveBtn.textContent = "Salvar";
    saveBtn.addEventListener("click", async () => {
        try {
            await apiFetch(`/api/admin/portfolio/carrosseis/groups/${groupIndex}/items/${itemIndex}`, {
                method: "PUT",
                body: JSON.stringify({ images, caption: captionInput.value })
            });
            await loadPortfolio();
        } catch (err) {
            alert("Erro ao salvar carrossel: " + err.message);
        }
    });
    card.appendChild(saveBtn);

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "btn-delete";
    deleteBtn.textContent = "Excluir";
    deleteBtn.addEventListener("click", async () => {
        if (!confirm("Excluir este carrossel?")) return;
        await apiFetch(`/api/admin/portfolio/carrosseis/groups/${groupIndex}/items/${itemIndex}`, { method: "DELETE" });
        await loadPortfolio();
    });
    card.appendChild(deleteBtn);

    return card;
}

async function addGroup(tab) {
    await apiFetch(`/api/admin/portfolio/${tab}/groups`, {
        method: "POST",
        body: JSON.stringify({ client: "Novo cliente", meta: "", handle: "" })
    });
    await loadPortfolio();
}

async function addItem(tab, groupIndex) {
    const body = tab === "carrosseis" ? { images: [], caption: "" } : { image: null, caption: "" };
    await apiFetch(`/api/admin/portfolio/${tab}/groups/${groupIndex}/items`, {
        method: "POST",
        body: JSON.stringify(body)
    });
    await loadPortfolio();
}

/* ---------- Inicialização ---------- */

document.addEventListener("DOMContentLoaded", async () => {
    const username = await requireAuth();
    if (!username) return;

    document.getElementById("admin-username").textContent = username;
    document.getElementById("logout-btn").addEventListener("click", async () => {
        await apiFetch("/api/logout", { method: "POST" });
        window.location.href = "admin-login.html";
    });

    initAdminTabs();
    initLinksForm();

    await loadLinks();
    await loadPortfolio();
});
