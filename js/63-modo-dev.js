// 63-modo-dev.js — Modo Desenvolvedor › Linguagem do aplicativo › "Ativar modo Leandro" (2.68.0)
// Ligar a chave passa por uma sequência de "proteção" de zoeira. Só a primeira vez é longa; depois é uma tela curta.
(function () {
    'use strict';
    const JA = 'linguagemDevJa';
    let ov = null, etapa = 0, total = 7, ocupado = false;
    const $ = s => ov && ov.querySelector(s);
    const jaFez = () => { try { return localStorage.getItem(JA) === '1'; } catch (e) { return false; } };
    const marcaFez = () => { try { localStorage.setItem(JA, '1'); } catch (e) { } };
    const bt = (...b) => `<div class="lmd-bt">${b.join('')}</div>`;
    const B = (id, txt, cls = '') => `<button type="button" class="lmd-b ${cls}" id="${id}">${txt}</button>`;
    // leandromendonssa
    function abre() { if (!ov) { ov = document.createElement('div'); ov.id = 'lmd-ov'; ov.className = 'lmd-ov'; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true'); document.body.appendChild(ov); } ov.classList.add('on'); }
    function fecha() { if (ov) { ov.classList.remove('on'); ov.innerHTML = ''; } ocupado = false; sincroniza(); }
    function tela(html, prog = true) {
        const p = prog ? `<div class="lmd-pg">Etapa ${etapa} de ${total}${etapa > 2 ? ' (pode aumentar)' : ''}</div><div class="lmd-bar"><i style="width:${Math.min(92, etapa / total * 100)}%"></i></div>` : '';
        abre(); ov.innerHTML = `<div class="lmd-cx">${p}${html}</div>`;
    }
    function sincroniza() {
        const on = typeof LING !== 'undefined' && LING.modo() === 's';
        const sw = document.getElementById('ling-sw'); if (sw) { sw.classList.toggle('on', on); sw.setAttribute('aria-checked', String(on)); }
    }
    function proxima() { etapa++; total = Math.max(total, etapa + 2 + Math.floor(Math.random() * 2)); passos[Math.min(etapa - 1, passos.length - 1)](); }
    function cancelaNao() {
        tela(`<h2>Boa decisão!</h2><p>Só que… tem certeza que <b>não</b> quer ativar?</p>${bt(B('a', 'Tenho certeza que não', 'g'), B('b', 'Quero ativar'))}`, false);
        $('#a').onclick = () => { fecha(); aviso('Sensato. Covarde, mas sensato.', 'Continua no Modo Normal.'); };
        $('#b').onclick = () => { etapa = Math.max(1, etapa - 1); proxima(); };
    }
    function aviso(t, d) { try { if (typeof toastRico === 'function') toastRico({ titulo: t, detalhe: d || '' }); } catch (e) { } }
    const passos = [
        // 1
        () => { tela(`<h2>⚠️ Antes de continuar</h2><p>Você está prestes a ativar o <b>Modo Leandro</b>. Ele muda a personalidade do app. Isso não é um teste.</p><p>(É um teste.)</p>${bt(B('n', 'Voltar', 'g'), B('y', 'Continuar'))}`); $('#y').onclick = proxima; $('#n').onclick = cancelaNao; },
        // 2: tem certeza (botões trocam de lugar)
        () => {
            const fr = ['Tem certeza?', 'Certeza absoluta?', 'Mesmo? Pensa nos fornecedores.', 'Última vez que pergunto. (mentira)']; let i = 0;
            (function r() {
                const sim = Math.random() < .5, S = B('y', 'Sim'), N = B('n', 'Não', 'g');
                tela(`<h2>${fr[i]}</h2><p>Atenção: os botões trocam de lugar.</p>${bt(...(sim ? [S, N] : [N, S]))}`);
                $('#y').onclick = () => { i++; i < fr.length ? r() : proxima(); }; $('#n').onclick = cancelaNao;
            })();
        },
        // 3: termo de responsabilidade
        () => {
            const cl = ['O usuário reconhece que o app pode ter opinião própria.', 'O app não se responsabiliza por piadas sobre fornecedor atrasado.', 'Qualquer semelhança com o chefe é coincidência. Provavelmente.', 'O usuário concorda em não levar nada disso a sério.', 'O app pode comentar o horário do almoço sem aviso.', 'Reclamações devem ser feitas ao fornecedor, que não responde.', 'O usuário aceita que "sextou" é uma obrigação.', 'O app não garante que a pendência vai sumir.', 'O café das 15h é um direito, não uma sugestão.', 'O Firebase não tem nada a ver com isso, mas fica o aviso.', 'Em caso de dúvida, culpe o sistema.', 'O usuário jura que leu tudo isto.']; let tentou = 0;
            tela(`<h2>Termo de responsabilidade</h2><p>Role até o fim. Sim, tudo.</p><div class="lmd-termos" id="tm">${cl.map((c, k) => `<p><b>${k + 1}.</b> ${c}</p>`).join('')}</div><label class="lmd-ck"><span class="lmd-cb" id="ck"></span><span>Li e aceito tudo isso</span></label><div class="lmd-msg" id="ms"></div>${bt(B('y', 'Aceitar'))}`);
            const tm = $('#tm'), ck = $('#ck'); $('#y').disabled = true;
            ck.onclick = () => {
                if (tm.scrollTop + tm.clientHeight < tm.scrollHeight - 6) { $('#ms').textContent = 'Você não leu até o fim. A rolagem não mente.'; return; }
                tentou++;
                if (tentou < 2) { const n = tm.querySelectorAll('p').length + 1; tm.insertAdjacentHTML('beforeend', `<p><b>${n}.</b> O usuário concorda em reler as cláusulas 1 a ${n - 1}.</p>`); $('#ms').textContent = 'Cláusula nova adicionada ao marcar. Releia.'; tm.scrollTop = 0; }
                else { ck.textContent = '✓'; $('#y').disabled = false; $('#ms').className = 'lmd-msg ok'; $('#ms').textContent = 'Ok. Acreditamos em você. Mais ou menos.'; }
            };
            $('#y').onclick = proxima;
        },
        // 4: captcha
        () => {
            let falhas = 0;
            function inicio() { tela(`<h2>Verificação humana</h2><div class="lmd-cap"><span class="lmd-cb" id="ck"></span><span>Não sou um robô</span></div><div class="lmd-msg" id="ms"></div>`); $('#ck').onclick = () => { $('#ck').outerHTML = '<span class="lmd-sp"></span>'; setTimeout(grade, 1100); }; }
            function grade() {
                const em = ['🚚', '📦', '🦄', '🧾', '🕳️', '🐢', '🛸', '☕', '👻'];
                tela(`<h2>Verificação adicional</h2><p>Selecione todos os quadrados com <b>fornecedor entregando no prazo</b>.</p><div class="lmd-grade">${em.map(e => `<div class="lmd-t">${e}</div>`).join('')}</div><div class="lmd-msg" id="ms"></div>${bt(B('y', 'Verificar'))}`);
                ov.querySelectorAll('.lmd-t').forEach(t => t.onclick = () => t.classList.toggle('s'));
                $('#y').onclick = () => {
                    falhas++;
                    if (falhas < 3) { $('#ms').textContent = ['Errado. Você parece um robô.', 'Quase. Mas não.'][falhas - 1]; ov.querySelectorAll('.lmd-t').forEach(t => t.classList.remove('s')); }
                    else { $('#ms').className = 'lmd-msg ok'; $('#ms').textContent = 'Ok, passou. Mas ficamos de olho.'; setTimeout(proxima, 1100); }
                };
            }
            inicio();
        },
        // 5: teste de atenção (reação)
        () => {
            tela(`<h2>Teste de atenção</h2><p>Toque no botão assim que ele ficar <b style="color:#34c759">verde</b>. Antes disso, não.</p><button type="button" class="lmd-reacao" id="r">Espera…</button><div class="lmd-msg" id="ms"></div>`);
            let t0 = 0, pronto = false, tm;
            const arm = () => { pronto = false; $('#r').className = 'lmd-reacao'; $('#r').textContent = 'Espera…'; tm = setTimeout(() => { pronto = true; t0 = performance.now(); $('#r').className = 'lmd-reacao v'; $('#r').textContent = 'AGORA!'; }, 1500 + Math.random() * 2000); }; arm();
            $('#r').onclick = () => { if (!pronto) { clearTimeout(tm); $('#ms').textContent = 'Ansioso demais. Recomeça.'; arm(); } else { const ms = Math.round(performance.now() - t0); $('#ms').className = 'lmd-msg ok'; $('#ms').textContent = `${ms} ms. Humano. Pelo menos meio.`; pronto = false; setTimeout(proxima, 1100); } };
        },
        // 6: pergunta de segurança
        () => {
            tela(`<h2>Pergunta de segurança</h2><p>Qual fornecedor <b>sempre</b> entrega no prazo?</p><button type="button" class="lmd-sel">Todos</button><button type="button" class="lmd-sel">O da semana passada</button><button type="button" class="lmd-sel">Nenhum</button><button type="button" class="lmd-sel">O do primo do gerente</button><div class="lmd-msg" id="ms"></div>`);
            const er = ['Mentira.', 'Esse também atrasou, juro.', 'Quase acreditei.']; let e = 0;
            ov.querySelectorAll('.lmd-sel').forEach(b => b.onclick = () => { if (b.textContent === 'Nenhum') { $('#ms').className = 'lmd-msg ok'; $('#ms').textContent = 'Correto. Esse é o único que nunca falha.'; setTimeout(proxima, 1000); } else $('#ms').textContent = er[e++ % er.length]; });
        },
        // 7: toques (no lugar de "segurar", que não funciona bem na web)
        () => {
            let n = 0; const alvo = 8;
            tela(`<h2>Confirmação física</h2><p>Toque no botão ${alvo} vezes. Sem pressa, sem pular.</p><button type="button" class="lmd-hold" id="h"><span>Toque aqui (0 de ${alvo})</span></button><div class="lmd-msg" id="ms"></div>`);
            $('#h').onclick = () => { n++; $('#h span').textContent = `Toque aqui (${n} de ${alvo})`; $('#h').style.setProperty('--p', (n / alvo * 100) + '%'); if (n === 5) $('#ms').textContent = 'Já foi mais da metade. Não desiste agora.'; if (n >= alvo) { $('#h').disabled = true; $('#ms').className = 'lmd-msg ok'; $('#ms').textContent = 'Dedo firme. Respeito.'; setTimeout(proxima, 900); } };
        },
        // 8: reflexão obrigatória
        () => {
            let n = 6;
            tela(`<h2>Período de reflexão obrigatório</h2><p>Respire. Pense na sua vida. Ainda dá tempo de desistir.</p><div class="lmd-big" id="n">${n}</div>${bt(B('c', 'Cancelar (recomendado)'), B('y', 'continuar', 'g mini'))}`);
            $('#y').disabled = true;
            $('#c').onclick = () => { fecha(); aviso('Sensato. Continua normal.', 'Por enquanto.'); };
            const iv = setInterval(() => {
                n--; if (!ov || !ov.contains($('#n'))) { clearInterval(iv); return; }
                $('#n').textContent = n;
                if (n <= 0) { clearInterval(iv); $('#n').textContent = '🙂'; $('#y').disabled = false; $('#y').classList.remove('mini'); $('#y').textContent = 'Continuar mesmo assim'; }
            }, 1000);
            $('#y').onclick = final;
        }
    ];
    function liga() { LING.definir('s'); sincroniza(); }
    function final() {
        marcaFez();
        tela(`<div class="lmd-final">😈</div><h2 style="text-align:center">Modo Leandro ativado</h2><p style="text-align:center">Não diga que não avisei.</p>${bt(B('y', 'Fechar'))}`, false);
        $('#y').onclick = () => { fecha(); liga(); setTimeout(() => aviso('Modo Leandro ativado', 'Não diga que não avisei.'), 250); };
    }
    function curto() {
        tela(`<h2>Ah, você de novo</h2><p>Já passamos por tudo isso. Sem burocracia dessa vez. Por favor, não se acostume.</p>${bt(B('n', 'Deixa pra lá', 'g'), B('y', 'Ativar'))}`, false);
        $('#n').onclick = fecha; $('#y').onclick = () => { fecha(); liga(); aviso('Voltamos', 'Não diga que não avisei.'); };
    }
    function desliga() {
        tela(`<h2>Voltar ao normal?</h2><p>O app vai parar de ter opinião. Que chato.</p>${bt(B('n', 'Manter', 'g'), B('y', 'Voltar ao normal'))}`, false);
        $('#n').onclick = fecha; $('#y').onclick = () => { LING.definir('n'); fecha(); aviso('Modo Normal', 'Sem graça, mas organizado.'); };
    }
    window.lingAlternar = function () {
        if (ocupado || typeof LING === 'undefined') return; ocupado = true;
        if (LING.modo() === 's') { desliga(); return; }
        if (jaFez()) { curto(); return; }
        etapa = 1; total = 7; passos[0]();
    };
    document.addEventListener('click', e => { const b = e.target.closest && e.target.closest('#ling-sw'); if (b) { e.preventDefault(); window.lingAlternar(); } });
    document.addEventListener('DOMContentLoaded', sincroniza); sincroniza();
})();
/* ARQ_V */ (window.ARQ_V = window.ARQ_V || {})['js/63-modo-dev.js'] = '2.68.0';
