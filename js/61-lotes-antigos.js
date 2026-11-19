/* ARQ_V */ (window.ARQ_V = window.ARQ_V || {})['js/61-lotes-antigos.js'] = '2.58.0';
// 2.58.0: uma tela só de lote (Buscar lote mostra dados atuais e modelo novo, com a origem de cada resultado).
// 2.57.9: lotes de NFs antigas (PDF). Lê só o que serve para achar o lote: lote, nº da NF, data, CNPJ do fornecedor e o caminho do PDF.
// Não guarda produto, valor nem texto da nota. Usado pela página lotes.html (leitura e gravação) e pela tela Buscar lote (consulta).
// Sem Firebase no carregamento: o Firestore só é usado dentro das funções, quando chamadas.

const LOTES_COLECAO = 'lotesNF';
const LOTES_CNPJ_PROPRIO = '16968547000115'; // CNPJ da instituição: não é o fornecedor da NF

// Letras que o OCR e a digitação costumam trocar por números. Na comparação, valem o mesmo.
const LOTES_PARECIDOS = { O: '0', I: '1', L: '1', B: '8', S: '5', Z: '2' };

function lotesEsc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function lotesDigitos(s) { return String(s || '').replace(/\D/g, ''); }

// Forma de comparação do lote: maiúsculas, sem separadores, com as letras parecidas trocadas por números.
function lotesChave(s) {
    return String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/[OILBSZ]/g, c => LOTES_PARECIDOS[c]);
}

// Diferença mínima entre dois textos (Levenshtein), para a busca aproximada.
function lotesDistancia(a, b) {
    if (a === b) return 0;
    let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
        const cur = [i];
        for (let j = 1; j <= b.length; j++) {
            cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
        }
        prev = cur;
    }
    return prev[b.length];
}

function lotesDataISO(texto) {
    const m = String(texto || '').match(/(\d{2})\/(\d{2})\/(\d{4})/);
    return m ? `${m[3]}-${m[2]}-${m[1]}` : '';
}

// Analisa o texto de um PDF (com camada de texto ou vindo do OCR) e devolve só o necessário para a busca.
function lotesAnalisarTexto(texto, caminho) {
    const t = String(texto || '').replace(/ /g, ' ');
    // Número da NF: "Nº. 215606", "N.000745455", "Nº 1349459"
    let nf = '';
    const mN = t.match(/N[ºo°\.]\s*\.?\s*(\d[\d.]{2,14})/i);
    if (mN) nf = mN[1].replace(/\D/g, '').replace(/^0+/, '');
    if (nf.length < 3) nf = '';
    if (!nf) { const mA = String(caminho || '').match(/(\d{4,9})/); if (mA) nf = mA[1]; }
    // CNPJ do emitente: o primeiro que não for o da própria instituição
    let cnpj = '';
    const reFmt = /(\d{2})\.(\d{3})\.(\d{3})\/(\d{4})-(\d{2})/g;
    let mc;
    while (!cnpj && (mc = reFmt.exec(t))) { const d = mc.slice(1).join(''); if (d !== LOTES_CNPJ_PROPRIO) cnpj = d; }
    const reNu = /(^|\D)(\d{14})(?!\d)/g;   // sem "lookbehind": compatível com iPhone mais antigo
    while (!cnpj && (mc = reNu.exec(t))) { if (mc[2] !== LOTES_CNPJ_PROPRIO) cnpj = mc[2]; }
    // Data de emissão: a que vem depois de "EMISSÃO"; se não achar, a primeira data do texto
    let data = '';
    const mE = t.match(/EMISS[ÃA]O[\s\S]{0,60}?(\d{2}\/\d{2}\/\d{4})/i) || t.match(/(\d{2}\/\d{2}\/\d{4})/);
    if (mE) data = lotesDataISO(mE[1]);
    // Lotes: "LT. 3110260" / "L.T 593682" / "LOTE 24A0731". Só conta o que tem número, para não pegar o cabeçalho "LOTE/VALID".
    const achados = new Map();
    const padroes = [/\bL\.?\s?T\.?\s*[:\-]?\s*([A-Z0-9][A-Z0-9\-\/\.]{3,19})/gi, /\bLOTE\s*[:\-]?\s*([A-Z0-9][A-Z0-9\-\/\.]{3,19})/gi, /\bL:\s*([A-Z0-9][A-Z0-9\-\/]{3,19})/gi];
    padroes.forEach(re => {
        re.lastIndex = 0;
        let x;
        while ((x = re.exec(t))) {
            const bruto = x[1].replace(/[.\-\/]+$/, '');
            if (!/\d/.test(bruto) || bruto.length < 4) continue;
            const ch = lotesChave(bruto);
            if (ch.length < 4 || achados.has(ch)) continue;
            achados.set(ch, bruto);
        }
    });
    return { nf, cnpj, data, caminho: String(caminho || ''), lotes: [...achados].map(([chave, lote]) => ({ lote, chave })) };
}

// Documento gravado: um por NF. Sem produto.
function lotesDocumento(nf) {
    const chaves = nf.lotes.map(x => x.chave);
    return {
        cnpj: nf.cnpj || '',
        nf: nf.nf,
        data: nf.data || '',
        caminho: nf.caminho || '',
        lotes: nf.lotes.map(x => x.lote),
        chaves,
        prefixos: [...new Set(chaves.map(c => c.slice(0, 3)))],
        sufixos: [...new Set(chaves.map(c => c.slice(-3)))],
        atualizadoEm: new Date().toISOString()
    };
}

