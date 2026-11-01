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
        const atual = /\.js$/.test(arq) ? (reg[arq] || '0') : (tem[arq] || '0');
        if (arqVerNum(atual) < arqVerNum(ver)) problemas.push({ arq, atual, ver });
    });
    return problemas;
}
function arqMostrarAviso(problemas) {
    if (!problemas.length || document.getElementById('aviso-arquivos')) return;
    const b = document.createElement('div'); b.id = 'aviso-arquivos'; b.setAttribute('role', 'alert');
    b.innerHTML = `<div><b>Atualização incompleta</b><span>Estes arquivos estão antigos ou não carregaram: ${problemas.map(p => `${escRel(p.arq)} (${p.atual === '0' ? 'sem versão' : escRel(p.atual)}, precisa ${escRel(p.ver)})`).join('; ')}. Suba de novo e recarregue o app.</span></div><button type="button" onclick="this.parentNode.remove()">Fechar</button>`;
    document.body.appendChild(b);
}
window.addEventListener('load', () => { setTimeout(() => { try { const p = arqVerificar(); if (p.length) { console.warn('Arquivos desatualizados:', p); arqMostrarAviso(p); } } catch (e) { console.error('Verificação de arquivos:', e); } }, 1500); });
/* ARQ_V */ (window.ARQ_V = window.ARQ_V || {})['js/43-verificar-arquivos.js'] = '2.20.8';
