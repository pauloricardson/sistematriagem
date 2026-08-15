// Criação manual do administrador (opcional — o servidor também cria
// automaticamente na primeira inicialização usando ADMIN_EMAIL/ADMIN_SENHA).
// Uso: npm run seed:admin -- novoemail@centro.local NovaSenha@123
require('dotenv').config();
const db = require('../config/db');
const Usuario = require('../models/Usuario');

async function main() {
  await db.connect();
  await Usuario.criarIndices();

  const email = process.argv[2] || process.env.ADMIN_EMAIL || 'admin@centro.local';
  const senha = process.argv[3] || process.env.ADMIN_SENHA || 'Trocar@123';

  if (await Usuario.buscarPorEmail(email)) {
    console.log('Já existe um usuário com este e-mail. Nada feito.');
    await db.close();
    return;
  }

  const bcrypt = require('bcryptjs');
  await Usuario.collection().insertOne({
    nome: 'Administrador do Centro de Especialidades',
    email: email.toLowerCase(),
    senhaHash: await bcrypt.hash(senha, 10),
    statusSenha: 'ativa',
    role: 'admin',
    cro: '', cpf: '', telefone: '', endereco: '', ubs: '',
    ativo: true,
    criadoEm: new Date(),
    atualizadoEm: new Date(),
  });

  console.log(`Admin criado: ${email} / ${senha}`);
  await db.close();
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
