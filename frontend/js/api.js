// Camada de comunicação com a API (backend Node.js / MongoDB Atlas)
const Api = (() => {
  function getToken() {
    return localStorage.getItem('triagem_token') || '';
  }
  function setToken(t) {
    if (t) localStorage.setItem('triagem_token', t);
    else localStorage.removeItem('triagem_token');
  }
  function getUsuario() {
    const raw = localStorage.getItem('triagem_usuario');
    try { return raw ? JSON.parse(raw) : null; } catch { return null; }
  }
  function setUsuario(u) {
    if (u) localStorage.setItem('triagem_usuario', JSON.stringify(u));
    else localStorage.removeItem('triagem_usuario');
  }

  async function request(caminho, { method = 'GET', body, autenticado = true } = {}) {
    const headers = { 'Content-Type': 'application/json' };
    if (autenticado && getToken()) headers.Authorization = 'Bearer ' + getToken();

    let resposta;
    try {
      resposta = await fetch(CONFIG.API_URL + caminho, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
    } catch {
      throw new Error('Falha de conexão com o servidor. Verifique sua internet.');
    }

    let dados = null;
    try { dados = await resposta.json(); } catch { /* resposta sem corpo */ }

    if (resposta.status === 401 && autenticado) {
      setToken(null); setUsuario(null);
      location.hash = '#login';
      throw new Error((dados && dados.erro) || 'Sessão expirada. Faça login novamente.');
    }
    if (!resposta.ok) throw new Error((dados && dados.erro) || 'Erro ' + resposta.status);
    return dados;
  }

  return { request, getToken, setToken, getUsuario, setUsuario };
})();
