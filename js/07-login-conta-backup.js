// 07-login-conta-backup.js — Formatação, login/segurança, conta e backup
// Parte do script do app (v2.0.1). Arquivo comum, carregado em ordem pelo index.html; compartilha funções e variáveis globais com os demais.
// --- MANIPULAÇÃO DE STRINGS E FORMATAÇÃO ---
function formatarDataInput(input){
    let v=input.value.replace(/\D/g,'').substring(0,8);
    if(v.length>4) v=`${v.slice(0,2)}/${v.slice(2,4)}/${v.slice(4)}`;
    else if(v.length>2) v=`${v.slice(0,2)}/${v.slice(2)}`;
    input.value=v;
}
function formatarValorBlur(event){
    let v=event.target.value.replace(/\./g,'').replace(',','.').replace(/[^\d.]/g,'');
    if(v) event.target.value=parseFloat(v).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
}

function closeAllModals(){document.querySelectorAll('.modal-screen.active').forEach(modal=>modal.classList.remove('active'))}
function personalizarMensagem(texto, ehSucesso){
    const nome = primeiroNomeUsuario();
    if (!nome || !ehSucesso) return texto;
    return `${texto.replace(/[.!]+$/, '')}, ${nome}!`;
}
function toast(msg){
    const t = document.getElementById('toast');
    const iconEl = document.getElementById('toast-icon');
    const textEl = document.getElementById('toast-text');
    const ehSucesso = msg.startsWith('✓');
    const ehErro = msg.startsWith('✕');
    const texto = (ehSucesso || ehErro) ? msg.slice(1).trim() : msg;
    iconEl.className = 'toast-icon' + (ehSucesso ? ' success' : ehErro ? ' error' : '');
    iconEl.innerHTML = ehSucesso ? '<i class="fa-solid fa-circle-check"></i>' : ehErro ? '<i class="fa-solid fa-circle-exclamation"></i>' : '';
    textEl.textContent = personalizarMensagem(texto, ehSucesso);
    t.style.display = 'flex';
    clearTimeout(window.__toastTimer);
    window.__toastTimer = setTimeout(() => t.style.display = 'none', 2000);
}

function showConfirmModal({title,message,confirmText="Confirmar",confirmClass="danger",onConfirm}){
    const modal=document.getElementById('confirm-modal');
    document.getElementById('confirm-title').textContent=title;
    document.getElementById('confirm-message').textContent=message;
    const confirmBtn=document.getElementById('confirm-btn');
    confirmBtn.textContent=confirmText;
    
    // Ajuste de classe do botão (cor do texto/borda — botão nunca é preenchido)
    confirmBtn.classList.remove('is-danger', 'is-success', 'is-warning');
    if(confirmClass === 'danger') confirmBtn.classList.add('is-danger');
    else if(confirmClass === 'success') confirmBtn.classList.add('is-success');
    else if(confirmClass === 'warning') confirmBtn.classList.add('is-warning');
    
    const cancelBtn=document.getElementById('cancel-btn');
    const confirmHandler=()=>{onConfirm();closeAllModals();cleanup()};
    const cancelHandler=()=>{closeAllModals();cleanup()};
    const cleanup=()=>{confirmBtn.removeEventListener('click',confirmHandler);cancelBtn.removeEventListener('click',cancelHandler)};
    confirmBtn.addEventListener('click',confirmHandler);
    cancelBtn.addEventListener('click',cancelHandler);
    modal.classList.add('active');
}

// --- FUNÇÕES DE SEGURANÇA E LOGIN (Firebase Authentication) ---
const auth = firebase.auth();

let confirmationResultTelefone = null;
let recaptchaVerifier = null;

