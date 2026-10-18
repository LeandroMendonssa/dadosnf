// 25-contas-admin.js — Criar contas de e-mail/senha direto pelo app (somente contas com acesso especial)
// Parte do script do app (v2.4.0). Arquivo comum, carregado em ordem pelo index.html; compartilha funções e variáveis globais com os demais.
// Truque padrão do Firebase: criar a conta numa segunda instância do app. Se fosse criada na instância principal, o Firebase
// entraria automaticamente com a conta nova e você seria desconectado.
let appContasSecundario = null;
function obterAppContasSecundario() {
    if (appContasSecundario) return appContasSecundario;
    appContasSecundario = firebase.apps.find(a => a.name === 'contas-secundario') || firebase.initializeApp(firebaseConfig, 'contas-secundario');
    try { appContasSecundario.auth().setPersistence(firebase.auth.Auth.Persistence.NONE); } catch (e) { /* sem isso a sessão secundária só fica na memória mesmo */ }
    return appContasSecundario;
}

function gerarSenhaTemporaria() {
    const alfabeto = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sem caracteres que se confundem (l, 1, O, 0, I)
    const bytes = new Uint32Array(10);
    (window.crypto || window.msCrypto).getRandomValues(bytes);
    return Array.from(bytes, b => alfabeto[b % alfabeto.length]).join('');
}
function preencherSenhaTemporaria() {
    const campo = document.getElementById('nova-conta-senha');
    if (!campo) return;
    campo.value = gerarSenhaTemporaria();
    campo.type = 'text'; // deixa visível para você anotar/enviar à pessoa
}

function mostrarResultadoNovaConta(texto, ok) {
    const el = document.getElementById('nova-conta-resultado');
    if (!el) return;
    el.textContent = texto;
    el.style.display = texto ? 'block' : 'none';
    el.style.color = ok ? 'var(--success-color, #1f9d55)' : 'var(--danger-color, #d93025)';
}

function mensagemErroCriarConta(error) {
    const mapa = {
        'auth/email-already-in-use': 'Já existe uma conta com esse e-mail.',
        'auth/invalid-email': 'E-mail inválido.',
        'auth/weak-password': 'A senha precisa ter pelo menos 6 caracteres.',
        'auth/operation-not-allowed': 'O login por e-mail e senha não está ativado no Firebase.',
        'auth/network-request-failed': 'Falha de conexão. Verifique sua internet.',
        'auth/too-many-requests': 'Muitas tentativas. Tente novamente em alguns minutos.'
    };
    console.error('Erro ao criar conta:', error && error.code, error && error.message);
    return `${mapa[error && error.code] || 'Não foi possível criar a conta.'} (${(error && error.code) || 'sem código'})`;
}

async function criarContaNoApp() {
    if (!isContaAdmin(auth.currentUser)) { toast('✕ Só contas com acesso especial podem criar contas.'); return; }
    const btn = document.getElementById('nova-conta-btn');
    const email = (document.getElementById('nova-conta-email').value || '').trim().toLowerCase();
    const nome = (document.getElementById('nova-conta-nome').value || '').trim();
    const senha = document.getElementById('nova-conta-senha').value || '';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { mostrarResultadoNovaConta('Informe um e-mail válido.', false); return; }
    if (senha.length < 6) { mostrarResultadoNovaConta('A senha precisa ter pelo menos 6 caracteres. Use "Gerar senha" se preferir.', false); return; }
    btn.disabled = true; mostrarResultadoNovaConta('Criando conta…', true);
    let uid = null;
    try {
        const appSec = obterAppContasSecundario();
        const cred = await appSec.auth().createUserWithEmailAndPassword(email, senha);
        uid = cred.user.uid;
        if (nome) { try { await cred.user.updateProfile({ displayName: nome }); } catch (e) { /* o nome é só enfeite */ } }
        try { await appSec.auth().signOut(); } catch (e) { /* a sessão secundária não é guardada */ }
    } catch (error) {
        mostrarResultadoNovaConta(mensagemErroCriarConta(error), false);
        btn.disabled = false;
        return;
    }
    // registra na lista de acessos (aparece em "Aprovações de Acesso" e dá para revogar depois)
    let registrada = true;
    try {
        await firestore.collection('acessosAutorizados').doc(uid).set({
            email, telefone: null, nome, aprovado: true, origem: 'criada-no-app',
            criadoPor: auth.currentUser.email || null,
            criadoEm: firebase.firestore.FieldValue.serverTimestamp()
        });
    } catch (e) { registrada = false; console.error('Conta criada, mas não registrada na lista de acessos:', e); }
    mostrarResultadoNovaConta(`✓ Conta criada: ${email}. Passe a senha para a pessoa; ela pode trocá-la depois em Conta › Alterar Senha.` + (registrada ? '' : ' (Não consegui registrá-la na lista de acessos abaixo, mas ela já consegue entrar.)'), true);
    document.getElementById('nova-conta-email').value = ''; document.getElementById('nova-conta-nome').value = '';
    document.getElementById('nova-conta-senha').value = ''; document.getElementById('nova-conta-senha').type = 'password';
    btn.disabled = false;
    toast('✓ Conta criada.');
}
