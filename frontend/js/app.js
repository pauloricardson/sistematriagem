// Roteador, autenticação e área do paciente
const App = (() => {
  function mostrarView(id) {
    document.querySelectorAll('.view').forEach((v) => v.classList.add('hidden'));
    const el = document.getElementById(id);
    if (el) { el.classList.remove('hidden'); el.classList.add('fade-in'); }
  }

  function atualizarTopbar() {
    const u = Api.getUsuario();
    const topbar = document.getElementById('topbar');
    if (!u) { topbar.classList.add('hidden'); return; }
    topbar.classList.remove('hidden');
    document.getElementById('topbar-nome').textContent = u.nome.split(' ')[0] + (u.nome.split(' ')[1] ? ' ' + u.nome.split(' ')[1] : '');
    document.getElementById('topbar-perfil').textContent = u.role === 'admin' ? 'Centro de Especialidades' : 'Dentista — UBS';
    document.getElementById('tabs-dentista').style.display = u.role === 'dentista' ? 'flex' : 'none';
    document.getElementById('tabs-centro').style.display = u.role === 'admin' ? 'flex' : 'none';
  }

  function marcarTab(sel) {
    document.querySelectorAll('.tabs a').forEach((a) => a.classList.remove('ativa'));
    if (sel) sel.classList.add('ativa');
  }

  function rotear() {
    const hash = (location.hash || '#login').replace(/^#/, '');
    const [rota, param] = hash.split('/');
    const u = Api.getUsuario();

    // Rotas protegidas: precisa estar logado
    if (['dentista', 'centro'].includes(rota) && !u) { location.hash = '#login'; return; }
    if (u && ['login', 'primeiro-acesso'].includes(rota)) { location.hash = u.role === 'admin' ? '#centro/encaminhamentos' : '#dentista/nova'; return; }

    atualizarTopbar();

    switch (rota) {
      case 'primeiro-acesso':
        mostrarView('view-primeiro-acesso'); marcarTab(null); break;
      case 'redefinir':
        App._tokenRedefinir = param || '';
        mostrarView('view-redefinir'); marcarTab(null); break;
      case 'paciente':
        mostrarView('view-paciente'); marcarTab(null); break;
      case 'dentista':
        if (u.role !== 'dentista') { location.hash = '#centro/encaminhamentos'; return; }
        mostrarView('view-dentista');
        marcarTab(document.querySelector('#tabs-dentista a[data-tab="' + (param || 'nova') + '"]'));
        Dentista.renderizar(param || 'nova'); break;
      case 'centro':
        if (u.role !== 'admin') { location.hash = '#dentista/nova'; return; }
        mostrarView('view-centro');
        marcarTab(document.querySelector('#tabs-centro a[data-tab="c-' + (param || 'encaminhamentos') + '"]'));
        Centro.renderizar(param || 'encaminhamentos'); break;
      default:
        mostrarView('view-login'); marcarTab(null);
    }
  }

  // ---------- LOGIN ----------
  async function entrar() {
    const btn = document.getElementById('btn-entrar');
    const erro = document.getElementById('login-erro');
    const email = document.getElementById('login-email').value.trim();
    const senha = document.getElementById('login-senha').value;
    erro.classList.add('hidden');

    if (!email || !senha) { erro.textContent = 'Preencha e-mail e senha.'; erro.classList.remove('hidden'); return; }

    btn.disabled = true; btn.textContent = 'Entrando...';
    try {
      const r = await Api.request('/auth/login', { method: 'POST', body: { email, senha }, autenticado: false });
      Api.setToken(r.token); Api.setUsuario(r.usuario);
      document.getElementById('login-senha').value = '';
      location.hash = r.usuario.role === 'admin' ? '#centro/encaminhamentos' : '#dentista/nova';
    } catch (e) {
      erro.textContent = e.message; erro.classList.remove('hidden');
    } finally {
      btn.disabled = false; btn.textContent = 'Entrar';
    }
  }

  function sair() {
    Api.setToken(null); Api.setUsuario(null);
    location.hash = '#login';
  }

  // ---------- PRIMEIRO ACESSO / REDEFINIÇÃO ----------
  async function pedirLinkSenha() {
    const btn = document.getElementById('btn-pa');
    const msg = document.getElementById('pa-msg');
    const erro = document.getElementById('pa-erro');
    const email = document.getElementById('pa-email').value.trim();
    msg.classList.add('hidden'); erro.classList.add('hidden');
    if (!email) { erro.textContent = 'Informe seu e-mail.'; erro.classList.remove('hidden'); return; }

    btn.disabled = true; btn.textContent = 'Enviando...';
    try {
      const r = await Api.request('/auth/primeiro-acesso', { method: 'POST', body: { email }, autenticado: false });
      msg.textContent = r.mensagem; msg.classList.remove('hidden');
    } catch (e) {
      erro.textContent = e.message; erro.classList.remove('hidden');
    } finally {
      btn.disabled = false; btn.textContent = 'Enviar link por e-mail';
    }
  }

  async function definirSenha() {
    const btn = document.getElementById('btn-rs');
    const msg = document.getElementById('rs-msg');
    const erro = document.getElementById('rs-erro');
    const senha = document.getElementById('rs-senha').value;
    const senha2 = document.getElementById('rs-senha2').value;
    msg.classList.add('hidden'); erro.classList.add('hidden');

    if (senha.length < 8) { erro.textContent = 'A senha deve ter no mínimo 8 caracteres.'; erro.classList.remove('hidden'); return; }
    if (senha !== senha2) { erro.textContent = 'As senhas não conferem.'; erro.classList.remove('hidden'); return; }

    btn.disabled = true; btn.textContent = 'Salvando...';
    try {
      const r = await Api.request('/auth/redefinir-senha', {
        method: 'POST', body: { token: App._tokenRedefinir, senha }, autenticado: false,
      });
      msg.textContent = r.mensagem; msg.classList.remove('hidden');
      setTimeout(() => { location.hash = '#login'; }, 2500);
    } catch (e) {
      erro.textContent = e.message; erro.classList.remove('hidden');
      btn.disabled = false; btn.textContent = 'Salvar senha';
    }
  }

  // ---------- CONSULTA DO PACIENTE ----------
  async function consultarPaciente() {
    const btn = document.getElementById('btn-pac-consultar');
    const erro = document.getElementById('pac-erro');
    const box = document.getElementById('pac-resultado');
    const cpf = document.getElementById('pac-cpf').value.trim();
    const nasc = document.getElementById('pac-nasc').value;
    erro.classList.add('hidden'); box.classList.add('hidden');

    if (!cpf || !nasc) { erro.textContent = 'Informe CPF e data de nascimento.'; erro.classList.remove('hidden'); return; }

    btn.disabled = true; btn.textContent = 'Consultando...';
    try {
      const r = await Api.request('/publica/consulta', {
        method: 'POST', body: { cpf, nascimento: nasc }, autenticado: false,
      });
      renderizarProcessosPaciente(r.processos || []);
      box.classList.remove('hidden');
    } catch (e) {
      erro.textContent = e.message; erro.classList.remove('hidden');
    } finally {
      btn.disabled = false; btn.textContent = 'Consultar';
    }
  }

  function renderizarProcessosPaciente(processos) {
    const box = document.getElementById('pac-resultado');
    if (!processos.length) {
      box.innerHTML = '<p class="vazio">Nenhum processo encontrado. Confira o CPF e a data de nascimento informados.</p>';
      return;
    }
    box.innerHTML = '<h3 class="secao-titulo" style="margin-top:18px;">Seus encaminhamentos (' + processos.length + ')</h3>' +
      processos.map((p) => {
        const st = STATUS_INFO[p.status] || { rotulo: p.status, cor: '#7f8c8d' };
        const ag = p.agendamento
          ? '<p><strong>Agendado para:</strong> ' + dataBR(p.agendamento.data) + (p.agendamento.hora ? ' às ' + escaparHtml(p.agendamento.hora) : '') + '</p>'
          : '';
        const obs = p.observacaoAtendimento ? '<p><strong>Observação:</strong> ' + escaparHtml(p.observacaoAtendimento) + '</p>' : '';
        const hist = (p.historico || []).map((h) =>
          '<div class="evento"><div class="data">' + formatarData(h.data) + '</div><div class="texto">' + escaparHtml(h.evento) + '</div></div>'
        ).join('');
        return '<div class="item-card">' +
          '<div class="item-linha-topo"><span class="item-titulo">' + escaparHtml(p.especialidade) + ' — Protocolo ' + escaparHtml(p.protocolo) + '</span>' +
          '<span class="badge" style="background:' + st.cor + '">' + st.rotulo + '</span></div>' +
          '<div class="linhas">' +
          '<p><strong>Classificação:</strong> ' + escaparHtml(p.risco) + ' (' + escaparHtml(p.nivelRisco) + ' — ' + escaparHtml(p.fila) + ', espera ' + escaparHtml(p.espera) + ')</p>' +
          '<p><strong>Solicitado em:</strong> ' + formatarData(p.criadoEm) + '</p>' + ag + obs +
          '</div><div class="timeline">' + hist + '</div></div>';
      }).join('');
  }

  // ---------- Inicialização ----------
  window.addEventListener('hashchange', rotear);
  document.addEventListener('DOMContentLoaded', rotear);

  return { entrar, sair, pedirLinkSenha, definirSenha, consultarPaciente, rotear, _tokenRedefinir: '' };
})();
