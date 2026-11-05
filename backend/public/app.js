/* Burguer & Sabor — site do cliente e painel do admin (JavaScript puro, sem build). */
'use strict';

// ---------- Estado e utilidades ----------

const TAXA_ENTREGA = 5;
const FORMAS = [
  { valor: 'PIX', nome: 'Pix', dica: 'Aprovado na hora' },
  { valor: 'CARTAO_CREDITO', nome: 'Cartão de crédito', dica: 'Aprovado na hora' },
  { valor: 'CARTAO_DEBITO', nome: 'Cartão de débito', dica: 'Aprovado na hora' },
  { valor: 'DINHEIRO', nome: 'Dinheiro', dica: 'Pago na entrega' },
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
const NOME_PAGAMENTO = { APROVADO: 'Pago', PENDENTE: 'A pagar na entrega', RECUSADO: 'Estornado' };

const guardar = (chave, valor) => {
  try { localStorage.setItem(chave, JSON.stringify(valor)); } catch { /* navegador sem armazenamento */ }
};
const ler = (chave, padrao) => {
  try { const v = localStorage.getItem(chave); return v ? JSON.parse(v) : padrao; } catch { return padrao; }
};

const estado = {
  sessao: ler('bs-sessao', null), // { token, usuario }
  carrinho: ler('bs-carrinho', []), // [{ produtoId, nome, preco, quantidade }]
};

const reais = (v) => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const numero = (v) => Number(v).toLocaleString('pt-BR', { maximumFractionDigits: 2 });
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const dataHora = (d) => new Date(d).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
const $ = (sel, raiz = document) => raiz.querySelector(sel);
const main = () => $('#conteudo');
const ehAdmin = () => estado.sessao?.usuario?.tipoUsuario === 'ADMIN';
const ehCliente = () => estado.sessao?.usuario?.tipoUsuario === 'CLIENTE';

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

function salvarCarrinho() {
  guardar('bs-carrinho', estado.carrinho);
  desenharMenu();
}

function sair(irParaInicio = true) {
  estado.sessao = null;
  guardar('bs-sessao', null);
  desenharMenu();
  if (irParaInicio) location.hash = '#/';
}

// ---------- Menu ----------

function desenharMenu() {
  const rota = location.hash || '#/';
  const atual = (h) => (rota === h || (h !== '#/' && rota.startsWith(h)) ? ' aria-current="page"' : '');
  const qtd = estado.carrinho.reduce((s, i) => s + i.quantidade, 0);
  let html = '';
  if (ehAdmin()) {
    html += `<a href="#/admin/pedidos"${atual('#/admin')}>Painel</a><a href="#/"${atual('#/')}>Ver cardápio</a>`;
  } else {
    html += `<a href="#/"${atual('#/')}>Cardápio</a>`;
    if (ehCliente()) html += `<a href="#/pedidos"${atual('#/pedidos')}>Meus pedidos</a>`;
    html += `<a href="#/finalizar"${atual('#/finalizar')}>Comanda${qtd ? `<span class="contador">${qtd}</span>` : ''}</a>`;
  }
  if (estado.sessao) {
    html += `<span class="quem">${esc(estado.sessao.usuario.nome.split(' ')[0])}</span><button type="button" id="botao-sair">Sair</button>`;
  } else {
    html += `<a href="#/entrar"${atual('#/entrar')}>Entrar</a>`;
  }
  $('#menu').innerHTML = html;
  $('#botao-sair')?.addEventListener('click', () => { sair(); avisar('Você saiu da sua conta.'); });
}

// ---------- Cliente: cardápio e comanda ----------

const filtro = { categoriaId: null, busca: '' };

async function telaCardapio() {
  main().innerHTML = `
    <section class="faixa">
      <h1>Peça seu lanche sem sair de casa</h1>
      <p>Escolha no cardápio, monte sua comanda e acompanhe o pedido até chegar.</p>
    </section>
    <div class="filtros">
      <div class="abas" id="abas" role="group" aria-label="Categorias"></div>
      <div class="busca"><label class="visualmente-oculto" for="busca">Buscar no cardápio</label>
        <input type="search" id="busca" placeholder="Buscar: cheddar, pizza, refri…" value="${esc(filtro.busca)}"></div>
    </div>
    <div class="cardapio-layout">
      <div class="grade" id="grade" aria-live="polite"><p class="vazio">Carregando o cardápio…</p></div>
      <aside class="comanda" id="comanda" aria-label="Sua comanda"></aside>
    </div>`;

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
    carregarProdutos();
  });

  let espera;
  $('#busca').addEventListener('input', (e) => {
    clearTimeout(espera);
    espera = setTimeout(() => { filtro.busca = e.target.value; carregarProdutos(); }, 250);
  });

  desenharComanda();
  await carregarProdutos();
}