// Nome do fornecedor a partir da lista do app (se o CNPJ já estiver cadastrado).
function lotesNomeFornecedor(cnpj) {
    try {
        const lista = typeof listaFornecedoresSpData !== 'undefined' ? listaFornecedoresSpData : [];
        for (const f of lista) {
            for (const c of (f.cnpjs || [])) {
                if (lotesDigitos(c.cnpj) === cnpj) return c.nomeExibido || c.nomeReal || f.nomeExibido || f.nomeReal || '';
            }
        }
    } catch (e) { }
    return '';
}
function lotesCnpjFormatado(d) {
    d = lotesDigitos(d);
    return d.length === 14 ? `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}` : d;
}
function lotesDataBR(iso) { const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})$/); return m ? `${m[3]}/${m[2]}/${m[1]}` : (iso || ''); }

// Grava uma lista de NFs (já conferidas). Em lotes de 100 por gravação, para não passar do limite do Firestore.
async function lotesGravar(lista, aoProgredir) {
    const validas = lista.filter(n => n.nf && n.lotes && n.lotes.length);
    for (let i = 0; i < validas.length; i += 100) {
        const b = firestore.batch();
        validas.slice(i, i + 100).forEach(n => {
            const id = (n.cnpj || 'sem-cnpj') + '_' + n.nf;
            b.set(firestore.collection(LOTES_COLECAO).doc(id), lotesDocumento(n));
        });
        await b.commit();
        if (aoProgredir) aoProgredir(Math.min(i + 100, validas.length), validas.length);
    }
    return validas.length;
}

// Busca um lote. Exata: mesma chave. Aproximada: até 2 diferenças, só a partir de 5 caracteres.
async function lotesBuscarLote(q) {
    const n = lotesChave(q);
    if (n.length < 4) return [];
    const col = firestore.collection(LOTES_COLECAO);
    const consultas = [col.where('chaves', 'array-contains', n).limit(50).get()];
    if (n.length >= 5) {
        consultas.push(col.where('prefixos', 'array-contains', n.slice(0, 3)).limit(60).get());
        consultas.push(col.where('sufixos', 'array-contains', n.slice(-3)).limit(60).get());
    }
    const snaps = await Promise.all(consultas);
    const docs = new Map();
    snaps.forEach(s => s.docs.forEach(d => docs.set(d.id, d.data())));
    const maxDif = n.length >= 5 ? 2 : 0;
    const achados = [];
    docs.forEach(d => {
        (d.chaves || []).forEach((ch, i) => {
            const dif = lotesDistancia(n, ch);
            if (dif <= maxDif) achados.push({ dif, lote: (d.lotes || [])[i] || ch, nf: d.nf, cnpj: d.cnpj, data: d.data, caminho: d.caminho });
        });
    });
    achados.sort((a, b) => a.dif - b.dif || String(b.data).localeCompare(String(a.data)));
    return achados;
}

// Tela Buscar lote: vários lotes de uma vez (um por linha), só no modelo novo. Mostra o melhor resultado de cada um.
async function loteAntigoBuscarVarios() {
    const txt = (document.getElementById('lote-antigo-varios') || {}).value || '';
    const out = document.getElementById('lote-antigo-resultado');
    if (!out) return;
    const lotes = [...new Set(txt.split(/[\n,;]+/).map(s => s.trim()).filter(s => lotesChave(s).length >= 4))].slice(0, 100);
    if (!lotes.length) { out.innerHTML = '<div class="ini-vazio">Cole os lotes, um por linha (mínimo de 4 caracteres).</div>'; return; }
    out.innerHTML = `<div class="ini-vazio">Buscando ${lotes.length} lote(s)…</div>`;
    try {
        const linhas = [];
        for (const q of lotes) {
            const r = await lotesBuscarLote(q);
            if (!r.length) { linhas.push(`<tr><td>${lotesEsc(q)}</td><td colspan="4">Não encontrado</td></tr>`); continue; }
            const m = r[0];
            const extra = r.length > 1 ? ` <small>(+${r.length - 1} outra${r.length > 2 ? 's' : ''})</small>` : '';
            const tipo = m.dif === 0 ? 'Exata' : `Aproximada (${m.dif} dif.)`;
            linhas.push(`<tr><td>${lotesEsc(q)}</td><td>${tipo}${extra}</td><td>NF ${lotesEsc(m.nf)}</td><td>${lotesEsc(lotesDataBR(m.data))}</td><td>${lotesEsc(lotesNomeFornecedor(m.cnpj) || lotesCnpjFormatado(m.cnpj))}<br><small>${lotesEsc(m.caminho)}</small></td></tr>`);
        }
        out.innerHTML = `<div class="lote-ant-lista"><table class="lote-ant-tab"><thead><tr><th>Lote</th><th>Resultado</th><th>NF</th><th>Data</th><th>Fornecedor e arquivo</th></tr></thead><tbody>${linhas.join('')}</tbody></table></div>`;
    } catch (e) {
        console.error('Busca de vários lotes antigos:', e);
        out.innerHTML = '<div class="ini-vazio">Não consegui buscar agora. Confira a internet e tente de novo.</div>';
    }
}
