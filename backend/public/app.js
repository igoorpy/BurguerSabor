/* Burguer & Sabor — site do cliente (estilo app de delivery) e painel do admin. JavaScript puro, sem build. */
'use strict';

// ---------- Constantes, estado e utilidades ----------

const FORMAS = [
  { valor: 'PIX', nome: 'Pix', dica: 'Aprovado na hora' },
  { valor: 'CARTAO_CREDITO', nome: 'Cartão de crédito', dica: 'Aprovado na hora' },
  { valor: 'CARTAO_DEBITO', nome: 'Cartão de débito', dica: 'Aprovado na hora' },
  { valor: 'DINHEIRO', nome: 'Dinheiro', dica: 'Pague na entrega' },
];
const NOME_FORMA = Object.fromEntries(FORMAS.map((f) => [f.valor, f.nome]));
const ETAPAS = ['RECEBIDO', 'PREPARANDO', 'SAIU_ENTREGA', 'CONCLUIDO'];
const NOME_STATUS = {
  RECEBIDO: 'Recebido',
  PREPARANDO: 'Em preparo',
  SAIU_ENTREGA: 'Saiu para entrega',
  CONCLUIDO: 'Entregue',
  CANCELADO: 'Cancelado',
};
const FRASE_STATUS = {
  RECEBIDO: 'A loja recebeu seu pedido',
  PREPARANDO: 'Seu pedido está sendo preparado',
  SAIU_ENTREGA: 'Seu pedido saiu para entrega',
  CONCLUIDO: 'Pedido entregue. Bom apetite!',
  CANCELADO: 'Este pedido foi cancelado',
};
const DETALHE_ETAPA = {
  RECEBIDO: 'A loja já está com o seu pedido.',
  PREPARANDO: 'Os lanches estão na chapa.',
  SAIU_ENTREGA: 'O entregador está a caminho.',
  CONCLUIDO: 'Pedido entregue no seu endereço.',
};
const NOME_PAGAMENTO = { APROVADO: 'Pago', PENDENTE: 'A pagar na entrega', RECUSADO: 'Estornado', REEMBOLSO_SOLICITADO: 'Reembolso solicitado', REEMBOLSADO: 'Reembolsado' };
const ICONE_LIXEIRA = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>';
const FOTO_PADRAO = '/img/sem-foto.svg';

const guardar = (chave, valor) => {
  try { localStorage.setItem(chave, JSON.stringify(valor)); } catch { /* navegador sem armazenamento */ }
};
const ler = (chave, padrao) => {
  try { const v = localStorage.getItem(chave); return v ? JSON.parse(v) : padrao; } catch { return padrao; }
};

const estado = {
  sessao: ler('bs-sessao', null), // { token, usuario }
  sacola: ler('bs-sacola', []), // [{ chave, produtoId, nome, preco, imagemUrl, quantidade, observacao }]
  loja: null, // { nome, taxaEntrega, tempoEntregaMin, tempoEntregaMax, notaMedia, totalAvaliacoes }
};
// Sem ninguém logado, não sobra sacola de uma sessão anterior
if (!estado.sessao) estado.sacola = [];

let timerTela; // atualização automática da tela atual (pedido ao vivo, fila da cozinha)

const reais = (v) => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const numero = (v) => Number(v).toLocaleString('pt-BR', { maximumFractionDigits: 2 });
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const dataHora = (d) => new Date(d).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
const hora = (d) => new Date(d).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
const $ = (sel, raiz = document) => raiz.querySelector(sel);
const main = () => $('#conteudo');
const ehAdmin = () => estado.sessao?.usuario?.tipoUsuario === 'ADMIN';
const ehCliente = () => estado.sessao?.usuario?.tipoUsuario === 'CLIENTE';
const foto = (url) => esc(url || FOTO_PADRAO);
const estrelas = (n) => '★'.repeat(n) + '☆'.repeat(5 - n);
const taxa = () => estado.loja?.taxaEntrega ?? 5;

let timerAviso;
function avisar(texto, erro = false) {
  const el = $('#aviso');
  el.textContent = texto;
  el.classList.toggle('erro', erro);
  el.classList.add('ver');
  clearTimeout(timerAviso);
  timerAviso = setTimeout(() => el.classList.remove('ver'), 3500);
}

/** Chama a API e transforma a resposta de erro padrão em uma mensagem legível. */
async function api(caminho, { metodo = 'GET', corpo } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (estado.sessao?.token) headers.Authorization = `Bearer ${estado.sessao.token}`;
  const resp = await fetch(caminho, { method: metodo, headers, body: corpo ? JSON.stringify(corpo) : undefined });
  if (resp.status === 204) return null;
  const dados = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    if (resp.status === 401 && estado.sessao) {
      sair(false);
      avisar('Sua sessão expirou. Entre de novo.', true);
      location.hash = '#/entrar';
    }
    const msg = Array.isArray(dados.message) ? dados.message.join('; ') : dados.message || `Erro ${resp.status}`;
    const erro = new Error(msg);
    erro.status = resp.status;
    erro.details = dados.details;
    throw erro;
  }
  return dados;
}

async function carregarLoja() {
  try { estado.loja = await api('/loja'); } catch { /* segue com os valores padrão */ }
}

function salvarSacola() {
  guardar('bs-sacola', estado.sacola);
  desenharMenu();
}

function sair(irParaInicio = true) {
  estado.sessao = null;
  guardar('bs-sessao', null);
  // A sacola é de quem está logado: ao sair, ela é esvaziada
  estado.sacola = [];
  guardar('bs-sacola', []);
  desenharMenu();
  if (irParaInicio) location.hash = '#/';
}

function abrirDialogo(conteudo, { botaoFechar = true } = {}) {
  const d = $('#dialogo');
  d.innerHTML = conteudo + (botaoFechar ? '<p style="margin-top:16px"><button class="botao secundario" type="button" data-fechar>Fechar</button></p>' : '');
  d.querySelectorAll('[data-fechar]').forEach((b) => b.addEventListener('click', () => d.close()));
  if (!d.open) d.showModal();
  return d;
}

// ---------- Menu e barra da sacola ----------

function totaisSacola() {
  if (!ehCliente()) return { subtotal: 0, itens: 0, total: 0 };
  const subtotal = estado.sacola.reduce((s, i) => s + Math.round(i.preco * 100) * i.quantidade, 0) / 100;
  const itens = estado.sacola.reduce((s, i) => s + i.quantidade, 0);
  return { subtotal, itens, total: subtotal ? Math.round((subtotal + taxa()) * 100) / 100 : 0 };
}

function desenharMenu() {
  const rota = (location.hash || '#/').split('?')[0];
  const atual = (h) => (rota === h || (h !== '#/' && rota.startsWith(h)) ? ' aria-current="page"' : '');
  const { itens, total } = totaisSacola();
  let html = '';
  if (ehAdmin()) {
    html += `<a href="#/admin/pedidos"${atual('#/admin')}>Painel da loja</a><a href="#/"${atual('#/')}>Ver cardápio</a>`;
  } else {
    html += `<a href="#/"${atual('#/')}>Cardápio</a>`;
    if (ehCliente()) html += `<a href="#/pedidos"${atual('#/pedido')}>Pedidos</a>`;
    html += `<a href="#/finalizar"${atual('#/finalizar')}>Sacola${itens ? `<span class="contador">${itens}</span>` : ''}</a>`;
  }
  html += estado.sessao
    ? `<span class="quem">${esc(estado.sessao.usuario.nome.split(' ')[0])}</span><button type="button" id="botao-sair">Sair</button>`
    : `<a href="#/entrar"${atual('#/entrar')}>Entrar</a>`;
  $('#menu').innerHTML = html;
  $('#botao-sair')?.addEventListener('click', () => { sair(); avisar('Você saiu da sua conta.'); });

  const barra = $('#barra-sacola');
  const mostrarBarra = itens > 0 && !ehAdmin() && (rota === '#/' || rota === '');
  barra.hidden = !mostrarBarra;
  if (mostrarBarra) barra.innerHTML = `<span class="qtd">${itens}</span> Ver sacola <span class="valor">${reais(total)}</span>`;
}

// ---------- Cliente: loja e cardápio ----------

const filtro = { categoriaId: null, busca: '' };

