// Perguntas de triagem e classificação de risco (mantidas do sistema original)
const PERGUNTAS = [
  { bloco: 'Bloco 1 - Angina e Sepse', texto: 'Quadro compatível com Angina de Ludwig?', pontos: 64 },
  { bloco: 'Bloco 1 - Angina e Sepse', texto: 'Risco ou sinais e sintomas de Sepse?', pontos: 64 },
  { bloco: 'Bloco 2 - Neoplasias e Infecções', texto: 'Celulite ou abscessos extraorais com ou sem fístula?', pontos: 32 },
  { bloco: 'Bloco 2 - Neoplasias e Infecções', texto: 'Possui alguma fratura nos ossos da face?', pontos: 32 },
  { bloco: 'Bloco 2 - Neoplasias e Infecções', texto: 'Há suspeita de malignidade?', pontos: 32 },
  { bloco: 'Bloco 3 - Riscos sistêmicos', texto: 'É paciente transplantado? (Coração, fígado, rim, pulmão ou medula)', pontos: 16 },
  { bloco: 'Bloco 3 - Riscos sistêmicos', texto: 'Teve AVC ou infarto nos últimos 6 meses?', pontos: 16 },
  { bloco: 'Bloco 3 - Riscos sistêmicos', texto: 'Tem ou teve câncer nos últimos 5 anos?', pontos: 16 },
  { bloco: 'Bloco 3 - Riscos sistêmicos', texto: 'Faz hemodiálise?', pontos: 16 },
  { bloco: 'Bloco 3 - Riscos sistêmicos', texto: 'É paciente hemofílico ou possui alguma doença autoimune?', pontos: 16 },
  { bloco: 'Bloco 4 - Dor percebida', texto: 'O objetivo do encaminhamento envolve molar inferior?', pontos: 8 },
  { bloco: 'Bloco 4 - Dor percebida', texto: 'Exibe abscesso intraoral com ou sem fístula?', pontos: 8 },
  { bloco: 'Bloco 4 - Dor percebida', texto: 'Sente dor ao beber água, comer ou mastigar?', pontos: 8 },
  { bloco: 'Bloco 4 - Dor percebida', texto: 'Sente dor na articulação têmporo-mandibular?', pontos: 8 },
  { bloco: 'Bloco 5 - Limitações', texto: 'Sente dificuldade de se alimentar, engolir ou beber água?', pontos: 4 },
  { bloco: 'Bloco 5 - Limitações', texto: 'Se sente envergonhado ou evita sorrir?', pontos: 4 },
  { bloco: 'Bloco 5 - Limitações', texto: 'Esta condição dificulta ou atrapalha o seu sono?', pontos: 4 },
  { bloco: 'Bloco 6 - Doenças crônicas', texto: 'É hipertenso ou cardiopata? (Controlado ou não)', pontos: 2 },
  { bloco: 'Bloco 6 - Doenças crônicas', texto: 'É diabético? (Controlado ou não)', pontos: 2 },
  { bloco: 'Bloco 6 - Doenças crônicas', texto: 'Possui algum tipo de deficiência?', pontos: 2 },
];

const ESPECIALIDADES = [
  'Endodontia', 'Cirurgia Bucomaxilofacial', 'Periodontia', 'Odontopediatria',
  'Pacientes Especiais', 'Prótese / Dentística', 'Estomatologia (Lesões)',
  'Ortodontia', 'Outros',
];

function classificarRisco(escore) {
  if (escore >= 64) return { cor: '#e74c3c', texto: '#ffffff', titulo: 'EMERGÊNCIA', nivel: 'Risco Altíssimo', espera: 'Imediato a 24h', fila: 'Fila 1' };
  if (escore >= 32) return { cor: '#ff9900', texto: '#000000', titulo: 'MUITO URGENTE', nivel: 'Risco Alto', espera: 'Até 7 dias', fila: 'Fila 2' };
  if (escore >= 16) return { cor: '#f1c40f', texto: '#000000', titulo: 'URGENTE', nivel: 'Risco Médio', espera: 'Até 30 dias', fila: 'Fila 3' };
  if (escore >= 4) return { cor: '#2ecc71', texto: '#000000', titulo: 'POUCO URGENTE', nivel: 'Risco Baixo', espera: 'Até 3 meses', fila: 'Fila 4' };
  return { cor: '#3498db', texto: '#000000', titulo: 'NÃO URGENTE', nivel: 'Sem risco', espera: 'Até 6 meses', fila: 'Fila 5' };
}

const STATUS_INFO = {
  NA_FILA: { rotulo: 'Aguardando agendamento', cor: '#f39c12' },
  AGENDADO: { rotulo: 'Agendado', cor: '#2980b9' },
  ATENDIDO: { rotulo: 'Atendido', cor: '#27ae60' },
  NAO_COMPARECEU: { rotulo: 'Não compareceu', cor: '#c0392b' },
  CANCELADO: { rotulo: 'Cancelado', cor: '#7f8c8d' },
};

function escaparHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[c]);
}

function formatarData(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d)) return String(iso);
  return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function dataBR(iso) {
  if (!iso) return '—';
  const p = String(iso).split('-');
  return p.length === 3 ? p.reverse().join('/') : String(iso);
}
