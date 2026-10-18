/* =====================================================================
 * 26-equipamentos.js  ·  Módulo "Equipamentos" (v1.0.0)
 * Gestão de equipamentos: cadastro, rastro por patrimônio/série, movimentações
 * (troca, entrega, extravio, transferência...), setores/CDC e exportação.
 *
 * Autocontido: sem dependências. Interface em Shadow DOM (o CSS do app não
 * interfere), usando as variáveis de tema do app. Tudo fica dentro de um
 * IIFE; a única coisa global é  window.EQP  (+ window.EQP_CONFIG de entrada).
 * Veja INSTRUCOES_ACOPLAMENTO.md.
 * ===================================================================== */
(function(){
"use strict";
const CSS=":host{display:block;color:var(--text-dark,#1d1d1f);font:15px/1.4 -apple-system,BlinkMacSystemFont,\"SF Pro Text\",Inter,\"Segoe UI\",Roboto,sans-serif}\n\n*{box-sizing:border-box;-webkit-tap-highlight-color:transparent}\nbutton,input,select,textarea{font:inherit}\n.in{max-width:760px;margin:auto}\n.seg{display:flex;background:var(--bg-tertiary,#e9ecef);border-radius:10px;padding:3px;gap:2px;margin-bottom:14px;overflow-x:auto}\n.seg button{flex:1;border:0;background:none;padding:8px 10px;border-radius:8px;font-weight:600;font-size:13px;color:var(--text-light,#6e6e73);white-space:nowrap;cursor:pointer}\n.seg button.on{background:var(--bg-secondary,#fff);color:var(--text-dark,#1d1d1f);box-shadow:var(--shadow-sm,0 1px 2px rgba(15,23,42,.04))}\n.card{background:var(--bg-secondary,#fff);border:1px solid var(--border-color,#d5d9de);border-radius:12px;padding:16px;margin-bottom:12px}\n.card h2{margin:0 0 12px;font-size:16px}\n.campo{margin-bottom:14px;position:relative}\nlabel{display:block;font-size:13px;font-weight:600;color:var(--text-light,#6e6e73);margin-bottom:6px}\ninput,select,textarea{width:100%;padding:13px 14px;border:1.5px solid transparent;border-radius:8px;font-size:16px;background:var(--bg-tertiary,#e9ecef);color:var(--text-dark,#1d1d1f)}\ninput:focus,select:focus{outline:0;border-color:var(--accent-color,#2f5aa8);box-shadow:0 0 0 3px color-mix(in srgb,var(--accent-color,#2f5aa8) 18%,transparent)}\n.btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;white-space:nowrap;padding:10px 18px;border:1.5px solid currentColor;border-radius:980px;background:transparent;color:var(--accent-text,#2f5aa8);font-size:14px;font-weight:600;cursor:pointer}\n.btn.p{background:var(--accent-color,#2f5aa8);border-color:var(--accent-color,#2f5aa8);color:var(--accent-contrast,#fff)}\n.btn.n{color:var(--text-light,#6e6e73)}.btn.w{width:100%;padding:14px}.btn:active{transform:scale(.97)}\n.row{display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap;margin-top:14px}\n.aux{font-size:12px;color:var(--text-light,#6e6e73)}\n.pill{display:inline-block;font-size:11px;font-weight:700;padding:2px 9px;border-radius:99px}\n.pill.success{background:var(--success-bg,rgba(52,199,89,.14));color:var(--success-text,#1e7a34)}.pill.info{background:var(--info-bg,rgba(0,122,255,.12));color:var(--info-text,#0a5fc1)}.pill.warning{background:var(--warning-bg,rgba(255,204,0,.2));color:var(--warning-text,#8a6d00)}.pill.danger{background:var(--danger-bg,rgba(255,59,48,.12));color:var(--danger,#d70015)}\n.sg{position:absolute;left:0;right:0;z-index:5;background:var(--bg-secondary,#fff);border:1px solid var(--border-color,#d5d9de);border-radius:12px;box-shadow:var(--shadow-md,0 4px 14px rgba(15,23,42,.12));margin-top:4px;overflow:hidden}\n.sg div{padding:10px 14px;border-bottom:1px solid var(--border-color,#d5d9de);cursor:pointer}.sg div:last-child{border:0}.sg div:hover{background:var(--bg-tertiary,#e9ecef)}\n.msg{margin-top:6px;font-size:13px;color:var(--warning-text,#8a6d00);background:var(--warning-bg,rgba(255,204,0,.2));padding:8px 12px;border-radius:8px}\n.dev{display:flex;gap:10px;align-items:flex-start;background:var(--bg-tertiary,#e9ecef);border-radius:10px;padding:12px}\n.dev .x{border:0;background:none;color:var(--text-light,#6e6e73);font-size:18px;cursor:pointer}\n.sum{background:color-mix(in srgb,var(--accent-color,#2f5aa8) 10%,transparent);color:var(--accent-text,#2f5aa8);border-radius:10px;padding:10px 14px;font-size:13px;margin-bottom:12px}\n.err{color:var(--danger,#d70015);font-size:13px;margin:8px 0 0}\n.grid{display:grid;grid-template-columns:repeat(2,1fr);gap:10px;margin-bottom:12px}\n@media(min-width:600px){.grid{grid-template-columns:repeat(4,1fr)}}\n.kpi{background:var(--bg-secondary,#fff);border:1px solid var(--border-color,#d5d9de);border-radius:12px;padding:12px 14px;cursor:pointer}\n.kpi span{font-size:12px;font-weight:600;color:var(--text-light,#6e6e73)}.kpi b{display:block;font-size:28px;line-height:1.15}\n.list{background:var(--bg-secondary,#fff);border:1px solid var(--border-color,#d5d9de);border-radius:12px;overflow:hidden;margin-bottom:12px}\n.li{display:flex;gap:10px;align-items:center;padding:12px 14px;border-bottom:1px solid var(--border-color,#d5d9de);cursor:pointer}.li:last-child{border:0}.li:active{background:var(--bg-tertiary,#e9ecef)}\n.li>div{flex:1;min-width:0}.li small{display:block;color:var(--text-light,#6e6e73);font-size:12px}\n.lh{padding:12px 14px;font-weight:700;border-bottom:1px solid var(--border-color,#d5d9de);display:flex;justify-content:space-between;gap:8px}\n.tb{display:flex;justify-content:space-between;align-items:center;gap:12px;margin:0 2px 12px}.bar{display:flex;gap:8px;margin-bottom:12px}.bar input{flex:1}.bar select{width:auto}\n.ov{position:fixed;inset:0;background:rgba(0,0,0,.5);display:none;align-items:flex-start;justify-content:center;overflow:auto;padding:20px 12px;z-index:9000}\n.ov.on{display:flex}.md{background:var(--bg-secondary,#fff);border-radius:16px;padding:18px;width:100%;max-width:520px}\n.md h2{margin:0 0 12px;font-size:17px}.f{display:grid;grid-template-columns:1fr 1fr;gap:0 10px}.f .w{grid-column:1/-1}\n.tl{border-left:2px solid var(--border-color,#d5d9de);margin:8px 0 0 6px;padding-left:14px}.tl div{margin-bottom:12px;position:relative}.tl div:before{content:\"\";position:absolute;left:-20px;top:5px;width:10px;height:10px;border-radius:50%;background:var(--accent-color,#2f5aa8)}\npre,textarea.tx{white-space:pre;background:var(--bg-tertiary,#e9ecef);padding:12px;border-radius:8px;font:12px/1.5 ui-monospace,monospace;overflow:auto;width:100%;height:200px;border:0;color:var(--text-dark,#1d1d1f)}\n#toast{position:fixed;left:50%;bottom:calc(90px + env(safe-area-inset-bottom,0px));transform:translateX(-50%);background:var(--text-dark,#1d1d1f);color:var(--bg-secondary,#fff);padding:10px 18px;border-radius:99px;font-size:14px;font-weight:600;display:none;z-index:9200;max-width:90%}\n.btn.sm{padding:5px 12px;font-size:13px}\n.lk{color:var(--accent-text,#2f5aa8);text-decoration:underline;cursor:pointer}\n.ac{display:flex;gap:8px}.cb{flex-shrink:0;width:50px;border:0;border-radius:8px;background:var(--bg-tertiary,#e9ecef);font-size:20px;cursor:pointer}\n.cb{color:var(--text-light,#6e6e73)}.cb svg{display:block;margin:auto}\n.chips{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px}.chip{border:0;background:var(--bg-tertiary,#e9ecef);color:var(--text-dark,#1d1d1f);padding:6px 12px;border-radius:99px;font-size:13px;cursor:pointer}\n\n#ov2{z-index:9100}\n";

const ESTQ="Almoxarifado",ESTQ_ANT="Estoque TI";
let SETORES=[ESTQ],setores=[];
const TIPOS=["Glicosímetro","Notebook","Desktop","Monitor","Impressora","Tablet","Celular","Leitor de código"];
const ST={estoque:["Em estoque","info"],em_uso:["Em uso","success"],manutencao:["Manutenção","warning"],extraviado:["Extraviado","danger"],baixado:["Baixado","danger"]};
const TIPOMOV={troca:"Troca",extravio:"Extravio / perda",nova:"Entrega nova",outro:"Outras"};
let tab="mov",items=[],F={q:"",tipo:"",flt:""},M=blank("troca");
const R={screen:null,ov:null};
const $=s=>(R.screen&&R.screen.querySelector(s))||(R.ov&&R.ov.querySelector(s))||null,gi=id=>items.find(i=>i.id==id);
const esc=s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const nz=s=>String(s||"").toLowerCase().replace(/[\s\-_.]/g,"");
const hoje=()=>{const d=new Date();return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0")},fd=d=>d?d.split("-").reverse().join("/"):"—";
const pill=s=>`<span class="pill ${ST[s][1]}">${ST[s][0]}</span>`;
const nm=i=>i.pat||i.serie||"sem código";
const stl=n=>{const x=setores.find(y=>y.nome==n);return x&&x.cod?x.cod+" · "+n:n};
const nfl=n=>n?`<a class="lk" onclick="event.stopPropagation();EQP.goNF('${String(n).replace(/[^\w.\-]/g,"")}')">${esc(n)}</a>`:"—";
const nfList=()=>{try{const c=cfg().nf;return c&&c.list?(c.list()||[]):[]}catch(e){return[]}};
const nfGet=n=>{try{const c=cfg().nf;return(c&&c.get&&c.get(n))||nfList().find(x=>nz(x.num)==nz(n))||null}catch(e){return null}};
function openNF(n){const c=cfg().nf;if(c&&c.open){md2Close();mdClose();c.open(n)}else toast("Integração com o Controle de NFs não configurada")}
const BC='<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8V5.5A1.5 1.5 0 0 1 5.5 4H8M16 4h2.5A1.5 1.5 0 0 1 20 5.5V8M20 16v2.5a1.5 1.5 0 0 1-1.5 1.5H16M8 20H5.5A1.5 1.5 0 0 1 4 18.5V16"/><path d="M8 9.5v5M11 9.5v5M13.5 9.5v5M16 9.5v5"/></svg>';
let LASTCAM=null,SS=null,fin=null;
function syncSet(){SETORES=[ESTQ,...setores.map(x=>x.nome).filter(n=>n!=ESTQ)]}
function seedCfg(){setores=[ESTQ,"UTI Adulto","Pronto Atendimento","Clínica Médica","Maternidade","Recepção","Farmácia","Centro Cirúrgico","Administrativo","Laboratório"].map(nome=>({nome,cod:""}));syncSet()}
function blank(t){return{tipo:t,setor:"",out:null,inn:null,resp:"",obs:"",dest:"estoque",motivo:"Aumento de contingente",acao:"transf"}}
function toast(t){const e=$("#toast");e.textContent=t;e.style.display="block";clearTimeout(e.t);e.t=setTimeout(()=>e.style.display="none",2600)}

function seed(){
 const nf=(n,d,f,v)=>({num:n,data:d,forn:f,valor:v}),A=nf("007781","2025-04-08","Roche Diagnóstica",190),B=nf("004512","2024-03-12","Dell Comercial",4800),C=nf("001287","2023-08-02","LG Distribuidora",1100),D=nf("002210","2025-06-10","HP Suprimentos",3900);
 const G=(n,st,s,o)=>["Glicosímetro","Roche","Accu-Chek Guide","SN-G"+(400+n),"PAT-"+(5000+n),A,st,s,o];
 const R=[G(1,"em_uso","UTI Adulto","UTI Adulto"),G(2,"em_uso","UTI Adulto","Clínica Médica"),G(3,"em_uso","Pronto Atendimento","Pronto Atendimento"),G(4,"em_uso","Clínica Médica","Clínica Médica"),G(5,"em_uso","Maternidade","Maternidade"),G(6,"estoque",ESTQ,ESTQ),G(7,"estoque",ESTQ,ESTQ),G(8,"extraviado","—","Maternidade"),
  ["Notebook","Dell","Latitude 3420","SN-D001","PAT-1001",B,"em_uso","Farmácia","Farmácia"],["Notebook","Dell","Latitude 3420","SN-D002","PAT-1002",B,"estoque",ESTQ,ESTQ],
  ["Monitor","LG","24MK430H","SN-L101","PAT-2001",C,"em_uso","Recepção","Recepção"],["Impressora","HP","LaserJet M404","SN-H301","PAT-4001",D,"estoque",ESTQ,ESTQ]];
 items=R.map((r,i)=>{const it={id:i+1,tipo:r[0],marca:r[1],modelo:r[2],serie:r[3],pat:r[4],nf:r[5],status:r[6],setor:r[7],origem:r[8],resp:r[6]=="em_uso"?"RT "+r[7]:"",exc:true,hist:[]};
  const h=(d,t,de,para,m,termo)=>it.hist.push({d,t,de,para,m,termo:termo||"",resp:"",ex:true});
  h(r[5].data,"Cadastro","—",ESTQ,"Aquisição NF "+r[5].num);
  if(r[8]!==ESTQ){h("2025-05-02","Entrega",ESTQ,r[8],"Termo de Responsabilidade","TR");if(r[6]=="em_uso"&&r[7]!==r[8])h("2025-09-03","Transferência",r[8],r[7],"Realocação identificada");if(r[6]=="extraviado")h("2025-10-01","Extravio/perda",r[8],"—","Termo de Extravio e Perda","TEP")}
  return it});
}
const cfg=()=>window.EQP_CONFIG||{};
function migraEstq(){/* dados antigos: "Estoque TI" passa a se chamar "Almoxarifado" */
 const t=v=>v==ESTQ_ANT?ESTQ:v;
 items.forEach(i=>{i.setor=t(i.setor);i.origem=t(i.origem);(i.hist||[]).forEach(h=>{h.de=t(h.de);h.para=t(h.para)})});
 const seen={};setores=setores.map(y=>({...y,nome:t(y.nome)})).filter(y=>seen[y.nome]?false:(seen[y.nome]=1))}
function applyState(x){if(!x||typeof x!="object")return false;items=Array.isArray(x.items)?x.items:[];setores=Array.isArray(x.setores)?x.setores.slice():[];migraEstq();if(!setores.some(y=>y.nome==ESTQ))setores.unshift({nome:ESTQ,cod:""});syncSet();return true}
function vazio(){items=[];setores=[{nome:ESTQ,cod:""}];syncSet()}
function load(){let x=null;try{const c=cfg();x=c.load?c.load():JSON.parse(localStorage.getItem("equipamentos_v1")||"null")}catch(e){}
 if(x&&typeof x.then=="function"){vazio();x.then(r=>{if(applyState(r))render()}).catch(e=>console.warn("EQP load",e));return}
 if(!applyState(x))vazio()}
function save(){try{const st={items,setores},c=cfg();if(c.save)c.save(st);else localStorage.setItem("equipamentos_v1",JSON.stringify(st))}catch(e){console.warn("EQP save",e)}}
function render(){
 const seg=[["mov","Movimentar"],["eq","Equipamentos"],["set","Setores"]];
 $("#v").innerHTML=`<div style="display:flex;justify-content:flex-end;margin-bottom:10px"><button class="btn sm" onclick="EQP.openItem(0)">＋ Cadastrar equipamento</button></div><div class="seg">${seg.map(([k,l])=>`<button class="${tab==k?"on":""}" onclick="EQP.tab='${k}';EQP.render()">${l}</button>`).join("")}</div><div id="body"></div>`;
 ({mov:renderMov,eq:renderEq,set:renderSet})[tab]();
}

/* ---------- busca ---------- */
function find(q,ok){q=nz(q);if(!q)return[];const ex=items.find(i=>nz(i.pat)==q||nz(i.serie)==q);if(ex)return[ex];return items.filter(i=>ok(i)&&[i.pat,i.serie,i.marca,i.modelo,i.tipo].some(v=>nz(v).includes(q))).slice(0,6)}
function okOut(i){if(M.tipo=="outro"){const a=M.acao;return a=="retorno"?i.status=="manutencao":a=="baixa"?i.status!="baixado":a=="manut"?i.status=="em_uso"||i.status=="estoque":i.status=="em_uso"}return i.status=="em_uso"}
const OK={out:okOut,inn:i=>i.status=="estoque"};
function sug(k){
 const q=$("#q_"+k).value.trim(),box=$("#s_"+k);if(!q){box.innerHTML="";return}
 const r=find(q,OK[k]);
 if(r.length==1&&!OK[k](r[0]))box.innerHTML=`<div class="msg">⚠ ${esc(nm(r[0]))} está “${ST[r[0].status][0]}”${r[0].setor!="—"?" em "+esc(r[0].setor):""} e não serve para este campo.</div>`;
 else if(!r.length)box.innerHTML=`<div class="sg"><div onclick="EQP.openItem(0,'${q.replace(/[^\w.\- ]/g,"")}')"><b>Não encontrado.</b> Cadastrar “${esc(q)}” agora</div></div>`;
 else box.innerHTML=`<div class="sg">${r.map(i=>`<div onclick="EQP.pick('${k}',${i.id})"><b>${esc(nm(i))}</b> · ${esc(i.tipo)} ${esc(i.modelo)}<div class="aux">Série ${esc(i.serie)} · ${esc(i.setor)}</div></div>`).join("")}</div>`;
}
function pick(k,id){
 if(!id){const r=find($("#q_"+k).value,OK[k]).filter(OK[k]);if(!r.length)return;id=r[0].id}
 M[k]=id;const i=gi(id);if(k=="out"&&!M.setor&&i.setor!=ESTQ&&i.setor!="—")M.setor=i.setor;
 renderMov();const n=$("[id^=q_]");if(n)n.focus();
}
function clr(k){M[k]=null;renderMov()}
function devCard(i,k){
 let w="";
 if(k=="out"&&M.setor&&i.setor!=M.setor&&i.status=="em_uso")w=`<div class="msg">⚠ Consta em <b>${esc(i.setor)}</b>, não em ${esc(M.setor)}. Será registrado com o local real.</div>`;
 else if(i.status=="em_uso"&&i.origem!=i.setor)w=`<div class="msg">Aparelho de origem: ${esc(i.origem)}</div>`;
 return `<div class="dev"><div style="flex:1;min-width:0"><b>${esc(i.tipo||"Equipamento")} · ${esc(i.marca)} ${esc(i.modelo)}</b><div class="aux">${esc(i.pat||"s/ patrimônio")} · Série ${esc(i.serie||"—")}</div><div class="aux">NF ${nfl(i.nf.num)} · ${esc(i.nf.forn)}</div><div style="margin-top:4px">${pill(i.status)} <span class="aux">${esc(i.setor)}</span></div>${w}</div><button class="x" onclick="EQP.clr('${k}')" aria-label="Trocar">✕</button></div>`;
}
function acf(k,label){const i=M[k]?gi(M[k]):null;
 const ch=k=="out"&&!i&&M.setor?items.filter(x=>x.setor==M.setor&&OK.out(x)):[];
 return `<div class="campo"><label>${label}</label>${i?devCard(i,k):`<div class="ac"><input id="q_${k}" autocomplete="off" placeholder="Digite ou bipe patrimônio / nº de série" oninput="EQP.sug('${k}')" onkeydown="if(event.key=='Enter')EQP.pick('${k}')"><button class="cb" aria-label="Ler código de barras" onclick="EQP.scan(v=>{EQP.$('#q_${k}').value=v;EQP.sug('${k}');EQP.pick('${k}')})">${BC}</button></div><div id="s_${k}"></div>${ch.length&&ch.length<=12?`<div class="aux" style="margin-top:8px">Hoje em ${esc(M.setor)}:</div><div class="chips">${ch.map(x=>`<button class="chip" onclick="EQP.pick('out',${x.id})">${esc(nm(x))} · ${esc(x.modelo||x.tipo)}</button>`).join("")}</div>`:""}`}</div>`}

/* ---------- Movimentar ---------- */
function renderMov(){
 const t=M.tipo,sel=(k,o)=>`<select onchange="EQP.M.${k}=this.value;EQP.renderMov()">${o.map(([v,l])=>`<option value="${v}" ${M[k]==v?"selected":""}>${l}</option>`).join("")}</select>`;
 const setor=lb=>`<div class="campo"><label>${lb||"Setor"}</label><select onchange="EQP.M.setor=this.value;EQP.renderMov()"><option value="">Selecione o setor…</option>${SETORES.filter(x=>x!=ESTQ).map(x=>`<option value="${esc(x)}" ${M.setor==x?"selected":""}>${esc(stl(x))}</option>`).join("")}</select></div>`;
 const resp=`<div class="campo"><label>Quem assinou (RT / solicitante)</label><input value="${esc(M.resp)}" oninput="EQP.M.resp=this.value" placeholder="Nome"></div>`;
 let f="",info="";
 if(t=="troca"){info="Sem termo novo: registre o que saiu e o que entrou.";f=setor()+acf("out","Aparelho que está saindo (devolvido)")+acf("inn","Aparelho novo entregue")+`<div class="campo"><label>O devolvido vai para</label>${sel("dest",[["estoque","Estoque (utilizável)"],["manutencao","Manutenção"],["baixado","Baixa (inservível)"]])}</div>`+resp}
 if(t=="extravio"){info="Registra o extravio e o aparelho que entrou no lugar (o termo é assinado no papel).";f=setor()+acf("inn","Aparelho novo entregue")+acf("out","Aparelho extraviado (se já cadastrado)")+resp}
 if(t=="nova"){info="Registra a entrega (o termo de responsabilidade é assinado no papel).";f=setor()+`<div class="campo"><label>Motivo</label>${sel("motivo",["Aumento de contingente","Abertura de setor novo","Equipamento novo (sem antigo para trocar)"].map(x=>[x,x]))}</div>`+acf("inn","Aparelho entregue")+resp}
 if(t=="outro")f=`<div class="campo"><label>Ação</label>${sel("acao",[["transf","Transferir para outro setor"],["devol","Devolver ao estoque"],["manut","Enviar para manutenção"],["retorno","Voltar da manutenção"],["baixa","Baixar definitivamente"]])}</div>`+acf("out","Aparelho")+(M.acao=="transf"?setor("Setor de destino"):"");
 const r=resumo();
 $("#body").innerHTML=`<div class="seg">${Object.entries(TIPOMOV).map(([k,l])=>`<button class="${t==k?"on":""}" onclick="EQP.M=EQP.blank('${k}');EQP.renderMov()">${l}</button>`).join("")}</div>
 <div class="card">${info?`<p class="aux" style="margin:0 0 12px">${info}</p>`:""}${f}<div class="campo"><label>Observação (opcional)</label><input value="${esc(M.obs)}" oninput="EQP.M.obs=this.value"></div></div>
 ${r?`<div class="sum">${r}</div>`:""}<div id="e" class="err"></div><button class="btn p w" onclick="EQP.confirmar()">Registrar movimentação</button>`;
 setTimeout(()=>{},0);
}
function resumo(){
 const o=M.out?gi(M.out):null,n=M.inn?gi(M.inn):null,s=M.setor,L=[];
 const dl={estoque:"estoque",manutencao:"manutenção",baixado:"baixa"}[M.dest];
 if(M.tipo=="troca"&&o&&n)L.push(`<b>${nm(n)}</b> entra em ${s||"?"}`,`<b>${nm(o)}</b> sai de ${o.setor} → ${dl}`);
 if((M.tipo=="extravio"||M.tipo=="nova")&&n)L.push(`<b>${nm(n)}</b> entra em ${s||"?"}`);
 if(M.tipo=="extravio"&&o)L.push(`<b>${nm(o)}</b> marcado como extraviado`);
 return L.join("<br>");
}
function confirmar(){
 const t=M.tipo,o=M.out?gi(M.out):null,n=M.inn?gi(M.inn):null,s=M.setor.trim(),resp=M.resp.trim(),obs=M.obs.trim(),e=m=>($("#e").textContent=m,null);
 if(t!="outro"&&!SETORES.includes(s)||s==ESTQ&&t!="outro")return e("Escolha um setor válido.");
 if((t=="troca"||t=="extravio"||t=="nova")&&!n)return e("Informe o aparelho novo entregue.");
 if(t=="troca"&&!o)return e("Informe o aparelho que está saindo.");
 if(t=="outro"&&!o)return e("Informe o aparelho.");
 if(t!="outro"&&!resp)return e("Informe quem assinou.");
 if(t=="outro"&&M.acao=="transf"&&(!SETORES.includes(M.setor)||M.setor==o.setor))return e("Escolha um setor de destino diferente do atual.");
 const now=hoje();let termo=null;
 const lg=(it,tp,para,m,tm,rel)=>it.hist.push({d:now,t:tp,de:it.setor,para,m:m+(obs?" · "+obs:""),termo:tm||"",resp,ex:false,rel:rel?{id:rel.id,pat:rel.pat,serie:rel.serie}:null});
 const set=(it,st,loc,r)=>{it.status=st;it.setor=loc;it.resp=r||""};
 if(t=="troca"||t=="extravio"||t=="nova"){
  const tm=t=="extravio"?"TEP":t=="nova"?"TR":"";
  lg(n,"Entrega",s,t=="troca"?"Troca por "+nm(o):t=="nova"?M.motivo:"Substituição por extravio",tm,o);set(n,"em_uso",s,resp);if(n.origem==ESTQ)n.origem=s;
  if(o){if(t=="troca"){const d=M.dest;lg(o,"Devolução (troca)",d=="estoque"||d=="manutencao"?ESTQ:"—","Trocado por "+nm(n)+" · destino: "+d,"",n);set(o,d,d=="baixado"?"—":ESTQ)}else{lg(o,"Extravio/perda","—","Substituído por "+nm(n),"TEP",n);set(o,"extraviado","—")}}
  if(tm)termo={tm,n,o,s,resp,mot:M.motivo};
 }else{
  const a=M.acao;
  if(a=="transf"){lg(o,"Transferência",M.setor,"Transferência entre setores");set(o,"em_uso",M.setor,resp||"RT "+M.setor)}
  if(a=="devol"){lg(o,"Devolução",ESTQ,"Devolução ao estoque");set(o,"estoque",ESTQ)}
  if(a=="manut"){lg(o,"Manutenção",ESTQ,"Enviado para manutenção");set(o,"manutencao",ESTQ)}
  if(a=="retorno"){lg(o,"Retorno",ESTQ,"Retorno da manutenção");set(o,"estoque",ESTQ)}
  if(a=="baixa"){lg(o,"Baixa","—","Baixa definitiva");set(o,"baixado","—")}
 }
 save();M=blank(t);toast("Movimentação registrada ✓");render();
}

/* ---------- Equipamentos ---------- */
function filt(){const q=nz(F.q);return items.filter(i=>(!F.tipo||i.tipo==F.tipo)&&(!F.flt||(F.flt=="fora"?i.status=="em_uso"&&i.setor!=i.origem:i.status==F.flt))&&(!q||[i.pat,i.serie,i.marca,i.modelo,i.tipo,i.nf.num,i.setor].some(v=>nz(v).includes(q))))}
function renderEq(){
 const c=x=>items.filter(i=>i.status==x).length,fora=items.filter(i=>i.status=="em_uso"&&i.setor!=i.origem).length;
 const K=(k,l,v)=>`<div class="kpi" onclick="EQP.F.flt=EQP.F.flt=='${k}'?'':'${k}';EQP.renderEq()" style="${F.flt==k?"border-color:var(--accent-color)":""}"><span>${l}</span><b>${v}</b></div>`;
 const por={};items.filter(i=>i.status=="estoque").forEach(i=>{const k=desc(i);por[k]=(por[k]||0)+1});
 $("#body").innerHTML=`<div class="grid">${K("estoque","Em estoque",c("estoque"))}${K("em_uso","Em uso",c("em_uso"))}${K("manutencao","Manutenção",c("manutencao"))}${K("fora","Fora da origem",fora)}</div>
 <div class="card"><h2>Estoque por modelo</h2>${Object.entries(por).map(([k,v])=>`<div style="display:flex;justify-content:space-between;padding:4px 0"><span>${esc(k)}</span><b>${v}</b></div>`).join("")||'<span class="aux">Estoque vazio</span>'}</div>
 <div class="bar"><input placeholder="Buscar patrimônio, série, modelo, NF…" value="${esc(F.q)}" oninput="EQP.F.q=this.value;EQP.lista()"><select onchange="EQP.F.tipo=this.value;EQP.lista()"><option value="">Todos</option>${TIPOS.map(t=>`<option ${F.tipo==t?"selected":""}>${t}</option>`).join("")}</select></div>
 <div class="tb"><span class="aux" id="cnt"></span><button class="btn sm" onclick="EQP.exportEq()">Exportar lista</button></div><div id="lst"></div>`;lista();
}
function lista(){
 const L=filt();$("#cnt").textContent=L.length+" equipamento(s)";
 $("#lst").innerHTML=`<div class="list">${L.map(i=>`<div class="li" onclick="EQP.openDet(${i.id})"><div><b>${esc(nm(i))}</b> · ${esc(i.tipo)} ${esc(i.modelo)}<small>Série ${esc(i.serie)} · ${esc(i.setor)}${i.status=="em_uso"&&i.setor!=i.origem?" · origem "+esc(i.origem):""}</small></div>${pill(i.status)}</div>`).join("")||'<div class="li aux">Nada encontrado</div>'}</div>`;
}
const setItems=n=>items.filter(i=>i.setor==n&&!["baixado","extraviado"].includes(i.status));
function renderSet(){
 $("#body").innerHTML=`<div class="tb"><span class="aux">Setor e centro de custo (CDC) são o mesmo cadastro</span><button class="btn sm" onclick="EQP.openSetor(-1)">＋ Setor</button></div><div class="list">${SETORES.map((n,k)=>{
  const L=setItems(n),ou=L.filter(i=>n!=ESTQ&&i.origem!=n).length,pd=items.filter(i=>i.origem==n&&i.status=="extraviado").length;
  return `<div class="li" onclick="EQP.openSetorView(${k})"><div><b>${esc(stl(n))}</b><small>${L.length} aparelho(s)${ou?` · ${ou} de outro setor`:""}${pd?` · ${pd} extraviado(s)`:""}</small></div><span class="aux">ver ›</span></div>`}).join("")}</div>`;
}
function openSetorView(k){
 const n=SETORES[k],L=setItems(n),res={};L.forEach(i=>res[desc(i)]=(res[desc(i)]||0)+1);
 mdOpen(`<h2>${esc(stl(n))}</h2><p class="aux" style="margin:-6px 0 12px">${L.length} aparelho(s) neste setor</p>
 <div class="card" style="padding:12px">${Object.entries(res).map(([a,b])=>`<div style="display:flex;justify-content:space-between;padding:3px 0"><span>${esc(a)}</span><b>${b}</b></div>`).join("")||'<span class="aux">Nenhum aparelho</span>'}</div>
 <div class="list">${L.map(i=>`<div class="li" onclick="EQP.openDet(${i.id})"><div>${esc(nm(i))} · ${esc(i.tipo)} ${esc(i.modelo)}<small>Série ${esc(i.serie||"—")}${i.nf.num?" · NF "+esc(i.nf.num):""}${n!=ESTQ&&i.origem!=n?" · veio de "+esc(i.origem):""}</small></div>${pill(i.status)}</div>`).join("")}</div>
 <div class="row"><button class="btn n" onclick="EQP.mdClose()">Fechar</button><button class="btn" onclick="EQP.openSetor(${k})">Editar</button><button class="btn p" onclick="EQP.exportSetor(${k})">Exportar</button></div>`);
}
function copiar(t){try{navigator.clipboard.writeText(t).then(()=>toast("Copiado ✓"),fb)}catch(e){fb()}function fb(){const a=document.createElement("textarea");a.value=t;document.body.appendChild(a);a.select();try{document.execCommand("copy");toast("Copiado ✓")}catch(e){toast("Selecione e copie manualmente")}a.remove()}}

/* ---------- Detalhe e cadastro ---------- */
const mdOpen=h=>{$("#md").innerHTML=h;$("#ov").classList.add("on")},mdClose=()=>$("#ov").classList.remove("on");
function openDet(id){
 const i=gi(id);
 mdOpen(`<h2>${esc(i.tipo||"Equipamento")} · ${esc(nm(i))} ${pill(i.status)}</h2><div class="f">
 <div class="campo"><label>Marca / modelo</label>${esc(i.marca)} ${esc(i.modelo)||"—"}</div><div class="campo"><label>Nº de série</label>${esc(i.serie)||"—"}</div>
 <div class="campo"><label>Local atual</label>${esc(i.setor)}</div><div class="campo"><label>Setor de origem</label>${esc(i.origem)}</div>
 <div class="campo"><label>Nota fiscal</label>${nfl(i.nf.num)} · ${fd(i.nf.data)}</div><div class="campo"><label>Fornecedor · valor</label>${esc(i.nf.forn)||"—"} · ${i.nf.valor?Number(i.nf.valor).toLocaleString("pt-BR",{style:"currency",currency:"BRL"}):"—"}</div></div>
 <label>Rastro</label><div class="tl">${[...i.hist].reverse().map(h=>`<div><b>${esc(h.t)}</b> · ${fd(h.d)}${h.termo?` <span class="pill info">${h.termo}</span>`:""}<br>${esc(h.de)} → ${esc(h.para)}<div class="aux">${esc(h.m)}${h.resp?" · "+esc(h.resp):""}</div></div>`).join("")}</div>
 <div class="row"><button class="btn n" onclick="EQP.mdClose()">Fechar</button><button class="btn" onclick="EQP.openItem(${i.id})">Editar</button><button class="btn p" onclick="EQP.goMov(${i.id})">Movimentar</button></div>`);
}
function goMov(id){const i=gi(id);M=blank(i.status=="estoque"?"nova":i.status=="em_uso"?"troca":"outro");if(i.status=="estoque")M.inn=id;else if(i.status=="em_uso"){M.out=id;M.setor=i.setor}else{M.out=id;M.acao=i.status=="manutencao"?"retorno":"baixa"}tab="mov";mdClose();render()}
let EDIT=0;
function openItem(id,pat){
 EDIT=id||0;
 const i=id?gi(id):{tipo:"",marca:"",modelo:"",serie:"",pat:pat||"",nf:{num:"",data:"",forn:"",valor:""},cdc:""};
 const cam=f=>`<button class="cb" type="button" aria-label="Ler código de barras" onclick="EQP.scanTo('${f}')">${BC}</button>`;
 mdOpen(`<h2>${id?"Editar":"Cadastrar"} equipamento</h2><p class="aux" style="margin:-6px 0 12px">Todos os campos são opcionais.</p><div class="f">
 <div class="campo"><label>Tipo</label><input id="a_tipo" list="dt" value="${esc(i.tipo)}"><datalist id="dt">${TIPOS.map(t=>`<option value="${t}">`).join("")}</datalist></div>
 <div class="campo"><label>Marca</label><input id="a_marca" value="${esc(i.marca)}"></div>
 <div class="campo w"><label>Modelo</label><input id="a_modelo" value="${esc(i.modelo)}"></div>
 <div class="campo"><label>Patrimônio</label><div class="ac"><input id="a_pat" oninput="EQP.chk()" value="${esc(nm(i))}">${cam("a_pat")}</div></div>
 <div class="campo"><label>Nº de série</label><div class="ac"><input id="a_serie" oninput="EQP.chk()" value="${esc(i.serie)}">${cam("a_serie")}</div></div>
 <div class="campo"><label>Nº da NF ${i.nf.num?"· "+nfl(i.nf.num):""}</label><input id="a_nf" list="dn" onchange="EQP.nfFill()" value="${esc(i.nf.num)}"><datalist id="dn">${nfList().slice(0,300).map(n=>`<option value="${n.num}">${esc(n.forn)}</option>`).join("")}</datalist><div class="aux">Digite ou escolha uma NF do <a class="lk" onclick="EQP.goNF(EQP.$('#a_nf').value)">Controle de NFs</a></div></div>
 <div class="campo"><label>Data da NF</label><input type="date" id="a_nfd" value="${i.nf.data}"></div>
 <div class="campo"><label>Fornecedor</label><input id="a_forn" value="${esc(i.nf.forn)}"></div><div class="campo"><label>Valor unitário (R$)</label><input type="number" id="a_val" value="${i.nf.valor}"></div>
 ${id?"":`<div class="campo"><label>Local atual</label><select id="a_loc">${SETORES.map(x=>`<option value="${esc(x)}">${esc(stl(x))}</option>`).join("")}</select></div>`}</div>
 <div id="err" class="err"></div><div class="row"><button class="btn n" onclick="EQP.mdClose()">Cancelar</button>${id?"":`<button class="btn" onclick="EQP.saveItem(0,1)">Salvar e cadastrar outro</button>`}<button class="btn p" onclick="EQP.saveItem(${id||0},0)">Salvar</button></div>`);
}
function nfFill(){const n=nfGet($("#a_nf").value);if(n){if(!$("#a_forn").value)$("#a_forn").value=n.forn;if(!$("#a_nfd").value)$("#a_nfd").value=n.data}}
function dup(){const p=nz($("#a_pat").value),r=nz($("#a_serie").value);return items.find(x=>x.id!=EDIT&&((p&&nz(x.pat)==p)||(r&&nz(x.serie)==r)))}
function chk(){const d=dup();$("#err").textContent=d?"Já cadastrado: "+nm(d)+" ("+(d.tipo||"")+" "+d.modelo+")":""}
function saveItem(id,again){
 const g=k=>$("#a_"+k).value.trim(),d={tipo:g("tipo"),pat:g("pat"),marca:g("marca"),modelo:g("modelo"),serie:g("serie"),nf:{num:g("nf"),data:g("nfd"),forn:g("forn"),valor:g("val")}};
 if(dup()){chk();return}
 if(id){Object.assign(gi(id),d);gi(id).exc=false}
 else{const loc=$("#a_loc").value||ESTQ,u=loc!=ESTQ,nid=Date.now()*1000+Math.floor(Math.random()*1000);
  const it={...d,id:nid,status:u?"em_uso":"estoque",setor:loc,origem:loc,resp:u?"RT "+loc:"",exc:false,hist:[{d:d.nf.data||hoje(),t:"Cadastro",de:"—",para:ESTQ,m:"Aquisição"+(d.nf.num?" NF "+d.nf.num:""),termo:"",resp:"",ex:false}]};
  if(u)it.hist.push({d:hoje(),t:"Entrega",de:ESTQ,para:loc,m:"Cadastro inicial (já estava no setor)",termo:"",resp:"",ex:false});
  items.push(it)}
 save();
 if(again){$("#a_pat").value="";$("#a_serie").value="";toast("Cadastrado ✓ · próximo");render();if(LASTCAM)scanTo(LASTCAM);else $("#a_pat").focus();return}
 mdClose();toast("Salvo ✓");render();
}
/* NF (simula o Controle de NFs do app) */
const md2Open=h=>{$("#md2").innerHTML=h;$("#ov2").classList.add("on")};
function md2Close(){stopScan();$("#ov2").classList.remove("on")}
function goNF(n){
 n=String(n||"").trim();if(!n)return toast("Digite o número da NF");
 const nf=nfGet(n),L=items.filter(i=>nz(i.nf.num)==nz(n));
 md2Open(`<h2>NF ${esc(n)}</h2>${nf?`<p style="margin:0 0 12px">${esc(nf.forn)} · ${fd(nf.data)}</p>`:`<div class="msg">NF não localizada no Controle de NFs.</div>`}<label>Equipamentos vinculados (${L.length})</label><div class="list">${L.map(i=>`<div class="li" onclick="EQP.md2Close();EQP.openDet(${i.id})"><div>${esc(nm(i))} · ${esc(i.tipo)} ${esc(i.modelo)}</div>${pill(i.status)}</div>`).join("")||'<div class="li aux">Nenhum ainda</div>'}</div><div class="row"><button class="btn n" onclick="EQP.md2Close()">Fechar</button><button class="btn p" onclick="EQP.openNF('${esc(n).replace(/[^\w.\-]/g,"")}')">Abrir no Controle de NFs</button></div>`);
}
/* setores (= CDC) */
function openSetor(k){const n=k<0?"":SETORES[k],x=setores.find(y=>y.nome==n)||{nome:"",cod:""};
 mdOpen(`<h2>${n?"Editar":"Novo"} setor</h2><div class="campo"><label>Nome</label><input id="s_nome" value="${esc(x.nome)}" ${n==ESTQ?"readonly":""}></div><div class="campo"><label>Código / CDC</label><input id="s_cod" value="${esc(x.cod)}" placeholder="Opcional"></div><div id="err" class="err"></div><div class="row">${n&&n!=ESTQ?`<button class="btn n" style="color:var(--danger)" onclick="EQP.delSetor(${k})">Excluir</button>`:""}<button class="btn n" onclick="EQP.mdClose()">Cancelar</button><button class="btn p" onclick="EQP.saveSetor(${k})">Salvar</button></div>`)}
function saveSetor(k){const old=k<0?"":SETORES[k];let nome=$("#s_nome").value.trim();const cod=$("#s_cod").value.trim();
 if(!nome)nome="Setor "+setores.length;
 if(nome!=old&&setores.some(y=>y.nome==nome))return $("#err").textContent="Já existe um setor com esse nome.";
 if(old){const x=setores.find(y=>y.nome==old);x.cod=cod;if(nome!=old){x.nome=nome;items.forEach(i=>{if(i.setor==old)i.setor=nome;if(i.origem==old)i.origem=nome;i.hist.forEach(h=>{if(h.de==old)h.de=nome;if(h.para==old)h.para=nome})})}}
 else setores.push({nome,cod});
 syncSet();save();mdClose();render()}
function delSetor(k){const n=SETORES[k];if(items.some(i=>i.setor==n||i.origem==n))return $("#err").textContent="Há equipamentos neste setor ou com origem nele.";setores=setores.filter(y=>y.nome!=n);syncSet();save();mdClose();render()}
/* exportação (disponível onde fizer sentido) */
const slug=t=>String(t||"x").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^\w]+/g,"_").replace(/^_|_$/g,"").toLowerCase();
const JSL={};function loadJS(u){return JSL[u]||(JSL[u]=new Promise((ok,no)=>{const e=document.createElement("script");e.src=u;e.onload=ok;e.onerror=()=>{delete JSL[u];no(new Error("falha ao carregar biblioteca"))};document.head.appendChild(e)}))}
const desc=i=>[i.tipo,i.marca,i.modelo].filter(Boolean).join(" ")||"Sem descrição";
const COLS={equip:[["Setor",34],["Tipo",24],["Marca",20],["Modelo",36],["Patrimônio",24],["Nº série",30],["NF",16],["Fornecedor",32],["Valor",16],["Status",22],["Observação",23]],
 mov:[["Data",18],["Evento",26],["Patrimônio",24],["Nº série",28],["Tipo",22],["Modelo",30],["De",28],["Para",28],["Motivo",40],["Termo",12],["Responsável",21]],
 ent:[["Data",18],["Setor",32],["Motivo",50],["Entregue (pat.)",26],["Entregue (série)",28],["Modelo",36],["Devolvido (pat.)",26],["Devolvido (série)",28],["Termo",14],["Responsável",19]],
 ext:[["Data",18],["Setor",32],["Extraviado (pat.)",28],["Extraviado (série)",28],["Modelo",40],["Substituto (pat.)",28],["Substituto (série)",28],["Termo",14],["Responsável",31],["Observação",30]]};
const KT={equip:"Relação de equipamentos",ent:"Entregas e trocas",ext:"Extravios e perdas",mov:"Histórico de movimentações"},KO={equip:"Relação de equipamentos",ent:"Entregas e trocas (entregue × devolvido)",ext:"Extravios e perdas",mov:"Histórico completo de movimentações"};
let XC=null;
function exportEq(){const L=filt();XC={items:L,setor:null,tipo:F.tipo,label:"Lista atual ("+L.length+" equipamentos)"};openExport()}
function exportSetor(k){const n=SETORES[k];XC={items:setItems(n),setor:n,tipo:"",label:"Setor: "+stl(n)};openExport()}
function xData(){
 const k=$("#x_k").value,tp=$("#x_t").value,nv=$("#x_n").checked,d1=$("#x_d1").value,d2=$("#x_d2").value,S=XC.setor;
 $("#x_p").style.display=k=="equip"?"none":"";
 $("#x_s").textContent=k=="equip"?XC.label:(S?"Eventos do setor: "+stl(S):"Eventos de todos os setores");
 if(k=="equip"){const A=XC.items.filter(i=>(!tp||i.tipo==tp)&&(!nv||!i.exc));return{k,tp,rows:A.map(i=>[i.setor,i.tipo,i.marca,i.modelo,i.pat,i.serie,i.nf.num,i.nf.forn,i.nf.valor,ST[i.status][0],i.status=="em_uso"&&i.origem!=i.setor?"origem: "+i.origem:""]),mark:()=>A.forEach(i=>i.exc=true)}}
 const E=[],rows=[],H=[],inS=(...v)=>!S||v.includes(S);
 items.forEach(i=>i.hist.forEach(h=>{if((!tp||i.tipo==tp)&&(!d1||h.d>=d1)&&(!d2||h.d<=d2)&&(!nv||!h.ex))E.push({h,i})}));
 E.sort((a,b)=>a.h.d.localeCompare(b.h.d));
 E.forEach(({h,i})=>{const r=h.rel,ri=r&&gi(r.id);
  if(k=="mov"&&inS(h.de,h.para)){rows.push([fd(h.d),h.t,i.pat,i.serie,i.tipo,i.modelo,h.de,h.para,h.m,h.termo,h.resp]);H.push(h)}
  else if(k=="ent"&&h.t=="Entrega"&&inS(h.para)){rows.push([fd(h.d),h.para,h.m,i.pat,i.serie,desc(i),r?r.pat+(h.termo=="TEP"?" (extraviado)":""):"-",r?r.serie:"",h.termo,h.resp]);H.push(h)}
  else if(k=="ext"){
   if(h.t=="Entrega"&&h.termo=="TEP"&&inS(h.para)){rows.push([fd(h.d),h.para,r?r.pat:"não identificado",r?r.serie:"",ri?desc(ri):desc(i),i.pat,i.serie,h.termo,h.resp,h.m]);H.push(h)}
   else if(h.t=="Extravio/perda"&&!h.rel&&inS(h.de)){rows.push([fd(h.d),h.de,i.pat,i.serie,desc(i),"-","",h.termo,h.resp,h.m]);H.push(h)}}
 });
 return{k,tp,rows,mark:()=>H.forEach(h=>h.ex=true)}}
function xInfo(){$("#x_c").textContent=xData().rows.length+" linha(s) serão exportadas"}
function openExport(){
 const nA=XC.items.filter(i=>!i.exc).length,nH=XC.items.reduce((a,i)=>a+i.hist.filter(h=>!h.ex).length,0),tipos=[...new Set(items.map(i=>i.tipo).filter(Boolean))].sort();
 md2Open(`<h2>Exportar</h2><p class="aux" id="x_s" style="margin:-6px 0 12px"></p>
 <div class="campo"><label>O que exportar</label><select id="x_k" onchange="EQP.xInfo()">${Object.entries(KO).map(([v,l])=>`<option value="${v}">${l}</option>`).join("")}</select></div>
 <div class="campo"><label>Tipo de aparelho</label><select id="x_t" onchange="EQP.xInfo()"><option value="">Todos os tipos</option>${tipos.map(t=>`<option ${XC.tipo==t?"selected":""}>${esc(t)}</option>`).join("")}</select></div>
 <div class="campo" id="x_p"><label>Período (opcional)</label><div class="ac"><input type="date" id="x_d1" onchange="EQP.xInfo()"><input type="date" id="x_d2" onchange="EQP.xInfo()"></div></div>
 <div class="campo"><label>Formato</label><select id="x_f"><option value="xlsx">Planilha (.xlsx)</option><option value="pdf">PDF</option><option value="txt">TXT</option></select></div>
 <label style="display:flex;gap:10px;align-items:flex-start;font-weight:400;color:var(--text-dark)"><input type="checkbox" id="x_n" style="width:auto;margin-top:3px" onchange="EQP.xInfo()"><span>Só o que é novo desde a última exportação<br><span class="aux">${nA} cadastro(s) novo(s) · ${nH} movimentação(ões) nova(s)</span></span></label>
 <p class="aux" id="x_c"></p><div class="row"><button class="btn n" onclick="EQP.md2Close()">Cancelar</button><button class="btn p" onclick="EQP.runExport()">Exportar</button></div>`);xInfo();
}
async function salvar(nome,data){
 const c=cfg();if(c.saveFile){const r=await c.saveFile(nome,data);return r!==false}
 const ext=nome.split(".").pop(),mime={xlsx:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",pdf:"application/pdf",txt:"text/plain;charset=utf-8",csv:"text/csv;charset=utf-8"}[ext]||"application/octet-stream";
 const blob=new Blob([data],{type:mime});
 try{const f=typeof File=="function"?new File([blob],nome,{type:mime}):null;
  if(f&&/iPhone|iPad|Android/i.test(navigator.userAgent)&&navigator.canShare&&navigator.canShare({files:[f]})){try{await navigator.share({files:[f],title:nome});return true}catch(e){if(e&&e.name=="AbortError")return false}}}catch(e){}
 const u=URL.createObjectURL(blob),a=document.createElement("a");a.href=u;a.download=nome;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),5000);toast("Arquivo gerado ✓");return true;
}
function resumoRows(R){const r={};R.forEach(x=>{const k=desc({tipo:x[1],marca:x[2],modelo:x[3]});r[k]=(r[k]||0)+1});return Object.entries(r)}
async function runExport(){
 const d=xData(),f=$("#x_f").value,cols=COLS[d.k],R=d.rows,eq=d.k=="equip",tp=d.tp;
 if(!R.length)return toast("Nada para exportar com esse filtro");
 const sc=eq?XC.label:(XC.setor?"Setor: "+stl(XC.setor):"Todos os setores"),tit=KT[d.k]+(tp?" - "+tp:"")+" - "+sc,e="Emitido em "+fd(hoje())+" | "+R.length+" linha(s)",
  nome=slug(KT[d.k])+"_"+(XC.setor?slug(XC.setor):"geral")+(tp?"_"+slug(tp):"")+"_"+hoje(),H=cols.map(c=>c[0]),pv=(a,b)=>a&&a!="-"?a+(b?" (série "+b+")":""):"-";let ok=false;
 try{
  if(f=="txt"){let o=tit.toUpperCase()+"\n"+e+"\n",cur=null;
   if(eq){o+="\nRESUMO\n"+resumoRows(R).map(([k,v])=>"  "+v+"x "+k).join("\n")+"\n";R.forEach(r=>{if(r[0]!=cur){cur=r[0];o+="\nSETOR: "+cur+" ("+R.filter(x=>x[0]==cur).length+")\n"}o+="  - "+[r[4]||"s/ patrimônio",desc({tipo:r[1],marca:r[2],modelo:r[3]}),"Série "+(r[5]||"-"),r[6]?"NF "+r[6]:"",r[9],r[10]].filter(Boolean).join(" | ")+"\n"})}
   else{o+="\n";R.forEach(r=>{o+=(d.k=="ent"?[r[0],r[1],"ENTREGUE "+pv(r[3],r[4])+" "+r[5],"DEVOLVIDO "+pv(r[6],r[7]),r[2],r[8]]:d.k=="ext"?[r[0],r[1],"EXTRAVIADO "+pv(r[2],r[3])+" "+r[4],"SUBSTITUTO "+pv(r[5],r[6]),r[7],r[9]]:[r[0],r[1],r[2]||"s/ patrimônio",r[6]+" -> "+r[7],r[8],r[9]]).filter(Boolean).join(" | ")+"\n"})}
   ok=await salvar(nome+".txt",o)}
  else if(f=="pdf"){
   if(!window.jspdf)await loadJS("https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js");
   const doc=new window.jspdf.jsPDF({orientation:"landscape",unit:"mm",format:"a4"});let y=0;
   const hdr=()=>{doc.setFont("helvetica","bold");doc.setFontSize(8);let x=10;cols.forEach(([n,w])=>{doc.text(n,x,y);x+=w});doc.line(10,y+1.5,287,y+1.5);y+=6;doc.setFont("helvetica","normal")};
   doc.setFont("helvetica","bold");doc.setFontSize(13);doc.text(doc.splitTextToSize(tit,277)[0],10,14);doc.setFont("helvetica","normal");doc.setFontSize(9);doc.text(e,10,20);y=28;hdr();doc.setFontSize(8);
   R.forEach(r=>{if(y>195){doc.addPage();y=15;hdr()}let x=10;cols.forEach(([n,w],k)=>{doc.text(doc.splitTextToSize(String(r[k]||"-"),w-2)[0]||"-",x,y);x+=w});y+=5.5});
   if(eq){y+=6;if(y>180){doc.addPage();y=15}doc.setFont("helvetica","bold");doc.text("Resumo",10,y);doc.setFont("helvetica","normal");resumoRows(R).forEach(([k,v])=>{y+=5.5;if(y>195){doc.addPage();y=15}doc.text(v+"x  "+k,10,y)})}
   ok=await salvar(nome+".pdf",doc.output("arraybuffer"))}
  else{let b=null;
   try{if(!window.XLSX)await loadJS("https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js");const wb=XLSX.utils.book_new(),w=XLSX.utils.aoa_to_sheet([H,...R]);w["!cols"]=cols.map(c=>({wch:c[1]*.6}));XLSX.utils.book_append_sheet(wb,w,KT[d.k].slice(0,31));if(eq)XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet([["Equipamento","Quantidade"],...resumoRows(R)]),"Resumo");b=XLSX.write(wb,{bookType:"xlsx",type:"array"})}catch(x){}
   ok=b?await salvar(nome+".xlsx",b):await salvar(nome+".csv","\ufeff"+[H,...R].map(r=>r.map(v=>'"'+String(v??"").replace(/"/g,'""')+'"').join(";")).join("\r\n"))}
 }catch(x){if(x&&x.code=="declined")return;toast("Não foi possível exportar"+(x&&x.message?": "+x.message:""));return}
 if(ok){if($("#x_n")&&$("#x_n").checked){d.mark();save()}md2Close()}
}
/* câmera / código de barras (2.5.2: leitor próprio sobre o ZXing: alta resolução, recortes, código invertido, lanterna e foto como alternativa) */
function stopScan(){if(SS){clearInterval(SS.t);clearTimeout(SS.h);try{SS.r&&SS.r.reset()}catch(e){}SS.s&&SS.s.getTracks().forEach(t=>t.stop());SS=null}}
function scanTo(id){scan(v=>{$("#"+id).value=v;LASTCAM=id;chk()})}
const ZXURLS=["https://cdn.jsdelivr.net/npm/@zxing/library@0.21.3/umd/index.min.js","https://unpkg.com/@zxing/library@0.21.3/umd/index.min.js"];
function loadZX(){return new Promise((ok,no)=>{if(window.ZXing)return ok();let i=0;const tenta=()=>{if(i>=ZXURLS.length)return no(new Error("biblioteca"));const e=document.createElement("script");e.src=ZXURLS[i++];e.onload=()=>window.ZXing?ok():tenta();e.onerror=()=>{e.remove();tenta()};document.head.appendChild(e)};tenta()})}
const ehIOS=()=>/iP(hone|ad|od)/.test(navigator.userAgent)||(navigator.platform==="MacIntel"&&navigator.maxTouchPoints>1);
let ZXR=null;
function zxReader(){if(ZXR)return ZXR;const Z=window.ZXing,B=Z.BarcodeFormat,h=new Map();
 h.set(Z.DecodeHintType.POSSIBLE_FORMATS,[B.CODE_128,B.CODE_39,B.CODE_93,B.EAN_13,B.EAN_8,B.UPC_A,B.UPC_E,B.ITF,B.CODABAR,B.QR_CODE,B.DATA_MATRIX,B.PDF_417,B.AZTEC]);
 h.set(Z.DecodeHintType.TRY_HARDER,true);const r=new Z.MultiFormatReader();r.setHints(h);ZXR=r;return r}
function zxDecode(canvas,inv){const Z=window.ZXing;try{let src=new Z.HTMLCanvasElementLuminanceSource(canvas);if(inv)src=src.invert();const r=zxReader().decode(new Z.BinaryBitmap(new Z.HybridBinarizer(src)));return r&&r.getText?r.getText():null}catch(e){return null}}
function zxFrame(v,cv,passo){const w=v.videoWidth,h=v.videoHeight;if(!w||!h)return null;
 let sx=0,sy=0,sw=w,sh=h;if(passo%2===1){sw=Math.round(w*.7);sh=Math.round(h*.5);sx=Math.round((w-sw)/2);sy=Math.round((h-sh)/2)} // quadros ímpares: recorte central, mais pixels por barra
 const tw=Math.min(sw,1280),th=Math.round(sh*tw/sw);cv.width=tw;cv.height=th;cv.getContext("2d",{willReadFrequently:true}).drawImage(v,sx,sy,sw,sh,0,0,tw,th);
 return zxDecode(cv)||zxDecode(cv,true)}
function zxImagem(img){const W=img.naturalWidth||img.width,H=img.naturalHeight||img.height;if(!W||!H)return null;const esc=Math.min(1,1800/Math.max(W,H)),cv=document.createElement("canvas"),cx=cv.getContext("2d",{willReadFrequently:true});
 for(const rot of [0,90]){const w=Math.round(W*esc),h=Math.round(H*esc);
  for(const crop of [0,1]){let sw=w,sh=h,sx=0,sy=0;if(crop){sw=Math.round(w*.8);sh=Math.round(h*.5);sx=Math.round((w-sw)/2);sy=Math.round((h-sh)/2)}
   const tmp=document.createElement("canvas");tmp.width=w;tmp.height=h;tmp.getContext("2d").drawImage(img,0,0,w,h);
   cv.width=rot?sh:sw;cv.height=rot?sw:sh;cx.setTransform(1,0,0,1,0,0);if(rot)cx.setTransform(0,1,-1,0,sh,0);cx.drawImage(tmp,sx,sy,sw,sh,0,0,sw,sh);cx.setTransform(1,0,0,1,0,0);
   const t=zxDecode(cv)||zxDecode(cv,true);if(t)return t}}
 return null}
async function scan(cb){
 md2Open(`<h2>Ler código de barras</h2><div style="position:relative"><video id="vid" playsinline muted autoplay style="width:100%;aspect-ratio:4/3;object-fit:cover;background:#000;border-radius:12px;display:block"></video><div style="position:absolute;left:10%;right:10%;top:28%;bottom:28%;border:2px solid rgba(255,255,255,.9);border-radius:10px;box-shadow:0 0 0 999px rgba(0,0,0,.28);pointer-events:none"></div></div><div id="se" class="aux" style="margin:8px 0">Aponte a câmera para o código e mantenha-o dentro do quadro…</div><div class="row" style="margin-bottom:8px"><label class="btn n" style="cursor:pointer">📷 Tirar foto do código<input id="foto" type="file" accept="image/*" capture="environment" style="display:none"></label><button id="lant" class="btn n" style="display:none">🔦 Lanterna</button></div><div class="campo"><label>Ou digite / bipe com o leitor</label><input id="man" placeholder="Código" onkeydown="if(event.key=='Enter')EQP.fin(this.value)"></div><div class="row"><button class="btn n" onclick="EQP.md2Close()">Cancelar</button></div>`);
 SS={};const st=t=>{const e=$("#se");if(e)e.textContent=t};
 const done=v=>{try{navigator.vibrate&&navigator.vibrate(60)}catch(e){}md2Close();if(v)cb(String(v).trim())};fin=done;
 const meu=SS; // se a janela fechar e abrir de novo, não mexe na leitura nova
 $("#foto").addEventListener("change",async ev=>{const f=ev.target.files&&ev.target.files[0];if(!f)return;st("Lendo a foto…");
  try{await loadZX()}catch(e){st("Não consegui carregar a biblioteca de leitura (sem internet?). Digite o código abaixo.");return}
  const url=URL.createObjectURL(f),img=new Image();
  img.onload=()=>{const t=zxImagem(img);URL.revokeObjectURL(url);if(t)done(t);else st("Não consegui ler essa foto. Tente de novo mais perto, com boa luz e o código reto; ou digite abaixo.")};
  img.onerror=()=>{URL.revokeObjectURL(url);st("Não consegui abrir a foto. Digite o código abaixo.")};img.src=url});
 try{const v=$("#vid");
  const pedir=async()=>{try{return await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:"environment"},width:{ideal:1920},height:{ideal:1080}},audio:false})}catch(e){if(e&&(e.name==="NotAllowedError"||e.name==="SecurityError"))throw e;return await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:"environment"}},audio:false})}};
  const stream=await pedir();if(SS!==meu){stream.getTracks().forEach(t=>t.stop());return}SS.s=stream;
  v.srcObject=stream;await v.play();
  try{const tr=stream.getVideoTracks()[0],cap=tr.getCapabilities?tr.getCapabilities():{};
   if(cap.focusMode&&cap.focusMode.indexOf("continuous")>=0)tr.applyConstraints({advanced:[{focusMode:"continuous"}]}).catch(()=>{});
   if(cap.torch){const b=$("#lant");b.style.display="";let on=false;b.onclick=()=>{on=!on;tr.applyConstraints({advanced:[{torch:on}]}).catch(()=>{})}}}catch(e){}
  SS.h=setTimeout(()=>st("Dica: afaste ou aproxime até o código ficar nítido, use boa luz, segure firme. Se não ler, use “Tirar foto do código”."),7000);
  let nativo=null;
  if(!ehIOS()&&"BarcodeDetector" in window){try{nativo=new BarcodeDetector();const f=BarcodeDetector.getSupportedFormats?await BarcodeDetector.getSupportedFormats():[1];if(!f.length)nativo=null}catch(e){nativo=null}}
  if(nativo){SS.t=setInterval(async()=>{try{const r=await nativo.detect(v);if(r.length)done(r[0].rawValue)}catch(e){}},200)}
  else{await loadZX();if(SS!==meu)return;const cv=document.createElement("canvas");let passo=0,ocupado=false;
   SS.t=setInterval(()=>{if(ocupado||v.readyState<2)return;ocupado=true;try{const t=zxFrame(v,cv,passo++);if(t)done(t)}catch(e){}ocupado=false},140)}
 }catch(e){const nome=e&&e.name||"erro";
  st(nome==="NotAllowedError"?"A câmera foi bloqueada. Permita o acesso à câmera nos Ajustes do navegador, ou use “Tirar foto do código” / digite o código abaixo.":nome==="Error"&&/biblioteca/.test(e.message||"")?"Não consegui carregar a biblioteca de leitura (sem internet?). Use “Tirar foto do código” ou digite o código abaixo.":"Câmera indisponível aqui ("+nome+"). Use “Tirar foto do código” ou digite o código abaixo.");
  const m=$("#man");if(m)m.focus()}
}