async function carregarProdutos() {
  const grade = $('#grade');
  if (!grade) return;
  const q = new URLSearchParams();
  if (filtro.categoriaId) q.set('categoriaId', filtro.categoriaId);
  if (filtro.busca.trim()) q.set('busca', filtro.busca.trim());
  const produtos = await api(`/produtos?${q}`);
  if (!produtos.length) {
    grade.innerHTML = `<p class="vazio">Nada encontrado${filtro.busca ? ` para “${esc(filtro.busca)}”` : ''}. Tente outro termo ou outra categoria.</p>`;
    return;
  }
  grade.innerHTML = produtos
    .map((p) => `
      <article class="lanche${p.disponivelParaVenda ? '' : ' esgotado'}">
        <span class="categoria">${esc(p.categoriaNome)}</span>
        <h3>${esc(p.nome)}</h3>
        <p>${esc(p.descricao || '')}</p>
        <div class="rodape-lanche">
          <span class="preco">${reais(p.preco)}</span>
          ${p.disponivelParaVenda
            ? `<button class="botao pequeno" type="button" data-adicionar='${esc(JSON.stringify({ produtoId: p.id, nome: p.nome, preco: p.preco }))}'>Adicionar</button>`
            : '<span class="selo">Esgotado</span>'}
        </div>
      </article>`)
    .join('');
  grade.querySelectorAll('[data-adicionar]').forEach((b) =>
    b.addEventListener('click', () => {
      const item = JSON.parse(b.dataset.adicionar);
      const existente = estado.carrinho.find((i) => i.produtoId === item.produtoId);
      if (existente) existente.quantidade = Math.min(50, existente.quantidade + 1);
      else estado.carrinho.push({ ...item, quantidade: 1 });
      salvarCarrinho();
      desenharComanda();
      avisar(`${item.nome} adicionado à comanda.`);
    }),
  );
}

function totaisCarrinho() {
  const subtotal = estado.carrinho.reduce((s, i) => s + Math.round(i.preco * 100) * i.quantidade, 0) / 100;
  return { subtotal, total: subtotal + (subtotal ? TAXA_ENTREGA : 0) };
}

function htmlComanda(editavel = true) {
  if (!estado.carrinho.length) {
    return `<h2>Sua comanda</h2><p class="vazio">Sua comanda está vazia. Escolha um lanche no cardápio.</p>`;
  }
  const { subtotal, total } = totaisCarrinho();
  const itens = estado.carrinho
    .map((i) => `
      <li>
        <strong>${esc(i.nome)}</strong><span>${reais(i.preco * i.quantidade)}</span>
        ${editavel
          ? `<div class="qtd"><button type="button" data-menos="${i.produtoId}" aria-label="Tirar um ${esc(i.nome)}">−</button><span aria-label="Quantidade">${i.quantidade}</span><button type="button" data-mais="${i.produtoId}" aria-label="Pôr mais um ${esc(i.nome)}">+</button></div>
             <button type="button" class="remover" data-remover="${i.produtoId}">Remover</button>`
          : `<small>${i.quantidade} × ${reais(i.preco)}</small>`}
      </li>`)
    .join('');
  return `
    <h2>Sua comanda <small>${estado.carrinho.reduce((s, i) => s + i.quantidade, 0)} itens</small></h2>
    <ul>${itens}</ul>
    <div class="totais">
      <div><span>Itens</span><span>${reais(subtotal)}</span></div>
      <div><span>Entrega</span><span>${reais(TAXA_ENTREGA)}</span></div>
      <div class="total"><span>Total</span><span>${reais(total)}</span></div>
    </div>`;
}

