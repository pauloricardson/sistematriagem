# Sistema de Triagem e Encaminhamento Odontológico

Sistema profissional para triagem de risco odontológico com encaminhamento de pacientes das UBS para o Centro de Especialidades, com controle de acesso por perfil, acompanhamento pelo paciente e persistência em **MongoDB Atlas**.

## Perfis e o que cada um faz

| Perfil | Acesso | Funções |
|---|---|---|
| **Centro de Especialidades** (admin) | E-mail + senha | Cadastra/edita/inativa dentistas (sem definir senha), vê a fila completa, agenda atendimentos, registra comparecimento, cancela e reabre processos |
| **Dentista / UBS** | E-mail + senha | Faz a triagem (20 perguntas), encaminha pacientes, vê e gerencia seus encaminhamentos, retira paciente da fila |
| **Paciente** | Sem login | Consulta o andamento do processo com **CPF + data de nascimento** |

## Arquitetura

```
┌─────────────────────┐         HTTPS          ┌──────────────────────┐        ┌────────────────┐
│  FRONTEND (GitHub   │ ─────────────────────► │  BACKEND (Node.js +  │ ─────► │ MongoDB Atlas  │
│  Pages — estático)  │   fetch /api/...       │  Express + JWT)      │        │ (cluster seu)  │
└─────────────────────┘                        └──────────────────────┘        └────────────────┘
```

> **Importante:** o GitHub Pages **só hospeda arquivos estáticos** — ele não executa Node.js.
> Por isso o sistema é dividido em duas partes:
> - `frontend/` → publica no **GitHub Pages** (grátis)
> - `backend/` → publica em um serviço que executa Node.js, ex.: **Render** (grátis), Railway ou Fly.io

## Estrutura do projeto

```
sistematriagem/
├── backend/                 # API Node.js (Express + MongoDB)
│   ├── .env.example         # modelo de configuração (copiar para .env)
│   ├── package.json
│   └── src/
│       ├── server.js        # servidor principal
│       ├── config/db.js     # conexão com MongoDB Atlas
│       ├── models/          # Usuario, Triagem, TokenSenha
│       ├── routes/          # auth, profissionais, triagens, publica
│       ├── middleware/      # autenticação JWT
│       ├── seed/            # criação do administrador
│       └── utils/mailer.js  # envio de e-mail (redefinição de senha)
└── frontend/                # site estático (GitHub Pages)
    ├── index.html
    ├── css/style.css
    └── js/ (config, api, app, dentista, centro, comum)
```

## Banco de dados (MongoDB Atlas)

O banco `sistematriagem` (criado automaticamente na 1ª execução) tem 3 coleções:

**`usuarios`** — profissionais e administradores:
`nome, email (único), senhaHash (bcrypt), statusSenha (pendente|ativa), role (admin|dentista), cro (único), cpf, telefone, endereco, ubs, ativo, criadoEm`

**`triagens`** — cada encaminhamento:
`protocolo (único, ex: TRG-AB12-3456), especialidade, paciente {nome, cpf, nascimento, telefone, endereco, acs}, motivo, escore, risco, nivelRisco, espera, fila, status (NA_FILA | AGENDADO | ATENDIDO | NAO_COMPARECEU | CANCELADO), respostas[20], achados[], dentista {id, nome, cro, ubs}, agendamento {data, hora, agendadoPor}, observacaoAtendimento, historico[] (linha do tempo), criadoEm`

**`tokens_senha`** — links de primeiro acesso/redefinição (expiram em 2h e são apagados automaticamente pelo MongoDB).

## Como rodar (desenvolvimento)

