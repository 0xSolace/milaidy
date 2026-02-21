# Headscale Integration for ElizaCloud Containers

This document explains how to integrate Headscale private networking with ElizaCloud containers so the cloud-only frontend can connect directly to user containers.

## Why Headscale?

- **Private Network**: Containers get private IPs not exposed to the public internet
- **Secure Communication**: Direct connection between frontend and container without exposing APIs
- **No Firewall Config**: Works through NAT and firewalls
- **Alternative to Tailscale**: Self-hosted, open-source alternative

## Architecture

```
┌─────────────┐         ┌──────────────────┐
│  Browser    │────────▶│  milady.fun      │
│             │         │  (Vercel)        │
└─────────────┘         └──────────────────┘
                               │
                               ▼
                        ┌──────────────────┐
                        │  ElizaCloud API  │
                        │  (OAuth + Mgmt)  │
                        └──────────────────┘
                               │
                               ▼
                        ┌──────────────────┐
                        │  Headscale       │
                        │  Coordination    │
                        │  Server          │
                        └──────────────────┘
                               │
                ┌──────────────┴──────────────┐
                ▼                             ▼
         ┌─────────────┐              ┌─────────────┐
         │  Container  │◀────────────▶│  Container  │
         │  100.64.1.5 │ Private Net  │  100.64.1.6 │
         │  (User A)   │              │  (User B)   │
         └─────────────┘              └─────────────┘
```

## Setup Steps

### 1. Deploy Headscale Server

**Option A: Docker Compose** (Recommended)

```yaml
# docker-compose.yml
version: "3.8"
services:
  headscale:
    image: headscale/headscale:latest
    container_name: headscale
    restart: unless-stopped
    ports:
      - "8080:8080"  # HTTP API
      - "50443:50443"  # gRPC (optional)
    volumes:
      - ./headscale-config:/etc/headscale
      - ./headscale-data:/var/lib/headscale
    command: headscale serve
```

**Headscale Config** (`headscale-config/config.yaml`):

```yaml
server_url: https://headscale.yourdomain.com:443
listen_addr: 0.0.0.0:8080
metrics_listen_addr: 0.0.0.0:9090

private_key_path: /var/lib/headscale/private.key
noise:
  private_key_path: /var/lib/headscale/noise_private.key

ip_prefixes:
  - 100.64.0.0/10

derp:
  server:
    enabled: true
    region_id: 999
    region_code: "headscale"
    region_name: "Headscale Embedded DERP"
    stun_listen_addr: "0.0.0.0:3478"

database:
  type: sqlite3
  sqlite:
    path: /var/lib/headscale/db.sqlite

dns_config:
  nameservers:
    - 1.1.1.1
    - 8.8.8.8
  magic_dns: true
  base_domain: milaidy.local
```

Start server:
```bash
docker-compose up -d
```

**Option B: Binary Install**

```bash
# Download latest release
wget https://github.com/juanfont/headscale/releases/download/v0.23.0/headscale_0.23.0_linux_amd64

# Install
sudo mv headscale_0.23.0_linux_amd64 /usr/local/bin/headscale
sudo chmod +x /usr/local/bin/headscale

# Create config
sudo mkdir -p /etc/headscale
sudo headscale gen config > /etc/headscale/config.yaml

# Edit config (set server_url, etc.)
sudo nano /etc/headscale/config.yaml

# Run as service
sudo systemctl enable headscale
sudo systemctl start headscale
```

### 2. Create Headscale Namespace

Each user or container type gets a namespace:

```bash
# Create namespace for Milaidy containers
headscale namespaces create milaidy

# Verify
headscale namespaces list
```

### 3. Modify ElizaCloud Container Dockerfile

Add Tailscale client (compatible with Headscale) to container image:

