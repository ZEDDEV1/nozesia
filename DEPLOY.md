# 🚀 GUIA RÁPIDO DE DEPLOY - LUMUSAI.COM.BR

## Pré-requisitos no Servidor VPS

### 1. Instalações Necessárias

```bash
# Atualizar sistema
sudo apt update && sudo apt upgrade -y

# Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# PostgreSQL
sudo apt install -y postgresql postgresql-contrib

# Redis
sudo apt install -y redis-server
sudo systemctl enable redis-server
sudo systemctl start redis-server

# PM2 (gerenciador de processos)
sudo npm install -g pm2

# Dependências do Puppeteer (para WPPConnect)
sudo apt install -y gconf-service libasound2 libatk1.0-0 libc6 libcairo2 \
libcups2 libdbus-1-3 libexpat1 libfontconfig1 libgcc1 libgconf-2-4 \
libgdk-pixbuf2.0-0 libglib2.0-0 libgtk-3-0 libnspr4 libpango-1.0-0 \
libpangocairo-1.0-0 libstdc++6 libx11-6 libx11-xcb1 libxcb1 libxcomposite1 \
libxcursor1 libxdamage1 libxext6 libxfixes3 libxi6 libxrandr2 libxrender1 \
libxss1 libxtst6 ca-certificates fonts-liberation libappindicator1 \
libnss3 lsb-release xdg-utils wget
```

---

## 📋 PASSOS DO DEPLOY

### PASSO 1: Configurar Banco de Dados

```bash
# Criar banco e usuário
sudo -u postgres psql

# No prompt do PostgreSQL:
CREATE DATABASE lumusai_db;
CREATE USER lumusai_user WITH ENCRYPTED PASSWORD 'SUA_SENHA_FORTE_AQUI';
GRANT ALL PRIVILEGES ON DATABASE lumusai_db TO lumusai_user;
\c lumusai_db
GRANT ALL ON SCHEMA public TO lumusai_user;
\q
```

### PASSO 2: Configurar DNS

No painel do seu domínio (Registro.br ou onde está registrado):
- Tipo: **A**
- Nome: **@**
- Valor: **IP_DO_SEU_VPS**
- TTL: **3600**

Aguarde propagação (pode levar até 24h, mas geralmente é rápido).

### PASSO 3: Configurar Site no CloudPanel

1. Acessar CloudPanel → Sites → Add Site
2. **Domain Name**: `lumusai.com.br`
3. **Site Type**: Node.js (ou Generic)
4. **SSL**: Enable Let's Encrypt
5. Criar o site

### PASSO 4: Upload dos Arquivos

Via SSH ou FTP, fazer upload de todo o projeto para:
```
/home/lumusai/htdocs/lumusai.com.br
```

Ou clonar via Git:
```bash
cd /home/lumusai/htdocs/lumusai.com.br
git clone https://github.com/SEU_USUARIO/SEU_REPO.git .
```

### PASSO 5: Configurar Variáveis de Ambiente

```bash
cd /home/lumusai/htdocs/lumusai.com.br
cp .env.production .env
nano .env
```

**IMPORTANTE - ALTERAR:**
1. `NEXTAUTH_SECRET` - Gerar novo:
   ```bash
   openssl rand -base64 32
   ```

2. `DATABASE_URL` - Usar senha criada no Passo 1:
   ```
   postgresql://lumusai_user:SUA_SENHA@localhost:5432/lumusai_db
   ```

3. `MERCADOPAGO_ACCESS_TOKEN` e `MERCADOPAGO_PUBLIC_KEY`:
   - Acessar https://www.mercadopago.com.br/developers/panel/app
   - Trocar credenciais **TEST** por **PRODUÇÃO**

4. `GOOGLE_REDIRECT_URI`:
   - Acessar https://console.cloud.google.com/apis/credentials
   - Adicionar URI autorizada: `https://lumusai.com.br/api/calendar/callback`

5. `WPPCONNECT_SECRET` - Criar senha forte

Salvar com `Ctrl+O`, `Enter`, `Ctrl+X`

### PASSO 6: Executar Setup Inicial

```bash
cd /home/lumusai/htdocs/lumusai.com.br

# Dar permissão de execução
chmod +x setup-production.sh

# Executar setup
./setup-production.sh
```

