const express = require('express');
const { ObjectId } = require('mongodb');
const Triagem = require('../models/Triagem');
const Usuario = require('../models/Usuario');
const { autenticar, exigirRole } = require('../middleware/auth');

const router = express.Router();
router.use(autenticar);

const ESPECIALIDADES = [
  'Endodontia', 'Cirurgia Bucomaxilofacial', 'Periodontia', 'Odontopediatria',
  'Pacientes Especiais', 'Prótese / Dentística', 'Estomatologia (Lesões)',
  'Ortodontia', 'Outros',
];

// POST /api/triagens — dentista registra nova triagem/encaminhamento
router.post('/', exigirRole('dentista', 'admin'), async (req, res) => {
  try {
    const { especialidade, paciente, motivo, escore, achados, respostas } = req.body || {};

    if (!ESPECIALIDADES.includes(especialidade)) {
      return res.status(400).json({ erro: 'Especialidade inválida.' });
    }
    if (!paciente || !paciente.nome || !paciente.cpf) {
      return res.status(400).json({ erro: 'Nome e CPF do paciente são obrigatórios.' });
    }
    if (!Array.isArray(respostas) || respostas.length !== 20) {
      return res.status(400).json({ erro: 'Questionário de triagem incompleto (20 perguntas).' });
    }
    const escoreNum = Number(escore);
    if (!Number.isFinite(escoreNum) || escoreNum < 0) {
      return res.status(400).json({ erro: 'Escore inválido.' });
    }

    const doc = await Triagem.criar({
      dentista: req.user,
      especialidade,
      paciente: {
        nome: String(paciente.nome).trim(),
        cpf: String(paciente.cpf).trim(),
        nascimento: String(paciente.nascimento || '').trim(),
        telefone: String(paciente.telefone || '').trim(),
        endereco: String(paciente.endereco || '').trim(),
        acs: String(paciente.acs || '').trim(),
      },
      motivo: String(motivo || '').trim(),
      escore: escoreNum,
      achados: Array.isArray(achados) ? achados : [],
      respostas,
    });

    res.status(201).json({ triagem: Triagem.publico(doc) });
  } catch (e) {
    console.error('[triagens/criar]', e);
    res.status(500).json({ erro: 'Erro ao salvar a triagem.' });
  }
});

// GET /api/triagens
//  dentista: só as dele | admin: todas
//  filtros por query: status, especialidade, fila, cpf, nome
router.get('/', async (req, res) => {
  try {
    const filtro = {};
    if (req.user.role === 'dentista') {
      filtro['dentista.id'] = req.user._id.toString();
    }
    if (req.query.status) filtro.status = String(req.query.status);
    if (req.query.especialidade) filtro.especialidade = String(req.query.especialidade);
    if (req.query.fila) filtro.fila = String(req.query.fila);
    if (req.query.cpf) filtro['paciente.cpf'] = new RegExp(String(req.query.cpf).replace(/\D/g, ''), 'i');

    let cursor = Triagem.collection().find(filtro);
    if (req.query.nome) {
      // filtro por nome aplicado após o find para simplificar regex
      cursor = Triagem.collection().find({
        ...filtro,
        'paciente.nome': new RegExp(String(req.query.nome).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'),
      });
    }

    const docs = await cursor.sort({ criadoEm: -1 }).limit(500).toArray();
    res.json({ triagens: docs.map(Triagem.publico) });
  } catch (e) {
    console.error('[triagens/listar]', e);
    res.status(500).json({ erro: 'Erro ao listar triagens.' });
  }
});

// GET /api/triagens/:id
router.get('/:id', async (req, res) => {
  try {
    if (!ObjectId.isValid(req.params.id)) return res.status(404).json({ erro: 'Triagem não encontrada.' });
    const doc = await Triagem.collection().findOne({ _id: new ObjectId(req.params.id) });
    if (!doc) return res.status(404).json({ erro: 'Triagem não encontrada.' });
    if (req.user.role === 'dentista' && doc.dentista.id !== req.user._id.toString()) {
      return res.status(403).json({ erro: 'Esta triagem pertence a outro profissional.' });
    }
    res.json({ triagem: Triagem.publico(doc) });
  } catch (e) {
    console.error('[triagens/obter]', e);
    res.status(500).json({ erro: 'Erro ao buscar triagem.' });
  }
});

// PATCH /api/triagens/:id/agendar  { data: 'AAAA-MM-DD', hora: 'HH:MM' }  — admin
router.patch('/:id/agendar', exigirRole('admin'), async (req, res) => {
  try {
    const doc = await Triagem.collection().findOne({ _id: new ObjectId(req.params.id) });
    if (!doc) return res.status(404).json({ erro: 'Triagem não encontrada.' });
    if (!['NA_FILA', 'AGENDADO'].includes(doc.status)) {
      return res.status(400).json({ erro: 'Esta triagem não pode ser agendada (status atual: ' + doc.status + ').' });
    }

    const { data, hora } = req.body || {};
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data || '')) {
      return res.status(400).json({ erro: 'Informe a data no formato AAAA-MM-DD.' });
    }

    const agendamento = { data, hora: (hora || '').trim(), agendadoPor: req.user.nome, agendadoEm: new Date() };
    await Triagem.collection().updateOne(
      { _id: doc._id },
      { $set: { status: 'AGENDADO', agendamento, atualizadoEm: new Date() } }
    );
    await Triagem.registrarEvento(
      doc._id,
      `Atendimento agendado para ${data.split('-').reverse().join('/')}${hora ? ' às ' + hora : ''} pelo Centro de Especialidades.`,
      req.user.nome
    );
    res.json({ ok: true });
  } catch (e) {
    console.error('[triagens/agendar]', e);
    res.status(500).json({ erro: 'Erro ao agendar.' });
  }
});