function htmlLoja() {
  const l = estado.loja;
  const nota = l?.totalAvaliacoes
    ? `<span class="nota">★ <strong>${numero(l.notaMedia)}</strong> (${l.totalAvaliacoes} ${l.totalAvaliacoes === 1 ? 'avaliação' : 'avaliações'})</span>`
    : '<span class="nota">★ Novo por aqui</span>';
  return `
    <section class="loja" aria-label="Informações da loja">
      <div class="loja-capa" role="img" aria-label="Capa da loja"></div>
      <div class="loja-info">
        <div class="loja-logo"><svg viewBox="0 0 64 64" aria-hidden="true"><path d="M8 30a24 18 0 0 1 48 0z" fill="#F2B705"/><rect x="6" y="34" width="52" height="8" rx="4" fill="#C8102E"/><path d="M8 46h48a4 4 0 0 1-4 6H12a4 4 0 0 1-4-6z" fill="#F2B705"/></svg></div>
        <div class="loja-texto">
          <h1>${esc(l?.nome ?? 'Burguer & Sabor')}</h1>
          <div class="loja-dados">${nota}<span>Lanches e pizzas</span><span>${l?.tempoEntregaMin ?? 30}–${l?.tempoEntregaMax ?? 45} min</span><span>Entrega ${reais(taxa())}</span></div>
        </div>
      </div>
    </section>`;
}

async function telaCardapio() {
  await carregarLoja();
  main().innerHTML = `
    ${htmlLoja()}
    <div class="filtros">
      <div class="abas" id="abas" role="group" aria-label="Categorias"></div>
      <div class="busca"><label class="visualmente-oculto" for="busca">Buscar no cardápio</label>
        <input type="search" id="busca" placeholder="Buscar no cardápio" value="${esc(filtro.busca)}"></div>
    </div>
    <div class="cardapio-layout">
      <div id="produtos" aria-live="polite"><p class="vazio">Carregando o cardápio…</p></div>
      <aside class="comanda" id="comanda" aria-label="Sua sacola"></aside>
    </div>`;
  desenharMenu();

  const categorias = await api('/categorias?somenteAtivas=true');
  const abas = $('#abas');
  const desenharAbas = () => {
    abas.innerHTML = [{ id: null, nome: 'Tudo' }, ...categorias]
      .map((c) => `<button type="button" data-id="${c.id ?? ''}" aria-pressed="${filtro.categoriaId === c.id}">${esc(c.nome)}</button>`)
      .join('');
  };
  desenharAbas();
  abas.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    filtro.categoriaId = b.dataset.id ? Number(b.dataset.id) : null;
    desenharAbas();
    carregarProdutos(categorias);
  });

  let espera;
  $('#busca').addEventListener('input', (e) => {
    clearTimeout(espera);
    espera = setTimeout(() => { filtro.busca = e.target.value; carregarProdutos(categorias); }, 250);
  });

  desenharSacolaLateral();
  await carregarProdutos(categorias);
}

async function carregarProdutos(categorias) {
  const area = $('#produtos');
  if (!area) return;
  const q = new URLSearchParams();
  if (filtro.categoriaId) q.set('categoriaId', filtro.categoriaId);
  if (filtro.busca.trim()) q.set('busca', filtro.busca.trim());
  const produtos = (await api(`/produtos?${q}`)).filter((p) => p.disponivel && p.categoriaAtiva);
  if (!produtos.length) {
    area.innerHTML = `<p class="vazio">Nada encontrado${filtro.busca ? ` para “${esc(filtro.busca)}”` : ''}. Tente outro termo ou outra categoria.</p>`;
    return;
  }
  const ordem = new Map(categorias.map((c, i) => [c.id, i]));
  const grupos = new Map();
  for (const p of produtos.sort((a, b) => (ordem.get(a.categoriaId) ?? 99) - (ordem.get(b.categoriaId) ?? 99))) {
    if (!grupos.has(p.categoriaId)) grupos.set(p.categoriaId, { nome: p.categoriaNome, itens: [] });
    grupos.get(p.categoriaId).itens.push(p);
  }
  area.innerHTML = [...grupos.values()]
    .map((g) => `
      <section class="secao-categoria">
        <h2>${esc(g.nome)}</h2>
        <div class="lista-produtos">${g.itens.map(htmlProduto).join('')}</div>
      </section>`)
    .join('');
  area.querySelectorAll('[data-produto]').forEach((b) =>
    b.addEventListener('click', () => abrirProduto(produtos.find((p) => p.id === Number(b.dataset.produto)))),
  );
}

function htmlProduto(p) {
  const vende = p.disponivelParaVenda;
  return `
    <button type="button" class="produto${vende ? '' : ' indisponivel'}" ${vende ? `data-produto="${p.id}"` : 'disabled'} aria-label="${esc(p.nome)}, ${reais(p.preco)}${vende ? '' : ', indisponível no momento'}">
      <div>
        <h3>${esc(p.nome)}</h3>
        <p>${esc(p.descricao || '')}</p>
        ${vende ? `<span class="preco">${reais(p.preco)}</span>` : '<span class="selo">Indisponível no momento</span>'}
      </div>
      <img src="${foto(p.imagemUrl)}" alt="" loading="lazy" onerror="this.src='${FOTO_PADRAO}'">
    </button>`;
}

function abrirProduto(p) {
  let qtd = 1;
  const d = abrirDialogo(`
    <form class="detalhe" id="form-produto">
      <img src="${foto(p.imagemUrl)}" alt="${esc(p.nome)}" onerror="this.src='${FOTO_PADRAO}'">
      <h2>${esc(p.nome)}</h2>
      <p>${esc(p.descricao || '')}</p>
      <p class="preco">${reais(p.preco)}</p>
      <div class="campo"><label for="obs">Alguma observação?</label><textarea id="obs" maxlength="200" placeholder="Ex.: sem cebola, ponto da carne…"></textarea></div>
      <div class="rodape-detalhe">
        <div class="stepper"><button type="button" data-menos aria-label="Diminuir quantidade" disabled>−</button><span id="qtd-detalhe">1</span><button type="button" data-mais aria-label="Aumentar quantidade">+</button></div>
        <button class="botao" type="submit" style="flex:1">Adicionar <span class="valor" id="valor-detalhe">${reais(p.preco)}</span></button>
      </div>
      <p style="margin-top:12px"><button class="botao secundario pequeno" type="button" data-fechar>Voltar ao cardápio</button></p>
    </form>`, { botaoFechar: false });
  const atualizar = () => {
    $('#qtd-detalhe', d).textContent = qtd;
    $('#valor-detalhe', d).textContent = reais(p.preco * qtd);
    $('[data-menos]', d).disabled = qtd <= 1;
    $('[data-mais]', d).disabled = qtd >= 50;
  };
  $('[data-menos]', d).addEventListener('click', () => { qtd = Math.max(1, qtd - 1); atualizar(); });
  $('[data-mais]', d).addEventListener('click', () => { qtd = Math.min(50, qtd + 1); atualizar(); });
  $('#form-produto', d).addEventListener('submit', (e) => {
    e.preventDefault();
    if (!estado.sessao) {
      d.close();
      avisar('Entre na sua conta para montar a sacola.');
      location.hash = '#/entrar';
      return;
    }
    if (ehAdmin()) { d.close(); avisar('Pedidos são feitos com uma conta de cliente.', true); return; }
    const observacao = $('#obs', d).value.trim();
    const chave = `${p.id}|${observacao}`;
    const existente = estado.sacola.find((i) => i.chave === chave);
    if (existente) existente.quantidade = Math.min(50, existente.quantidade + qtd);
    else estado.sacola.push({ chave, produtoId: p.id, nome: p.nome, preco: p.preco, imagemUrl: p.imagemUrl, quantidade: qtd, observacao });
    salvarSacola();
    desenharSacolaLateral();
    d.close();
    avisar(`${qtd} × ${p.nome} na sacola.`);
  });
}

// ---------- Cliente: sacola ----------