function desenharComanda() {
  const el = $('#comanda');
  if (!el) return;
  el.innerHTML = htmlComanda(true) + (estado.carrinho.length ? '<a class="botao cheio" href="#/finalizar">Finalizar pedido</a>' : '');
  el.onclick = (e) => {
    const alvo = e.target.closest('button');
    if (!alvo) return;
    const id = Number(alvo.dataset.mais || alvo.dataset.menos || alvo.dataset.remover);
    const item = estado.carrinho.find((i) => i.produtoId === id);
    if (!item) return;
    if (alvo.dataset.mais) item.quantidade = Math.min(50, item.quantidade + 1);
    if (alvo.dataset.menos) item.quantidade -= 1;
    if (alvo.dataset.remover || item.quantidade < 1) estado.carrinho = estado.carrinho.filter((i) => i.produtoId !== id);
    salvarCarrinho();
    desenharComanda();
  };
}

// ---------- Cliente: finalizar pedido ----------

async function telaFinalizar() {
  if (!estado.carrinho.length) {
    main().innerHTML = `<div class="painel estreito"><h1>Sua comanda está vazia</h1><p>Escolha seus lanches no cardápio para fazer um pedido.</p><a class="botao" href="#/">Ver cardápio</a></div>`;
    return;
  }
  if (!ehCliente()) {
    main().innerHTML = `<div class="dupla"><div class="painel"><h1>Quase lá</h1><p>Entre na sua conta ou crie uma para escolher o endereço e a forma de pagamento.</p>
      <p><a class="botao" href="#/entrar?voltar=finalizar">Entrar</a> <a class="botao secundario" href="#/cadastro?voltar=finalizar">Criar conta</a></p>
      ${ehAdmin() ? '<p class="erro-form">Você está como administrador. Pedidos são feitos com uma conta de cliente.</p>' : ''}</div>
      <aside class="comanda" id="comanda"></aside></div>`;
    desenharComanda();
    return;
  }

  const enderecos = await api('/enderecos');
  main().innerHTML = `
    <div class="dupla">
      <form class="painel" id="form-pedido" novalidate>
        <h1>Finalizar pedido</h1>
        <div class="erro-form" id="erro"></div>
        <h2>Onde entregar</h2>
        <div id="lista-enderecos"></div>
        <details id="novo-endereco" ${enderecos.length ? '' : 'open'}>
          <summary>Cadastrar outro endereço</summary>
          <div class="linha-campos" style="margin-top:12px">
            <div class="campo"><label for="rua">Rua</label><input id="rua" type="text" autocomplete="address-line1"></div>
            <div class="campo"><label for="numero">Número</label><input id="numero" type="text"></div>
            <div class="campo"><label for="bairro">Bairro</label><input id="bairro" type="text"></div>
            <div class="campo"><label for="cep">CEP</label><input id="cep" type="text" placeholder="69000-000" inputmode="numeric"></div>
          </div>
          <div class="campo"><label for="ref">Ponto de referência (opcional)</label><input id="ref" type="text"></div>
          <button class="botao secundario pequeno" type="button" id="salvar-endereco">Salvar endereço</button>
        </details>
        <h2 style="margin-top:24px">Como você vai pagar</h2>
        <div class="opcoes-pagamento">
          ${FORMAS.map((f, i) => `<div class="opcao"><input type="radio" name="forma" id="f-${f.valor}" value="${f.valor}" ${i === 0 ? 'checked' : ''}><label for="f-${f.valor}"><strong>${f.nome}</strong><span>${f.dica}</span></label></div>`).join('')}
        </div>
        <p><small>Pagamento simulado: nenhum valor é cobrado de verdade.</small></p>
        <button class="botao cheio" type="submit">Confirmar pedido de ${reais(totaisCarrinho().total)}</button>
      </form>
      <aside class="comanda">${htmlComanda(false)}<a class="botao secundario cheio" href="#/">Alterar itens</a></aside>
    </div>`;

  const desenharEnderecos = (lista, selecionado) => {
    $('#lista-enderecos').innerHTML = lista.length
      ? `<div class="opcoes-pagamento">${lista
          .map((e, i) => `<div class="opcao"><input type="radio" name="endereco" id="e-${e.id}" value="${e.id}" ${(selecionado ? e.id === selecionado : i === 0) ? 'checked' : ''}><label for="e-${e.id}"><strong>${esc(e.rua)}, ${esc(e.numero)}</strong><span>${esc(e.bairro)} — ${esc(e.cep)}</span></label></div>`)
          .join('')}</div>`
      : '<p class="vazio">Você ainda não tem endereço. Cadastre um abaixo.</p>';
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
    if (!endereco) { $('#erro').textContent = 'Escolha ou cadastre um endereço de entrega.'; return; }
    const botao = e.submitter;
    botao.disabled = true;
    try {
      const pedido = await api('/pedidos', {
        metodo: 'POST',
        corpo: {
          enderecoId: Number(endereco.value),
          formaPagamento: $('input[name="forma"]:checked').value,
          itens: estado.carrinho.map((i) => ({ produtoId: i.produtoId, quantidade: i.quantidade })),
        },
      });
      estado.carrinho = [];
      salvarCarrinho();
      avisar(`Pedido ${pedido.id} confirmado.`);
      location.hash = '#/pedidos';
    } catch (err) {
      const faltas = Array.isArray(err.details) && err.details[0]?.nomeItem
        ? ` Em falta: ${err.details.map((d) => d.nomeItem).join(', ')}.` : '';
      $('#erro').textContent = err.message + faltas;
      botao.disabled = false;
    }
  });
}

