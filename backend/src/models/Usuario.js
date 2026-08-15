const { getDb } = require('../config/db');
const bcrypt = require('bcryptjs');

// Papéis: 'admin' (Centro de Especialidades) e 'dentista' (UBS)
// statusSenha: 'pendente' (cadastro feito pelo centro, nunca acessou)
//              'ativa'    (definiu/redefiniu senha)
function collection() {
  return getDb().collection('usuarios');
}

async function criarIndices() {
  await collection().createIndex({ email: 1 }, { unique: true });
  await collection().createIndex({ cro: 1 }, { unique: true, sparse: true });
}

function publico(user) {
  if (!user) return null;
  return {
    id: user._id.toString(),
    nome: user.nome,
    email: user.email,
    role: user.role,
    cro: user.cro || '',
    cpf: user.cpf || '',
    telefone: user.telefone || '',
    endereco: user.endereco || '',
    ubs: user.ubs || '',
    statusSenha: user.statusSenha,
    ativo: user.ativo,
    criadoEm: user.criadoEm,
  };
}

async function buscarPorEmail(email) {
  return collection().findOne({ email: (email || '').trim().toLowerCase() });
}

async function buscarPorId(id) {
  const { ObjectId } = require('mongodb');
  if (!ObjectId.isValid(id)) return null;
  return collection().findOne({ _id: new ObjectId(id) });
}

async function criar(usuario) {
  const doc = {
    nome: usuario.nome.trim(),
    email: usuario.email.trim().toLowerCase(),
    senhaHash: usuario.senhaHash || null,
    statusSenha: usuario.senhaHash ? 'ativa' : 'pendente',
    role: usuario.role || 'dentista',
    cro: (usuario.cro || '').trim(),
    cpf: (usuario.cpf || '').trim(),
    telefone: (usuario.telefone || '').trim(),
    endereco: (usuario.endereco || '').trim(),
    ubs: (usuario.ubs || '').trim(),
    ativo: true,
    criadoEm: new Date(),
    atualizadoEm: new Date(),
  };
  const r = await collection().insertOne(doc);
  return { ...doc, _id: r.insertedId };
}

async function definirSenha(userId, senha) {
  const senhaHash = await bcrypt.hash(senha, 10);
  await collection().updateOne(
    { _id: userId },
    { $set: { senhaHash, statusSenha: 'ativa', atualizadoEm: new Date() } }
  );
}

async function compararSenha(user, senha) {
  if (!user.senhaHash) return false;
  return bcrypt.compare(senha, user.senhaHash);
}

module.exports = {
  collection,
  criarIndices,
  publico,
  buscarPorEmail,
  buscarPorId,
  criar,
  definirSenha,
  compararSenha,
};
