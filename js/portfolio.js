/* portfolio.js
   Renderiza os dados do portfólio (agora vindos de /api/portfolio,
   não mais de um portfolio-config.js fixo) dentro de cada painel, e
   controla a troca de abas.

   Cada aba tem seu próprio layout:
   - estaticos:   grid de miniaturas, agrupado por cliente
   - carrosseis:  cards grandes empilhados, com carrossel de slides
                  arrastável (swipe real — funciona com touch e mouse)
   - stories:     lista de destaques, com avatar circular e botão de play
*/

const SECTION_LABELS = {
    estaticos: "Artes estáticas",
    carrosseis: "Carrosséis",
    stories: "Stories"
};

/* ---------- Aba: Estáticos (grid) ---------- */

function createGridCard(item) {
    const card = document.createElement(item.image ? "a" : "div");
    card.className = "portfolio-card" + (item.image ? "" : " placeholder");

    if (item.image) {
        card.href = item.image;
        card.target = "_blank";
        card.rel = "noopener";

        const img = document.createElement("img");
        img.src = item.image;
        img.alt = item.caption || "Arte do portfólio";
        card.appendChild(img);

        if (item.caption) {
            const caption = document.createElement("span");
            caption.className = "caption";
            caption.textContent = item.caption;
            card.appendChild(caption);
        }
    } else {
        const icon = document.createElement("i");
        icon.className = "fa-regular fa-image";
        card.appendChild(icon);

        const label = document.createElement("span");
        label.textContent = "Em breve";
        card.appendChild(label);
    }

    return card;
}

function renderGridPanel(panel, groups) {
    const groupsWrap = document.createElement("div");
    groupsWrap.className = "client-groups";

    groups.forEach(group => {
        const groupEl = document.createElement("div");
        groupEl.className = "client-group";

        const header = document.createElement("div");
        header.className = "client-header";
        header.innerHTML = `<h3>${group.client}</h3><span class="client-meta">${group.meta}</span>`;
        groupEl.appendChild(header);

        const grid = document.createElement("div");
        grid.className = "portfolio-grid";
        group.items.forEach(item => grid.appendChild(createGridCard(item)));
        groupEl.appendChild(grid);

        groupsWrap.appendChild(groupEl);
    });

    panel.appendChild(groupsWrap);
}

/* ---------- Aba: Carrosséis (carrossel arrastável de verdade) ---------- */

const SWIPE_THRESHOLD = 40;

function createCarouselCard(item, group) {
    const images = Array.isArray(item.images) ? item.images.filter(Boolean) : [];
    const total = images.length;

    const card = document.createElement("div");
    card.className = "carousel-card" + (total ? "" : " placeholder");

    const cover = document.createElement("div");
    cover.className = "carousel-cover";

    if (total > 0) {
        const track = document.createElement("div");
        track.className = "carousel-track";

        images.forEach(src => {
            const img = document.createElement("img");
            img.src = src;
            img.alt = item.caption || "Slide do carrossel";
            img.draggable = false;
            track.appendChild(img);
        });

        cover.appendChild(track);

        const badge = document.createElement("span");
        badge.className = "slides-count-badge";
        badge.innerHTML = `<i class="fa-solid fa-layer-group"></i> <span class="count-current">1</span>/${total}`;
        cover.appendChild(badge);

        let dotsEl = null;

        if (total > 1) {
            const hint = document.createElement("span");
            hint.className = "swipe-hint";
            hint.innerHTML = `arraste <i class="fa-solid fa-chevron-right"></i>`;
            cover.appendChild(hint);

            dotsEl = document.createElement("div");
            dotsEl.className = "carousel-dots";
            for (let i = 0; i < total; i++) {
                const dot = document.createElement("span");
                dot.className = "dot" + (i === 0 ? " active" : "");
                dotsEl.appendChild(dot);
            }
            cover.appendChild(dotsEl);
        }

        setupCarouselDrag({ cover, track, badge, dotsEl, total });
    } else {
        const icon = document.createElement("i");
        icon.className = "fa-regular fa-image";
        cover.appendChild(icon);
    }

    card.appendChild(cover);

    const info = document.createElement("div");
    info.className = "carousel-info";

    const title = document.createElement("h4");
    title.className = "carousel-title";
    title.textContent = item.caption || group.client;
    info.appendChild(title);

    const subtitleParts = [group.handle, group.meta].filter(Boolean);
    if (subtitleParts.length) {
        const subtitle = document.createElement("span");
        subtitle.className = "carousel-subtitle";
        subtitle.textContent = subtitleParts.join(" · ");
        info.appendChild(subtitle);
    }

    card.appendChild(info);

    return card;
}

