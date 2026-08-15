require('dotenv').config();
const express = require('express');
const cors = require('cors');
const db = require('./config/db');
const Usuario = require('./models/Usuario');
const Triagem = require('./models/Triagem');
const TokenSenha = require('./models/TokenSenha');

const authRoutes = require('./routes/auth');
const profissionaisRoutes = require('./routes/profissionais');
const { router: triagensRoutes, ESPECIALIDADES } = require('./routes/triagens');
const publicaRoutes = require('./routes/publica');

async function criarAdminInicial() {
  const existe = await Usuario.collection().findOne({ role: 'admin' });
  if (existe) return;

  const email = (process.env.ADMIN_EMAIL || 'admin@centro.local').toLowerCase();
  const senha = process.env.ADMIN_SENHA || 'Trocar@123';
  const bcrypt = require('bcryptjs');

  await Usuario.collection().insertOne({
    nome: process.env.ADMIN_NOME || 'Administrador do Centro de Especialidades',
    email,
    senhaHash: await bcrypt.hash(senha, 10),
    statusSenha: 'ativa',
    role: 'admin',
    cro: '',
    cpf: '',
    telefone: '',
    endereco: '',
    ubs: '',
    ativo: true,
    criadoEm: new Date(),
    atualizadoEm: new Date(),
  });

  console.log('==========================================================');
  console.log('[seed] Primeiro administrador criado:');
  console.log(`[seed]   E-mail: ${email}`);
  console.log(`[seed]   Senha:  ${senha}`);
  console.log('[seed] Faça login e altere esta senha o quanto antes.');
  console.log('==========================================================');
}

async function start() {
  await db.connect();
  await Usuario.criarIndices();
  await Triagem.criarIndices();
  await TokenSenha.criarIndices();
  await criarAdminInicial();

  const app = express();

  // CORS: permite o frontend do GitHub Pages e chamadas locais de teste
  const origens = [
    process.env.FRONTEND_URL,
    'http://localhost:5500',
    'http://127.0.0.1:5500',
  ].filter(Boolean);
  app.use(cors({ origin: true }));
  app.use(express.json({ limit: '1mb' }));

  // Pequena proteção contra sobrecarga: máx. 60 requisições/min por IP
  const visitas = new Map();
  app.use((req, res, next) => {
    const chave = req.ip || 'x';
    const agora = Date.now();
    const lista = (visitas.get(chave) || []).filter((t) => agora - t < 60000);
    if (lista.length >= 60 && !req.path.startsWith('/api/publica')) {
      return res.status(429).json({ erro: 'Muitas requisições. Aguarde um momento.' });
    }
    lista.push(agora);
    visitas.set(chave, lista);
    next();
  });

  app.get('/', (req, res) => res.json({ status: 'ok', servico: 'API Sistema de Triagem' }));
  app.get('/api/especialidades', (req, res) => res.json({ especialidades: ESPECIALIDADES }));

  app.use('/api/auth', authRoutes);
  app.use('/api/profissionais', profissionaisRoutes);
  app.use('/api/triagens', triagensRoutes);
  app.use('/api/publica', publicaRoutes);

  app.use((req, res) => res.status(404).json({ erro: 'Rota não encontrada.' }));

  const porta = process.env.PORT || 3000;
  app.listen(porta, () => {
    console.log(`[server] API rodando na porta ${porta}`);
    console.log('[server] Frontend configurado:', process.env.FRONTEND_URL || '(não definido)');
  });
}

start().catch((e) => {
  console.error('[server] Falha ao iniciar:', e.message);
  process.exit(1);
});
