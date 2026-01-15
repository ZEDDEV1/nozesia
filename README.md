# NozesIA

Sistema de Atendimento Inteligente com IA para Loja de Roupas.

## 🚀 Quick Start

### 1. Instale as dependências

```bash
npm install
```

### 2. Configure o ambiente

```bash
cp .env.example .env
# Edite .env com suas credenciais
```

### 3. Inicie o banco de dados

```bash
docker-compose up -d
npx prisma migrate dev
npx prisma db seed
```

### 4. Rode a aplicação

```bash
npm run dev
```

Acesse http://localhost:3000

---

## 📋 Scripts Disponíveis

| Comando | Descrição |
|---------|-----------|
| `npm run dev` | Inicia servidor de desenvolvimento |
| `npm run build` | Build de produção |
| `npm run start` | Inicia servidor de produção |
| `npm run worker` | Inicia worker de mensagens |
| `npm run test` | Executa testes |

---

## 🔧 Variáveis de Ambiente

Copie `.env.example` para `.env` e configure:

**Obrigatórias:**
- `DATABASE_URL` - PostgreSQL connection string
- `NEXTAUTH_SECRET` - JWT secret (min 32 chars)
- `NEXT_PUBLIC_APP_URL` - URL da aplicação (https://nozesia.com)
- `OPENAI_API_KEY` - Chave da OpenAI

**WhatsApp:**
- `WPPCONNECT_URL` - URL do servidor WPPConnect
- `WPPCONNECT_SECRET` - Secret do WPPConnect

---

## 🏗️ Arquitetura

```
src/
├── app/           # Next.js App Router
│   ├── api/       # API Routes
│   ├── dashboard/ # Área do administrador
│   └── admin/     # Painel de controle
├── components/    # Componentes React
└── lib/           # Utilitários e serviços
```

### Stack

- **Frontend**: Next.js 15, React 19, TailwindCSS
- **Backend**: Next.js API Routes, Prisma ORM
- **Database**: PostgreSQL
- **Cache**: Redis
- **AI**: OpenAI GPT-4
- **WhatsApp**: WPPConnect

---

## 📄 License

Proprietary - NozesIA