```dockerfile
# Existing Dockerfile for ElizaCloud containers
FROM node:20-slim

# ... your existing setup ...

# Install Tailscale (Headscale-compatible client)
RUN apt-get update && \
    apt-get install -y curl gnupg lsb-release && \
    curl -fsSL https://pkgs.tailscale.com/stable/ubuntu/$(lsb_release -sc).noarmor.gpg | tee /usr/share/keyrings/tailscale-archive-keyring.gpg >/dev/null && \
    curl -fsSL https://pkgs.tailscale.com/stable/ubuntu/$(lsb_release -sc).tailscale-keyring.list | tee /etc/apt/sources.list.d/tailscale.list && \
    apt-get update && \
    apt-get install -y tailscale && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Add startup script
COPY scripts/container-init.sh /usr/local/bin/container-init.sh
RUN chmod +x /usr/local/bin/container-init.sh

# Start script runs both tailscale and your app
CMD ["/usr/local/bin/container-init.sh"]
```

### 4. Create Container Startup Script

**`scripts/container-init.sh`:**

```bash
#!/bin/bash
set -e

# Start Tailscale daemon in background
tailscaled --tun=userspace-networking --socket=/var/run/tailscale/tailscaled.sock &

# Wait for tailscaled to be ready
sleep 2

# Connect to Headscale
if [ -n "$HEADSCALE_URL" ] && [ -n "$HEADSCALE_AUTH_KEY" ]; then
  echo "Connecting to Headscale network..."
  tailscale up \
    --login-server="$HEADSCALE_URL" \
    --authkey="$HEADSCALE_AUTH_KEY" \
    --hostname="milaidy-$CONTAINER_ID" \
    --accept-routes \
    --accept-dns=false
  
  # Wait for IP assignment
  sleep 3
  
  # Get assigned IP
  HEADSCALE_IP=$(tailscale ip -4)
  echo "Headscale IP assigned: $HEADSCALE_IP"
  
  # Save to metadata (optional - for ElizaCloud API to query)
  echo "$HEADSCALE_IP" > /tmp/headscale-ip.txt
  
  # Report back to ElizaCloud API
  if [ -n "$ELIZACLOUD_API_URL" ] && [ -n "$CONTAINER_ID" ]; then
    curl -X POST "$ELIZACLOUD_API_URL/containers/$CONTAINER_ID/networking" \
      -H "Content-Type: application/json" \
      -d "{\"headscaleIp\": \"$HEADSCALE_IP\"}"
  fi
else
  echo "Warning: HEADSCALE_URL or HEADSCALE_AUTH_KEY not set. Skipping Headscale setup."
fi

# Start your Milaidy agent
exec node /app/dist/index.js
```

### 5. ElizaCloud API Integration

**When creating a container:**

```typescript
// ElizaCloud backend: POST /api/v1/agents
async function createContainer(userId: string, config: AgentConfig) {
  // Generate pre-auth key for Headscale
  const authKey = await generateHeadscaleAuthKey(userId);
  
  // Create container with Headscale environment variables
  const container = await docker.createContainer({
    Image: 'milaidy:latest',
    Env: [
      `HEADSCALE_URL=${process.env.HEADSCALE_URL}`,
      `HEADSCALE_AUTH_KEY=${authKey}`,
      `CONTAINER_ID=${containerId}`,
      `ELIZACLOUD_API_URL=${process.env.API_URL}`,
    ],
    // ... other container config
  });
  
  await container.start();
  
  // Wait for Headscale IP (container will report it back)
  const headscaleIp = await waitForHeadscaleIp(containerId, 30_000);
  
  return {
    agentId: containerId,
    headscaleIp,
    agentName: config.agentName,
  };
}
```

**Generate pre-auth key:**

```bash
# Manual generation (for testing)
headscale preauthkeys create \
  --namespace milaidy \
  --expiration 24h \
  --reusable false

# Returns: "mkey_abc123..."
```

**API endpoint to generate keys:**

