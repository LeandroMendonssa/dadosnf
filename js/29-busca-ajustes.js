// 29-busca-ajustes.js — 2.7.1: busca em Ajustes (telas de Ajustes e as opções da Personalização)
(function () {
    'use strict';
    const norm = t => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    // palavras que também levam a cada tela de Ajustes
    const CHAVES = {
        'screen-fornecedores': 'fornecedor cadastro empresa cnpj',
        'screen-observacoes': 'observacao texto padrao nota',
        'screen-spdata': 'produtos sp data sku catalogo',
        'screen-config-analise-cotacoes': 'analise cotacao ganhador preco regra',
        'screen-historico-mudancas': 'historico mudanca versao novidade atualizacao',
        'screen-personalizacao': 'aparencia tema personalizar visual',
        'screen-backup': 'backup copia seguranca dados restaurar exportar',
        'screen-conta': 'conta senha email perfil usuario sair',
        'screen-aprovacoes': 'aprovacao acesso usuario criar conta admin liberar'
    };
    const PZ = 'Personalização';
    // opções da Personalização: [título, palavras, tela, título da tela, id do campo, caminho]
    const OPCOES = [
        ['Tema do Aplicativo', 'claro escuro oceano por do sol floresta ameixa vinho cor', 'screen-pz-aparencia', 'Aparência', 'theme-select'],
        ['Estilo dos Ícones', 'icone solido material contorno duplo tom', 'screen-pz-aparencia', 'Aparência', 'icon-theme-select'],
        ['Fonte do Aplicativo', 'fonte letra arial inter serif mono montserrat tipografia', 'screen-pz-aparencia', 'Aparência', 'font-select'],
        ['Densidade das Listas', 'densidade confortavel compacta espacamento', 'screen-pz-aparencia', 'Aparência', 'density-select'],
        ['Velocidade das Animações', 'animacao velocidade lenta rapida desligar movimento', 'screen-pz-animacoes', 'Animações e Transições', 'animation-speed-slider'],
        ['Duração da troca de aba', 'duracao tempo transicao aba milissegundos', 'screen-pz-animacoes', 'Animações e Transições', 'tab-duracao-slider'],
        ['Efeito ao trocar de aba', 'efeito transicao esmaecer deslizar subir zoom instantaneo', 'screen-pz-animacoes', 'Animações e Transições', 'aba-efeito-options'],
        ['Pré-visualizar transição', 'testar previa transicao', 'screen-pz-animacoes', 'Animações e Transições', 'transition-demo-a'],
        ['Carregamento', 'carregando blocos brilho esqueleto texto', 'screen-pz-animacoes', 'Animações e Transições', 'carregamento-options'],
        ['Ícones na Navegação', 'icones barra navegacao mostrar ocultar texto', 'screen-pz-dock', 'Dock e Navegação', 'tab-icons-select'],
        ['Estilo da dock', 'dock barra inferior vidro liquido classico', 'screen-pz-dock', 'Dock e Navegação', 'dock-estilo'],
        ['Espessura do vidro', 'dock vidro espessura transparencia contraste', 'screen-pz-dock', 'Dock e Navegação', 'dock-espessura'],
        ['Velocidade da troca de aba (dock)', 'dock velocidade pilula troca aba', 'screen-pz-dock', 'Dock e Navegação', 'dock-velocidade'],
        ['Recolher a dock', 'dock recolher encolher expandir rolar', 'screen-pz-dock', 'Dock e Navegação', 'dock-encolher'],
        ['Reduzir Movimento (dock)', 'dock reduzir movimento acessibilidade', 'screen-pz-dock', 'Dock e Navegação', 'dock-movimento'],
        ['Ordem dos Menus e barra inferior', 'menu ordem barra mais reordenar ordenar mover itens', 'screen-pz-menus', 'Menus e Barra Inferior', 'menu-reorder-list'],
        ['Logo da Instituição', 'logo imagem pdf cabecalho instituicao enviar', 'screen-pz-logo', 'Logo da Instituição', 'logo-upload-input']
    ].map(o => ({ t: o[0], k: o[1], tela: o[2], tituloTela: o[3], alvo: o[4], caminho: PZ + ' › ' + o[3], icone: 'fa-sliders', cor: '#8e8e93' }));

    function entradas() {
        const lista = [];
        document.querySelectorAll('#ajustes-lista li').forEach(li => {
            const a = li.querySelector('a[data-screen]');
            if (!a || li.style.display === 'none') return;
            const t = (a.textContent || '').replace(/\s+/g, ' ').trim();
            const ic = a.querySelector('i.icon');
            lista.push({ t, k: CHAVES[a.dataset.screen] || '', caminho: 'Ajustes', link: a, icone: ic ? ic.className.replace('icon ', '').trim() : 'fa-solid fa-gear', cor: ic ? ic.style.backgroundColor : '#8e8e93', direto: true });
        });
        return lista.concat(OPCOES);
    }
    function procurar(q) {
        const toks = norm(q).split(/\s+/).filter(Boolean);
        if (!toks.length) return [];
        return entradas().map(e => {
            const hay = norm(e.t + ' ' + e.k + ' ' + e.caminho), titulo = norm(e.t);
            if (!toks.every(t => hay.includes(t))) return null;
            return { e, p: toks.every(t => titulo.includes(t)) ? 0 : 1 };
        }).filter(Boolean).sort((a, b) => a.p - b.p).map(x => x.e);
    }
    function abrir(e) {
        if (e.direto) { e.link.click(); return; }
        switchToScreen(e.tela, e.tituloTela);
        setTimeout(() => {
            const el = document.getElementById(e.alvo); if (!el) return;
            const bloco = el.closest('.campo') || el;
            bloco.scrollIntoView({ block: 'center', behavior: 'smooth' });
            bloco.classList.remove('ajuste-destaque'); void bloco.offsetWidth; bloco.classList.add('ajuste-destaque');
            setTimeout(() => bloco.classList.remove('ajuste-destaque'), 1800);
        }, 520);
    }
    function iniciar() {
        const inp = document.getElementById('ajustes-busca'), res = document.getElementById('ajustes-resultados'), lista = document.getElementById('ajustes-lista');
        if (!inp || !res || !lista) return;
        let atuais = [];
        const desenhar = () => {
            const q = inp.value.trim();
            if (!q) { res.style.display = 'none'; lista.style.display = ''; res.innerHTML = ''; atuais = []; return; }
            atuais = procurar(q);
            lista.style.display = 'none'; res.style.display = '';
            res.innerHTML = atuais.length
                ? atuais.map((e, i) => `<li><a data-i="${i}"><i class="icon fa-solid ${esc(e.icone.replace(/^fa-solid /, ''))}" style="background-color:${esc(e.cor || '#8e8e93')}"></i> <span class="pz-txt">${esc(e.t)}<small>${esc(e.caminho)}</small></span> <i class="fa-solid fa-chevron-right"></i></a></li>`).join('')
                : '<li><a style="cursor:default;color:var(--text-light)">Nada encontrado para essa busca.</a></li>';
        };
        inp.addEventListener('input', desenhar);
        inp.addEventListener('keydown', ev => { if (ev.key === 'Enter' && atuais[0]) { ev.preventDefault(); inp.blur(); abrir(atuais[0]); } });
        res.addEventListener('click', ev => { const a = ev.target.closest('a[data-i]'); if (a) abrir(atuais[+a.dataset.i]); });
    }
    window.buscaAjustes = { procurar };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar); else iniciar();
})();