function htmlSacola(editavel = true) {
  if (!estado.sacola.length) {
    return `<h2>Sua sacola</h2><p class="vazio">Sua sacola está vazia. Escolha algo gostoso no cardápio.</p>`;
  }
  const { subtotal, itens, total } = totaisSacola();
  const linhas = estado.sacola
    .map((i) => `
      <li>
        <strong>${editavel ? '' : `${i.quantidade}× `}${esc(i.nome)}</strong><span>${reais(i.preco * i.quantidade)}</span>
        ${i.observacao ? `<span class="obs">Obs.: ${esc(i.observacao)}</span>` : ''}
        ${editavel ? `<div class="linha-acoes">
          <button type="button" class="remover" data-remover="${esc(i.chave)}" aria-label="Tirar ${esc(i.nome)} da sacola" title="Tirar da sacola">${ICONE_LIXEIRA}<span>Remover</span></button>
          <div class="stepper"><button type="button" data-menos="${esc(i.chave)}" aria-label="Tirar um ${esc(i.nome)}">−</button><span>${i.quantidade}</span><button type="button" data-mais="${esc(i.chave)}" aria-label="Pôr mais um ${esc(i.nome)}">+</button></div>
        </div>` : ''}
      </li>`)
    .join('');
  return `
    <h2>Sua sacola <small>${itens} ${itens === 1 ? 'item' : 'itens'}</small></h2>
    <ul>${linhas}</ul>
    <div class="totais">
      <div><span>Subtotal</span><span>${reais(subtotal)}</span></div>
      <div><span>Taxa de entrega</span><span>${reais(taxa())}</span></div>
      <div class="total"><span>Total</span><span>${reais(total)}</span></div>
    </div>`;
}

function ligarEdicaoSacola(el, aoMudar) {
  el.onclick = (e) => {
    const alvo = e.target.closest('button[data-mais], button[data-menos], button[data-remover]');
    if (!alvo) return;
    const chave = alvo.dataset.mais || alvo.dataset.menos || alvo.dataset.remover;
    const item = estado.sacola.find((i) => i.chave === chave);
    if (!item) return;
    if (alvo.dataset.mais) item.quantidade = Math.min(50, item.quantidade + 1);
    if (alvo.dataset.menos) item.quantidade -= 1;
    if (alvo.dataset.remover || item.quantidade < 1) estado.sacola = estado.sacola.filter((i) => i.chave !== chave);
    salvarSacola();
    aoMudar();
  };
}

function desenharSacolaLateral() {
  const el = $('#comanda');
  if (!el) return;
  el.innerHTML = htmlSacola(true) + (estado.sacola.length ? '<a class="botao cheio" href="#/finalizar">Escolher entrega e pagamento</a>' : '');
  ligarEdicaoSacola(el, desenharSacolaLateral);
}

// ---------- Cliente: finalizar pedido ----------

async function telaFinalizar() {
  await carregarLoja();
  if (!estado.sacola.length) {
    main().innerHTML = `<div class="painel estreito"><h1>Sua sacola está vazia</h1><p>Escolha seus lanches no cardápio para fazer um pedido.</p><a class="botao" href="#/">Ver cardápio</a></div>`;
    return;
  }
  if (!ehCliente()) {
    main().innerHTML = `<div class="dupla"><div class="painel"><h1>Quase lá</h1><p>Entre na sua conta ou crie uma para escolher o endereço e a forma de pagamento.</p>
      <p><a class="botao" href="#/entrar?voltar=finalizar">Entrar</a> <a class="botao secundario" href="#/cadastro?voltar=finalizar">Criar conta</a></p>
      ${ehAdmin() ? '<p class="erro-form">Você está como administrador. Pedidos são feitos com uma conta de cliente.</p>' : ''}</div>
      <aside class="comanda" id="sacola-checkout"></aside></div>`;
    const el = $('#sacola-checkout');
    const desenhar = () => { el.innerHTML = htmlSacola(true); ligarEdicaoSacola(el, desenhar); };
    desenhar();
    return;
  }

  const enderecos = await api('/enderecos');
  main().innerHTML = `
    <div class="dupla">
      <form class="painel" id="form-pedido" novalidate>
        <h1>Finalizar pedido</h1>
        <div class="erro-form" id="erro"></div>
        <h2>Entregar em</h2>
        <p class="previsao">Hoje, ${estado.loja?.tempoEntregaMin ?? 30}–${estado.loja?.tempoEntregaMax ?? 45} min · ${reais(taxa())}</p>
        <div id="lista-enderecos"></div>
        <details id="novo-endereco" ${enderecos.length ? '' : 'open'}>
          <summary>Adicionar outro endereço</summary>
          <div class="linha-campos" style="margin-top:12px">
            <div class="campo"><label for="rua">Rua</label><input id="rua" type="text" autocomplete="address-line1"></div>
            <div class="campo"><label for="numero">Número</label><input id="numero" type="text"></div>
            <div class="campo"><label for="bairro">Bairro</label><input id="bairro" type="text"></div>
            <div class="campo"><label for="cep">CEP</label><input id="cep" type="text" placeholder="69000-000" inputmode="numeric"></div>
          </div>
          <div class="campo"><label for="ref">Ponto de referência (opcional)</label><input id="ref" type="text"></div>
          <button class="botao secundario pequeno" type="button" id="salvar-endereco">Salvar endereço</button>
        </details>
        <h2 style="margin-top:24px">Pagamento</h2>
        <div class="opcoes-pagamento">
          ${FORMAS.map((f, i) => `<div class="opcao"><input type="radio" name="forma" id="f-${f.valor}" value="${f.valor}" ${i === 0 ? 'checked' : ''}><label for="f-${f.valor}"><strong>${f.nome}</strong><span>${f.dica}</span></label></div>`).join('')}
        </div>
        <p><small>Pagamento simulado: nenhum valor é cobrado de verdade.</small></p>
        <button class="botao cheio" type="submit">Fazer pedido <span class="valor">${reais(totaisSacola().total)}</span></button>
      </form>
      <aside class="comanda">${htmlSacola(false)}<a class="botao secundario cheio" href="#/">Adicionar mais itens</a></aside>
    </div>`;

  const desenharEnderecos = (lista, selecionado) => {
    $('#lista-enderecos').innerHTML = lista.length
      ? `<div class="opcoes-pagamento">${lista
          .map((e, i) => `<div class="opcao"><input type="radio" name="endereco" id="e-${e.id}" value="${e.id}" ${(selecionado ? e.id === selecionado : i === 0) ? 'checked' : ''}><label for="e-${e.id}"><strong>${esc(e.rua)}, ${esc(e.numero)}</strong><span>${esc(e.bairro)} — ${esc(e.cep)}</span></label></div>`)
          .join('')}</div>`
      : '<p class="vazio">Você ainda não tem endereço. Adicione um abaixo.</p>';
  };
  desenharEnderecos(enderecos);

  $('#salvar-endereco').addEventListener('click', async () => {
    try {
      const novo = await api('/enderecos', {
        metodo: 'POST',
        corpo: { rua: $('#rua').value, numero: $('#numero').value, bairro: $('#bairro').value, cep: $('#cep').value, ...($('#ref').value ? { pontoReferencia: $('#ref').value } : {}) },
      });
      enderecos.push(novo);
      desenharEnderecos(enderecos, novo.id);
      $('#novo-endereco').open = false;
      $('#erro').textContent = '';
      avisar('Endereço salvo.');
    } catch (err) {
      $('#erro').textContent = err.message;
    }
  });

  $('#form-pedido').addEventListener('submit', async (e) => {
    e.preventDefault();
    const endereco = $('input[name="endereco"]:checked');
    if (!endereco) { $('#erro').textContent = 'Escolha ou adicione um endereço de entrega.'; return; }
    const botao = e.submitter;
    botao.disabled = true;
    try {
      const pedido = await api('/pedidos', {
        metodo: 'POST',
        corpo: {
          enderecoId: Number(endereco.value),
          formaPagamento: $('input[name="forma"]:checked').value,
          itens: estado.sacola.map((i) => ({ produtoId: i.produtoId, quantidade: i.quantidade, ...(i.observacao ? { observacao: i.observacao } : {}) })),
        },
      });
      estado.sacola = [];
      salvarSacola();
      avisar('Pedido feito!');
      location.hash = `#/pedido/${pedido.id}`;
    } catch (err) {
      const faltas = Array.isArray(err.details) && err.details[0]?.nomeItem ? ' Algum item acabou de esgotar; ajuste a sacola e tente de novo.' : '';
      $('#erro').textContent = err.message + faltas;
      botao.disabled = false;
    }
  });
}

// ---------- Cliente: acompanhar pedido (ao vivo) e avaliar ----------