// Traduz os códigos de erro mais comuns do Firebase Auth para mensagens em
// português. O código original vai entre parênteses pra facilitar diagnóstico
// (o Google/telefone estão dando erro — isso ajuda a identificar qual é).
function traduzErroAuth(error) {
    const mapa = {
        'auth/invalid-email': 'E-mail inválido.',
        'auth/user-disabled': 'Esta conta foi desativada.',
        'auth/user-not-found': 'E-mail ou senha incorretos.',
        'auth/wrong-password': 'E-mail ou senha incorretos.',
        'auth/invalid-credential': 'E-mail ou senha incorretos.',
        'auth/too-many-requests': 'Muitas tentativas. Tente novamente em alguns minutos.',
        'auth/network-request-failed': 'Falha de conexão. Verifique sua internet.',
        'auth/popup-closed-by-user': 'Login cancelado.',
        'auth/popup-blocked': 'O navegador bloqueou a janela de login. Tentando de outro jeito...',
        'auth/operation-not-supported-in-this-environment': 'O login não funciona com o app aberto como arquivo local (file://). Abra pelo endereço do app (https://) ou por um servidor local (http://localhost).',
        'auth/unauthorized-domain': 'Este domínio não está autorizado no Firebase (Authentication → Settings → Authorized domains).',
        'auth/invalid-phone-number': 'Número de telefone inválido. Use o formato +55 11 91234-5678.',
        'auth/invalid-verification-code': 'Código incorreto.',
        'auth/code-expired': 'Código expirado. Envie um novo.',
        'auth/weak-password': 'A senha precisa ter pelo menos 6 caracteres.',
        'auth/requires-recent-login': 'Por segurança, verifique sua senha novamente.',
        'auth/captcha-check-failed': 'A verificação do reCAPTCHA falhou. Tente novamente.',
        'auth/argument-error': 'Configuração inválida para este tipo de login.',
    };
    console.error('Erro Auth:', error.code, error.message);
    const base = mapa[error.code] || 'Ocorreu um erro ao entrar.';
    return `${base} (${error.code || 'sem código'})`;
}

function mostrarLoaderApp(mostrar) {
    const appLoader = document.getElementById('app-loader');
    if (!appLoader) return;
    appLoader.classList.toggle('app-loader-hidden', !mostrar);
    document.body.classList.toggle('is-loading', mostrar);
}

// Coleção onde ficam registradas as contas que entraram via Google/telefone
// (autocadastro). Contas de e-mail/senha são criadas manualmente por você no
// Console do Firebase, então essas já contam como aprovadas por definição.
// Google/telefone criam um pedido de acesso aqui, com aprovado:false, e você
// aprova mudando esse campo para true direto no Firestore (Console → Firestore
// Database → acessosAutorizados → o documento da pessoa → aprovado: true).
async function verificarAprovacaoAcesso(user) {
    const provedores = user.providerData.map(p => p.providerId);
    if (provedores.includes('password')) return true;
    try {
        const ref = firestore.collection('acessosAutorizados').doc(user.uid);
        const snap = await ref.get();
        if (!snap.exists) {
            await ref.set({
                email: user.email || null,
                telefone: user.phoneNumber || null,
                nome: user.displayName || '',
                aprovado: false,
                criadoEm: firebase.firestore.FieldValue.serverTimestamp()
            });
            await auth.signOut();
            mostrarEtapaPendente('Seu acesso foi solicitado e está aguardando aprovação. Assim que for liberado, você poderá entrar normalmente.');
            return false;
        }
        if (snap.data().aprovado !== true) {
            await auth.signOut();
            mostrarEtapaPendente('Sua conta ainda não foi aprovada. Peça para o administrador liberar seu acesso.');
            return false;
        }
        return true;
    } catch (e) {
        console.error('Erro ao verificar aprovação:', e);
        await auth.signOut();
        document.getElementById('login-error-message').textContent = 'Não foi possível verificar seu acesso. Tente novamente.';
        return false;
    }
}

// onAuthStateChanged é a fonte da verdade sobre o login — dispara na carga inicial
// e sempre que o usuário entra/sai, em qualquer aba/dispositivo com a sessão ativa.
auth.onAuthStateChanged(async (user) => {
    if (user) {
        mostrarLoaderApp(true);
        const permitido = await verificarAprovacaoAcesso(user);
        if (!permitido) return; // signOut() já disparou onAuthStateChanged de novo com user=null

        document.getElementById('app-container').style.display = 'flex';
        document.getElementById('login-screen').style.display = 'none';
        atualizarTelaConta(user);
        atualizarPainelAprovacoes(user);
        iniciarDadosAppSeNecessario();
    } else {
        pararDadosApp();
        atualizarPainelAprovacoes(null);
        document.getElementById('app-container').style.display = 'none';
        document.getElementById('login-screen').style.display = 'flex';
        mostrarLoaderApp(false);
    }
});

