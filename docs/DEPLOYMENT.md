# StoryChef Deployment Guide

## Production Deployment

### Option 1: VPS/Cloud Server (Recommended)

**1. Server Setup (Ubuntu/Debian)**

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install Python 3.8+
sudo apt install python3 python3-pip -y

# Install PM2 for process management
sudo npm install -g pm2

# Clone your repository
git clone https://github.com/saleemh/storychef.git
cd storychef

# Install dependencies
npm install
pip3 install -r requirements.txt
```

**2. Environment Configuration**

```bash
# Create production environment file
cat > .env << EOF
NODE_ENV=production
OPENAI_API_KEY=your-openai-api-key-here
ANTHROPIC_API_KEY=your-anthropic-key-here
PORT=3000
HOST=0.0.0.0
EOF

# Set environment variables
source .env
```

**3. Production Configuration**

Create `story-chef.production.json`:

```json
{
  "aiModel": {
    "provider": "openai",
    "model": "gpt-4o-mini",
    "temperature": 0.8,
    "maxTokens": 300
  },
  "server": {
    "port": 3000,
    "maxPlayers": 100,
    "maxConcurrentSessions": 50,
    "logLevel": "info",
    "aiRequestQueue": {
      "maxConcurrent": 5,
      "timeout": 30000
    }
  },
  "webFrontend": {
    "enabled": true,
    "port": 3001
  },
  "competition": {
    "enabled": true,
    "difficulty": "medium"
  }
}
```

**4. Start with PM2**

```bash
# Create PM2 ecosystem file
cat > ecosystem.config.js << EOF
module.exports = {
  apps: [{
    name: 'storychef-server',
    script: 'src/cli.js',
    args: 'server --config story-chef.production.json',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: './logs/pm2-error.log',
    out_file: './logs/pm2-out.log',
    log_file: './logs/pm2-combined.log',
    time: true
  }]
};
EOF

# Start with PM2
pm2 start ecosystem.config.js

# Save PM2 configuration
pm2 save

# Setup PM2 to start on system boot
pm2 startup
```

**5. Nginx Reverse Proxy (Optional)**

```nginx
# /etc/nginx/sites-available/storychef
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # WebSocket support for Socket.io
    location /socket.io/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Enable the site:
```bash
sudo ln -s /etc/nginx/sites-available/storychef /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### Option 2: Docker Deployment

**1. Create Dockerfile**

```dockerfile
# Dockerfile
FROM node:18-alpine

# Install Python
RUN apk add --no-cache python3 py3-pip

WORKDIR /app

# Copy package files
COPY package*.json requirements.txt ./

# Install dependencies
RUN npm ci --only=production
RUN pip3 install -r requirements.txt

# Copy application code
COPY . .

# Create directories
RUN mkdir -p logs exports data

EXPOSE 3000 3001

CMD ["node", "src/cli.js", "server", "--config", "story-chef.production.json"]
```

**2. Docker Compose**

```yaml
# docker-compose.yml
version: '3.8'

services:
  storychef:
    build: .
    ports:
      - "3000:3000"
      - "3001:3001"
    environment:
      - NODE_ENV=production
      - OPENAI_API_KEY=${OPENAI_API_KEY}
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
    volumes:
      - ./logs:/app/logs
      - ./exports:/app/exports
      - ./data:/app/data
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "node", "src/cli.js", "test"]
      interval: 30s
      timeout: 10s
      retries: 3

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/nginx/ssl
    depends_on:
      - storychef
    restart: unless-stopped
```

**3. Deploy with Docker**

```bash
# Build and start
docker-compose up -d

# View logs
docker-compose logs -f storychef

# Scale if needed
docker-compose up -d --scale storychef=2
```

## Security Configuration

### 1. API Key Security

```bash
# Use environment variables, never commit keys
export OPENAI_API_KEY="sk-..."
export ANTHROPIC_API_KEY="sk-ant-..."

# Use PM2 secrets (recommended)
pm2 set pm2:sysmonit true
```

### 2. Rate Limiting

```json
{
  "server": {
    "aiRequestQueue": {
      "maxConcurrent": 3,
      "timeout": 20000
    },
    "maxConcurrentSessions": 20
  }
}
```

### 3. Firewall Configuration

```bash
# UFW firewall setup
sudo ufw allow ssh
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 3000/tcp  # Only if not using nginx proxy
sudo ufw --force enable
```

## Monitoring & Maintenance

### 1. Health Checks

```bash
# Add to crontab
*/5 * * * * curl -f http://localhost:3000/health || systemctl restart storychef
```

### 2. Log Management

```bash
# Rotate logs with PM2
pm2 install pm2-logrotate

# Configure log rotation
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 30
```

### 3. Backup Strategy

```bash
# Backup script
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
tar -czf /backups/storychef_$DATE.tar.gz \
    /app/data \
    /app/exports \
    /app/logs \
    /app/story-chef.production.json
```

## Testing Production Deployment

### 1. Smoke Tests

```bash
# Test server is running
curl http://your-domain.com/health

# Test WebSocket connection
node src/cli.js test --server ws://your-domain.com

# Test story creation
node src/cli.js create --server ws://your-domain.com --name "TestUser"
```

### 2. Load Testing

```bash
# Install artillery for load testing
npm install -g artillery

# Create artillery config
cat > load-test.yml << EOF
config:
  target: 'ws://your-domain.com'
  phases:
    - duration: 60
      arrivalRate: 5
scenarios:
  - name: "Create sessions"
    weight: 100
    engine: ws
EOF

# Run load test
artillery run load-test.yml
```

## Scaling Considerations

### 1. Horizontal Scaling

- Use Redis for session storage: `npm install redis`
- Load balance multiple instances with nginx
- Use sticky sessions for Socket.io

### 2. Database Upgrade

For production, consider upgrading from SQLite to PostgreSQL:

```bash
npm install pg
# Update src/server/globalLeaderboard.js
```

### 3. AI Cost Management

- Set up billing alerts with your AI provider
- Implement request caching for repeated prompts
- Use cheaper models (gpt-4o-mini) for high-volume scenarios

## Troubleshooting Production

### Common Issues

**1. Out of Memory**
```bash
# Increase PM2 memory limit
pm2 start ecosystem.config.js --max-memory-restart 2G
```

**2. Socket.io Connection Issues**
```bash
# Check nginx WebSocket configuration
# Ensure sticky sessions are enabled
```

**3. AI Rate Limits**
```bash
# Reduce concurrent requests
{
  "server": {
    "aiRequestQueue": {
      "maxConcurrent": 1
    }
  }
}
```

**4. High CPU Usage**
```bash
# Profile the application
node --prof src/cli.js server
```