async function telaPedido(id) {
  if (!ehCliente()) { location.hash = '#/entrar'; return; }
  await carregarLoja();
  const p = await api(`/pedidos/${id}`);
  const atual = ETAPAS.indexOf(p.status);
  const min = estado.loja?.tempoEntregaMin ?? 30;
  const max = estado.loja?.tempoEntregaMax ?? 45;
  const inicio = new Date(p.criadoEm);
  const previsao = `${hora(new Date(inicio.getTime() + min * 60000))}–${hora(new Date(inicio.getTime() + max * 60000))}`;
  const emAndamento = !['CONCLUIDO', 'CANCELADO'].includes(p.status);

  const avaliacao = p.status !== 'CONCLUIDO' ? ''
    : p.avaliacao
      ? `<div class="painel"><h2>Sua avaliação</h2><p class="estrelas-fixas" aria-label="${p.avaliacao.nota} de 5 estrelas">${estrelas(p.avaliacao.nota)}</p>${p.avaliacao.comentario ? `<p>“${esc(p.avaliacao.comentario)}”</p>` : ''}<p><small>Obrigado por avaliar!</small></p></div>`
      : `<form class="painel" id="form-avaliacao"><h2>Como foi o seu pedido?</h2>
          <div class="estrelas" role="radiogroup" aria-label="Nota de 1 a 5">${[1, 2, 3, 4, 5].map((n) => `<button type="button" role="radio" aria-checked="false" aria-label="${n} ${n === 1 ? 'estrela' : 'estrelas'}" data-nota="${n}">★</button>`).join('')}</div>
          <div class="campo"><label for="comentario">Quer contar mais? (opcional)</label><textarea id="comentario" maxlength="300"></textarea></div>
          <div class="erro-form" id="erro-avaliacao"></div>
          <button class="botao" type="submit">Enviar avaliação</button></form>`;

  const pg = p.pagamento;
  const reembolso = p.status !== 'CONCLUIDO' || !pg ? ''
    : pg.statusPagamento === 'REEMBOLSADO'
      ? `<div class="painel aviso-reembolso ok"><h2>Reembolso aprovado</h2><p>A loja aprovou o reembolso de <strong>${reais(pg.valorPago)}</strong> (pagamento simulado).</p>${pg.motivoReembolso ? `<p><small>Motivo: ${esc(pg.motivoReembolso)}</small></p>` : ''}</div>`
      : pg.statusPagamento === 'REEMBOLSO_SOLICITADO'
        ? `<div class="painel aviso-reembolso"><h2>Reembolso solicitado</h2><p>A loja vai analisar o seu pedido de reembolso. Esta tela atualiza sozinha.</p><p><small>Motivo: ${esc(pg.motivoReembolso || '')}</small></p></div>`
        : pg.statusPagamento === 'APROVADO'
          ? `<div class="painel"><h2>Algum problema com o pedido?</h2><p>${pg.motivoReembolso ? 'A loja recusou o pedido anterior, mas você pode explicar melhor e pedir de novo.' : 'Se algo deu errado, você pode pedir o reembolso do valor pago.'}</p><button class="botao secundario pequeno" type="button" id="pedir-reembolso">Pedir reembolso</button></div>`
          : '';

  main().innerHTML = `
    <div class="acompanhar">
      <div>
        <section class="painel status-grande">
          <p>${emAndamento ? '<span class="ao-vivo">Atualizando ao vivo</span>' : `Pedido ${p.id}`}</p>
          <h1>${FRASE_STATUS[p.status]}</h1>
          ${emAndamento ? `<p class="previsao">Previsão de entrega <strong>${previsao}</strong></p>` : ''}
          ${p.status === 'CANCELADO' ? '<p>Os itens foram devolvidos ao estoque e o pagamento foi estornado.</p>' : `
          <ol class="linha-tempo">${ETAPAS.map((s, i) => `<li class="${i < atual || p.status === 'CONCLUIDO' ? 'feita' : i === atual ? 'atual' : ''}"><strong>${NOME_STATUS[s]}</strong>${i <= atual ? DETALHE_ETAPA[s] : ''}</li>`).join('')}</ol>`}
          ${p.status === 'RECEBIDO' ? `<button class="botao perigo pequeno" type="button" id="cancelar">Cancelar pedido</button>` : ''}
        </section>
        ${avaliacao}
        ${reembolso}
      </div>
      <aside class="painel">
        <h2>Pedido ${p.id}</h2>
        <p><small>Feito em ${dataHora(p.criadoEm)}</small></p>
        <ul style="padding-left:18px">${p.itens.map((i) => `<li>${i.quantidade}× ${esc(i.produtoNome)} — ${reais(i.subtotal)}${i.observacao ? `<br><small>Obs.: ${esc(i.observacao)}</small>` : ''}</li>`).join('')}</ul>
        <div class="totais">
          <div><span>Taxa de entrega</span><span>${reais(p.taxaEntrega)}</span></div>
          <div class="total"><span>Total</span><span>${reais(p.valorTotal)}</span></div>
        </div>
        <p>${NOME_FORMA[p.pagamento?.formaPagamento] ?? ''} · ${NOME_PAGAMENTO[p.pagamento?.statusPagamento] ?? ''}</p>
        <a class="botao secundario cheio" href="#/pedidos">Ver todos os pedidos</a>
      </aside>
    </div>`;

  $('#cancelar')?.addEventListener('click', async () => {
    if (!confirm(`Cancelar o pedido ${p.id}?`)) return;
    try {
      await api(`/pedidos/${p.id}/cancelamento`, { metodo: 'POST' });
      avisar('Pedido cancelado.');
      telaPedido(id);
    } catch (err) { avisar(err.message, true); }
  });

  $('#pedir-reembolso')?.addEventListener('click', () => {
    const d = abrirDialogo(`<form id="form-reembolso" novalidate><h2>Pedir reembolso</h2>
      <p>Pedido ${p.id} · ${reais(pg.valorPago)}. Conte o que aconteceu; a loja vai analisar.</p>
      <div class="erro-form" id="erro-dialogo"></div>
      <div class="campo"><label for="motivo">Motivo</label><textarea id="motivo" maxlength="300" required placeholder="Ex.: o lanche chegou frio"></textarea></div>
      <button class="botao" type="submit">Enviar pedido de reembolso</button></form>`);
    $('#form-reembolso', d).addEventListener('submit', async (e) => {
      e.preventDefault();
      const motivo = $('#motivo', d).value.trim();
      if (motivo.length < 5) { $('#erro-dialogo', d).textContent = 'Conte em poucas palavras o motivo (pelo menos 5 letras).'; return; }
      try {
        await api(`/pedidos/${p.id}/reembolso`, { metodo: 'POST', corpo: { motivo } });
        d.close();
        avisar('Pedido de reembolso enviado para a loja.');
        telaPedido(id);
      } catch (err) { $('#erro-dialogo', d).textContent = err.message; }
    });
  });

  const form = $('#form-avaliacao');
  if (form) {
    let nota = 0;
    const botoes = [...form.querySelectorAll('[data-nota]')];
    botoes.forEach((b) => b.addEventListener('click', () => {
      nota = Number(b.dataset.nota);
      botoes.forEach((x) => { const acesa = Number(x.dataset.nota) <= nota; x.classList.toggle('acesa', acesa); x.setAttribute('aria-checked', String(Number(x.dataset.nota) === nota)); });
    }));
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!nota) { $('#erro-avaliacao').textContent = 'Escolha de 1 a 5 estrelas.'; return; }
      try {
        await api(`/pedidos/${p.id}/avaliacao`, { metodo: 'POST', corpo: { nota, ...($('#comentario').value.trim() ? { comentario: $('#comentario').value.trim() } : {}) } });
        avisar('Avaliação enviada. Obrigado!');
        telaPedido(id);
      } catch (err) { $('#erro-avaliacao').textContent = err.message; }
    });
  }

  // Status ao vivo: busca o pedido de novo a cada 5 s e redesenha só se o status mudou
  const aguardandoReembolso = pg?.statusPagamento === 'REEMBOLSO_SOLICITADO';
  if (emAndamento || aguardandoReembolso) {
    timerTela = setInterval(async () => {
      try {
        const novo = await api(`/pedidos/${id}`);
        if (novo.status !== p.status) { clearInterval(timerTela); avisar(FRASE_STATUS[novo.status]); telaPedido(id); }
        else if (novo.pagamento?.statusPagamento !== pg?.statusPagamento) {
          clearInterval(timerTela);
          avisar(novo.pagamento?.statusPagamento === 'REEMBOLSADO' ? 'A loja aprovou o seu reembolso.' : 'A loja respondeu o seu pedido de reembolso.');
          telaPedido(id);
        }
      } catch { /* tenta de novo no próximo ciclo */ }
    }, 5000);
  }
}