```typescript
// Headscale API wrapper
async function generateHeadscaleAuthKey(userId: string): Promise<string> {
  const res = await fetch(`${HEADSCALE_API}/api/v1/preauthkey`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${HEADSCALE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      namespace: 'milaidy',
      reusable: false,
      ephemeral: false,
      expiration: new Date(Date.now() + 86400000).toISOString(), // 24h
    }),
  });
  
  const data = await res.json();
  return data.preAuthKey.key;
}
```

### 6. Frontend: Connect to Container via Headscale IP

**In CloudLanding.tsx** (already implemented):

```typescript
// After container creation
const headscaleIp = agent.networking?.headscaleIp;

// Store IP in sessionStorage
sessionStorage.setItem("container_ip", headscaleIp);

// Later: Send Discord token to container
await fetch(`http://${headscaleIp}:2138/api/discord/configure`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ botToken }),
});
```

**Important:** The browser can only connect to the Headscale IP if:
1. The user is on the same Headscale network (not typical for public web)
2. OR there's a proxy/relay server that bridges the connection

**Solution: Use a relay proxy**

```
Browser → milady.fun/api/relay → Headscale Network → Container
```

**Relay endpoint on backend:**

```typescript
// Backend API at milady.fun
app.post('/api/relay/:containerId/:route*', async (req, res) => {
  // Get container's Headscale IP from ElizaCloud API
  const { headscaleIp } = await elizaCloudApi.getContainerInfo(req.params.containerId);
  
  // Proxy request to container
  const containerUrl = `http://${headscaleIp}:2138${req.params.route}`;
  const proxyRes = await fetch(containerUrl, {
    method: req.method,
    headers: req.headers,
    body: req.body,
  });
  
  res.status(proxyRes.status).send(await proxyRes.text());
});
```

## Security Considerations

1. **Auth Keys**: Pre-auth keys should be single-use and expire quickly
2. **Network Isolation**: Each user's container in separate namespace (optional)
3. **Firewall**: Container should only expose API on Headscale interface
4. **TLS**: Use HTTPS for Headscale server
5. **Access Control**: Validate requests to relay proxy with JWT/API keys

## Testing

### Manual Test Flow

1. **Start Headscale server**
```bash
docker-compose up -d
```

2. **Create namespace**
```bash
docker exec headscale headscale namespaces create test
```

3. **Generate auth key**
```bash
docker exec headscale headscale preauthkeys create --namespace test --expiration 1h
```

4. **Test container connection**
```bash
docker run -it --rm \
  -e HEADSCALE_URL=http://your-headscale-server:8080 \
  -e HEADSCALE_AUTH_KEY=mkey_abc123... \
  milaidy:latest
```

5. **Verify IP assignment**
```bash
# Inside container
tailscale ip -4
# Should print: 100.64.1.x
```

6. **Test connectivity**
```bash
# From another Headscale-connected machine
curl http://100.64.1.x:2138/api/health
```

## Troubleshooting

### Container can't connect to Headscale
- Check `HEADSCALE_URL` is reachable from container
- Verify auth key is valid and not expired
- Check container has internet access for initial connection

### Headscale IP not assigned
- Tailscale daemon may not be running (`tailscaled` process)
- Auth key may be invalid or already used
- Check Headscale server logs for errors

### Can't reach container from frontend
- Browser can't directly reach Headscale network
- Must use relay proxy or VPN
- Verify relay proxy is on Headscale network

## Production Recommendations

1. **High Availability**: Deploy multiple Headscale servers behind load balancer
2. **Monitoring**: Track container connections, IP assignments, network health
3. **Logging**: Centralize Headscale and container logs
4. **Backup**: Regularly backup Headscale database (contains node keys)
5. **Scaling**: Use namespace-per-user or namespace-per-tier for isolation
6. **Rate Limiting**: Limit auth key generation to prevent abuse

## Resources

- Headscale GitHub: https://github.com/juanfont/headscale
- Headscale Docs: https://headscale.net
- Tailscale (compatible client): https://tailscale.com/kb