function atualizarTelaConta(user) {
    const emailEl = document.getElementById('conta-email');
    const providerEl = document.getElementById('conta-provider');
    if (!emailEl || !providerEl) return;
    const provedores = user.providerData.map(p => p.providerId);
    const usaSenha = provedores.includes('password');
    emailEl.textContent = user.email || user.phoneNumber || 'Conta';
    providerEl.textContent = usaSenha ? 'Login por e-mail e senha'
        : provedores.includes('google.com') ? 'Login pelo Google'
        : provedores.includes('phone') ? 'Login por telefone'
        : 'Conta';
    document.getElementById('conta-senha-card').style.display = usaSenha ? 'block' : 'none';
    document.getElementById('conta-senha-indisponivel').style.display = usaSenha ? 'none' : 'block';
    const nomeInput = document.getElementById('conta-nome-input');
    if (nomeInput) nomeInput.value = user.displayName || '';
}

// --- Contas com "acesso especial": podem aprovar/revogar outras contas
// direto pelo app, sem precisar entrar no Console do Firebase. ---
const ADMIN_EMAILS = ['aseleandro@gmail.com', 'leandromendoncadesign@gmail.com'];
function isContaAdmin(user) { return !!user && !!user.email && ADMIN_EMAILS.includes(user.email.toLowerCase()); }