async function telaMeusPedidos() {
  if (!ehCliente()) { location.hash = '#/entrar'; return; }
  const pedidos = await api('/pedidos');
  main().innerHTML = `
    <div class="cabecalho"><h1>Seus pedidos</h1></div>
    ${pedidos.length
      ? pedidos.map((p) => `
        <a class="pedido" href="#/pedido/${p.id}">
          <div class="pedido-topo"><h3>Pedido ${p.id}</h3><span>${dataHora(p.criadoEm)}</span></div>
          <p>${p.itens.map((i) => `${i.quantidade}× ${esc(i.produtoNome)}`).join(', ')}</p>
          <p><span class="selo ${p.status === 'CONCLUIDO' ? 'ok' : p.status === 'CANCELADO' ? 'ruim' : 'atencao'}">${NOME_STATUS[p.status]}</span>
          <strong style="margin-left:8px">${reais(p.valorTotal)}</strong>
          ${p.status === 'CONCLUIDO' && !p.avaliacao ? '<span style="margin-left:8px">· Avalie este pedido</span>' : ''}
          ${p.avaliacao ? `<span class="estrelas-fixas" style="margin-left:8px;font-size:1rem">${estrelas(p.avaliacao.nota)}</span>` : ''}</p>
        </a>`).join('')
      : '<div class="painel"><p class="vazio">Você ainda não fez pedidos.</p><a class="botao" href="#/">Ver cardápio</a></div>'}`;
}

// ---------- Entrar e criar conta ----------

function voltarDepois() {
  const voltar = new URLSearchParams(location.hash.split('?')[1] || '').get('voltar');
  if (ehAdmin()) location.hash = '#/admin/pedidos';
  else location.hash = voltar === 'finalizar' ? '#/finalizar' : '#/';
}

async function entrar(email, senha) {
  const r = await api('/auth/login', { metodo: 'POST', corpo: { email, senha } });
  estado.sessao = { token: r.accessToken, usuario: r.usuario };
  guardar('bs-sessao', estado.sessao);
  desenharMenu();
  avisar(`Olá, ${r.usuario.nome.split(' ')[0]}!`);
}

function telaEntrar() {
  const voltar = location.hash.includes('voltar=finalizar') ? '?voltar=finalizar' : '';
  main().innerHTML = `
    <form class="painel estreito" id="form-entrar" novalidate>
      <h1>Entrar</h1>
      <p>Clientes e a equipe da loja entram por aqui.</p>
      <div class="erro-form" id="erro"></div>
      <div class="campo"><label for="email">E-mail</label><input id="email" type="email" autocomplete="username" required></div>
      <div class="campo"><label for="senha">Senha</label><input id="senha" type="password" autocomplete="current-password" required></div>
      <button class="botao cheio" type="submit">Entrar</button>
      <p style="margin-top:16px">Ainda não tem conta? <a href="#/cadastro${voltar}">Criar conta</a></p>
      <p class="contas">Contas de teste: <button type="button" data-conta="cliente">cliente Hudson</button> ou <button type="button" data-conta="admin">loja (admin)</button>.</p>
    </form>`;
  const contas = { cliente: ['hudson@email.com', 'cliente123'], admin: ['admin@burguersabor.com', 'admin123'] };
  main().querySelectorAll('[data-conta]').forEach((b) =>
    b.addEventListener('click', () => { [$('#email').value, $('#senha').value] = contas[b.dataset.conta]; }),
  );
  $('#form-entrar').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await entrar($('#email').value.trim(), $('#senha').value);
      voltarDepois();
    } catch (err) { $('#erro').textContent = err.message; }
  });
  $('#email').focus();
}

function telaCadastro() {
  main().innerHTML = `
    <form class="painel estreito" id="form-cadastro" novalidate>
      <h1>Criar conta</h1>
      <div class="erro-form" id="erro"></div>
      <div class="campo"><label for="nome">Nome</label><input id="nome" type="text" autocomplete="name"></div>
      <div class="campo"><label for="email">E-mail</label><input id="email" type="email" autocomplete="email"></div>
      <div class="campo"><label for="telefone">Celular com DDD</label><input id="telefone" type="text" inputmode="numeric" placeholder="92991234567" autocomplete="tel"><small>Só números, 10 ou 11 dígitos.</small></div>
      <div class="campo"><label for="senha">Senha</label><input id="senha" type="password" autocomplete="new-password"><small>Pelo menos 6 caracteres.</small></div>
      <button class="botao cheio" type="submit">Criar conta</button>
      <p style="margin-top:16px">Já tem conta? <a href="#/entrar">Entrar</a></p>
    </form>`;
  $('#form-cadastro').addEventListener('submit', async (e) => {
    e.preventDefault();
    const corpo = {
      nome: $('#nome').value.trim(),
      email: $('#email').value.trim(),
      telefone: $('#telefone').value.replace(/\D/g, ''),
      senha: $('#senha').value,
    };
    try {
      await api('/auth/registro', { metodo: 'POST', corpo });
      await entrar(corpo.email, corpo.senha);
      voltarDepois();
    } catch (err) { $('#erro').textContent = err.message; }
  });
  $('#nome').focus();
}

// ---------- Admin ----------

async function cabecalhoAdmin(ativa) {
  let alertas = [];
  try { alertas = await api('/alertas?resolvido=false'); } catch { /* segue sem o número */ }
  const aba = (rota, nome, extra = '') => `<a href="#/admin/${rota}"${ativa === rota ? ' aria-current="page"' : ''}>${nome}${extra}</a>`;
  return {
    alertas,
    html: `<nav class="abas-admin" aria-label="Painel da loja">
      ${aba('pedidos', 'Pedidos')}${aba('produtos', 'Cardápio')}${aba('estoque', 'Estoque', alertas.length ? `<span class="badge">${alertas.length}</span>` : '')}${aba('avaliacoes', 'Avaliações')}${aba('relatorio', 'Relatório')}
    </nav>`,
  };
}

function exigirAdmin() {
  if (ehAdmin()) return true;
  location.hash = '#/entrar';
  return false;
}

function htmlPedidoAdmin(p, acoes) {
  const atual = ETAPAS.indexOf(p.status);
  const etapas = p.status === 'CANCELADO'
    ? '<p class="cancelado">Pedido cancelado</p>'
    : `<ol class="etapas">${ETAPAS.map((s, i) => `<li class="${i < atual || p.status === 'CONCLUIDO' ? 'feita' : i === atual ? 'atual' : ''}">${NOME_STATUS[s]}</li>`).join('')}</ol>`;
  return `
    <article class="pedido">
      <div class="pedido-topo"><h3>Pedido ${p.id}</h3><span>${dataHora(p.criadoEm)}</span></div>
      ${etapas}
      <ul>${p.itens.map((i) => `<li>${i.quantidade}× ${esc(i.produtoNome)}${i.observacao ? ` <small>(${esc(i.observacao)})</small>` : ''}</li>`).join('')}</ul>
      <p><strong>${reais(p.valorTotal)}</strong> · ${NOME_FORMA[p.pagamento?.formaPagamento] ?? ''} · ${NOME_PAGAMENTO[p.pagamento?.statusPagamento] ?? ''}${p.avaliacao ? ` · <span class="estrelas-fixas" style="font-size:1rem">${estrelas(p.avaliacao.nota)}</span>` : ''}</p>
      ${p.pagamento?.statusPagamento === 'REEMBOLSO_SOLICITADO' ? `<p class="aviso-reembolso"><strong>O cliente pediu reembolso:</strong> “${esc(p.pagamento.motivoReembolso || '')}”</p>` : ''}
      ${acoes ? `<div class="acoes">${acoes}</div>` : ''}
    </article>`;
}

