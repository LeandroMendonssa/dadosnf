// 43-verificar-arquivos.js — Avisa quando falta subir algum arquivo de uma atualização (2.20.8).
// Como funciona: cada atualização no Histórico de mudanças (js/14) lista os arquivos que mudaram (campo "arquivos"). Cada arquivo, ao carregar, registra a versão dele
// no final do próprio arquivo (ARQ_V['js/xx.js'] = 'x.y.z'); index.html e style.css registram pela meta "app-versao" e pela variável CSS --css-versao.
// Aqui comparamos: se um arquivo carregou com versão menor do que a última atualização que o citou (ou nem carregou), aparece o aviso no topo.
// Só há aviso quando o index.html e este arquivo estão no lugar. Vale para atualizações a partir da 2.20.8.
function arqVerNum(v) { const p = String(v || '0').split('.').map(n => parseInt(n, 10) || 0); return p[0] * 1e6 + (p[1] || 0) * 1e3 + (p[2] || 0); }
function arqVerificar() {
    const esperado = {};   // arquivo → maior versão que o citou
    (typeof HISTORICO_FASES !== 'undefined' ? HISTORICO_FASES : []).forEach(f => (f.arquivos || []).forEach(a => { if (!esperado[a] || arqVerNum(f.numero) > arqVerNum(esperado[a])) esperado[a] = f.numero; }));
    const tem = {}, reg = window.ARQ_V || {};
    try { const m = document.querySelector('meta[name="app-versao"]'); tem['index.html'] = m ? m.content : '0'; } catch (e) { tem['index.html'] = '0'; }
    try { tem['style.css'] = (getComputedStyle(document.documentElement).getPropertyValue('--css-versao') || '').replace(/['"\s]/g, '') || '0'; } catch (e) { tem['style.css'] = '0'; }
    const problemas = [];
    Object.entries(esperado).forEach(([arq, ver]) => {
        if (!/^js\//.test(arq) && arq !== 'index.html' && arq !== 'style.css') return;   // sw.js e a pasta avisos não dá para conferir daqui
        const atual = /\.js$/.test(arq) ? (reg[arq] || '0') : (tem[arq] || '0');
        if (arqVerNum(atual) < arqVerNum(ver)) problemas.push({ arq, atual, ver });
    });
    return problemas;
}
function arqMostrarAviso(problemas) {
    if (!problemas.length || document.getElementById('aviso-arquivos')) return;
    // 2.24.6: resumo geral primeiro (quantos arquivos faltam do total da última atualização); a lista fica em "Ver arquivos"
    const fases = (typeof HISTORICO_FASES !== 'undefined' ? HISTORICO_FASES : []), ult = fases[0] || {};
    const total = (ult.arquivos || []).filter(a => /^js\//.test(a) || a === 'index.html' || a === 'style.css').length;
    const faltam = problemas.length, alvo = problemas.reduce((m, p) => arqVerNum(p.ver) > arqVerNum(m) ? p.ver : m, '0');
    const resumo = total && faltam <= total ? `Faltam ${faltam} de ${total} arquivos da versão ${escRel(ult.numero || alvo)}.` : `${faltam} arquivo(s) estão antigos ou não carregaram (versão ${escRel(alvo)}).`;
    const b = document.createElement('div'); b.id = 'aviso-arquivos'; b.setAttribute('role', 'alert');
    b.innerHTML = `<div><b>Atualização incompleta</b><span>${resumo} Se a publicação ainda está em andamento, espere o aviso de conclusão e recarregue.</span>
        <details><summary>Ver arquivos</summary><span>${problemas.map(p => `${escRel(p.arq)} (${p.atual === '0' ? 'sem versão' : escRel(p.atual)}, precisa ${escRel(p.ver)})`).join('; ')}</span></details></div>
        <button type="button" onclick="location.reload()">Recarregar</button><button type="button" onclick="this.parentNode.remove()">Fechar</button>`;
    document.body.appendChild(b);
}
// 2.40.0: confere de novo depois (a publicação do GitHub Pages pode demorar e os arquivos chegam em momentos diferentes), ao voltar para o app e
// quando um botão chama algo que não existe (arquivo antigo no ar). O aviso só aparece uma vez; "Fechar" não o impede de voltar numa próxima conferência.
function arqConferirAgora() { try { const p = arqVerificar(); if (p.length) { console.warn('Arquivos desatualizados:', p); arqMostrarAviso(p); } return p; } catch (e) { console.error('Verificação de arquivos:', e); return []; } }
window.addEventListener('load', () => { [1500, 6000, 15000].forEach(t => setTimeout(arqConferirAgora, t)); });
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') setTimeout(arqConferirAgora, 800); });
window.addEventListener('error', e => {
    const m = String((e && e.message) || '');
    if (/Can't find variable|is not defined/i.test(m)) { const p = arqConferirAgora(); if (!p.length) console.warn('Função ausente (pode ser arquivo antigo):', m); }
});
// Lista com a versão que cada arquivo carregou (aparece no topo do Histórico de Mudanças)
function arqRelatorio() {
    const esperado = {};
    (typeof HISTORICO_FASES !== 'undefined' ? HISTORICO_FASES : []).forEach(f => (f.arquivos || []).forEach(a => { if (!/^js\//.test(a) && a !== 'index.html' && a !== 'style.css') return; if (!esperado[a] || arqVerNum(f.numero) > arqVerNum(esperado[a])) esperado[a] = f.numero; }));
    const reg = window.ARQ_V || {};
    const meta = document.querySelector('meta[name="app-versao"]');
    const css = (getComputedStyle(document.documentElement).getPropertyValue('--css-versao') || '').replace(/['"\s]/g, '');
    return Object.entries(esperado).map(([arq, ver]) => {
        const atual = arq === 'index.html' ? (meta ? meta.content : '0') : arq === 'style.css' ? (css || '0') : (reg[arq] || '0');
        return { arq, atual, ver, ok: arqVerNum(atual) >= arqVerNum(ver) };
    }).sort((a, b) => (a.ok - b.ok) || a.arq.localeCompare(b.arq));
}
function arqDesenharVersoes() {
    const tela = document.getElementById('screen-historico-mudancas'); if (!tela) return;
    let box = document.getElementById('arq-versoes');
    if (!box) { box = document.createElement('details'); box.id = 'arq-versoes'; box.className = 'card arq-versoes'; tela.insertBefore(box, tela.firstChild); }
    const r = arqRelatorio(), ruins = r.filter(x => !x.ok).length;
    box.innerHTML = `<summary>Versões dos arquivos carregados ${ruins ? `<b class="arq-ruim">(${ruins} desatualizado${ruins > 1 ? 's' : ''})</b>` : '<span class="arq-bom">(tudo em dia)</span>'}</summary>
        <div class="arq-lista">${r.map(x => `<div class="arq-lin ${x.ok ? '' : 'arq-ruim'}"><span>${x.ok ? '✓' : '✕'} ${escRel(x.arq)}</span><span>${x.atual === '0' ? 'sem versão' : escRel(x.atual)}${x.ok ? '' : ' → precisa ' + escRel(x.ver)}</span></div>`).join('')}</div>
        <button type="button" class="action-chip" style="color:var(--accent-text)" onclick="arqDesenharVersoes(); arqConferirAgora()">Conferir de novo</button>`;
}
(function () {
    const orig = switchToScreen;
    switchToScreen = function (id, t) { const r = orig.apply(this, arguments); if (id === 'screen-historico-mudancas') setTimeout(arqDesenharVersoes, 50); return r; };
})();
/* ARQ_V */ (window.ARQ_V = window.ARQ_V || {})['js/43-verificar-arquivos.js'] = '2.55.7';