1. Instale **Node.js 18.7 ou superior** (https://nodejs.org)
2. Backend:
   ```bash
   cd backend
   npm install
   copy .env.example .env    # (Windows) — ou: cp .env.example .env
   # edite o .env (veja abaixo)
   npm start
   ```
   Na primeira execução o administrador inicial é criado automaticamente com
   `ADMIN_EMAIL` / `ADMIN_SENHA` do `.env` (o login aparece no console).
3. Frontend: abra `frontend/index.html` via Live Server do VS Code, ou publique direto (abaixo). Em `frontend/js/config.js` coloque `http://localhost:3000/api` para testar localmente.

## Configuração do backend (.env)

Copie `backend/.env.example` para `backend/.env` e preencha:

| Variável | O que é |
|---|---|
| `MONGODB_URI` | Sua string do Atlas — **troque `<db_password>` pela senha do usuário do banco** |
| `MONGODB_DB` | Nome do banco (padrão: `sistematriagem`) |
| `JWT_SECRET` | Chave aleatória longa para os tokens de sessão |
| `FRONTEND_URL` | URL do site no GitHub Pages (usada nos links de e-mail e CORS) |
| `ADMIN_EMAIL` / `ADMIN_SENHA` / `ADMIN_NOME` | Primeiro administrador (criado só na 1ª execução) |
| `SMTP_*` | Servidor de e-mail para enviar links de senha. **Se ficar em branco, o link aparece no console do servidor** (útil para testar) |

### Enviando e-mails de verdade (Gmail como exemplo)
1. Ative a verificação em 2 etapas na conta Google e crie uma **Senha de App** (https://myaccount.google.com/apppasswords)
2. No `.env`:
   ```
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USER=seuemail@gmail.com
   SMTP_PASS=senha-de-app-de-16-letras
   ```

## Publicação

### Backend no Render (grátis)
1. Suba o projeto para um repositório GitHub
2. Em https://render.com → **New Web Service** → conecte o repositório
3. Configuração: **Root Directory** = `backend`, **Build** = `npm install`, **Start** = `npm start`
4. Em **Environment**, cadastre as mesmas variáveis do `.env` (MONGODB_URI, JWT_SECRET, FRONTEND_URL, SMTP_*, ADMIN_*)
5. O Render entregará uma URL tipo `https://sistematriagem-api.onrender.com`

### Frontend no GitHub Pages
1. No repositório: **Settings → Pages → Branch: main, Folder: /frontend**
2. Antes, edite `frontend/js/config.js` e coloque a URL da API:
   ```js
   const CONFIG = { API_URL: 'https://sistematriagem-api.onrender.com/api' };
   ```
3. O site ficará em `https://SEU-USUARIO.github.io/NOME-DO-REPO/`

### MongoDB Atlas — libere o acesso
No painel do Atlas: **Network Access → Add IP Address → Allow access from anywhere (0.0.0.0/0)** — necessário porque o Render usa IPs dinâmicos.

## Fluxo do sistema

1. **Centro** entra → aba *Profissionais* → cadastra o dentista (nome, CPF, CRO, endereço, e-mail, UBS...) **sem senha**
2. **Dentista** entra no site → *Primeiro acesso* → informa o e-mail → recebe link → define a senha
3. **Dentista** faz *Nova Triagem*: especialidade → dados do paciente → 20 perguntas (mesmas do sistema original) → escore e classificação (EMERGÊNCIA/Fila 1 ... NÃO URGENTE/Fila 5) → salva
4. **Centro** vê a fila completa, filtra por status/especialidade/fila/paciente, **agenda** (data + hora) e no dia marca **compareceu / não compareceu**; pode cancelar ou reabrir processos
5. **Dentista** acompanha seus encaminhamentos e pode **retirar o paciente da fila** (com motivo, registrado no histórico)
6. **Paciente** consulta de casa: CPF + data de nascimento → vê situação atual, agendamento e toda a linha do tempo do processo (e dos processos anteriores)

## Segurança implementada
- Senhas com hash **bcrypt** (nunca ficam em texto puro)
- Sessões com **JWT** (expiram em 8h) e controle de permissão por perfil em cada rota
- Links de senha **expiram em 2 horas**, são de uso único e não revelam se um e-mail existe
- O paciente só vê os dados do próprio processo (nunca dados do profissional ou de outros pacientes)
- `frontend/js/config.js` e `backend/.env` são as ÚNICAS coisas a editar — nenhum segredo vai para o GitHub (o `.env` está no `.gitignore`)