async function telaAdminPedidos() {
  if (!exigirAdmin()) return;
  const { html } = await cabecalhoAdmin('pedidos');
  const statusFiltro = new URLSearchParams(location.hash.split('?')[1] || '').get('status') || '';
  const pedidos = await api(`/pedidos${statusFiltro ? `?status=${statusFiltro}` : ''}`);
  const proximo = { RECEBIDO: 'PREPARANDO', PREPARANDO: 'SAIU_ENTREGA', SAIU_ENTREGA: 'CONCLUIDO' };
  const assinatura = JSON.stringify(pedidos.map((p) => [p.id, p.status, p.pagamento?.statusPagamento]));
  main().innerHTML = `${html}
    <div class="cabecalho"><h1>Pedidos</h1>
      <div class="inline"><span class="ao-vivo">Ao vivo</span><label for="filtro-status">Mostrar</label>
        <select id="filtro-status" style="width:auto">
          <option value="">Todos</option>
          ${Object.keys(NOME_STATUS).map((s) => `<option value="${s}" ${s === statusFiltro ? 'selected' : ''}>${NOME_STATUS[s]}</option>`).join('')}
        </select>
      </div>
    </div>
    <div id="lista-pedidos">
    ${pedidos.length ? pedidos.map((p) => htmlPedidoAdmin(p,
      (proximo[p.status] ? `<button class="botao pequeno" type="button" data-avancar="${p.id}" data-para="${proximo[p.status]}">Marcar como ${NOME_STATUS[proximo[p.status]].toLowerCase()}</button>` : '') +
      (['RECEBIDO', 'PREPARANDO'].includes(p.status) ? `<button class="botao perigo pequeno" type="button" data-cancelar="${p.id}">Cancelar</button>` : '') +
      (p.pagamento?.statusPagamento === 'REEMBOLSO_SOLICITADO'
        ? `<button class="botao pequeno" type="button" data-reembolso="${p.id}" data-aprovar="sim">Aprovar reembolso</button><button class="botao perigo pequeno" type="button" data-reembolso="${p.id}" data-aprovar="nao">Recusar reembolso</button>`
        : '') +
      `<button class="botao secundario pequeno" type="button" data-baixas="${p.id}">Ver baixas no estoque</button>`,
    )).join('') : '<div class="painel"><p class="vazio">Nenhum pedido por aqui ainda. Os novos aparecem sozinhos.</p></div>'}
    </div>`;

  $('#filtro-status').addEventListener('change', (e) => { location.hash = `#/admin/pedidos${e.target.value ? `?status=${e.target.value}` : ''}`; });
  $('#lista-pedidos').addEventListener('click', async (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    try {
      if (b.dataset.avancar) {
        await api(`/pedidos/${b.dataset.avancar}/status`, { metodo: 'PATCH', corpo: { status: b.dataset.para } });
        avisar(`Pedido ${b.dataset.avancar}: ${NOME_STATUS[b.dataset.para].toLowerCase()}.`);
        recarregar();
      } else if (b.dataset.reembolso) {
        const aprovar = b.dataset.aprovar === 'sim';
        if (!confirm(`${aprovar ? 'Aprovar' : 'Recusar'} o reembolso do pedido ${b.dataset.reembolso}?${aprovar ? ' O estoque não volta, porque o pedido já foi entregue.' : ''}`)) return;
        await api(`/pedidos/${b.dataset.reembolso}/reembolso`, { metodo: 'PATCH', corpo: { aprovar } });
        avisar(aprovar ? `Reembolso do pedido ${b.dataset.reembolso} aprovado.` : `Reembolso do pedido ${b.dataset.reembolso} recusado.`);
        recarregar();
      } else if (b.dataset.cancelar) {
        if (!confirm(`Cancelar o pedido ${b.dataset.cancelar}? Os ingredientes voltam ao estoque.`)) return;
        await api(`/pedidos/${b.dataset.cancelar}/cancelamento`, { metodo: 'POST' });
        avisar('Pedido cancelado e estoque devolvido.');
        recarregar();
      } else if (b.dataset.baixas) {
        const movs = await api(`/movimentacoes?pedidoId=${b.dataset.baixas}`);
        abrirDialogo(`<h2>Baixas do pedido ${b.dataset.baixas}</h2>
          <table><thead><tr><th>Ingrediente</th><th>Movimento</th><th class="num">Quantidade</th></tr></thead><tbody>
          ${movs.map((m) => `<tr><td>${esc(m.nomeItem)}</td><td>${m.tipo === 'SAIDA' ? 'Saiu' : 'Voltou (cancelamento)'}</td><td class="num">${numero(m.quantidade)}</td></tr>`).join('') || '<tr><td colspan="3">Este pedido não usou ingredientes com receita.</td></tr>'}
          </tbody></table>`);
      }
    } catch (err) { avisar(err.message, true); }
  });

  // Fila ao vivo: verifica a cada 8 s e só redesenha se chegou pedido novo ou algum status mudou
  timerTela = setInterval(async () => {
    try {
      const agora = await api(`/pedidos${statusFiltro ? `?status=${statusFiltro}` : ''}`);
      if (JSON.stringify(agora.map((p) => [p.id, p.status, p.pagamento?.statusPagamento])) !== assinatura) {
        if (agora.length > pedidos.length) avisar('Chegou pedido novo!');
        recarregar();
      }
    } catch { /* tenta de novo no próximo ciclo */ }
  }, 8000);
}

function recarregar() {
  clearInterval(timerTela);
  navegar();
}

