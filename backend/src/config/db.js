const { MongoClient, ServerApiVersion } = require('mongodb');

let client = null;
let db = null;

async function connect() {
  if (db) return db;

  const uri = process.env.MONGODB_URI;
  if (!uri || uri.includes('<db_password>')) {
    throw new Error('MONGODB_URI não configurada. Copie backend/.env.example para backend/.env e substitua <db_password> pela senha do usuário do Atlas.');
  }

  client = new MongoClient(uri, {
    serverApi: {
      version: ServerApiVersion.v1,
      strict: true,
      deprecationErrors: true,
    },
  });

  await client.connect();
  await client.db('admin').command({ ping: 1 });
  db = client.db(process.env.MONGODB_DB || 'sistematriagem');
  console.log('[db] Conectado ao MongoDB Atlas — banco:', db.databaseName);
  return db;
}

function getDb() {
  if (!db) throw new Error('Banco de dados ainda não conectado.');
  return db;
}

async function close() {
  if (client) await client.close();
}

module.exports = { connect, getDb, close };