// ---------- Cliente: meus pedidos ----------

function htmlEtapas(status) {
  if (status === 'CANCELADO') return '<p class="cancelado">Pedido cancelado</p>';
  const atual = ETAPAS.indexOf(status);
  return `<ol class="etapas">${ETAPAS.map((s, i) => `<li class="${i < atual ? 'feita' : i === atual ? (status === 'CONCLUIDO' ? 'feita' : 'atual') : ''}">${NOME_STATUS[s]}</li>`).join('')}</ol>`;
}

function htmlPedido(p, acoes = '') {
  return `
    <article class="pedido">
      <div class="pedido-topo"><h3>Pedido ${p.id}</h3><span>${dataHora(p.criadoEm)}</span></div>
      ${htmlEtapas(p.status)}
      <ul>${p.itens.map((i) => `<li>${i.quantidade} × ${esc(i.produtoNome)} — ${reais(i.subtotal)}${i.observacao ? ` <small>(${esc(i.observacao)})</small>` : ''}</li>`).join('')}</ul>
      <p><strong>${reais(p.valorTotal)}</strong> com entrega · ${NOME_FORMA[p.pagamento?.formaPagamento] ?? ''} · ${NOME_PAGAMENTO[p.pagamento?.statusPagamento] ?? ''}</p>
      ${acoes ? `<div class="acoes">${acoes}</div>` : ''}
    </article>`;
}

async function telaMeusPedidos() {
  if (!ehCliente()) { location.hash = '#/entrar'; return; }
  const pedidos = await api('/pedidos');
  main().innerHTML = `
    <div class="cabecalho"><h1>Meus pedidos</h1><button class="botao secundario pequeno" type="button" id="atualizar">Atualizar</button></div>
    ${pedidos.length
      ? pedidos.map((p) => htmlPedido(p, p.status === 'RECEBIDO' ? `<button class="botao perigo pequeno" type="button" data-cancelar="${p.id}">Cancelar pedido</button>` : '')).join('')
      : '<div class="painel"><p class="vazio">Você ainda não fez pedidos.</p><a class="botao" href="#/">Ver cardápio</a></div>'}`;
  $('#atualizar').addEventListener('click', telaMeusPedidos);
  main().querySelectorAll('[data-cancelar]').forEach((b) =>
    b.addEventListener('click', async () => {
      if (!confirm(`Cancelar o pedido ${b.dataset.cancelar}?`)) return;
      try {
        await api(`/pedidos/${b.dataset.cancelar}/cancelamento`, { metodo: 'POST' });
        avisar('Pedido cancelado.');
        telaMeusPedidos();
      } catch (err) { avisar(err.message, true); }
    }),
  );
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
      <p>Clientes e administradores entram por aqui.</p>
      <div class="erro-form" id="erro"></div>
      <div class="campo"><label for="email">E-mail</label><input id="email" type="email" autocomplete="username" required></div>
      <div class="campo"><label for="senha">Senha</label><input id="senha" type="password" autocomplete="current-password" required></div>
      <button class="botao cheio" type="submit">Entrar</button>
      <p style="margin-top:16px">Ainda não tem conta? <a href="#/cadastro${voltar}">Criar conta</a></p>
      <p class="contas">Contas de teste: <button type="button" data-conta="cliente">cliente Hudson</button> ou <button type="button" data-conta="admin">administrador</button>.</p>
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
    html: `<nav class="abas-admin" aria-label="Painel do administrador">
      ${aba('pedidos', 'Pedidos')}${aba('produtos', 'Cardápio')}${aba('estoque', 'Estoque', alertas.length ? `<span class="badge">${alertas.length}</span>` : '')}${aba('relatorio', 'Relatório')}
    </nav>`,
  };
}

