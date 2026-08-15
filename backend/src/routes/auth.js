const express = require('express');
const Usuario = require('../models/Usuario');
const TokenSenha = require('../models/TokenSenha');
const { gerarToken } = require('../middleware/auth');
const { enviarEmail, smtpConfigurado } = require('../utils/mailer');

const router = express.Router();

// POST /api/auth/login  { email, senha }
router.post('/login', async (req, res) => {
  try {
    const { email, senha } = req.body || {};
    if (!email || !senha) return res.status(400).json({ erro: 'Informe e-mail e senha.' });

    const user = await Usuario.buscarPorEmail(email);
    if (!user || !user.ativo) return res.status(401).json({ erro: 'E-mail ou senha incorretos.' });

    if (user.statusSenha === 'pendente' || !user.senhaHash) {
      return res.status(403).json({
        erro: 'Sua senha ainda não foi definida. Clique em "Primeiro acesso" para recebê-la por e-mail.',
      });
    }

    const ok = await Usuario.compararSenha(user, senha);
    if (!ok) return res.status(401).json({ erro: 'E-mail ou senha incorretos.' });

    res.json({ token: gerarToken(user), usuario: Usuario.publico(user) });
  } catch (e) {
    console.error('[auth/login]', e);
    res.status(500).json({ erro: 'Erro interno ao autenticar.' });
  }
});

// POST /api/auth/primeiro-acesso  { email }
// Serve tanto para o 1º acesso (senha pendente) quanto para redefinir a senha.
router.post('/primeiro-acesso', async (req, res) => {
  try {
    const { email } = req.body || {};
    if (!email) return res.status(400).json({ erro: 'Informe o e-mail cadastrado.' });

    const user = await Usuario.buscarPorEmail(email);
    // Resposta genérica para não revelar quais e-mails existem no sistema
    const respostaGenerica = {
      ok: true,
      mensagem:
        'Se o e-mail estiver cadastrado, você receberá um link para definir sua senha. Verifique também a caixa de spam.',
    };
    if (!user || !user.ativo) return res.json(respostaGenerica);

    const token = await TokenSenha.gerarToken(user._id);
    const base = (process.env.FRONTEND_URL || '').replace(/\/$/, '');
    const link = `${base}/index.html#redefinir/${token}`;

    await enviarEmail({
      to: user.email,
      subject: 'Sistema de Triagem — Definição de Senha',
      text: `Olá, ${user.nome}.\n\nUse o link abaixo para definir (ou redefinir) sua senha. Ele expira em 2 horas:\n\n${link}\n\nSe você não solicitou, ignore este e-mail.`,
      html: `
        <p>Olá, <strong>${user.nome}</strong>.</p>
        <p>Clique no botão abaixo para definir (ou redefinir) sua senha de acesso ao Sistema de Triagem. O link expira em 2 horas.</p>
        <p><a href="${link}" style="background:#2b5c8f;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;">Definir minha senha</a></p>
        <p>Se o botão não funcionar, copie e cole este endereço no navegador:<br>${link}</p>
        <p style="color:#6b7280;">Se você não solicitou, ignore este e-mail.</p>`,
    });

    if (!smtpConfigurado()) {
      // Em desenvolvimento o link já vai para o console do servidor.
      console.log(`[auth] Link de senha para ${user.email}: ${link}`);
    }
    res.json(respostaGenerica);
  } catch (e) {
    console.error('[auth/primeiro-acesso]', e);
    res.status(500).json({ erro: 'Erro interno ao gerar o link.' });
  }
});

// POST /api/auth/redefinir-senha  { token, senha }
router.post('/redefinir-senha', async (req, res) => {
  try {
    const { token, senha } = req.body || {};
    if (!token || !senha) return res.status(400).json({ erro: 'Dados incompletos.' });
    if (String(senha).length < 8) {
      return res.status(400).json({ erro: 'A senha deve ter no mínimo 8 caracteres.' });
    }

    const doc = await TokenSenha.validarToken(token);
    if (!doc) return res.status(400).json({ erro: 'Link inválido ou expirado. Solicite um novo.' });

    const user = await Usuario.buscarPorId(doc.userId.toString());
    if (!user || !user.ativo) return res.status(400).json({ erro: 'Usuário não encontrado.' });

    await Usuario.definirSenha(user._id, senha);
    await TokenSenha.consumirToken(token);

    res.json({ ok: true, mensagem: 'Senha definida com sucesso! Você já pode entrar no sistema.' });
  } catch (e) {
    console.error('[auth/redefinir-senha]', e);
    res.status(500).json({ erro: 'Erro interno ao salvar a senha.' });
  }
});

// GET /api/auth/me  (valida o token e devolve o usuário logado)
const { autenticar } = require('../middleware/auth');
router.get('/me', autenticar, async (req, res) => {
  res.json({ usuario: Usuario.publico(req.user) });
});

module.exports = router;
