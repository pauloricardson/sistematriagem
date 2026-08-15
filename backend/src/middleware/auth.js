const jwt = require('jsonwebtoken');
const Usuario = require('../models/Usuario');

// Extrai e valida o token JWT do cabeçalho Authorization: Bearer <token>
async function autenticar(req, res, next) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return res.status(401).json({ erro: 'Não autenticado.' });

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await Usuario.buscarPorId(payload.sub);
    if (!user || !user.ativo) return res.status(401).json({ erro: 'Sessão inválida.' });
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ erro: 'Sessão expirada. Faça login novamente.' });
  }
}

// Restringe a rota a determinados papéis. Uso: exigirRole('admin')
function exigirRole(...papeis) {
  return (req, res, next) => {
    if (!papeis.includes(req.user.role)) {
      return res.status(403).json({ erro: 'Você não tem permissão para esta operação.' });
    }
    next();
  };
}

function gerarToken(user) {
  return jwt.sign(
    { sub: user._id.toString(), role: user.role, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: '8h' }
  );
}

module.exports = { autenticar, exigirRole, gerarToken };
