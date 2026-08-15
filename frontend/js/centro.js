// Painel do Centro de Especialidades (admin): fila de encaminhamentos + profissionais
const Centro = (() => {
  let profissionalEditando = null; // id quando editando

  function renderizar(tab) {
    const alvo = document.getElementById('view-centro');
    alvo.classList.remove('hidden');
    document.getElementById('view-dentista').classList.add('hidden');
    if (tab === 'profissionais') renderizarProfissionais(alvo);
    else renderizarTriagens(alvo);
  }

  // ================== ENCAMINHAMENTOS ==================
  async function renderizarTriagens(alvo) {
    const opcoesStatus = Object.entries(STATUS_INFO)
      .map(([k, v]) => '<option value="' + k + '">' + v.rotulo + '</option>').join('');
    const opcoesEsp = ESPECIALIDADES.map((e) => '<option>' + e + '</option>').join('');
    const opcoesFila = ['Fila 1', 'Fila 2', 'Fila 3', 'Fila 4', 'Fila 5'].map((f) => '<option>' + f + '</option>').join('');

    alvo.innerHTML = `
      <h2 class="secao-titulo">Fila de Encaminhamentos</h2>
      <div class="filtros">
        <div class="input-group"><label>Status</label>
          <select id="f-status" class="form-select" onchange="Centro.buscarTriagens()"><option value="">Todos</option>${opcoesStatus}</select></div>
        <div class="input-group"><label>Especialidade</label>
          <select id="f-especialidade" class="form-select" onchange="Centro.buscarTriagens()"><option value="">Todas</option>${opcoesEsp}</select></div>
        <div class="input-group"><label>Fila de risco</label>
          <select id="f-fila" class="form-select" onchange="Centro.buscarTriagens()"><option value="">Todas</option>${opcoesFila}</select></div>
        <div class="input-group"><label>Paciente (nome ou CPF)</label>
          <input id="f-busca" class="form-input" placeholder="Buscar..." onkeydown="if(event.key==='Enter')Centro.buscarTriagens()">
        </div>
        <button class="btn-main btn-sm" onclick="Centro.buscarTriagens()">Filtrar</button>
      </div>
      <div id="lista-triagens"><p class="vazio">Carregando...</p></div>`;

    await buscarTriagens();
  }

  async function buscarTriagens() {
    const box = document.getElementById('lista-triagens');
    if (!box) return;
    box.innerHTML = '<p class="vazio">Carregando...</p>';

    const params = new URLSearchParams();
    const status = document.getElementById('f-status').value;
    const esp = document.getElementById('f-especialidade').value;
    const fila = document.getElementById('f-fila').value;
    const busca = document.getElementById('f-busca').value.trim();
    if (status) params.set('status', status);
    if (esp) params.set('especialidade', esp);
    if (fila) params.set('fila', fila);
    if (busca) { params.set(busca.replace(/\D/g, '').length >= 3 ? 'cpf' : 'nome', busca); }

    try {
      const r = await Api.request('/triagens' + (params.toString() ? '?' + params : ''));
      desenharTriagens(r.triagens || []);
    } catch (e) {
      box.innerHTML = '<p class="msg-erro">' + escaparHtml(e.message) + '</p>';
    }
  }

  function desenharTriagens(lista) {
    const box = document.getElementById('lista-triagens');
    if (!lista.length) { box.innerHTML = '<p class="vazio">Nenhum encaminhamento encontrado com estes filtros.</p>'; return; }
    box.innerHTML = lista.map((t) => card(t)).join('');
  }

  function card(t) {
    const st = STATUS_INFO[t.status] || { rotulo: t.status, cor: '#7f8c8d' };
    const risco = classificarRisco(t.escore);
    const ag = t.agendamento
      ? '<p><strong>Agendado para:</strong> ' + dataBR(t.agendamento.data) + (t.agendamento.hora ? ' às ' + escaparHtml(t.agendamento.hora) : '') + '</p>' : '';
    const obs = t.observacaoAtendimento ? '<p><strong>Observação:</strong> ' + escaparHtml(t.observacaoAtendimento) + '</p>' : '';

    let acoes = '<button class="btn-main btn-outline btn-sm" onclick="Centro.alternarDetalhes(this)">Detalhes</button>';
    if (t.status === 'NA_FILA') {
      acoes += '<button class="btn-main btn-sm" style="background:#2980b9;" onclick="Centro.mostrarAgendar(\'' + t.id + '\')">Agendar</button>' +
               '<button class="btn-main btn-sm" style="background:#c0392b;" onclick="Centro.cancelar(\'' + t.id + '\')">Cancelar</button>';
    } else if (t.status === 'AGENDADO') {
      acoes += '<button class="btn-main btn-sm" style="background:#27ae60;" onclick="Centro.comparecimento(\'' + t.id + '\', true)">Compareceu</button>' +
               '<button class="btn-main btn-sm" style="background:#e67e22;" onclick="Centro.comparecimento(\'' + t.id + '\', false)">Não compareceu</button>' +
               '<button class="btn-main btn-sm" style="background:#c0392b;" onclick="Centro.cancelar(\'' + t.id + '\')">Cancelar</button>';
    } else if (['NAO_COMPARECEU', 'CANCELADO'].includes(t.status)) {
      acoes += '<button class="btn-main btn-sm" style="background:#8e44ad;" onclick="Centro.reabrir(\'' + t.id + '\')">Reabrir na fila</button>';
    }

    const hist = (t.historico || []).map((h) =>
      '<div class="evento"><div class="data">' + formatarData(h.data) + '</div><div class="texto">' + escaparHtml(h.evento) + '</div></div>'
    ).join('');

    return '<div class="item-card">' +
      '<div class="item-linha-topo">' +
      '<span class="item-titulo">' + escaparHtml(t.paciente.nome) + ' — ' + escaparHtml(t.especialidade) +
      ' <span class="badge" style="background:' + risco.cor + ';color:' + risco.texto + ';">' + t.escore + ' pts · ' + risco.fila + '</span></span>' +
      '<span class="badge" style="background:' + st.cor + '">' + st.rotulo + '</span></div>' +
      '<div class="linhas">' +
      '<p><strong>Protocolo:</strong> ' + escaparHtml(t.protocolo) + ' | <strong>CPF:</strong> ' + escaparHtml(t.paciente.cpf) + ' | <strong>Nasc.:</strong> ' + escaparHtml(t.paciente.nascimento || '—') + '</p>' +
      '<p><strong>Encaminhado por:</strong> ' + escaparHtml(t.dentista.nome) + ' (CRO ' + escaparHtml(t.dentista.cro) + ' — ' + escaparHtml(t.dentista.ubs || 'UBS não informada') + ')</p>' +
      '<p><strong>Telefone:</strong> ' + escaparHtml(t.paciente.telefone || '—') + ' | <strong>Criado em:</strong> ' + formatarData(t.criadoEm) + '</p>' +
      ag + obs + '</div>' +
      '<div class="acoes">' + acoes + '</div>' +
      '<div class="agendar-box hidden" id="ag-' + t.id + '">' +
      '<input type="date" id="ag-data-' + t.id + '"> <input type="time" id="ag-hora-' + t.id + '">' +
      '<button class="btn-main btn-sm" onclick="Centro.agendar(\'' + t.id + '\')">Confirmar agendamento</button></div>' +
      '<div class="detalhes hidden" style="margin-top:12px;">' +
      '<p style="font-size:.85rem;"><strong>Endereço:</strong> ' + escaparHtml(t.paciente.endereco || '—') + ' | <strong>ACS:</strong> ' + escaparHtml(t.paciente.acs || '—') + '</p>' +
      '<p style="font-size:.85rem;margin-top:6px;"><strong>Motivo:</strong> ' + escaparHtml(t.motivo || 'Não informado') + '</p>' +
      '<p style="font-size:.85rem;margin-top:6px;"><strong>Fatores de risco:</strong> ' + (t.achados && t.achados.length ? escaparHtml(t.achados.join(' | ')) : 'Nenhum') + '</p>' +
      '<div class="timeline">' + hist + '</div></div></div>';
  }

  function alternarDetalhes(btn) {
    btn.closest('.item-card').querySelector('.detalhes').classList.toggle('hidden');
  }

  function mostrarAgendar(id) {
    const box = document.getElementById('ag-' + id);
    box.classList.toggle('hidden');
  }

  async function agendar(id) {
    const data = document.getElementById('ag-data-' + id).value;
    const hora = document.getElementById('ag-hora-' + id).value;
    if (!data) { alert('Informe a data do atendimento.'); return; }
    try {
      await Api.request('/triagens/' + id + '/agendar', { method: 'PATCH', body: { data, hora } });
      buscarTriagens();
    } catch (e) { alert(e.message); }
  }

  async function comparecimento(id, compareceu) {
    const observacao = prompt(compareceu ? 'Observações do atendimento (opcional):' : 'Observações sobre a ausência (opcional):') || '';
    try {
      await Api.request('/triagens/' + id + '/comparecimento', { method: 'PATCH', body: { compareceu, observacao } });
      buscarTriagens();
    } catch (e) { alert(e.message); }
  }

  async function cancelar(id) {
    const motivo = prompt('Informe o motivo do cancelamento:');
    if (motivo === null) return;
    try {
      await Api.request('/triagens/' + id + '/cancelar', { method: 'PATCH', body: { motivo } });
      buscarTriagens();
    } catch (e) { alert(e.message); }
  }

  async function reabrir(id) {
    if (!confirm('Reabrir este processo e devolvê-lo à fila de aguardo?')) return;
    try {
      await Api.request('/triagens/' + id + '/reabrir', { method: 'PATCH' });
      buscarTriagens();
    } catch (e) { alert(e.message); }
  }

  // ================== PROFISSIONAIS ==================
  async function renderizarProfissionais(alvo) {
    profissionalEditando = null;
    alvo.innerHTML = `
      <h2 class="secao-titulo">Cadastro de Profissionais (Dentistas das UBS)</h2>
      <p class="subtitulo">Cadastre o profissional sem senha — ele receberá um link por e-mail no primeiro acesso para definir a própria senha.</p>
      <div class="info-grid" style="grid-template-columns:1fr 1fr;">
        <div class="info-col">
          <h4 id="form-prof-titulo">Novo profissional</h4>
          <div class="input-group"><label>Nome completo *</label><input id="pf-nome" class="form-input"></div>
          <div class="input-group"><label>E-mail *</label><input id="pf-email" type="email" class="form-input"></div>
          <div class="form-grid">
            <div class="input-group"><label>CRO *</label><input id="pf-cro" class="form-input" placeholder="Ex: 12345"></div>
            <div class="input-group"><label>CPF</label><input id="pf-cpf" class="form-input" placeholder="000.000.000-00"></div>
          </div>
        </div>
        <div class="info-col">
          <h4>&nbsp;</h4>
          <div class="form-grid">
            <div class="input-group"><label>Telefone</label><input id="pf-telefone" class="form-input" placeholder="(00) 00000-0000"></div>
            <div class="input-group"><label>UBS / Unidade</label><input id="pf-ubs" class="form-input"></div>
          </div>
          <div class="input-group"><label>Endereço</label><input id="pf-endereco" class="form-input" placeholder="Rua, Número, Bairro, Cidade"></div>
          <button class="btn-main" id="btn-pf-salvar" onclick="Centro.salvarProfissional()">Cadastrar profissional</button>
          <button class="btn-main btn-outline btn-sm hidden" id="btn-pf-cancelar" onclick="Centro.renderizarProfissionaisTela()">Cancelar edição</button>
          <p id="pf-msg" class="msg-ok hidden"></p><p id="pf-erro" class="msg-erro hidden"></p>
        </div>
      </div>
      <h3 class="secao-titulo" style="margin-top:22px;font-size:1rem;">Profissionais cadastrados</h3>
      <div id="lista-profissionais"><p class="vazio">Carregando...</p></div>`;
    await buscarProfissionais();
  }

  async function buscarProfissionais() {
    const box = document.getElementById('lista-profissionais');
    if (!box) return;
    try {
      const r = await Api.request('/profissionais');
      desenharProfissionais(r.profissionais || []);
    } catch (e) {
      box.innerHTML = '<p class="msg-erro">' + escaparHtml(e.message) + '</p>';
    }
  }

  function desenharProfissionais(lista) {
    const box = document.getElementById('lista-profissionais');
    if (!lista.length) { box.innerHTML = '<p class="vazio">Nenhum profissional cadastrado ainda.</p>'; return; }
    box.innerHTML = lista.map((p) => {
      const senha = p.statusSenha === 'pendente'
        ? '<span class="badge" style="background:#e67e22;">Senha pendente</span>'
        : '<span class="badge" style="background:#27ae60;">Ativo</span>';
      const situacao = p.ativo
        ? '<span class="badge" style="background:#2980b9;">Habilitado</span>'
        : '<span class="badge" style="background:#7f8c8d;">Inativo</span>';
      return '<div class="item-card">' +
        '<div class="item-linha-topo"><span class="item-titulo">' + escaparHtml(p.nome) + ' — CRO ' + escaparHtml(p.cro) + '</span><span>' + senha + ' ' + situacao + '</span></div>' +
        '<div class="linhas">' +
        '<p><strong>E-mail:</strong> ' + escaparHtml(p.email) + (p.telefone ? ' | <strong>Telefone:</strong> ' + escaparHtml(p.telefone) : '') + '</p>' +
        '<p><strong>CPF:</strong> ' + escaparHtml(p.cpf || '—') + ' | <strong>UBS:</strong> ' + escaparHtml(p.ubs || '—') + ' | <strong>Endereço:</strong> ' + escaparHtml(p.endereco || '—') + '</p>' +
        '</div><div class="acoes">' +
        '<button class="btn-main btn-outline btn-sm" onclick=\'Centro.editarProfissional(' + JSON.stringify(JSON.stringify(p)).replace(/'/g, '&#39;') + ')\'>Editar</button>' +
        '<button class="btn-main btn-sm" style="background:' + (p.ativo ? '#c0392b' : '#27ae60') + ';" onclick="Centro.alterarStatus(\'' + p.id + '\',' + (!p.ativo) + ')">' + (p.ativo ? 'Inativar' : 'Reativar') + '</button>' +
        '</div></div>';
    }).join('');
  }

  function editarProfissional(pJson) {
    const p = JSON.parse(pJson);
    profissionalEditando = p.id;
    document.getElementById('form-prof-titulo').textContent = 'Editando: ' + p.nome;
    document.getElementById('pf-nome').value = p.nome;
    document.getElementById('pf-email').value = p.email;
    document.getElementById('pf-cro').value = p.cro;
    document.getElementById('pf-cpf').value = p.cpf;
    document.getElementById('pf-telefone').value = p.telefone;
    document.getElementById('pf-ubs').value = p.ubs;
    document.getElementById('pf-endereco').value = p.endereco;
    document.getElementById('btn-pf-salvar').textContent = 'Salvar alterações';
    document.getElementById('btn-pf-cancelar').classList.remove('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function salvarProfissional() {
    const btn = document.getElementById('btn-pf-salvar');
    const msg = document.getElementById('pf-msg');
    const erro = document.getElementById('pf-erro');
    msg.classList.add('hidden'); erro.classList.add('hidden');

    const corpo = {
      nome: document.getElementById('pf-nome').value.trim(),
      email: document.getElementById('pf-email').value.trim(),
      cro: document.getElementById('pf-cro').value.trim(),
      cpf: document.getElementById('pf-cpf').value.trim(),
      telefone: document.getElementById('pf-telefone').value.trim(),
      ubs: document.getElementById('pf-ubs').value.trim(),
      endereco: document.getElementById('pf-endereco').value.trim(),
    };
    if (!corpo.nome || !corpo.email || !corpo.cro) {
      erro.textContent = 'Nome, e-mail e CRO são obrigatórios.'; erro.classList.remove('hidden'); return;
    }

    btn.disabled = true; btn.textContent = 'Salvando...';
    try {
      if (profissionalEditando) {
        await Api.request('/profissionais/' + profissionalEditando, { method: 'PUT', body: corpo });
        msg.textContent = 'Profissional atualizado com sucesso.';
      } else {
        await Api.request('/profissionais', { method: 'POST', body: corpo });
        msg.textContent = 'Profissional cadastrado! Avise-o para acessar "Primeiro acesso" no site e definir a senha pelo e-mail informado.';
      }
      msg.classList.remove('hidden');
      await buscarProfissionais();
      setTimeout(() => renderizarProfissionais(document.getElementById('view-centro')), 2500);
    } catch (e) {
      erro.textContent = e.message; erro.classList.remove('hidden');
      btn.disabled = false; btn.textContent = profissionalEditando ? 'Salvar alterações' : 'Cadastrar profissional';
    }
  }

  async function alterarStatus(id, ativo) {
    try {
      await Api.request('/profissionais/' + id + '/status', { method: 'PUT', body: { ativo } });
      buscarProfissionais();
    } catch (e) { alert(e.message); }
  }

  return {
    renderizar, renderizarProfissionaisTela: (el) => renderizarProfissionais(el || document.getElementById('view-centro')),
    buscarTriagens, alternarDetalhes, mostrarAgendar, agendar, comparecimento, cancelar, reabrir,
    editarProfissional, salvarProfissional, alterarStatus,
  };
})();