Este script vai:
- ✅ Verificar dependências
- ✅ Instalar pacotes NPM
- ✅ Gerar Prisma Client
- ✅ Executar migrations do banco
- ✅ Fazer build da aplicação
- ✅ Iniciar processos com PM2

### PASSO 7: Configurar Nginx no CloudPanel

1. Acessar CloudPanel → Sites → lumusai.com.br
2. Ir em "Vhost" ou "Nginx Settings"
3. Adicionar configuração de proxy:

```nginx
# Proxy para Next.js
location / {
    proxy_pass http://localhost:3000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_connect_timeout 60s;
    proxy_send_timeout 60s;
    proxy_read_timeout 60s;
}

# WebSocket (Socket.io)
location /socket.io/ {
    proxy_pass http://localhost:3000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_connect_timeout 7d;
    proxy_send_timeout 7d;
    proxy_read_timeout 7d;
}
```

4. Salvar e recarregar Nginx

### PASSO 8: Configurar PM2 Auto-start

```bash
# Executar comando gerado pelo setup-production.sh
pm2 startup
# Copiar e executar o comando sugerido (algo como):
# sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u lumusai --hp /home/lumusai

# Salvar processos atuais
pm2 save
```

### PASSO 9: Verificação

```bash
# Verificar processos PM2
pm2 status

# Ver logs
pm2 logs

# Testar API localmente
curl http://localhost:3000/api/health

# Testar pelo domínio
curl https://lumusai.com.br/api/health
```

### PASSO 10: Testes Finais

1. **Acessar site**: https://lumusai.com.br
2. **Criar conta**: Testar registro
3. **Login**: Testar autenticação
4. **WhatsApp**: Conectar número e testar mensagens
5. **Real-time**: Verificar se mensagens aparecem instantaneamente

---

## 🔄 DEPLOY DE ATUALIZAÇÕES

Após o setup inicial, para fazer deploy de novas versões:

```bash
cd /home/lumusai/htdocs/lumusai.com.br
./deploy.sh
```

Ou manualmente:
```bash
git pull origin main
npm ci
npm run build
npx prisma migrate deploy
pm2 restart ecosystem.config.js
```

---

## 📊 COMANDOS ÚTEIS

```bash
# Ver status dos processos
pm2 status

# Ver logs em tempo real
pm2 logs

# Ver log de um processo específico
pm2 logs lumusai-app
pm2 logs lumusai-worker
pm2 logs lumusai-wpp

# Reiniciar processo específico
pm2 restart lumusai-app

# Reiniciar todos
pm2 restart all

# Parar todos
pm2 stop all

# Ver informações detalhadas
pm2 info lumusai-app

# Monitorar recursos
pm2 monit
```

---

## 🔒 SEGURANÇA

### Firewall
```bash
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw enable
```

### Backup Automático do Banco

Criar script:
```bash
nano ~/backup-db.sh
```

Conteúdo:
```bash
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
pg_dump -U lumusai_user lumusai_db | gzip > ~/backups/db_$DATE.sql.gz
find ~/backups -name "db_*.sql.gz" -mtime +7 -delete
```

Agendar no cron (todo dia às 3h):
```bash
chmod +x ~/backup-db.sh
crontab -e
# Adicionar:
0 3 * * * ~/backup-db.sh
```

---

## ❗ TROUBLESHOOTING

### Site retorna 502 Bad Gateway
```bash
pm2 status
pm2 restart lumusai-app
pm2 logs lumusai-app
```

### WhatsApp não conecta
```bash
pm2 restart lumusai-wpp
pm2 logs lumusai-wpp
```

### Mensagens não são processadas
```bash
redis-cli ping  # Deve retornar PONG
pm2 restart lumusai-worker
pm2 logs lumusai-worker
```

### Erro de memória
```bash
# Aumentar limite no ecosystem.config.js
# max_memory_restart: '2G'
pm2 restart ecosystem.config.js
```

---

## 📞 SUPORTE

- **Logs de erro**: `/home/lumusai/htdocs/lumusai.com.br/logs/`
- **PM2 logs**: `pm2 logs`
- **Nginx logs**: `/var/log/nginx/`
- **PostgreSQL logs**: `/var/log/postgresql/`

---

✅ **Deploy Completo!** Acesse: https://lumusai.com.br