let unsubAprovacoes = null;
function atualizarPainelAprovacoes(user) {
    const menuItem = document.getElementById('menu-aprovacoes');
    if (!isContaAdmin(user)) {
        if (menuItem) menuItem.style.display = 'none';
        if (unsubAprovacoes) { unsubAprovacoes(); unsubAprovacoes = null; }
        return;
    }
    if (menuItem) menuItem.style.display = '';
    if (unsubAprovacoes) return; // já inscrito, não duplica o listener
    unsubAprovacoes = firestore.collection('acessosAutorizados').orderBy('criadoEm', 'desc').onSnapshot(snapshot => {
        renderListaAprovacoes(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    }, error => console.error('Erro ao carregar aprovações:', error));
}
function renderListaAprovacoes(lista) {
    const container = document.getElementById('lista-aprovacoes');
    if (!container) return;
    if (lista.length === 0) { container.innerHTML = '<li class="empty-state">Nenhum pedido de acesso ainda.</li>'; return; }
    container.innerHTML = lista.map(item => {
        const identificacao = item.email || item.telefone || item.id;
        const aprovado = item.aprovado === true;
        return `<li class="approval-item">
            <div class="approval-item-info">
                <div class="approval-item-email">${identificacao}</div>
                <div class="approval-item-status${aprovado ? ' aprovado' : ''}">${aprovado ? '✓ Aprovado' : 'Pendente'}${item.nome ? ' · ' + item.nome : ''}</div>
            </div>
            <button class="action-chip ${aprovado ? 'delete-chip' : 'edit-chip'}" onclick="alternarAprovacaoAcesso('${item.id}', ${!aprovado})">${aprovado ? 'Revogar' : 'Aprovar'}</button>
        </li>`;
    }).join('');
}
function alternarAprovacaoAcesso(uid, novoValor) {
    firestore.collection('acessosAutorizados').doc(uid).update({ aprovado: novoValor })
        .then(() => toast(novoValor ? '✓ Acesso aprovado!' : '✓ Acesso revogado.'))
        .catch(() => toast('✕ Não foi possível atualizar.'));
}

// --- Login por e-mail/senha ---
function handleLoginEmail() {
    const emailInput = document.getElementById('login-email-input');
    const passwordInput = document.getElementById('login-password-input');
    const errorMessage = document.getElementById('login-error-message');
    errorMessage.textContent = '';
    if (!emailInput.value.trim() || !passwordInput.value) { errorMessage.textContent = 'Preencha e-mail e senha.'; return; }
    auth.signInWithEmailAndPassword(emailInput.value.trim(), passwordInput.value)
        .then(() => { passwordInput.value = ''; })
        .catch(error => {
            errorMessage.textContent = traduzErroAuth(error);
            passwordInput.classList.add('shake');
            setTimeout(() => passwordInput.classList.remove('shake'), 820);
        });
}

function handleForgotPassword() {
    const emailInput = document.getElementById('login-email-input');
    const errorMessage = document.getElementById('login-error-message');
    if (!emailInput.value.trim()) { errorMessage.textContent = 'Digite seu e-mail acima para recuperar a senha.'; return; }
    auth.sendPasswordResetEmail(emailInput.value.trim())
        .then(() => toast('✓ E-mail de redefinição enviado!'))
        .catch(error => { errorMessage.textContent = traduzErroAuth(error); });
}

// --- Login com Google ---
async function handleLoginGoogle() {
    const errorEl = document.getElementById('login-error-message');
    errorEl.textContent = '';
    const provider = new firebase.auth.GoogleAuthProvider();
    try {
        await auth.signInWithPopup(provider);
    } catch (error) {
        const precisaFallback = ['auth/popup-blocked', 'auth/operation-not-supported-in-this-environment', 'auth/cancelled-popup-request'].includes(error.code);
        if (precisaFallback) {
            try { await auth.signInWithRedirect(provider); } catch (error2) { errorEl.textContent = traduzErroAuth(error2); }
            return;
        }
        errorEl.textContent = traduzErroAuth(error);
    }
}
// Se o login com Google caiu no fallback de redirect (fora de popup), o
// resultado chega aqui quando a página recarrega depois do redirect.
auth.getRedirectResult().catch(error => {
    if (error && error.code) {
        const errorEl = document.getElementById('login-error-message');
        if (errorEl) errorEl.textContent = traduzErroAuth(error);
    }
});

// --- Login por telefone (SMS) ---
function mostrarEtapaTelefone() {
    document.getElementById('login-intro').style.display = 'block';
    document.getElementById('login-email-step').style.display = 'none';
    document.getElementById('login-phone-step').style.display = 'block';
    document.getElementById('login-phone-code-step').style.display = 'none';
    document.getElementById('login-pending-step').style.display = 'none';
    if (!recaptchaVerifier) {
        recaptchaVerifier = new firebase.auth.RecaptchaVerifier('recaptcha-container', { size: 'normal' });
        recaptchaVerifier.render();
    }
}
function voltarParaEmailStep() {
    document.getElementById('login-intro').style.display = 'block';
    document.getElementById('login-email-step').style.display = 'block';
    document.getElementById('login-phone-step').style.display = 'none';
    document.getElementById('login-phone-code-step').style.display = 'none';
    document.getElementById('login-pending-step').style.display = 'none';
}
function mostrarEtapaPendente(mensagem) {
    document.getElementById('login-intro').style.display = 'none';
    document.getElementById('login-email-step').style.display = 'none';
    document.getElementById('login-phone-step').style.display = 'none';
    document.getElementById('login-phone-code-step').style.display = 'none';
    document.getElementById('login-pending-step').style.display = 'block';
    document.getElementById('login-pending-message').textContent = mensagem;
}
function enviarCodigoTelefone() {
    const phoneInput = document.getElementById('login-phone-input');
    const errorMessage = document.getElementById('login-phone-error-message');
    errorMessage.textContent = '';
    if (!phoneInput.value.trim()) { errorMessage.textContent = 'Digite seu telefone com DDI (ex: +55 11 91234-5678).'; return; }
    auth.signInWithPhoneNumber(phoneInput.value.trim(), recaptchaVerifier)
        .then(result => {
            confirmationResultTelefone = result;
            document.getElementById('login-phone-step').style.display = 'none';
            document.getElementById('login-phone-code-step').style.display = 'block';
            setTimeout(() => document.getElementById('login-phone-code-input').focus(), 50);
        })
        .catch(error => {
            errorMessage.textContent = traduzErroAuth(error);
            if (recaptchaVerifier) recaptchaVerifier.render().then(widgetId => grecaptcha.reset(widgetId));
        });
}
function confirmarCodigoTelefone() {
    const codeInput = document.getElementById('login-phone-code-input');
    const errorMessage = document.getElementById('login-phone-code-error-message');
    if (!confirmationResultTelefone) return;
    confirmationResultTelefone.confirm(codeInput.value.trim())
        .catch(error => {
            errorMessage.textContent = traduzErroAuth(error);
            codeInput.classList.add('shake');
            setTimeout(() => codeInput.classList.remove('shake'), 820);
        });
}

// --- Logout ---
function handleLogout() {
    showConfirmModal({
        title: 'Sair da Conta',
        message: 'Você precisará entrar novamente para acessar suas notas.',
        confirmText: 'Sair',
        confirmClass: 'danger',
        onConfirm: () => auth.signOut()
    });
}

// --- Alterar senha (reautenticação + updatePassword real no Firebase) ---
function abrirModalSenhaComVerificacao() {
    document.getElementById('security-check-screen').style.display = 'flex';
    setTimeout(() => document.getElementById('security-check-password-input').focus(), 50);
}
function handleSecurityCheck() {
    const input = document.getElementById('security-check-password-input');
    const errorMessage = document.getElementById('security-check-error-message');
    const user = auth.currentUser;
    if (!user || !user.email) { errorMessage.textContent = 'Não foi possível verificar a conta.'; return; }
    const credential = firebase.auth.EmailAuthProvider.credential(user.email, input.value);
    user.reauthenticateWithCredential(credential)
        .then(() => {
            document.getElementById('security-check-screen').style.display = 'none';
            input.value = '';
            errorMessage.textContent = '';
            document.getElementById('password-change-screen').style.display = 'flex';
            setTimeout(() => document.getElementById('new-password-input').focus(), 50);
        })
        .catch(error => {
            errorMessage.textContent = traduzErroAuth(error);
            input.classList.add('shake');
            setTimeout(() => { input.classList.remove('shake'); input.value = ''; }, 820);
        });
}
function cancelSecurityCheck() { document.getElementById('security-check-screen').style.display = 'none'; document.getElementById('security-check-password-input').value = ''; }
function closePasswordChangeScreen() { document.getElementById('password-change-screen').style.display = 'none'; document.getElementById('new-password-input').value = ''; document.getElementById('confirm-password-input').value = ''; }
function handleSaveNewPassword() {
    const n = document.getElementById('new-password-input');
    const c = document.getElementById('confirm-password-input');
    const e = document.getElementById('password-error-message');
    if (n.value.length < 6) { e.textContent = 'Mínimo 6 caracteres.'; return; }
    if (n.value !== c.value) { e.textContent = 'Senhas não conferem.'; c.classList.add('shake'); setTimeout(() => c.classList.remove('shake'), 820); return; }
    const user = auth.currentUser;
    user.updatePassword(n.value)
        .then(() => { toast('✓ Senha alterada!'); closePasswordChangeScreen(); })
        .catch(error => { e.textContent = traduzErroAuth(error); });
}

// --- Nome de exibição (usado pra personalizar as mensagens do app) ---
function primeiroNomeUsuario() {
    const nome = (auth.currentUser && auth.currentUser.displayName) ? auth.currentUser.displayName.trim() : '';
    return nome ? nome.split(' ')[0] : '';
}
function salvarNomeConta() {
    const input = document.getElementById('conta-nome-input');
    const user = auth.currentUser;
    if (!user || !input) return;
    const nome = input.value.trim();
    user.updateProfile({ displayName: nome })
        .then(() => toast(nome ? '✓ Nome salvo!' : '✓ Nome removido.'))
        .catch(error => toast('✕ Não foi possível salvar o nome.'));
}

// --- Backup completo dos dados (JSON) ---
// Busca tudo direto do Firestore (não confia só no que já está em memória, pra
// garantir que o backup reflita o estado real e completo do banco) e gera um
// arquivo .json pra download local — não depende do Firebase pra existir.
async function baixarBackupCompleto() {
    const statusEl = document.getElementById('backup-status');
    statusEl.textContent = 'Preparando backup...';
    try {
        const [notasSnap, historicoSnap, anotacoesSnap, configSnap] = await Promise.all([
            notasCollection.get(),
            historicoCollection.get(),
            anotacoesTextoCollection.get(),
            settingsDocRef.get()
        ]);

        // Timestamps do Firestore não viram JSON puro sozinhos — convertemos pra
        // string ISO aqui, senão o campo simplesmente some no JSON.stringify.
        const serializar = (data) => {
            const out = { ...data };
            Object.keys(out).forEach(k => {
                if (out[k] && typeof out[k].toDate === 'function') out[k] = out[k].toDate().toISOString();
            });
            return out;
        };

        const backup = {
            geradoEm: new Date().toISOString(),
            versaoApp: 'notas-fiscais-backup-v1',
            notasPendentes: notasSnap.docs.map(d => ({ id: d.id, ...serializar(d.data()) })),
            historico: historicoSnap.docs.map(d => ({ id: d.id, ...serializar(d.data()) })),
            anotacoes: anotacoesSnap.docs.map(d => ({ id: d.id, ...serializar(d.data()) })),
            configuracoes: configSnap.exists ? serializar(configSnap.data()) : {}
        };

        const nomeArquivo = `backup-notas-fiscais-${new Date().toISOString().slice(0, 10)}.json`;
        const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = nomeArquivo;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        const total = backup.notasPendentes.length + backup.historico.length + backup.anotacoes.length;
        statusEl.textContent = `✓ Backup baixado — ${total} registro(s) no total.`;
        toast('✓ Backup baixado!');
    } catch (e) {
        console.error('Erro ao gerar backup:', e);
        statusEl.textContent = 'Não foi possível gerar o backup. Tente novamente.';
        toast('✕ Erro ao gerar backup.');
    }
}


// Funções de Gerenciamento (Fornecedores/Pedidos/Obs)
// Fase 44: nome de fornecedor sempre texto. Objeto vira o campo de nome dele; o lixo "[object Object]" nunca é válido.
function nomeTextoSeguro(v) {
    if (v && typeof v === 'object') v = v.nomeExibido || v.nome || v.nomeReal || v.razaoSocial || v.fornecedor || '';
    const t = String(v == null ? '' : v).trim();
    return /^\[object object\]$/i.test(t) ? '' : t;
}
async function adicionarFornecedor(forn, noToast = false) {const f = nomeTextoSeguro(forn).toUpperCase();if (f && !fornecedoresSugeridos.includes(f)) {fornecedoresSugeridos.push(f);await settingsDocRef.set({ fornecedores: fornecedoresSugeridos }, { merge: true });if (!noToast) toast(`Fornecedor ${f} adicionado!`);}}
async function deletarFornecedor(f){showConfirmModal({title:"Excluir Fornecedor",message:`Excluir "${f}"?`,onConfirm:async()=>{fornecedoresSugeridos = fornecedoresSugeridos.filter(item => item !== f);await settingsDocRef.update({fornecedores:firebase.firestore.FieldValue.arrayRemove(f)});toast(`Fornecedor ${f} excluído.`)}})}
function popularDatalist(){DOM.fornDatalist.innerHTML='';const nomesUnificados=[...new Set([...fornecedoresSugeridos, ...listaFornecedoresSpData.map(f=>f.nomeExibido||f.nomeReal).filter(Boolean)])];nomesUnificados.sort().forEach(f=>DOM.fornDatalist.innerHTML+=`<option value="${f}"></option>`);popularListaFornecedores()}

function popularListaFornecedores(){
    DOM.listaFornManage.classList.toggle('selection-mode', selectionModeFornecedores);
    const termo = filtroFornecedoresTexto.trim().toUpperCase();
    const lista = fornecedoresSugeridos.slice().sort().filter(f => !termo || String(f).toUpperCase().includes(termo));

    const counterEl = document.getElementById('forn-counter');
    if (counterEl) counterEl.textContent = `${lista.length} de ${fornecedoresSugeridos.length} fornecedor${fornecedoresSugeridos.length === 1 ? '' : 'es'}`;

    if (lista.length === 0) {
        DOM.listaFornManage.innerHTML = `<li style="justify-content:center; color: var(--text-light);">Nenhum fornecedor encontrado.</li>`;
        atualizarBulkBarFornecedores();
        return;
    }

    let html = '';
    let letraAtual = '';
    lista.forEach(f => {
        const fStr = String(f);
        const letra = fStr.charAt(0).toUpperCase();
        if (letra !== letraAtual) {
            letraAtual = letra;
            html += `<li class="manage-list-header">${letra}</li>`;
        }
        const fEsc = fStr.replace(/'/g, "\\'");
        const checked = fornecedoresSelecionados.has(f) ? 'checked' : '';
        const ignorado = fornecedoresIgnorados.has(f);
        html += `<li class="${fornecedoresSelecionados.has(f) ? 'forn-selected' : ''} ${ignorado ? 'forn-ignorado' : ''}">
            <label class="forn-select-checkbox"><input type="checkbox" ${checked} onchange="toggleFornecedorSelecionado('${fEsc}')"></label>
            <span class="forn-nome">${fStr}${ignorado ? '<span class="badge-ignorado">Ignorado no ERP</span>' : ''}</span>
            <button class="forn-ignore-btn ${ignorado ? 'active' : ''}" onclick="toggleFornecedorIgnorado('${fEsc}')" title="${ignorado ? 'Voltar a considerar na importação do ERP' : 'Ignorar este fornecedor na importação do ERP'}"><i class="fa-solid fa-ban"></i></button>
            <button onclick="deletarFornecedor('${fEsc}')"><i class="fa-solid fa-times-circle"></i></button>
        </li>`;
    });
    DOM.listaFornManage.innerHTML = html;

    atualizarBulkBarFornecedores();
}