// PATCH /api/triagens/:id/comparecimento  { compareceu: bool, observacao? }  — admin
router.patch('/:id/comparecimento', exigirRole('admin'), async (req, res) => {
  try {
    const doc = await Triagem.collection().findOne({ _id: new ObjectId(req.params.id) });
    if (!doc) return res.status(404).json({ erro: 'Triagem não encontrada.' });
    if (doc.status !== 'AGENDADO') {
      return res.status(400).json({ erro: 'O comparecimento só pode ser registrado para triagens agendadas.' });
    }

    const { compareceu, observacao } = req.body || {};
    const status = compareceu ? 'ATENDIDO' : 'NAO_COMPARECEU';
    const evento = compareceu
      ? 'Paciente compareceu e foi atendido no Centro de Especialidades.'
      : 'Paciente NÃO compareceu no dia agendado.';

    await Triagem.collection().updateOne(
      { _id: doc._id },
      { $set: { status, observacaoAtendimento: String(observacao || '').trim(), atualizadoEm: new Date() } }
    );
    await Triagem.registrarEvento(doc._id, evento, req.user.nome);
    res.json({ ok: true });
  } catch (e) {
    console.error('[triagens/comparecimento]', e);
    res.status(500).json({ erro: 'Erro ao registrar comparecimento.' });
  }
});

// PATCH /api/triagens/:id/cancelar  { motivo }  — dentista autor ou admin
router.patch('/:id/cancelar', async (req, res) => {
  try {
    const doc = await Triagem.collection().findOne({ _id: new ObjectId(req.params.id) });
    if (!doc) return res.status(404).json({ erro: 'Triagem não encontrada.' });
    if (doc.status === 'ATENDIDO') {
      return res.status(400).json({ erro: 'Triagens já atendidas não podem ser canceladas.' });
    }
    if (req.user.role === 'dentista' && doc.dentista.id !== req.user._id.toString()) {
      return res.status(403).json({ erro: 'Esta triagem pertence a outro profissional.' });
    }

    const motivo = String(req.body?.motivo || '').trim();
    await Triagem.collection().updateOne(
      { _id: doc._id },
      { $set: { status: 'CANCELADO', atualizadoEm: new Date() } }
    );
    await Triagem.registrarEvento(
      doc._id,
      `Retirado da fila por ${req.user.role === 'admin' ? 'o Centro de Especialidades' : 'o profissional encaminhador'}. Motivo: ${motivo || 'não informado'}.`,
      req.user.nome
    );
    res.json({ ok: true });
  } catch (e) {
    console.error('[triagens/cancelar]', e);
    res.status(500).json({ erro: 'Erro ao cancelar triagem.' });
  }
});

// PATCH /api/triagens/:id/reabrir  — admin devolve à fila (ex.: faltou, remarcar)
router.patch('/:id/reabrir', exigirRole('admin'), async (req, res) => {
  try {
    const doc = await Triagem.collection().findOne({ _id: new ObjectId(req.params.id) });
    if (!doc) return res.status(404).json({ erro: 'Triagem não encontrada.' });
    if (!['NAO_COMPARECEU', 'CANCELADO', 'AGENDADO'].includes(doc.status)) {
      return res.status(400).json({ erro: 'Status não permite reabrir.' });
    }
    await Triagem.collection().updateOne(
      { _id: doc._id },
      { $set: { status: 'NA_FILA', agendamento: null, atualizadoEm: new Date() } }
    );
    await Triagem.registrarEvento(doc._id, 'Processo reaberto e devolvido à fila de aguardo.', req.user.nome);
    res.json({ ok: true });
  } catch (e) {
    console.error('[triagens/reabrir]', e);
    res.status(500).json({ erro: 'Erro ao reabrir triagem.' });
  }
});

module.exports = { router, ESPECIALIDADES };
