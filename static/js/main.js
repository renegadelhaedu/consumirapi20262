/**
 * main.js - Lógica frontend para consumo e exibição do JSON
 */

document.addEventListener("DOMContentLoaded", () => {
    // Elementos DOM
    const endpointInput = document.getElementById("endpointInput");
    const btnFetch = document.getElementById("btnFetch");
    const btnPresets = document.querySelectorAll(".btn-preset");
    
    // Alertas e Status
    const errorAlert = document.getElementById("errorAlert");
    const errorMessage = document.getElementById("errorMessage");
    const btnCloseAlert = document.getElementById("btnCloseAlert");
    const loadingIndicator = document.getElementById("loadingIndicator");
    const emptyState = document.getElementById("emptyState");
    const resultsHeader = document.getElementById("resultsHeader");
    const badgeStatus = document.getElementById("badgeStatus");
    const badgeCount = document.getElementById("badgeCount");
    const activeUrl = document.getElementById("activeUrl");
    const filterInput = document.getElementById("filterInput");

    // Vistas de Conteúdo
    const cardsView = document.getElementById("cardsView");
    const tableView = document.getElementById("tableView");
    const rawView = document.getElementById("rawView");
    const tableHead = document.getElementById("tableHead");
    const tableBody = document.getElementById("tableBody");
    const jsonCode = document.getElementById("jsonCode");
    const btnCopyJson = document.getElementById("btnCopyJson");

    // Botões de alternância de visualização
    const btnViewCards = document.getElementById("btnViewCards");
    const btnViewTable = document.getElementById("btnViewTable");
    const btnViewRaw = document.getElementById("btnViewRaw");

    // Estado da aplicação
    let currentRawData = null;
    let normalizedList = [];
    let currentView = "cards"; // 'cards' | 'table' | 'raw'

    // ========================================================
    // Funções de Consumo da API
    // ========================================================

    async function fetchData(url) {
        if (!url || !url.trim()) {
            showError("Por favor, informe uma URL válida para o endpoint.");
            return;
        }

        hideError();
        setLoading(true);

        try {
            const response = await fetch("/api/consumir", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ url: url.trim() })
            });

            const result = await response.json();

            if (!response.ok || !result.success) {
                const msg = result.error || `Erro na requisição (Código ${response.status})`;
                showError(msg);
                setLoading(false);
                return;
            }

            // Sucesso
            handleSuccessData(result);

        } catch (err) {
            showError("Falha ao comunicar com o servidor Flask local: " + err.message);
        } finally {
            setLoading(false);
        }
    }

    function handleSuccessData(result) {
        currentRawData = result.data;
        normalizedList = normalizeDataToList(result.data);

        // Atualiza cabeçalho de status
        badgeStatus.textContent = `HTTP ${result.status_code || 200}`;
        badgeCount.textContent = `${normalizedList.length} item(ns)`;
        activeUrl.textContent = result.url;
        activeUrl.title = result.url;

        emptyState.classList.add("hidden");
        resultsHeader.classList.remove("hidden");

        // Atualiza código bruto
        jsonCode.textContent = JSON.stringify(result.data, null, 2);

        // Renderiza lista
        renderCurrentView();
    }

    // Normaliza os dados para sempre obter uma lista para renderização
    function normalizeDataToList(data) {
        if (Array.isArray(data)) {
            return data;
        } else if (typeof data === "object" && data !== null) {
            // Se for um dicionário de objetos (ex: awesomeapi cotações), converte em array
            const keys = Object.keys(data);
            const isDictOfObjects = keys.every(k => typeof data[k] === "object" && data[k] !== null && !Array.isArray(data[k]));
            if (isDictOfObjects && keys.length > 0) {
                return keys.map(k => ({ _id_origem: k, ...data[k] }));
            }
            // Se for um objeto único simples (ex: ViaCEP), envelopa em array com 1 item
            return [data];
        } else {
            return [{ valor: data }];
        }
    }

    // ========================================================
    // Funções de Renderização
    // ========================================================

    function renderCurrentView() {
        const query = (filterInput.value || "").toLowerCase().trim();
        const filteredItems = filterItems(normalizedList, query);

        // Oculta todas as vistas
        cardsView.classList.add("hidden");
        tableView.classList.add("hidden");
        rawView.classList.add("hidden");

        if (currentView === "cards") {
            cardsView.classList.remove("hidden");
            renderCards(filteredItems);
        } else if (currentView === "table") {
            tableView.classList.remove("hidden");
            renderTable(filteredItems);
        } else if (currentView === "raw") {
            rawView.classList.remove("hidden");
        }
    }

    function filterItems(items, query) {
        if (!query) return items;
        return items.filter(item => {
            const str = JSON.stringify(item).toLowerCase();
            return str.includes(query);
        });
    }

    // Renderiza Cards
    function renderCards(items) {
        cardsView.innerHTML = "";

        if (items.length === 0) {
            cardsView.innerHTML = `<div class="empty-state" style="grid-column: 1 / -1;">
                <p>Nenhum item corresponde ao filtro pesquisado.</p>
            </div>`;
            return;
        }

        items.forEach((item, index) => {
            const card = document.createElement("article");
            card.className = "data-card";

            // Descobre um título sugerido (id, name, title, code, etc.)
            const titleField = item.name || item.title || item.nome || item.name_pt || item.code || `Item #${index + 1}`;
            const identifier = item.id || item._id_origem || `#${index + 1}`;

            let fieldsHtml = "";
            for (const [key, val] of Object.entries(item)) {
                if (key === "_id_origem") continue;
                fieldsHtml += `
                    <div class="card-field">
                        <span class="field-label">${escapeHtml(key)}:</span>
                        <span class="field-value">${formatFieldValue(val)}</span>
                    </div>
                `;
            }

            card.innerHTML = `
                <div class="card-header-bar">
                    <span class="card-index">${escapeHtml(String(identifier))}</span>
                </div>
                <h4 class="card-title">${escapeHtml(String(titleField))}</h4>
                <div class="card-body">
                    ${fieldsHtml}
                </div>
            `;

            cardsView.appendChild(card);
        });
    }

    // Renderiza Tabela Dinâmica
    function renderTable(items) {
        tableHead.innerHTML = "";
        tableBody.innerHTML = "";

        if (items.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="10" style="text-align: center; padding: 2rem;">Nenhum item corresponde ao filtro.</td></tr>`;
            return;
        }

        // Extrai todas as chaves únicas dos itens
        const allKeys = [];
        items.forEach(it => {
            if (typeof it === "object" && it !== null) {
                Object.keys(it).forEach(k => {
                    if (!allKeys.includes(k) && k !== "_id_origem") {
                        allKeys.push(k);
                    }
                });
            }
        });

        // Limita a 8 colunas para não estourar a tela se tiver dezenas de campos
        const displayKeys = allKeys.slice(0, 8);

        // Cria o thead
        const trHead = document.createElement("tr");
        const thIndex = document.createElement("th");
        thIndex.textContent = "#";
        trHead.appendChild(thIndex);

        displayKeys.forEach(k => {
            const th = document.createElement("th");
            th.textContent = k;
            trHead.appendChild(th);
        });
        tableHead.appendChild(trHead);

        // Cria o tbody
        items.forEach((item, idx) => {
            const tr = document.createElement("tr");
            const tdIndex = document.createElement("td");
            tdIndex.textContent = idx + 1;
            tr.appendChild(tdIndex);

            displayKeys.forEach(k => {
                const td = document.createElement("td");
                const val = item ? item[k] : "";
                td.innerHTML = formatFieldValue(val);
                tr.appendChild(td);
            });
            tableBody.appendChild(tr);
        });
    }

    // Formata o valor dos campos
    function formatFieldValue(val) {
        if (val === null || val === undefined) {
            return '<span style="color: var(--text-muted); font-style: italic;">null</span>';
        }
        if (typeof val === "boolean") {
            return val ? '<span class="badge badge-success">true</span>' : '<span class="badge" style="background:#fee2e2;color:#991b1b;">false</span>';
        }
        if (typeof val === "object") {
            return `<code>${escapeHtml(JSON.stringify(val))}</code>`;
        }
        
        const strVal = String(val);

        // Se for e-mail
        if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(strVal)) {
            return `<a href="mailto:${escapeHtml(strVal)}">${escapeHtml(strVal)}</a>`;
        }
        // Se for URL
        if (/^https?:\/\//.test(strVal)) {
            return `<a href="${escapeHtml(strVal)}" target="_blank" rel="noopener noreferrer">${escapeHtml(strVal)}</a>`;
        }

        return escapeHtml(strVal);
    }

    function escapeHtml(text) {
        return String(text)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    // ========================================================
    // Utilitários de Interface e Estados
    // ========================================================

    function setLoading(isLoading) {
        if (isLoading) {
            loadingIndicator.classList.remove("hidden");
            btnFetch.disabled = true;
            btnFetch.querySelector(".btn-text").textContent = "Carregando...";
        } else {
            loadingIndicator.classList.add("hidden");
            btnFetch.disabled = false;
            btnFetch.querySelector(".btn-text").textContent = "Carregar Dados";
        }
    }

    function showError(msg) {
        errorMessage.textContent = msg;
        errorAlert.classList.remove("hidden");
        errorAlert.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }

    function hideError() {
        errorAlert.classList.add("hidden");
        errorMessage.textContent = "";
    }

    function switchView(viewName) {
        currentView = viewName;
        btnViewCards.classList.toggle("active", viewName === "cards");
        btnViewTable.classList.toggle("active", viewName === "table");
        btnViewRaw.classList.toggle("active", viewName === "raw");
        renderCurrentView();
    }

    // ========================================================
    // Event Listeners
    // ========================================================

    // Botão Carregar Dados
    btnFetch.addEventListener("click", () => {
        fetchData(endpointInput.value);
    });

    // Enter no campo de entrada
    endpointInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
            fetchData(endpointInput.value);
        }
    });

    // Filtro de pesquisa em tempo real
    filterInput.addEventListener("input", () => {
        renderCurrentView();
    });

    // Presets de endpoints rápidos
    btnPresets.forEach(btn => {
        btn.addEventListener("click", () => {
            const url = btn.getAttribute("data-url");
            endpointInput.value = url;
            fetchData(url);
        });
    });

    // Alternar vistas
    btnViewCards.addEventListener("click", () => switchView("cards"));
    btnViewTable.addEventListener("click", () => switchView("table"));
    btnViewRaw.addEventListener("click", () => switchView("raw"));

    // Fechar alerta de erro
    btnCloseAlert.addEventListener("click", hideError);

    // Copiar JSON
    btnCopyJson.addEventListener("click", async () => {
        if (!currentRawData) return;
        try {
            await navigator.clipboard.writeText(JSON.stringify(currentRawData, null, 2));
            const oldText = btnCopyJson.textContent;
            btnCopyJson.textContent = "✅ Copiado!";
            setTimeout(() => {
                btnCopyJson.textContent = oldText;
            }, 2000);
        } catch {
            showError("Não foi possível copiar automaticamente para a área de transferência.");
        }
    });
});
