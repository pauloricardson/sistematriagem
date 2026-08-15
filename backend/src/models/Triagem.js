const { getDb } = require('../config/db');

// Status possíveis:
//  NA_FILA        — triagem criada pelo dentista, aguardando o Centro agendar
//  AGENDADO       — Centro marcou data/hora do atendimento
//  ATENDIDO       — paciente compareceu e foi atendido
//  NAO_COMPARECEU — paciente não compareceu no dia agendado
//  CANCELADO      — retirado da fila (pelo dentista autor ou pelo Centro)

const STATUS = ['NA_FILA', 'AGENDADO', 'ATENDIDO', 'NAO_COMPARECEU', 'CANCELADO'];

function collection() {
  return getDb().collection('triagens');
}

async function criarIndices() {
  await collection().createIndex({ protocolo: 1 }, { unique: true });
  await collection().createIndex({ 'paciente.cpf': 1 });
  await collection().createIndex({ dentistaId: 1 });
  await collection().createIndex({ status: 1, fila: 1 });
}

function gerarProtocolo() {
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  const ts = Date.now().toString().slice(-4);
  return `TRG-${rand}-${ts}`;
}

function classificarRisco(escore) {
  if (escore >= 64) return { titulo: 'EMERGÊNCIA', nivel: 'Risco Altíssimo', espera: 'Imediato a 24h', fila: 'Fila 1' };
  if (escore >= 32) return { titulo: 'MUITO URGENTE', nivel: 'Risco Alto', espera: 'Até 7 dias', fila: 'Fila 2' };
  if (escore >= 16) return { titulo: 'URGENTE', nivel: 'Risco Médio', espera: 'Até 30 dias', fila: 'Fila 3' };
  if (escore >= 4) return { titulo: 'POUCO URGENTE', nivel: 'Risco Baixo', espera: 'Até 3 meses', fila: 'Fila 4' };
  return { titulo: 'NÃO URGENTE', nivel: 'Sem risco', espera: 'Até 6 meses', fila: 'Fila 5' };
}

function publico(doc) {
  return {
    id: doc._id.toString(),
    protocolo: doc.protocolo,
    especialidade: doc.especialidade,
    status: doc.status,
    escore: doc.escore,
    risco: doc.risco,
    nivelRisco: doc.nivelRisco,
    espera: doc.espera,
    fila: doc.fila,
    paciente: doc.paciente,
    motivo: doc.motivo,
    achados: doc.achados,
    respostas: doc.respostas,
    dentista: doc.dentista,
    agendamento: doc.agendamento || null,
    observacaoAtendimento: doc.observacaoAtendimento || '',
    historico: doc.historico || [],
    criadoEm: doc.criadoEm,
  };
}

// Visão reduzida para a consulta pública do paciente (sem dados do profissional)
function publicoPaciente(doc) {
  return {
    protocolo: doc.protocolo,
    especialidade: doc.especialidade,
    status: doc.status,
    risco: doc.risco,
    nivelRisco: doc.nivelRisco,
    espera: doc.espera,
    fila: doc.fila,
    agendamento: doc.agendamento || null,
    observacaoAtendimento: doc.observacaoAtendimento || '',
    historico: (doc.historico || []).map((h) => ({
      data: h.data,
      evento: h.evento,
    })),
    criadoEm: doc.criadoEm,
  };
}

async function criar({ dentista, especialidade, paciente, motivo, escore, achados, respostas }) {
  const risco = classificarRisco(escore);
  const agora = new Date();
  const doc = {
    protocolo: gerarProtocolo(),
    especialidade,
    paciente,
    motivo,
    escore,
    achados,
    respostas,
    risco: risco.titulo,
    nivelRisco: risco.nivel,
    espera: risco.espera,
    fila: risco.fila,
    status: 'NA_FILA',
    dentista: {
      id: dentista._id.toString(),
      nome: dentista.nome,
      cro: dentista.cro || '',
      ubs: dentista.ubs || '',
    },
    agendamento: null,
    observacaoAtendimento: '',
    historico: [
      {
        data: agora,
        evento: `Triagem realizada pelo(a) profissional ${dentista.nome} (${risco.titulo} — ${risco.fila}).`,
        autor: dentista.nome,
      },
    ],
    criadoEm: agora,
    atualizadoEm: agora,
  };
  const r = await collection().insertOne(doc);
  return { ...doc, _id: r.insertedId };
}

async function registrarEvento(id, evento, autor) {
  const { ObjectId } = require('mongodb');
  await collection().updateOne(
    { _id: new ObjectId(id) },
    {
      $push: { historico: { data: new Date(), evento, autor } },
      $set: { atualizadoEm: new Date() },
    }
  );
}

module.exports = {
  collection,
  criarIndices,
  criar,
  publico,
  publicoPaciente,
  registrarEvento,
  STATUS,
  classificarRisco,
};
