const { getDb } = require('../config/db');
const crypto = require('crypto');

// Tokens de primeiro acesso / redefinição de senha. Expiram em 2 horas.
const EXPIRACAO_MS = 2 * 60 * 60 * 1000;

function collection() {
  return getDb().collection('tokens_senha');
}

async function criarIndices() {
  await collection().createIndex({ expiraEm: 1 }, { expireAfterSeconds: 0 });
}

async function gerarToken(userId) {
  // Invalida tokens anteriores do mesmo usuário
  await collection().deleteMany({ userId });
  const token = crypto.randomBytes(32).toString('hex');
  await collection().insertOne({
    userId,
    token,
    expiraEm: new Date(Date.now() + EXPIRACAO_MS),
    usado: false,
  });
  return token;
}

async function validarToken(token) {
  const doc = await collection().findOne({ token });
  if (!doc || doc.usado || doc.expiraEm < new Date()) return null;
  return doc;
}

async function consumirToken(token) {
  await collection().updateOne({ token }, { $set: { usado: true } });
}

module.exports = { criarIndices, gerarToken, validarToken, consumirToken };