function setupCarouselDrag({ cover, track, badge, dotsEl, total }) {
    let currentIndex = 0;
    let startX = 0;
    let isDragging = false;

    function goToSlide(index) {
        currentIndex = Math.max(0, Math.min(total - 1, index));
        track.style.transform = `translateX(-${currentIndex * 100}%)`;

        const counter = badge.querySelector(".count-current");
        if (counter) counter.textContent = currentIndex + 1;

        if (dotsEl) {
            dotsEl.querySelectorAll(".dot").forEach((dot, i) => {
                dot.classList.toggle("active", i === currentIndex);
            });
        }
    }

    if (total <= 1) return;

    cover.classList.add("draggable");

    cover.addEventListener("pointerdown", (e) => {
        isDragging = true;
        startX = e.clientX;
        track.style.transition = "none";
        cover.setPointerCapture(e.pointerId);
        cover.classList.add("dragging");
    });

    cover.addEventListener("pointermove", (e) => {
        if (!isDragging) return;
        const delta = e.clientX - startX;
        const percent = (delta / cover.clientWidth) * 100;
        track.style.transform = `translateX(calc(-${currentIndex * 100}% + ${percent}%))`;
    });

    function endDrag(e) {
        if (!isDragging) return;
        isDragging = false;
        cover.classList.remove("dragging");
        track.style.transition = "transform 0.3s ease";

        const delta = e.clientX - startX;

        if (delta <= -SWIPE_THRESHOLD) {
            goToSlide(currentIndex + 1);
        } else if (delta >= SWIPE_THRESHOLD) {
            goToSlide(currentIndex - 1);
        } else {
            goToSlide(currentIndex);
        }
    }

    cover.addEventListener("pointerup", endDrag);
    cover.addEventListener("pointercancel", endDrag);
    cover.addEventListener("pointerleave", (e) => {
        if (isDragging) endDrag(e);
    });
}

function renderCarrosselPanel(panel, groups) {
    const list = document.createElement("div");
    list.className = "carousel-list";

    groups.forEach(group => {
        group.items.forEach(item => {
            list.appendChild(createCarouselCard(item, group));
        });
    });

    panel.appendChild(list);
}

/* ---------- Aba: Stories (lista de destaques) ---------- */

function createStoryRow(item, group) {
    const row = document.createElement(item.link ? "a" : "div");
    row.className = "story-row";

    if (item.link) {
        row.href = item.link;
        row.target = "_blank";
        row.rel = "noopener";
    }

    const avatar = document.createElement("div");
    avatar.className = "story-avatar";
    if (item.image) {
        const img = document.createElement("img");
        img.src = item.image;
        img.alt = item.caption || "Capa dos stories";
        avatar.appendChild(img);
    } else {
        const icon = document.createElement("i");
        icon.className = "fa-regular fa-image";
        avatar.appendChild(icon);
    }
    row.appendChild(avatar);

    const info = document.createElement("div");
    info.className = "story-info";

    const title = document.createElement("h4");
    title.className = "story-title";
    title.textContent = item.caption || "Stories";
    info.appendChild(title);

    const subtitleParts = [];
    if (item.count) subtitleParts.push(`${item.count} stories`);
    if (group.handle) subtitleParts.push(group.handle);

    if (subtitleParts.length) {
        const subtitle = document.createElement("span");
        subtitle.className = "story-subtitle";
        subtitle.textContent = subtitleParts.join(" · ");
        info.appendChild(subtitle);
    }

    row.appendChild(info);

    const playBtn = document.createElement("span");
    playBtn.className = "story-play";
    playBtn.innerHTML = `<i class="fa-solid fa-play"></i>`;
    row.appendChild(playBtn);

    return row;
}

function renderStoriesPanel(panel, groups) {
    const list = document.createElement("div");
    list.className = "story-list";

    groups.forEach(group => {
        group.items.forEach(item => {
            list.appendChild(createStoryRow(item, group));
        });
    });

    panel.appendChild(list);
}

/* ---------- Dispatcher geral ---------- */

function renderPanel(tabKey, data) {
    const panel = document.getElementById(`panel-${tabKey}`);
    if (!panel) return;

    panel.innerHTML = "";
    const groups = data[tabKey] || [];

    const label = document.createElement("div");
    label.className = "section-label";
    label.innerHTML = `<span class="marker"></span> ${SECTION_LABELS[tabKey]}`;
    panel.appendChild(label);

    if (tabKey === "estaticos") {
        renderGridPanel(panel, groups);
    } else if (tabKey === "carrosseis") {
        renderCarrosselPanel(panel, groups);
    } else if (tabKey === "stories") {
        renderStoriesPanel(panel, groups);
    }
}

function initTabs() {
    const tabs = document.querySelectorAll(".tab");
    tabs.forEach(tab => {
        tab.addEventListener("click", () => {
            tabs.forEach(t => t.classList.remove("active"));
            document.querySelectorAll(".tab-panel").forEach(p => p.classList.remove("active"));

            tab.classList.add("active");
            document.getElementById(`panel-${tab.dataset.tab}`).classList.add("active");
        });
    });
}

async function loadPortfolioData() {
    const res = await fetch(`${API_BASE}/api/portfolio`);
    if (!res.ok) throw new Error("não foi possível carregar o portfólio");
    return res.json();
}

document.addEventListener("DOMContentLoaded", async () => {
    try {
        const data = await loadPortfolioData();
        Object.keys(SECTION_LABELS).forEach(tab => renderPanel(tab, data));
    } catch (err) {
        console.error("Erro ao carregar portfólio:", err);
    }
    initTabs();
});
