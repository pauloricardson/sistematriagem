const express = require('express');
const Usuario = require('../models/Usuario');
const { autenticar, exigirRole } = require('../middleware/auth');

const router = express.Router();

// Todas as rotas exigem login + perfil admin (Centro de Especialidades)
router.use(autenticar, exigirRole('admin'));

// GET /api/profissionais?ativos=true
router.get('/', async (req, res) => {
  try {
    const filtro = {};
    if (req.query.ativos === 'true') filtro.ativo = true;

    const docs = await Usuario.collection()
      .find({ role: 'dentista', ...filtro })
      .sort({ nome: 1 })
      .toArray();

    res.json({ profissionais: docs.map(Usuario.publico) });
  } catch (e) {
    console.error('[profissionais/listar]', e);
    res.status(500).json({ erro: 'Erro ao listar profissionais.' });
  }
});

// POST /api/profissionais — cadastro SEM senha (dentista define no 1º acesso)
router.post('/', async (req, res) => {
  try {
    const { nome, email, cro, cpf, telefone, endereco, ubs } = req.body || {};
    if (!nome || !email || !cro) {
      return res.status(400).json({ erro: 'Nome, e-mail e CRO são obrigatórios.' });
    }

    if (await Usuario.buscarPorEmail(email)) {
      return res.status(409).json({ erro: 'Já existe um cadastro com este e-mail.' });
    }
    const croDuplicado = await Usuario.collection().findOne({ cro: cro.trim() });
    if (croDuplicado) {
      return res.status(409).json({ erro: 'Já existe um cadastro com este CRO.' });
    }

    const novo = await Usuario.criar({
      nome,
      email,
      cro,
      cpf,
      telefone,
      endereco,
      ubs,
      role: 'dentista',
    });
    res.status(201).json({ profissional: Usuario.publico(novo) });
  } catch (e) {
    console.error('[profissionais/criar]', e);
    res.status(500).json({ erro: 'Erro ao cadastrar profissional.' });
  }
});

// PUT /api/profissionais/:id — atualizar dados cadastrais
router.put('/:id', async (req, res) => {
  try {
    const alvo = await Usuario.buscarPorId(req.params.id);
    if (!alvo || alvo.role !== 'dentista') {
      return res.status(404).json({ erro: 'Profissional não encontrado.' });
    }

    const { nome, email, cro, cpf, telefone, endereco, ubs } = req.body || {};
    if (email && email.toLowerCase() !== alvo.email) {
      const existe = await Usuario.buscarPorEmail(email);
      if (existe) return res.status(409).json({ erro: 'E-mail já usado por outro cadastro.' });
    }
    if (cro && cro.trim() !== alvo.cro) {
      const { ObjectId } = require('mongodb');
      const existe = await Usuario.collection().findOne({ cro: cro.trim(), _id: { $ne: alvo._id } });
      if (existe) return res.status(409).json({ erro: 'CRO já usado por outro cadastro.' });
    }

    await Usuario.collection().updateOne(
      { _id: alvo._id },
      {
        $set: {
          nome: nome !== undefined ? nome.trim() : alvo.nome,
          email: email !== undefined ? email.trim().toLowerCase() : alvo.email,
          cro: cro !== undefined ? cro.trim() : alvo.cro,
          cpf: cpf !== undefined ? cpf.trim() : alvo.cpf,
          telefone: telefone !== undefined ? telefone.trim() : alvo.telefone,
          endereco: endereco !== undefined ? endereco.trim() : alvo.endereco,
          ubs: ubs !== undefined ? ubs.trim() : alvo.ubs,
          atualizadoEm: new Date(),
        },
      }
    );
    res.json({ profissional: Usuario.publico(await Usuario.buscarPorId(req.params.id)) });
  } catch (e) {
    console.error('[profissionais/atualizar]', e);
    res.status(500).json({ erro: 'Erro ao atualizar profissional.' });
  }
});

// PUT /api/profissionais/:id/status  { ativo: bool }  — ativar/inativar
router.put('/:id/status', async (req, res) => {
  try {
    const alvo = await Usuario.buscarPorId(req.params.id);
    if (!alvo || alvo.role !== 'dentista') {
      return res.status(404).json({ erro: 'Profissional não encontrado.' });
    }
    const ativo = Boolean(req.body?.ativo);
    await Usuario.collection().updateOne(
      { _id: alvo._id },
      { $set: { ativo, atualizadoEm: new Date() } }
    );
    res.json({ ok: true });
  } catch (e) {
    console.error('[profissionais/status]', e);
    res.status(500).json({ erro: 'Erro ao alterar status.' });
  }
});

module.exports = router;