function mount(host,opt){
 opt=opt||{};
 R.screen=host.shadowRoot||host.attachShadow({mode:"open"});
 R.screen.innerHTML=`<style>${CSS}</style><div class="in" id="v"></div>`;
 if(!R.ov){const h=document.createElement("div");h.id="eqp-overlay";(opt.overlayParent||document.body).appendChild(h);
  R.ov=h.attachShadow({mode:"open"});
  R.ov.innerHTML=`<style>${CSS}</style><div class="ov" id="ov"><div class="md" id="md"></div></div><div class="ov" id="ov2"><div class="md" id="md2"></div></div><div id="toast"></div>`;
  R.ov.getElementById("ov").addEventListener("mousedown",e=>{if(e.target.id=="ov")mdClose()});
  R.ov.getElementById("ov2").addEventListener("mousedown",e=>{if(e.target.id=="ov2")md2Close()})}
 load();render()}
const EQP=window.EQP=window.EQP||{};
const def=(n,g,s)=>Object.defineProperty(EQP,n,{get:g,set:s,enumerable:true,configurable:true});
EQP.$=$;
def("F",()=>F,v=>{F=v});
def("M",()=>M,v=>{M=v});
def("blank",()=>blank);
def("chk",()=>chk);
def("clr",()=>clr);
def("confirmar",()=>confirmar);
def("copiar",()=>copiar);
def("delSetor",()=>delSetor);
def("exportEq",()=>exportEq);
def("exportSetor",()=>exportSetor);
def("fin",()=>fin,v=>{fin=v});
def("goMov",()=>goMov);
def("goNF",()=>goNF);
def("lista",()=>lista);
def("md2Close",()=>md2Close);
def("mdClose",()=>mdClose);
def("nfFill",()=>nfFill);
def("openDet",()=>openDet);
def("openItem",()=>openItem);
def("openNF",()=>openNF);
def("openSetor",()=>openSetor);
def("openSetorView",()=>openSetorView);
def("pick",()=>pick);
def("render",()=>render);
def("renderEq",()=>renderEq);
def("renderMov",()=>renderMov);
def("runExport",()=>runExport);
def("saveItem",()=>saveItem);
def("saveSetor",()=>saveSetor);
def("scan",()=>scan);
def("scanTo",()=>scanTo);
def("sug",()=>sug);
def("tab",()=>tab,v=>{tab=v});
def("xInfo",()=>xInfo);
EQP.version="1.0.0";
EQP.mount=mount;
EQP.onShow=()=>{if(R.screen)render()};
EQP.setState=x=>{if(applyState(x)&&R.screen)render()};
EQP.getState=()=>({items,setores});
EQP.closeAll=()=>{if(R.ov){mdClose();md2Close()}};
EQP.novoDaNF=nf=>{if(!R.screen)return;tab="eq";render();openItem(0);nf=nf||{};$("#a_nf").value=nf.num||"";$("#a_nfd").value=nf.data||"";$("#a_forn").value=nf.forn||"";$("#a_val").value=nf.valor||""};
EQP.loadDemo=()=>{seed();seedCfg();save();if(R.screen)render()};

})();