function exigirAdmin() {
  if (ehAdmin()) return true;
  location.hash = '#/entrar';
  return false;
}

async function telaAdminPedidos() {
  if (!exigirAdmin()) return;
  const { html } = await cabecalhoAdmin('pedidos');
  const statusFiltro = new URLSearchParams(location.hash.split('?')[1] || '').get('status') || '';
  const pedidos = await api(`/pedidos${statusFiltro ? `?status=${statusFiltro}` : ''}`);
  const proximo = { RECEBIDO: 'PREPARANDO', PREPARANDO: 'SAIU_ENTREGA', SAIU_ENTREGA: 'CONCLUIDO' };
  main().innerHTML = `${html}
    <div class="cabecalho"><h1>Pedidos</h1>
      <div class="inline"><label for="filtro-status">Mostrar</label>
        <select id="filtro-status" style="width:auto">
          <option value="">Todos</option>
          ${Object.keys(NOME_STATUS).map((s) => `<option value="${s}" ${s === statusFiltro ? 'selected' : ''}>${NOME_STATUS[s]}</option>`).join('')}
        </select>
        <button class="botao secundario pequeno" type="button" id="atualizar">Atualizar</button>
      </div>
    </div>
    ${pedidos.length ? pedidos.map((p) => htmlPedido(p,
      (proximo[p.status] ? `<button class="botao pequeno" type="button" data-avancar="${p.id}" data-para="${proximo[p.status]}">Marcar como ${NOME_STATUS[proximo[p.status]].toLowerCase()}</button>` : '') +
      (['RECEBIDO', 'PREPARANDO'].includes(p.status) ? `<button class="botao perigo pequeno" type="button" data-cancelar="${p.id}">Cancelar</button>` : '') +
      `<button class="botao secundario pequeno" type="button" data-baixas="${p.id}">Ver baixas no estoque</button>`,
    )).join('') : '<div class="painel"><p class="vazio">Nenhum pedido por aqui ainda.</p></div>'}
    <dialog id="dialogo"></dialog>`;

  $('#filtro-status').addEventListener('change', (e) => { location.hash = `#/admin/pedidos${e.target.value ? `?status=${e.target.value}` : ''}`; });
  $('#atualizar').addEventListener('click', telaAdminPedidos);
  main().addEventListener('click', async (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    try {
      if (b.dataset.avancar) {
        await api(`/pedidos/${b.dataset.avancar}/status`, { metodo: 'PATCH', corpo: { status: b.dataset.para } });
        avisar(`Pedido ${b.dataset.avancar}: ${NOME_STATUS[b.dataset.para].toLowerCase()}.`);
        telaAdminPedidos();
      } else if (b.dataset.cancelar) {
        if (!confirm(`Cancelar o pedido ${b.dataset.cancelar}? Os ingredientes voltam ao estoque.`)) return;
        await api(`/pedidos/${b.dataset.cancelar}/cancelamento`, { metodo: 'POST' });
        avisar('Pedido cancelado e estoque devolvido.');
        telaAdminPedidos();
      } else if (b.dataset.baixas) {
        const movs = await api(`/movimentacoes?pedidoId=${b.dataset.baixas}`);
        abrirDialogo(`<h2>Baixas do pedido ${b.dataset.baixas}</h2>
          <table><thead><tr><th>Ingrediente</th><th>Movimento</th><th class="num">Quantidade</th></tr></thead><tbody>
          ${movs.map((m) => `<tr><td>${esc(m.nomeItem)}</td><td>${m.tipo === 'SAIDA' ? 'Saiu' : 'Voltou (cancelamento)'}</td><td class="num">${numero(m.quantidade)}</td></tr>`).join('') || '<tr><td colspan="3">Este pedido não usou ingredientes com receita.</td></tr>'}
          </tbody></table>`);
      }
    } catch (err) { avisar(err.message, true); }
  }, { once: true });
}