async function telaAdminProdutos() {
  if (!exigirAdmin()) return;
  const { html } = await cabecalhoAdmin('produtos');
  const [produtos, categorias, insumos] = await Promise.all([api('/produtos'), api('/categorias'), api('/insumos')]);
  const opcoesCategoria = (sel) => categorias.map((c) => `<option value="${c.id}" ${c.id === sel ? 'selected' : ''}>${esc(c.nome)}${c.ativo ? '' : ' (desativada)'}</option>`).join('');
  main().innerHTML = `${html}
    <div class="cabecalho"><h1>Cardápio</h1>
      <div class="inline"><button class="botao secundario pequeno" type="button" id="nova-categoria">Nova categoria</button><button class="botao pequeno" type="button" id="novo-produto">Novo produto</button></div></div>
    <div class="painel tabela-rolagem">
      <table><thead><tr><th></th><th>Produto</th><th>Categoria</th><th class="num">Preço</th><th>Situação</th><th></th></tr></thead><tbody>
      ${produtos.map((p) => `<tr>
        <td><img class="miniatura" src="${foto(p.imagemUrl)}" alt="" onerror="this.src='${FOTO_PADRAO}'"></td>
        <td><strong>${esc(p.nome)}</strong></td><td>${esc(p.categoriaNome)}</td><td class="num">${reais(p.preco)}</td>
        <td>${!p.disponivel ? '<span class="selo">Fora do cardápio</span>' : !p.categoriaAtiva ? '<span class="selo">Categoria desativada</span>' : p.temEstoque ? '<span class="selo ok">À venda</span>' : '<span class="selo ruim">Sem ingrediente</span>'}</td>
        <td><div class="inline">
          <button class="botao secundario pequeno" type="button" data-editar="${p.id}">Editar</button>
          <button class="botao secundario pequeno" type="button" data-receita="${p.id}">Receita</button>
          <button class="botao secundario pequeno" type="button" data-custo="${p.id}">Custo e lucro</button>
          <button class="botao perigo pequeno" type="button" data-excluir="${p.id}">Excluir</button>
        </div></td></tr>`).join('')}
      </tbody></table>
    </div>`;

  const formProduto = (p = {}) => {
    const d = abrirDialogo(`
      <form id="form-produto-admin" novalidate>
        <h2>${p.id ? 'Editar produto' : 'Novo produto'}</h2>
        <div class="erro-form" id="erro-dialogo"></div>
        <div class="campo"><label for="p-nome">Nome</label><input id="p-nome" type="text" value="${esc(p.nome || '')}"></div>
        <div class="campo"><label for="p-desc">Descrição</label><input id="p-desc" type="text" value="${esc(p.descricao || '')}"></div>
        <div class="linha-campos">
          <div class="campo"><label for="p-cat">Categoria</label><select id="p-cat">${opcoesCategoria(p.categoriaId)}</select></div>
          <div class="campo"><label for="p-preco">Preço de venda (R$)</label><input id="p-preco" type="number" min="0.01" step="0.01" value="${p.preco ?? ''}"></div>
        </div>
        <div class="campo"><label for="p-foto">Foto (link da imagem)</label>
          <div class="inline" style="flex-wrap:nowrap"><img class="previa-foto" id="previa" src="${foto(p.imagemUrl)}" alt="Prévia da foto" onerror="this.src='${FOTO_PADRAO}'"><input id="p-foto" type="text" placeholder="https://... ou /img/x-cheddar.svg" value="${esc(p.imagemUrl || '')}" style="width:100%"></div>
          <small>Cole o endereço de uma imagem da internet. Sem foto, aparece uma ilustração padrão.</small></div>
        <div class="campo"><label><input id="p-disp" type="checkbox" ${p.disponivel === false ? '' : 'checked'}> Mostrar no cardápio</label></div>
        <button class="botao" type="submit">${p.id ? 'Salvar alterações' : 'Cadastrar produto'}</button>
      </form>`);
    $('#p-foto', d).addEventListener('input', (e) => { $('#previa', d).src = e.target.value.trim() || FOTO_PADRAO; });
    $('#form-produto-admin', d).addEventListener('submit', async (e) => {
      e.preventDefault();
      const imagem = $('#p-foto', d).value.trim();
      const corpo = {
        nome: $('#p-nome', d).value.trim(),
        descricao: $('#p-desc', d).value.trim() || undefined,
        categoriaId: Number($('#p-cat', d).value),
        preco: Number($('#p-preco', d).value),
        disponivel: $('#p-disp', d).checked,
        imagemUrl: imagem || (p.id ? null : undefined),
      };
      try {
        await api(p.id ? `/produtos/${p.id}` : '/produtos', { metodo: p.id ? 'PATCH' : 'POST', corpo });
        d.close();
        avisar(p.id ? 'Produto salvo.' : 'Produto cadastrado. Monte a receita para o estoque baixar sozinho.');
        telaAdminProdutos();
      } catch (err) { $('#erro-dialogo', d).textContent = err.message; }
    });
  };

  $('#novo-produto').addEventListener('click', () => formProduto());
  $('#nova-categoria').addEventListener('click', () => {
    const d = abrirDialogo(`<form id="form-cat" novalidate><h2>Nova categoria</h2><div class="erro-form" id="erro-dialogo"></div>
      <div class="campo"><label for="c-nome">Nome</label><input id="c-nome" type="text" placeholder="Sobremesas"></div>
      <div class="campo"><label for="c-ordem">Posição no cardápio</label><input id="c-ordem" type="number" min="0" value="${categorias.length + 1}"></div>
      <button class="botao" type="submit">Criar categoria</button></form>`);
    $('#form-cat', d).addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        await api('/categorias', { metodo: 'POST', corpo: { nome: $('#c-nome', d).value.trim(), ordemExibicao: Number($('#c-ordem', d).value) } });
        d.close();
        avisar('Categoria criada.');
        telaAdminProdutos();
      } catch (err) { $('#erro-dialogo', d).textContent = err.message; }
    });
  });

  main().querySelector('table').addEventListener('click', async (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    const id = Number(b.dataset.editar || b.dataset.receita || b.dataset.custo || b.dataset.excluir);
    const produto = produtos.find((p) => p.id === id);
    try {
      if (b.dataset.editar) formProduto(produto);
      if (b.dataset.excluir) {
        if (!confirm(`Excluir ${produto.nome}?`)) return;
        await api(`/produtos/${id}`, { metodo: 'DELETE' });
        avisar('Produto excluído.');
        telaAdminProdutos();
      }
      if (b.dataset.custo) {
        const c = await api(`/produtos/${id}/custo`);
        abrirDialogo(`<h2>${esc(c.nome)}</h2>
          <div class="custo-grade"><div>Preço<strong>${reais(c.preco)}</strong></div><div>Custo<strong>${reais(c.custo)}</strong></div><div>Lucro<strong>${reais(c.lucro)}</strong></div></div>
          <p>Margem de ${numero(c.margemPercentual)}%.</p>
          ${c.itens.length ? `<table><thead><tr><th>Ingrediente</th><th class="num">Qtd.</th><th class="num">Custo</th></tr></thead><tbody>${c.itens.map((i) => `<tr><td>${esc(i.nomeItem)}</td><td class="num">${numero(i.quantidadeNecessaria)}</td><td class="num">${reais(i.custo)}</td></tr>`).join('')}</tbody></table>` : '<p class="vazio">Sem receita: cadastre os ingredientes para calcular o custo.</p>'}`);
      }
      if (b.dataset.receita) {
        const ficha = await api(`/produtos/${id}/ficha-tecnica`);
        const opcoesInsumo = (sel) => insumos.map((i) => `<option value="${i.id}" ${i.id === sel ? 'selected' : ''}>${esc(i.nomeItem)} (${i.unidadeMedida})</option>`).join('');
        const linha = (f = {}) => `<div class="receita-linha"><select aria-label="Ingrediente">${opcoesInsumo(f.insumoId)}</select><input type="number" min="0.01" step="0.01" aria-label="Quantidade por porção" value="${f.quantidadeNecessaria ?? 1}"><button type="button" class="botao perigo pequeno" data-tirar>Tirar</button></div>`;
        const d = abrirDialogo(`<form id="form-receita"><h2>Receita de ${esc(produto.nome)}</h2>
          <p>Quanto de cada ingrediente sai do estoque a cada unidade vendida.</p>
          <div class="erro-form" id="erro-dialogo"></div>
          <div id="linhas">${ficha.map(linha).join('')}</div>
          <p><button type="button" class="botao secundario pequeno" id="mais-linha">Pôr ingrediente</button></p>
          <button class="botao" type="submit">Salvar receita</button></form>`);
        $('#mais-linha', d).addEventListener('click', () => $('#linhas', d).insertAdjacentHTML('beforeend', linha()));
        $('#linhas', d).addEventListener('click', (ev) => { if (ev.target.matches('[data-tirar]')) ev.target.parentElement.remove(); });
        $('#form-receita', d).addEventListener('submit', async (ev) => {
          ev.preventDefault();
          const itens = [...d.querySelectorAll('.receita-linha')].map((l) => ({ insumoId: Number(l.querySelector('select').value), quantidadeNecessaria: Number(l.querySelector('input').value) }));
          try {
            await api(`/produtos/${id}/ficha-tecnica`, { metodo: 'PUT', corpo: { itens } });
            d.close();
            avisar('Receita salva.');
            telaAdminProdutos();
          } catch (err) { $('#erro-dialogo', d).textContent = err.message; }
        });
      }
    } catch (err) { avisar(err.message, true); }
  });
}

