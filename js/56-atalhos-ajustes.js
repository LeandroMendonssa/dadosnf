// 56-atalhos-ajustes.js — Atalhos de telas dentro de Ajustes (2.50.0)
// Em Personalização > Ordem dos Menus, a estrela de cada tela a põe (ou tira) do grupo "Atalhos" no topo de Ajustes.
(function () {
    'use strict';
    const lista = () => (appConfig.personalizacao && appConfig.personalizacao.atalhosAjustes) || [];
    window.renderAtalhosAjustes = function () {
        const ul = document.getElementById('ajustes-atalhos'); if (!ul) return;
        const busca = document.getElementById('ajustes-busca');
        const itens = lista().filter(id => id !== 'screen-settings' && typeof menuDetails !== 'undefined' && menuDetails[id]);
        ul.style.display = itens.length && !(busca && busca.value.trim()) ? '' : 'none';
        ul.innerHTML = itens.map(id => { const d = menuDetails[id]; return `<li><a onclick="abrirTelaMenu('${id}', '${String(d.title).replace(/'/g, "\\'")}')"><i class="icon ${d.icon}" style="background-color:#007aff;"></i> ${d.title} <i class="fa-solid fa-chevron-right"></i></a></li>`; }).join('');
    };
    window.toggleAtalhoAjustes = function (id, on) {
        const cfg = appConfig.personalizacao = appConfig.personalizacao || {};
        const s = new Set(cfg.atalhosAjustes || []); if (on) s.add(id); else s.delete(id);
        cfg.atalhosAjustes = [...s];
        if (typeof salvarPersonalizacao === 'function') salvarPersonalizacao();
        if (typeof popularListaReordenar === 'function') popularListaReordenar();
        renderAtalhosAjustes();
    };
    const t = document.getElementById('screen-settings');
    if (t) {
        renderAtalhosAjustes();
        let ativa = t.classList.contains('active');
        new MutationObserver(() => { const a = t.classList.contains('active'); if (a && !ativa) renderAtalhosAjustes(); ativa = a; }).observe(t, { attributes: true, attributeFilter: ['class'] });
        const b = document.getElementById('ajustes-busca'); if (b) b.addEventListener('input', renderAtalhosAjustes);
    }
})();
/* ARQ_V */ (window.ARQ_V = window.ARQ_V || {})['js/56-atalhos-ajustes.js'] = '2.50.0';