function abrirDialogo(conteudo) {
  const d = $('#dialogo');
  d.innerHTML = `${conteudo}<p style="margin-top:16px"><button class="botao secundario" type="button" id="fechar-dialogo">Fechar</button></p>`;
  $('#fechar-dialogo').addEventListener('click', () => d.close());
  d.showModal();
  return d;
}

async function telaAdminProdutos() {
  if (!exigirAdmin()) return;
  const { html } = await cabecalhoAdmin('produtos');
  const [produtos, categorias, insumos] = await Promise.all([api('/produtos'), api('/categorias'), api('/insumos')]);
  const opcoesCategoria = (sel) => categorias.map((c) => `<option value="${c.id}" ${c.id === sel ? 'selected' : ''}>${esc(c.nome)}</option>`).join('');
  main().innerHTML = `${html}
    <div class="cabecalho"><h1>Cardápio</h1>
      <div class="inline"><button class="botao secundario pequeno" type="button" id="nova-categoria">Nova categoria</button><button class="botao pequeno" type="button" id="novo-produto">Novo produto</button></div></div>
    <div class="painel tabela-rolagem">
      <table><thead><tr><th>Produto</th><th>Categoria</th><th class="num">Preço</th><th>Situação</th><th></th></tr></thead><tbody>
      ${produtos.map((p) => `<tr>
        <td><strong>${esc(p.nome)}</strong></td><td>${esc(p.categoriaNome)}</td><td class="num">${reais(p.preco)}</td>
        <td>${!p.disponivel ? '<span class="selo">Fora do cardápio</span>' : p.temEstoque ? '<span class="selo ok">À venda</span>' : '<span class="selo ruim">Sem ingrediente</span>'}</td>
        <td><div class="inline">
          <button class="botao secundario pequeno" type="button" data-editar="${p.id}">Editar</button>
          <button class="botao secundario pequeno" type="button" data-receita="${p.id}">Receita</button>
          <button class="botao secundario pequeno" type="button" data-custo="${p.id}">Custo e lucro</button>
          <button class="botao perigo pequeno" type="button" data-excluir="${p.id}">Excluir</button>
        </div></td></tr>`).join('')}
      </tbody></table>
    </div>
    <dialog id="dialogo"></dialog>`;

  const formProduto = (p = {}) => abrirDialogo(`
    <form id="form-produto" novalidate>
      <h2>${p.id ? 'Editar produto' : 'Novo produto'}</h2>
      <div class="erro-form" id="erro-dialogo"></div>
      <div class="campo"><label for="p-nome">Nome</label><input id="p-nome" type="text" value="${esc(p.nome || '')}"></div>
      <div class="campo"><label for="p-desc">Descrição</label><input id="p-desc" type="text" value="${esc(p.descricao || '')}"></div>
      <div class="linha-campos">
        <div class="campo"><label for="p-cat">Categoria</label><select id="p-cat">${opcoesCategoria(p.categoriaId)}</select></div>
        <div class="campo"><label for="p-preco">Preço de venda (R$)</label><input id="p-preco" type="number" min="0.01" step="0.01" value="${p.preco ?? ''}"></div>
      </div>
      <div class="campo"><label><input id="p-disp" type="checkbox" ${p.disponivel === false ? '' : 'checked'}> Mostrar no cardápio</label></div>
      <button class="botao" type="submit">${p.id ? 'Salvar alterações' : 'Cadastrar produto'}</button>
    </form>`).querySelector('#form-produto').addEventListener('submit', async (e) => {
    e.preventDefault();
    const corpo = { nome: $('#p-nome').value.trim(), descricao: $('#p-desc').value.trim() || undefined, categoriaId: Number($('#p-cat').value), preco: Number($('#p-preco').value), disponivel: $('#p-disp').checked };
    try {
      await api(p.id ? `/produtos/${p.id}` : '/produtos', { metodo: p.id ? 'PATCH' : 'POST', corpo });
      $('#dialogo').close();
      avisar(p.id ? 'Produto salvo.' : 'Produto cadastrado. Monte a receita para o estoque baixar sozinho.');
      telaAdminProdutos();
    } catch (err) { $('#erro-dialogo').textContent = err.message; }
  });

  $('#novo-produto').addEventListener('click', () => formProduto());
  $('#nova-categoria').addEventListener('click', () => {
    abrirDialogo(`<form id="form-cat" novalidate><h2>Nova categoria</h2><div class="erro-form" id="erro-dialogo"></div>
      <div class="campo"><label for="c-nome">Nome</label><input id="c-nome" type="text" placeholder="Sobremesas"></div>
      <div class="campo"><label for="c-ordem">Posição no cardápio</label><input id="c-ordem" type="number" min="0" value="${categorias.length + 1}"></div>
      <button class="botao" type="submit">Criar categoria</button></form>`).querySelector('#form-cat').addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        await api('/categorias', { metodo: 'POST', corpo: { nome: $('#c-nome').value.trim(), ordemExibicao: Number($('#c-ordem').value) } });
        $('#dialogo').close();
        avisar('Categoria criada.');
        telaAdminProdutos();
      } catch (err) { $('#erro-dialogo').textContent = err.message; }
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
        d.querySelector('#mais-linha').addEventListener('click', () => d.querySelector('#linhas').insertAdjacentHTML('beforeend', linha()));
        d.querySelector('#linhas').addEventListener('click', (ev) => { if (ev.target.matches('[data-tirar]')) ev.target.parentElement.remove(); });
        d.querySelector('#form-receita').addEventListener('submit', async (ev) => {
          ev.preventDefault();
          const itens = [...d.querySelectorAll('.receita-linha')].map((l) => ({ insumoId: Number(l.querySelector('select').value), quantidadeNecessaria: Number(l.querySelector('input').value) }));
          try {
            await api(`/produtos/${id}/ficha-tecnica`, { metodo: 'PUT', corpo: { itens } });
            d.close();
            avisar('Receita salva.');
            telaAdminProdutos();
          } catch (err) { $('#erro-dialogo').textContent = err.message; }
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
    </div>
    <dialog id="dialogo"></dialog>`;

  const formInsumo = (i = null) => abrirDialogo(`
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
    </form>`).querySelector('#form-insumo').addEventListener('submit', async (e) => {
    e.preventDefault();
    const corpo = { nomeItem: $('#i-nome').value.trim(), unidadeMedida: $('#i-un').value, precoCusto: Number($('#i-custo').value), estoqueMinimo: Number($('#i-min').value) };
    if (!i) corpo.quantidadeDisponivel = Number($('#i-qtd').value);
    try {
      await api(i ? `/insumos/${i.id}` : '/insumos', { metodo: i ? 'PATCH' : 'POST', corpo });
      $('#dialogo').close();
      avisar(i ? 'Ingrediente salvo.' : 'Ingrediente cadastrado.');
      telaAdminEstoque();
    } catch (err) { $('#erro-dialogo').textContent = err.message; }
  });

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
      const motivo = { PEDIDO: 'Pedido', CANCELAMENTO: 'Cancelamento', REPOSICAO: 'Reposição', CADASTRO: 'Cadastro' };
      abrirDialogo(`<h2>Extrato: ${esc(insumo.nomeItem)}</h2>
        <div class="tabela-rolagem"><table><thead><tr><th>Quando</th><th>Motivo</th><th class="num">Entrada/saída</th></tr></thead><tbody>
        ${movs.map((m) => `<tr><td>${dataHora(m.criadoEm)}</td><td>${motivo[m.motivo]}${m.pedidoId ? ` (pedido ${m.pedidoId})` : ''}</td><td class="num">${m.tipo === 'SAIDA' ? '−' : '+'}${numero(m.quantidade)} ${insumo.unidadeMedida}</td></tr>`).join('') || '<tr><td colspan="3">Sem movimentações.</td></tr>'}
        </tbody></table></div>`);
    }
  });
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
  '#/admin/relatorio': telaAdminRelatorio,
};

async function navegar() {
  const caminho = (location.hash || '#/').split('?')[0];
  const tela = ROTAS[caminho] || telaCardapio;
  desenharMenu();
  try {
    await tela();
  } catch (err) {
    main().innerHTML = `<div class="painel estreito"><h1>Não foi possível carregar</h1><p>${esc(err.message)}</p>
      <p>Confira se a API está ligada (janela do Iniciar BurguerSabor aberta) e tente de novo.</p><button class="botao" type="button" onclick="location.reload()">Tentar de novo</button></div>`;
  }
  main().focus({ preventScroll: true });
  window.scrollTo(0, 0);
}

window.addEventListener('hashchange', navegar);
navegar();