async function telaAdminEstoque() {
  if (!exigirAdmin()) return;
  const { html, alertas } = await cabecalhoAdmin('estoque');
  const insumos = await api('/insumos');
  main().innerHTML = `${html}
    <div class="cabecalho"><h1>Estoque</h1><button class="botao pequeno" type="button" id="novo-insumo">Novo ingrediente</button></div>
    ${alertas.length ? `<div class="alertas" role="alert"><strong>Repor em breve</strong><ul>${alertas.map((a) => `<li>${esc(a.mensagem)}</li>`).join('')}</ul></div>` : ''}
    <div class="painel tabela-rolagem">
      <table><thead><tr><th>Ingrediente</th><th class="num">Em estoque</th><th class="num">Mínimo</th><th class="num">Custo</th><th>Repor</th><th></th></tr></thead><tbody>
      ${insumos.map((i) => `<tr class="${i.precisaRepor ? 'precisa' : ''}">
        <td><strong>${esc(i.nomeItem)}</strong> ${i.precisaRepor ? '<span class="selo atencao">Acabando</span>' : ''}</td>
        <td class="num">${numero(i.quantidadeDisponivel)} ${i.unidadeMedida}</td>
        <td class="num">${numero(i.estoqueMinimo)}</td>
        <td class="num">${reais(i.precoCusto)}/${i.unidadeMedida}</td>
        <td><form class="inline" data-repor="${i.id}"><input type="number" min="0.01" step="0.01" aria-label="Quantidade para repor ${esc(i.nomeItem)}" placeholder="Qtd."><button class="botao pequeno" type="submit">Repor</button></form></td>
        <td><div class="inline"><button class="botao secundario pequeno" type="button" data-editar="${i.id}">Editar</button><button class="botao secundario pequeno" type="button" data-extrato="${i.id}">Extrato</button></div></td>
      </tr>`).join('')}
      </tbody></table>
    </div>`;

  const formInsumo = (i = null) => {
    const d = abrirDialogo(`
      <form id="form-insumo" novalidate><h2>${i ? `Editar ${esc(i.nomeItem)}` : 'Novo ingrediente'}</h2>
        <div class="erro-form" id="erro-dialogo"></div>
        <div class="campo"><label for="i-nome">Nome</label><input id="i-nome" type="text" value="${esc(i?.nomeItem || '')}"></div>
        <div class="linha-campos">
          <div class="campo"><label for="i-un">Unidade</label><select id="i-un">${['UN', 'KG', 'G', 'L', 'ML'].map((u) => `<option ${i?.unidadeMedida === u ? 'selected' : ''}>${u}</option>`).join('')}</select></div>
          ${i ? '' : '<div class="campo"><label for="i-qtd">Quantidade inicial</label><input id="i-qtd" type="number" min="0" step="0.01" value="0"></div>'}
          <div class="campo"><label for="i-custo">Custo por unidade (R$)</label><input id="i-custo" type="number" min="0.01" step="0.01" value="${i?.precoCusto ?? ''}"></div>
          <div class="campo"><label for="i-min">Avisar quando chegar a</label><input id="i-min" type="number" min="0" step="0.01" value="${i?.estoqueMinimo ?? 0}"></div>
        </div>
        <button class="botao" type="submit">${i ? 'Salvar alterações' : 'Cadastrar ingrediente'}</button>
      </form>`);
    $('#form-insumo', d).addEventListener('submit', async (e) => {
      e.preventDefault();
      const corpo = { nomeItem: $('#i-nome', d).value.trim(), unidadeMedida: $('#i-un', d).value, precoCusto: Number($('#i-custo', d).value), estoqueMinimo: Number($('#i-min', d).value) };
      if (!i) corpo.quantidadeDisponivel = Number($('#i-qtd', d).value);
      try {
        await api(i ? `/insumos/${i.id}` : '/insumos', { metodo: i ? 'PATCH' : 'POST', corpo });
        d.close();
        avisar(i ? 'Ingrediente salvo.' : 'Ingrediente cadastrado.');
        telaAdminEstoque();
      } catch (err) { $('#erro-dialogo', d).textContent = err.message; }
    });
  };

  $('#novo-insumo').addEventListener('click', () => formInsumo());
  const tabela = main().querySelector('table');
  tabela.addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target.closest('[data-repor]');
    const qtd = Number(form.querySelector('input').value);
    if (!qtd) { avisar('Informe quanto entrou no estoque.', true); return; }
    try {
      const r = await api(`/insumos/${form.dataset.repor}/reposicao`, { metodo: 'POST', corpo: { quantidade: qtd } });
      avisar(`${r.nomeItem}: agora há ${numero(r.quantidadeDisponivel)} ${r.unidadeMedida}.`);
      telaAdminEstoque();
    } catch (err) { avisar(err.message, true); }
  });
  tabela.addEventListener('click', async (e) => {
    const b = e.target.closest('button[type="button"]');
    if (!b) return;
    const insumo = insumos.find((i) => i.id === Number(b.dataset.editar || b.dataset.extrato));
    if (b.dataset.editar) formInsumo(insumo);
    if (b.dataset.extrato) {
      const movs = await api(`/movimentacoes?insumoId=${insumo.id}`);
      const motivo = { PEDIDO: 'Pedido', CANCELAMENTO: 'Cancelamento', REPOSICAO: 'Reposição', CADASTRO: 'Saldo inicial' };
      abrirDialogo(`<h2>Extrato: ${esc(insumo.nomeItem)}</h2>
        <div class="tabela-rolagem"><table><thead><tr><th>Quando</th><th>Motivo</th><th class="num">Entrada/saída</th></tr></thead><tbody>
        ${movs.map((m) => `<tr><td>${dataHora(m.criadoEm)}</td><td>${motivo[m.motivo]}${m.pedidoId ? ` (pedido ${m.pedidoId})` : ''}</td><td class="num">${m.tipo === 'SAIDA' ? '−' : '+'}${numero(m.quantidade)} ${insumo.unidadeMedida}</td></tr>`).join('') || '<tr><td colspan="3">Sem movimentações.</td></tr>'}
        </tbody></table></div>`);
    }
  });
}

async function telaAdminAvaliacoes() {
  if (!exigirAdmin()) return;
  const { html } = await cabecalhoAdmin('avaliacoes');
  const [loja, avaliacoes] = await Promise.all([api('/loja'), api('/avaliacoes')]);
  main().innerHTML = `${html}
    <div class="cabecalho"><h1>Avaliações</h1></div>
    <div class="custo-grade" style="max-width:420px"><div>Nota média<strong>${loja.notaMedia === null ? '—' : `★ ${numero(loja.notaMedia)}`}</strong></div><div>Avaliações<strong>${loja.totalAvaliacoes}</strong></div></div>
    ${avaliacoes.length
      ? avaliacoes.map((a) => `<article class="pedido"><div class="pedido-topo"><h3>${esc(a.clienteNome)}</h3><span>Pedido ${a.pedidoId} · ${dataHora(a.criadoEm)}</span></div>
          <p class="estrelas-fixas" aria-label="${a.nota} de 5 estrelas">${estrelas(a.nota)}</p>${a.comentario ? `<p>“${esc(a.comentario)}”</p>` : ''}</article>`).join('')
      : '<div class="painel"><p class="vazio">Ainda não há avaliações. Elas aparecem quando o cliente avalia um pedido entregue.</p></div>'}`;
}

async function telaAdminRelatorio() {
  if (!exigirAdmin()) return;
  const { html } = await cabecalhoAdmin('relatorio');
  const params = new URLSearchParams(location.hash.split('?')[1] || '');
  const de = params.get('de') || '';
  const ate = params.get('ate') || '';
  const q = new URLSearchParams();
  if (de) q.set('de', de);
  if (ate) q.set('ate', ate);
  const linhas = await api(`/relatorios/saida-produtos?${q}`);
  const total = linhas.reduce((s, l) => s + l.faturamento, 0);
  const unidades = linhas.reduce((s, l) => s + l.quantidadeVendida, 0);
  main().innerHTML = `${html}
    <div class="cabecalho"><h1>Saída de produtos</h1>
      <form class="inline" id="periodo"><label for="de">De</label><input id="de" type="date" value="${de}" style="width:auto"><label for="ate">até</label><input id="ate" type="date" value="${ate}" style="width:auto"><button class="botao secundario pequeno" type="submit">Filtrar</button></form>
    </div>
    <div class="custo-grade" style="max-width:520px"><div>Unidades vendidas<strong>${unidades}</strong></div><div>Faturamento<strong>${reais(total)}</strong></div><div>Produtos diferentes<strong>${linhas.length}</strong></div></div>
    <div class="painel tabela-rolagem">
      <table><thead><tr><th>Produto</th><th class="num">Vendidos</th><th class="num">Faturamento</th></tr></thead><tbody>
      ${linhas.map((l) => `<tr><td>${esc(l.nome)}</td><td class="num">${l.quantidadeVendida}</td><td class="num">${reais(l.faturamento)}</td></tr>`).join('') || '<tr><td colspan="3">Nenhuma venda no período. Pedidos cancelados não entram.</td></tr>'}
      </tbody></table>
    </div>`;
  $('#periodo').addEventListener('submit', (e) => {
    e.preventDefault();
    const p = new URLSearchParams();
    if ($('#de').value) p.set('de', $('#de').value);
    if ($('#ate').value) p.set('ate', $('#ate').value);
    location.hash = `#/admin/relatorio${p.toString() ? `?${p}` : ''}`;
  });
}

// ---------- Rotas ----------

const ROTAS = {
  '#/': telaCardapio,
  '#/finalizar': telaFinalizar,
  '#/pedidos': telaMeusPedidos,
  '#/entrar': telaEntrar,
  '#/cadastro': telaCadastro,
  '#/admin/pedidos': telaAdminPedidos,
  '#/admin/produtos': telaAdminProdutos,
  '#/admin/estoque': telaAdminEstoque,
  '#/admin/avaliacoes': telaAdminAvaliacoes,
  '#/admin/relatorio': telaAdminRelatorio,
};

async function navegar() {
  clearInterval(timerTela);
  const d = $('#dialogo');
  if (d.open) d.close();
  const caminho = (location.hash || '#/').split('?')[0];
  const pedido = caminho.match(/^#\/pedido\/(\d+)$/);
  desenharMenu();
  try {
    if (pedido) await telaPedido(Number(pedido[1]));
    else await (ROTAS[caminho] || telaCardapio)();
  } catch (err) {
    main().innerHTML = `<div class="painel estreito"><h1>Não foi possível carregar</h1><p>${esc(err.message)}</p>
      <p>Confira se o sistema está ligado (janela do Iniciar BurguerSabor aberta) e tente de novo.</p><button class="botao" type="button" onclick="location.reload()">Tentar de novo</button></div>`;
  }
  desenharMenu();
  main().focus({ preventScroll: true });
  window.scrollTo(0, 0);
}

window.addEventListener('hashchange', navegar);
navegar();
