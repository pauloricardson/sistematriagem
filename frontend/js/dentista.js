// Painel do Dentista (UBS): nova triagem + meus encaminhamentos
const Dentista = (() => {
  let etapa = 'especialidade';      // especialidade | paciente | quiz | resultado
  let dados = {};                   // especialidade, paciente, respostas[], escore, achados[]
  let indice = 0;
  let triagemSalva = null;

  const usuario = () => Api.getUsuario();

  function renderizar(tab) {
    const alvo = document.getElementById('view-dentista');
    alvo.classList.remove('hidden');
    document.getElementById('view-centro').classList.add('hidden');

    if (tab === 'encaminhamentos') { renderizarEncaminhamentos(alvo); return; }

    // Nova triagem — mantém o estado enquanto o profissional navega entre abas,
    // mas reinicia quando a triagem anterior já foi salva
    const reiniciar = dados._tabAtual !== 'nova' || (etapa === 'resultado' && triagemSalva);
    if (!alvo.dataset.iniciada || reiniciar) {
      dados = { _tabAtual: 'nova' };
      etapa = 'especialidade';
      triagemSalva = null;
      alvo.dataset.iniciada = '1';
    }
    renderizarEtapa(alvo);
  }

  function renderizarEtapa(alvo) {
    if (etapa === 'especialidade') return telaEspecialidade(alvo);
    if (etapa === 'paciente') return telaPaciente(alvo);
    if (etapa === 'quiz') return telaQuiz(alvo);
    telaResultado(alvo);
  }

  // ---------- Etapa 1: especialidade ----------
  function telaEspecialidade(alvo) {
    const u = usuario();
    alvo.innerHTML = `
      <h2 class="secao-titulo">Nova Triagem — Especialidade</h2>
      <p class="subtitulo">Profissional: <strong>${escaparHtml(u ? u.nome : '')}</strong> — CRO ${escaparHtml(u ? u.cro : '')} — ${escaparHtml(u ? u.ubs : '')}</p>
      <div class="input-group"><label>Especialidade do encaminhamento *</label>
        <select id="tr-especialidade" class="form-select">
          <option value="">-- Selecione uma opção --</option>
          ${ESPECIALIDADES.map((e) => `<option ${dados.especialidade === e ? 'selected' : ''}>${e}</option>`).join('')}
        </select></div>
      <button class="btn-main" onclick="Dentista.avancarPaciente()">Avançar</button>`;
  }

  function avancarPaciente() {
    const v = document.getElementById('tr-especialidade').value;
    if (!v) { alert('Selecione uma especialidade.'); return; }
    dados.especialidade = v;
    etapa = 'paciente';
    renderizarEtapa(document.getElementById('view-dentista'));
  }

  // ---------- Etapa 2: dados do paciente ----------
  function telaPaciente(alvo) {
    const p = dados.paciente || {};
    alvo.innerHTML = `
      <h2 class="secao-titulo">Nova Triagem — Dados do Paciente</h2>
      <p class="subtitulo">Especialidade selecionada: <strong>${escaparHtml(dados.especialidade)}</strong></p>
      <div class="form-grid">
        <div class="input-group"><label>Nome completo *</label><input type="text" id="tr-nome" class="form-input" value="${escaparHtml(p.nome || '')}"></div>
        <div class="input-group"><label>CPF *</label><input type="text" id="tr-cpf" class="form-input" placeholder="000.000.000-00" value="${escaparHtml(p.cpf || '')}"></div>
      </div>
      <div class="form-grid">
        <div class="input-group"><label>Data de nascimento</label><input type="date" id="tr-nasc" class="form-input" value="${escaparHtml(p.nascimentoISO || '')}"></div>
        <div class="input-group"><label>Agente Comunitário (ACS)</label><input type="text" id="tr-acs" class="form-input" value="${escaparHtml(p.acs || '')}"></div>
      </div>
      <div class="input-group"><label>Endereço</label><input type="text" id="tr-end" class="form-input" placeholder="Rua, Número, Bairro" value="${escaparHtml(p.endereco || '')}"></div>
      <div class="input-group"><label>Telefone</label><input type="tel" id="tr-tel" class="form-input" placeholder="(00) 00000-0000" value="${escaparHtml(p.telefone || '')}"></div>
      <div class="input-group"><label>Motivo da consulta / Queixa principal</label>
        <textarea id="tr-motivo" class="form-textarea" style="min-height:90px;resize:vertical;" placeholder="Descreva o motivo do encaminhamento à atenção especializada...">${escaparHtml(p.motivo || '')}</textarea></div>
      <button class="btn-main" onclick="Dentista.iniciarQuiz()">Iniciar Triagem de Risco</button>
      <button class="btn-main btn-outline btn-sm" style="margin-top:10px;" onclick="Dentista.voltarEspecialidade()">Voltar</button>`;
  }

  function voltarEspecialidade() { coletarPaciente(); etapa = 'especialidade'; renderizarEtapa(document.getElementById('view-dentista')); }

  function coletarPaciente() {
    const v = (id) => { const el = document.getElementById(id); return el ? el.value.trim() : ''; };
    dados.paciente = {
      nome: v('tr-nome'), cpf: v('tr-cpf'),
      nascimentoISO: v('tr-nasc'),
      nascimento: v('tr-nasc') ? v('tr-nasc').split('-').reverse().join('/') : '',
      acs: v('tr-acs'), endereco: v('tr-end'), telefone: v('tr-tel'), motivo: v('tr-motivo'),
    };
  }

  function iniciarQuiz() {
    coletarPaciente();
    if (!dados.paciente.nome) { alert('O nome do paciente é obrigatório.'); return; }
    if (!dados.paciente.cpf) { alert('O CPF do paciente é obrigatório.'); return; }
    dados.respostas = []; dados.escore = 0; dados.achados = [];
    indice = 0;
    etapa = 'quiz';
    renderizarEtapa(document.getElementById('view-dentista'));
  }

  // ---------- Etapa 3: questionário ----------
  function telaQuiz(alvo) {
    alvo.innerHTML = `
      <div id="quiz-area" class="card-header" style="border-radius:14px;">
        <div class="app-title">Triagem de Risco</div>
        <div class="progress-bar-container"><div class="progress-bar" id="quiz-bar" style="width:0%"></div></div>
        <div class="progress-text" id="quiz-progress"></div>
      </div>
      <div style="margin-top:24px;text-align:center;">
        <div class="block-badge" id="quiz-bloco"></div>
        <div class="question" id="quiz-pergunta">Carregando...</div>
        <div class="actions">
          <button class="btn-yes" onclick="Dentista.responder(true)">SIM</button>
          <button class="btn-no" onclick="Dentista.responder(false)">NÃO</button>
        </div>
      </div>`;
    desenharPergunta();
  }

  function desenharPergunta() {
    if (indice >= PERGUNTAS.length) { etapa = 'resultado'; renderizarEtapa(document.getElementById('view-dentista')); return; }
    document.getElementById('quiz-progress').textContent = 'Pergunta ' + (indice + 1) + ' de ' + PERGUNTAS.length;
    document.getElementById('quiz-bar').style.width = ((indice + 1) / PERGUNTAS.length * 100) + '%';
    document.getElementById('quiz-bloco').textContent = PERGUNTAS[indice].bloco;
    const el = document.getElementById('quiz-pergunta');
    el.classList.remove('fade-in'); void el.offsetWidth; el.classList.add('fade-in');
    el.textContent = PERGUNTAS[indice].texto;
  }

  function responder(sim) {
    dados.respostas.push(sim);
    if (sim) { dados.escore += PERGUNTAS[indice].pontos; dados.achados.push(PERGUNTAS[indice].texto); }
    indice++;
    setTimeout(desenharPergunta, 150);
  }

  // ---------- Etapa 4: resultado ----------
  function telaResultado(alvo) {
    const u = usuario();
    const p = dados.paciente;
    const risco = classificarRisco(dados.escore);
    const achados = dados.achados.length
      ? dados.achados.map((a) => '<li>' + escaparHtml(a) + '</li>').join('')
      : '<li>Nenhum fator sentinela identificado.</li>';

    alvo.innerHTML = `
      <div class="card-header" style="border-radius:14px 14px 0 0;"><div class="app-title">Relatório de Triagem</div></div>
      <div style="padding:24px;">
        <div class="result-header">
          <span class="protocol-id" id="res-protocolo"></span>
          <p style="color:var(--text-muted);font-size:.85rem;margin-top:8px;" id="res-datahora"></p>
        </div>
        <div class="info-grid">
          <div class="info-col"><h4>Profissional Encaminhador</h4>
            <p><strong>Nome:</strong> ${escaparHtml(u.nome)}</p>
            <p><strong>CRO:</strong> ${escaparHtml(u.cro)}</p>
            <p><strong>UBS:</strong> ${escaparHtml(u.ubs)}</p>
            <p><strong>Especialidade:</strong> ${escaparHtml(dados.especialidade)}</p></div>
          <div class="info-col"><h4>Paciente</h4>
            <p><strong>Nome:</strong> ${escaparHtml(p.nome)}</p>
            <p><strong>Nascimento:</strong> ${escaparHtml(p.nascimento || 'Não informado')} | <strong>CPF:</strong> ${escaparHtml(p.cpf)}</p>
            <p><strong>Telefone:</strong> ${escaparHtml(p.telefone || 'Não informado')}</p>
            <p><strong>Endereço:</strong> ${escaparHtml(p.endereco || 'Não informado')}</p>
            <p><strong>ACS:</strong> ${escaparHtml(p.acs || 'Não informado')}</p></div>
        </div>
        <div class="motivo-box"><h4>Motivo da Consulta</h4><p>${escaparHtml(p.motivo || 'Não informado')}</p></div>
        <div class="score-row">
          <div class="score-box"><span style="font-weight:600;color:var(--primary-light);font-size:.8rem;text-transform:uppercase;">Escore Total</span><span class="value">${dados.escore}</span></div>
          <div class="risk-box" style="background:${risco.cor};color:${risco.texto};">
            <span style="font-weight:600;font-size:.8rem;text-transform:uppercase;opacity:.85;">Classificação</span>
            <span class="value">${risco.titulo}</span>
            <div class="risk-details"><span>${risco.nivel}</span><span>Espera: ${risco.espera}</span><span>${risco.fila}</span></div>
          </div>
        </div>
        <h3 style="font-size:.95rem;margin-bottom:8px;">Fatores de Risco (Sim):</h3>
        <ul class="summary-list">${achados}</ul>
        <div class="final-actions">
          <button class="btn-main" id="btn-salvar-triagem" style="background:#2563eb;" onclick="Dentista.salvar()">Salvar no Banco</button>
          <button class="btn-main" style="background:#4b5563;" onclick="window.print()">Imprimir A4</button>
        </div>
        <p id="res-msg" class="msg-ok hidden"></p>
      </div>`;

    if (triagemSalva) {
      document.getElementById('res-protocolo').textContent = 'ID: ' + triagemSalva.protocolo;
      document.getElementById('res-datahora').textContent = 'Data/Hora: ' + triagemSalva.dataHora;
      const b = document.getElementById('btn-salvar-triagem');
      b.textContent = '✓ Salvo com sucesso'; b.style.background = 'var(--ok)'; b.disabled = true;
    }
  }

  async function salvar() {
    const btn = document.getElementById('btn-salvar-triagem');
    const msg = document.getElementById('res-msg');
    btn.disabled = true; btn.textContent = 'Salvando...';

    const agora = new Date();
    try {
      const r = await Api.request('/triagens', {
        method: 'POST',
        body: {
          especialidade: dados.especialidade,
          paciente: {
            nome: dados.paciente.nome, cpf: dados.paciente.cpf,
            nascimento: dados.paciente.nascimento, telefone: dados.paciente.telefone,
            endereco: dados.paciente.endereco, acs: dados.paciente.acs,
          },
          motivo: dados.paciente.motivo,
          escore: dados.escore,
          achados: dados.achados,
          respostas: dados.respostas,
        },
      });

      triagemSalva = {
        protocolo: r.triagem.protocolo,
        dataHora: agora.toLocaleDateString('pt-BR') + ' às ' + agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      };
      document.getElementById('res-protocolo').textContent = 'ID: ' + triagemSalva.protocolo;
      document.getElementById('res-datahora').textContent = 'Data/Hora: ' + triagemSalva.dataHora;
      btn.textContent = '✓ Salvo com sucesso'; btn.style.background = 'var(--ok)';
      msg.textContent = 'Encaminhamento registrado! O paciente pode acompanhar pelo site informando CPF e data de nascimento.';
      msg.classList.remove('hidden');
    } catch (e) {
      alert(e.message);
      btn.disabled = false; btn.textContent = 'Tentar Salvar Novamente';
    }
  }

  // ---------- Meus encaminhamentos ----------
  async function renderizarEncaminhamentos(alvo) {
    alvo.innerHTML = '<h2 class="secao-titulo">Meus Encaminhamentos</h2><p class="vazio">Carregando...</p>';
    try {
      const r = await Api.request('/triagens');
      desenharEncaminhamentos(alvo, r.triagens || []);
    } catch (e) {
      alvo.innerHTML = '<h2 class="secao-titulo">Meus Encaminhamentos</h2><p class="msg-erro">' + escaparHtml(e.message) + '</p>';
    }
  }

  function desenharEncaminhamentos(alvo, lista) {
    if (!lista.length) { alvo.innerHTML = '<h2 class="secao-titulo">Meus Encaminhamentos</h2><p class="vazio">Você ainda não registrou encaminhamentos.</p>'; return; }
    alvo.innerHTML = '<h2 class="secao-titulo">Meus Encaminhamentos (' + lista.length + ')</h2>' + lista.map((t) => cardTriagem(t, false)).join('');
  }

  function cardTriagem(t, detalhesAbertos) {
    const st = STATUS_INFO[t.status] || { rotulo: t.status, cor: '#7f8c8d' };
    const risco = classificarRisco(t.escore);
    const ag = t.agendamento
      ? '<p><strong>Agendado para:</strong> ' + dataBR(t.agendamento.data) + (t.agendamento.hora ? ' às ' + escaparHtml(t.agendamento.hora) : '') + '</p>' : '';
    const obs = t.observacaoAtendimento ? '<p><strong>Observação:</strong> ' + escaparHtml(t.observacaoAtendimento) + '</p>' : '';
    const podeCancelar = ['NA_FILA', 'AGENDADO', 'NAO_COMPARECEU'].includes(t.status);
    const hist = (t.historico || []).map((h) =>
      '<div class="evento"><div class="data">' + formatarData(h.data) + '</div><div class="texto">' + escaparHtml(h.evento) + '</div></div>'
    ).join('');

    return '<div class="item-card">' +
      '<div class="item-linha-topo"><span class="item-titulo">' + escaparHtml(t.paciente.nome) + ' — ' + escaparHtml(t.especialidade) + '</span>' +
      '<span class="badge" style="background:' + st.cor + '">' + st.rotulo + '</span></div>' +
      '<div class="linhas">' +
      '<p><strong>Protocolo:</strong> ' + escaparHtml(t.protocolo) + ' | <strong>Escore:</strong> ' + t.escore + ' — ' + escaparHtml(t.risco) + ' (' + escaparHtml(t.fila) + ')</p>' +
      '<p><strong>CPF:</strong> ' + escaparHtml(t.paciente.cpf) + ' | <strong>Criado em:</strong> ' + formatarData(t.criadoEm) + '</p>' +
      ag + obs + '</div>' +
      '<div class="acoes">' +
      '<button class="btn-main btn-outline btn-sm" onclick="Dentista.alternarDetalhes(this)">Detalhes</button>' +
      (podeCancelar ? '<button class="btn-main btn-sm" style="background:#c0392b;" onclick="Dentista.cancelar(\'' + t.id + '\')">Retirar da fila</button>' : '') +
      '</div>' +
      '<div class="detalhes ' + (detalhesAbertos ? '' : 'hidden') + '" style="margin-top:12px;">' +
      '<p style="font-size:.85rem;"><strong>Motivo:</strong> ' + escaparHtml(t.motivo || 'Não informado') + '</p>' +
      '<p style="font-size:.85rem;margin-top:6px;"><strong>Fatores de risco:</strong> ' + (t.achados && t.achados.length ? escaparHtml(t.achados.join(' | ')) : 'Nenhum') + '</p>' +
      '<div class="timeline">' + hist + '</div></div></div>';
  }

  function alternarDetalhes(btn) {
    const d = btn.closest('.item-card').querySelector('.detalhes');
    d.classList.toggle('hidden');
  }

  async function cancelar(id) {
    const motivo = prompt('Informe o motivo da retirada da fila:');
    if (motivo === null) return;
    try {
      await Api.request('/triagens/' + id + '/cancelar', { method: 'PATCH', body: { motivo } });
      renderizarEncaminhamentos(document.getElementById('view-dentista'));
    } catch (e) { alert(e.message); }
  }

  return {
    renderizar, avancarPaciente, voltarEspecialidade, iniciarQuiz, responder,
    salvar, cancelar, alternarDetalhes,
  };
})();
