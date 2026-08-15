const express = require('express');
const Triagem = require('../models/Triagem');

const router = express.Router();

// POST /api/publica/consulta  { cpf, nascimento }
// Consulta do PACIENTE (sem login): informa CPF e data de nascimento.
// Só devolve o andamento do processo — nenhum dado do profissional.
router.post('/consulta', async (req, res) => {
  try {
    const { cpf, nascimento } = req.body || {};
    const cpfDigitos = String(cpf || '').replace(/\D/g, '');
    const nasc = String(nascimento || '').trim();

    if (cpfDigitos.length !== 11 || !/^\d{4}-\d{2}-\d{2}$/.test(nasc)) {
      return res.status(400).json({ erro: 'Informe CPF (11 dígitos) e data de nascimento.' });
    }

    const nascBr = nasc.split('-').reverse().join('/');

    const docs = await Triagem.collection()
      .find({
        'paciente.cpf': { $regex: cpfDigitos },
        'paciente.nascimento': { $in: [nasc, nascBr] },
      })
      .sort({ criadoEm: -1 })
      .limit(50)
      .toArray();

    res.json({ processos: docs.map(Triagem.publicoPaciente) });
  } catch (e) {
    console.error('[publica/consulta]', e);
    res.status(500).json({ erro: 'Erro ao consultar. Tente novamente.' });
  }
});

module.exports = router;
