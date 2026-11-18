/* ARQ_V */ (window.ARQ_V = window.ARQ_V || {})['js/59-historico-smartcompras.js'] = '2.57.2';
// 2.57.0: histórico de alterações do SmartCompras.
// Um marcador (bookmarklet) é tocado na página "Histórico de Pedidos" do SmartCompras, já logado.
// Ele manda o texto do diálogo para o app pelo endereço (#smartHist=...). O app lê, organiza e salva por pedido.
// Pelo mesmo caminho, #smartHistVer=<pedido> abre o histórico salvo desse pedido.

const SMART_HIST_MESES = { jan: 1, fev: 2, mar: 3, abr: 4, mai: 5, jun: 6, jul: 7, ago: 8, set: 9, out: 10, nov: 11, dez: 12 };
const SMART_HIST_MES_NOME = ['', 'jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

function smartHistEsc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Lê o texto copiado do diálogo "Histórico de Pedidos". Cada bloco tem data, hora e tipo, e pode ter várias alterações.
// Em QUANTIDADE o nome do produto vem ANTES do "De ... para ...". Em PRAZO DE PAGAMENTO o nome do fornecedor vem DEPOIS.
function smartHistParsear(texto) {
    const linhas = String(texto || '').split(/\n/).map(l => l.replace(/\s+/g, ' ').trim()).filter(Boolean);
    const blocos = [];
    let atual = null;
    let pendente = '';
    for (const l of linhas) {
        if (/^(Alçada de aprovações|Alterações$|Deseja |Cancelar$|Salvar alterações|Fornecedores visitantes|Termos e condições)/i.test(l)) break;
        const mData = l.match(/^(\d{1,2}) ([a-zç]{3})\.?$/i);
        if (mData && SMART_HIST_MESES[mData[2].toLowerCase()]) {
            atual = { dia: +mData[1], mes: SMART_HIST_MESES[mData[2].toLowerCase()], hora: '', tipo: '', usuario: '', mudancas: [] };
            blocos.push(atual);
            pendente = '';
            continue;
        }
        if (!atual) continue;
        if (/^\d{1,2}:\d{2}$/.test(l)) { atual.hora = l; continue; }
        const mTipo = l.match(/^(.+?)\s*ALTERA[ÇC][ÃA]O$/i);
        if (mTipo && !atual.tipo) { atual.tipo = mTipo[1].trim(); continue; }
        if (/^por /i.test(l) && !atual.usuario) { atual.usuario = l.replace(/^por /i, ''); continue; }
        const mDe = l.match(/^De (.+?) para (.+)$/i);
        const ehPrazo = /PRAZO/i.test(atual.tipo);
        if (mDe) {
            atual.mudancas.push({ nome: ehPrazo ? '' : pendente, de: mDe[1], para: mDe[2] });
            pendente = '';
            continue;
        }
        if (ehPrazo) {
            // Nome do fornecedor logo depois do "De ... para ...".
            const ultima = atual.mudancas[atual.mudancas.length - 1];
            if (ultima && !ultima.nome) ultima.nome = l;
            continue;
        }
        pendente = pendente ? pendente + ' ' + l : l;
    }
    const hoje = new Date();
    // 2.57.2: só alteração de QUANTIDADE interessa à cotação. Prazo de pagamento e outras são descartadas antes de guardar.
    return blocos.filter(b => /QUANTIDADE/i.test(b.tipo) && b.mudancas.length).map(b => {
        let ano = hoje.getFullYear();
        // Sem o ano na tela: se a data cair mais de um mês à frente de hoje, é do ano anterior (virada de dezembro).
        if (new Date(ano, b.mes - 1, b.dia) > new Date(hoje.getTime() + 31 * 86400000)) ano -= 1;
        const iso = ano + '-' + String(b.mes).padStart(2, '0') + '-' + String(b.dia).padStart(2, '0');
        return { dataIso: iso, dataTexto: b.dia + ' ' + SMART_HIST_MES_NOME[b.mes], hora: b.hora, tipo: b.tipo, usuario: b.usuario, mudancas: b.mudancas };
    }).sort((x, y) => (y.dataIso + y.hora).localeCompare(x.dataIso + x.hora));
}

function smartHistModal(html) {
    let el = document.getElementById('smart-hist-modal');
    if (!el) {
        el = document.createElement('div');
        el.id = 'smart-hist-modal';
        el.className = 'hs-overlay';
        document.body.appendChild(el);
    }
    el.innerHTML = `<div class="hs-caixa">${html}<div class="hs-acoes"><button type="button" class="action-chip" onclick="smartHistFechar()">Fechar</button></div></div>`;
    el.style.display = 'flex';
}
function smartHistFechar() {
    const el = document.getElementById('smart-hist-modal');
    if (el) el.style.display = 'none';
}

function smartHistRenderLista(pedido, entradas, rodape) {
    const blocos = (entradas || []).map(e => `
        <div class="hs-linha">
            <div><b>${smartHistEsc(e.dataTexto)} ${smartHistEsc(e.hora)}</b> · ${smartHistEsc(e.tipo)} · por ${smartHistEsc(e.usuario)}</div>
            ${(e.mudancas || []).map(m => `<div class="hs-mud">${m.nome ? smartHistEsc(m.nome) + ': ' : ''}De <b>${smartHistEsc(m.de)}</b> para <b>${smartHistEsc(m.para)}</b></div>`).join('')}
        </div>`).join('');
    return `<h3>Histórico do pedido ${smartHistEsc(pedido)}</h3>
        <div class="hs-lista">${blocos || '<div>Nenhuma alteração encontrada.</div>'}</div>
        ${rodape || ''}`;
}

// Recebe o conteúdo do marcador e mostra a conferência antes de salvar.
function smartHistMostrarImportacao(dados) {
    const pedido = String(dados.pedido || '').trim();
    const entradas = smartHistParsear(dados.texto);
    if (!entradas.length) return toast('Não achei alterações nesse texto. Abra o Histórico de Pedidos e toque no marcador de novo.');
    const rodape = `<p class="txt-aux">Ao salvar, o histórico anterior desse pedido é substituído pelo que está na tela.</p>
        <div class="hs-acoes"><button type="button" class="action-chip" onclick="smartHistSalvar('${smartHistEsc(pedido)}')">Salvar histórico do pedido ${smartHistEsc(pedido || '?')}</button></div>`;
    window.__smartHistPendenteEntradas = entradas;
    if (!pedido) {
        return smartHistModal(smartHistRenderLista('(sem número)', entradas, '<p>Não achei o número do pedido nessa página, então não dá para salvar.</p>'));
    }
    smartHistModal(smartHistRenderLista(pedido, entradas, rodape));
}

async function smartHistSalvar(pedido) {
    const entradas = window.__smartHistPendenteEntradas || [];
    if (!pedido || !entradas.length) return toast('Nada para salvar.');
    try {
        await firestore.collection('historicoSmartCompras').doc(String(pedido)).set({
            pedido: String(pedido),
            entradas: entradas,
            atualizadoEm: new Date().toISOString(),
            atualizadoPor: (firebase.auth().currentUser && firebase.auth().currentUser.email) || ''
        });
        window.__smartHistPendenteEntradas = null;
        toast('✓ Histórico do pedido ' + pedido + ' salvo.');
        smartHistFechar();
    } catch (e) {
        console.error('Erro ao salvar histórico SmartCompras:', e);
        toast('✕ Não consegui salvar. Confira o acesso e as regras do Firestore.');
    }
}

async function smartHistAbrirSalvo(pedido) {
    try {
        const d = await firestore.collection('historicoSmartCompras').doc(String(pedido)).get();
        if (!d.exists) return toast('Ainda não há histórico salvo do pedido ' + pedido + '.');
        const dados = d.data() || {};
        smartHistModal(smartHistRenderLista(pedido, dados.entradas, `<p class="txt-aux">Salvo em ${smartHistEsc((dados.atualizadoEm || '').slice(0, 10))} por ${smartHistEsc(dados.atualizadoPor || '')}.</p>`));
    } catch (e) {
        console.error('Erro ao abrir histórico SmartCompras:', e);
        toast('✕ Não consegui abrir o histórico salvo.');
    }
}

// Guarda o que veio pelo endereço antes do login, porque o login pode recarregar a página.
(function smartHistReceberHash() {
    const h = location.hash || '';
    if (h.indexOf('#smartHist=') === 0) {
        try { sessionStorage.setItem('smartHistPendente', decodeURIComponent(escape(atob(h.slice(11))))); }
        catch (e) { console.error('Histórico SmartCompras: link inválido', e); }
        history.replaceState(null, '', location.pathname + location.search);
    } else if (h.indexOf('#smartHistVer=') === 0) {
        try { sessionStorage.setItem('smartHistVer', h.slice(14)); } catch (e) { }
        history.replaceState(null, '', location.pathname + location.search);
    }
})();

function smartHistProcessarPendentes() {
    let pend = null, ver = null;
    try {
        pend = sessionStorage.getItem('smartHistPendente'); sessionStorage.removeItem('smartHistPendente');
        ver = sessionStorage.getItem('smartHistVer'); sessionStorage.removeItem('smartHistVer');
    } catch (e) { }
    if (pend) { try { smartHistMostrarImportacao(JSON.parse(pend)); } catch (e) { toast('✕ Não consegui ler o histórico recebido.'); } }
    if (ver) smartHistAbrirSalvo(ver);
}

// Só processa depois do login, quando o Firestore já aceita a gravação.
firebase.auth().onAuthStateChanged(u => {
    if (u) setTimeout(smartHistProcessarPendentes, 1500);
});
