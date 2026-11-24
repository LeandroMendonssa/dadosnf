// 68-conflito-edicao.js — Aviso de conflito de edição (2.73.22)
// Problema: ao abrir uma edição, o app mostra os dados daquele instante. Se outro aparelho (ou a importação do ERP) mudar o mesmo registro
// enquanto a edição está aberta, o "Salvar" gravava por cima sem avisar. Aqui guardamos uma foto dos campos ao abrir a edição e, ao salvar,
// comparamos com o valor ao vivo (os ouvintes do Firestore já o mantêm atualizado: não faz leitura nova nem gasta cota).
// Se algo mudou nesse meio tempo, o app mostra o que mudou e pergunta antes de gravar. Não altera nenhuma regra de gravação.
// leandromendonssa
const conflitoBase = new Map();
const CONFLITO_NOTA = ['fornecedor', 'nf', 'vencimento', 'valor', 'obs'];
const CONFLITO_ROT = { fornecedor: 'fornecedor', nf: 'NF', vencimento: 'vencimento', valor: 'valor', obs: 'recurso', nomeReal: 'nome real', nomeExibido: 'apelido', cnpjs: 'CNPJs' };
function conflitoFoto(o, campos) { const f = {}; campos.forEach(c => { f[c] = c === 'cnpjs' ? JSON.stringify((o && o.cnpjs) || []) : String((o && o[c]) == null ? '' : o[c]).trim(); }); return f; }
function conflitoDifs(base, atual, campos) {
    return campos.filter(c => base[c] !== atual[c]).map(c => c === 'cnpjs'
        ? `${CONFLITO_ROT[c]}: ${JSON.parse(base[c]).length} → ${JSON.parse(atual[c]).length}`
        : `${CONFLITO_ROT[c] || c}: ${base[c] || '—'} → ${atual[c] || '—'}`);
}
function conflitoPerguntar(titulo, difs, aoConfirmar) {
    showConfirmModal({ title: titulo, confirmText: 'Salvar mesmo assim', confirmClass: 'warning',
        message: 'Outro aparelho alterou isto desde que você abriu a edição (' + difs.join('; ') + '). Salvar agora substitui essas mudanças. O que você digitou continua na tela se você cancelar.',
        onConfirm: aoConfirmar });
}

// ---- Notas do Repasse de NF ----
(function () {
    const abrir = toggleEditPanel, salvar = salvarEdicao;
    toggleEditPanel = function (btn, notaId) {
        const r = abrir.apply(this, arguments);
        try {
            const painel = btn && btn.closest('.nota-item') && btn.closest('.nota-item').querySelector('.edit-panel');
            const n = notasPendentes.find(x => x.id === notaId);
            if (painel && painel.classList.contains('show') && n) conflitoBase.set('nota:' + notaId, conflitoFoto(n, CONFLITO_NOTA)); else conflitoBase.delete('nota:' + notaId);
        } catch (e) { }
        return r;
    };
    salvarEdicao = async function (id) {
        const base = conflitoBase.get('nota:' + id), exec = () => { conflitoBase.delete('nota:' + id); return salvar.call(this, id); };
        if (!base) return salvar.call(this, id);
        const n = notasPendentes.find(x => x.id === id);
        if (!n) { toast('Esta nota não existe mais: foi arquivada ou excluída em outro aparelho.'); return; }
        const difs = conflitoDifs(base, conflitoFoto(n, CONFLITO_NOTA), CONFLITO_NOTA);
        if (!difs.length) return exec();
        conflitoPerguntar('Esta nota mudou em outro aparelho', difs, exec);
    };
})();

// ---- Cadastro de fornecedor (nome real e apelido) ----
(function () {
    const abrir = toggleEditarApelidoFornecedor, salvar = salvarApelidoFornecedor, CAMPOS = ['nomeReal', 'nomeExibido'];
    const atualDe = chave => {
        const origem = chave.slice(0, 2), id = chave.slice(3);
        if (origem === 'sp') { const d = listaFornecedoresSpData.find(f => f.id === id); return d ? conflitoFoto(d, CAMPOS) : null; }
        const ap = apelidosFornecedores[String(id).toUpperCase()];
        return { nomeReal: String(id), nomeExibido: String(ap || '').trim() };
    };
    toggleEditarApelidoFornecedor = function (chave) {
        const abrindo = !fornecedorEditando.has(chave);
        if (abrindo) { try { const a = atualDe(chave); if (a) conflitoBase.set('forn:' + chave, a); } catch (e) { } } else conflitoBase.delete('forn:' + chave);
        return abrir.apply(this, arguments);
    };
    salvarApelidoFornecedor = async function (chave) {
        const base = conflitoBase.get('forn:' + chave), exec = () => { conflitoBase.delete('forn:' + chave); return salvar.call(this, chave); };
        if (!base) return salvar.call(this, chave);
        let atual = null; try { atual = atualDe(chave); } catch (e) { }
        if (!atual) { toast('Este fornecedor não existe mais: foi alterado em outro aparelho.'); return; }
        const difs = conflitoDifs(base, atual, CAMPOS);
        if (!difs.length) return exec();
        conflitoPerguntar('Este fornecedor mudou em outro aparelho', difs, exec);
    };
})();
/* ARQ_V */ (window.ARQ_V = window.ARQ_V || {})['js/68-conflito-edicao.js'] = '2.73.22';
