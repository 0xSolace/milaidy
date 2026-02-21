# Cloud-Only Deployment Guide

This guide covers deploying the Milaidy cloud-only frontend to Vercel with ElizaCloud + Headscale integration.

## Architecture

```
User Browser → Vercel (milady.fun)
                 ↓
            ElizaCloud OAuth → Container Provisioning
                 ↓
            Headscale Network → User's Container API
                 ↓
            Discord Integration
```

## Prerequisites

1. **Discord Application**
   - Create app at https://discord.com/developers/applications
   - Enable bot with required permissions (Send Messages minimum)
   - Save Client ID and Client Secret

2. **Vercel Account**
   - Sign up at https://vercel.com
   - Install Vercel CLI: `npm i -g vercel`

3. **ElizaCloud Account** (users will create during onboarding)

4. **Headscale Network** (for container connectivity)
   - Set up Headscale server or use managed service
   - Configure containers to join network on boot

## Step 1: Configure Discord Application

1. Go to Discord Developer Portal → Your Application → OAuth2
2. Add redirect URI: `https://milady.fun/discord-callback`
3. Save the following values:
   - **Client ID**: `1234567890...`
   - **Client Secret**: `abc123...`
4. Go to Bot tab → Reset Token → Save **Bot Token**

## Step 2: Set Up Vercel Project

### Local Testing (Optional)

```bash
cd ~/projects/milaidy-dev

# Create .env.local for local testing
cp .env.cloud-example .env.local

# Edit .env.local with your Discord credentials
nano .env.local

# Test locally
npm run dev:ui
# Visit http://localhost:2138
```

### Deploy to Vercel

```bash
# Link to Vercel project (first time only)
vercel link

# Add environment variables
vercel env add VITE_DISCORD_CLIENT_ID production
# Paste your Discord Client ID when prompted

# Deploy
vercel --prod
```

## Step 3: Configure Environment Variables in Vercel Dashboard

Go to your Vercel project → Settings → Environment Variables:

| Variable | Value | Environment |
|----------|-------|-------------|
| `VITE_CLOUD_ONLY` | `true` | Production |
| `VITE_ELIZACLOUD_BASE` | `https://www.elizacloud.ai` | Production |
| `VITE_DISCORD_CLIENT_ID` | Your Discord Client ID | Production |
| `VITE_DISCORD_REDIRECT_URI` | `https://milady.fun/discord-callback` | Production |

**Note:** The `@discord_client_id` syntax in `vercel.json` is a placeholder. You must set the actual value in the Vercel dashboard.

## Step 4: Configure Containers for Headscale

Each ElizaCloud container must:

1. **Join Headscale network on boot**
   ```bash
   # Add to container startup script
   headscale nodes register --user <user-id>
   ```

2. **Expose API on Headscale private IP**
   - Container API should listen on `0.0.0.0:2138`
   - Headscale will assign a private IP (e.g., `100.64.1.5`)
   - Frontend connects via this IP

3. **Accept cross-origin requests from milady.fun**
   ```typescript
   // In container API server
   app.use(cors({
     origin: 'https://milady.fun',
     credentials: true
   }));
   ```

## Step 5: Test the Flow

### Full User Journey

1. **Visit milady.fun**
   - Should see CloudLanding component
   - Click "Get Started ✨"

2. **ElizaCloud OAuth**
   - Pop-up opens for elizacloud.ai login
   - User signs in/creates account
   - Frontend receives API key

3. **Container Provisioning**
   - Frontend creates agent container via ElizaCloud API
   - Waits for Headscale IP assignment (30s max)
   - Stores API key + IP in sessionStorage

4. **Discord Integration**
   - Shows "Add to Discord" button
   - Redirects to Discord OAuth
   - Exchanges code for bot token
   - Sends token to container via Headscale IP

5. **Success**
   - Container receives bot token
   - Discord client connects
   - User is redirected to dashboard

### Testing Checklist

- [ ] CloudLanding loads correctly
- [ ] ElizaCloud OAuth popup opens
- [ ] Container is created successfully
- [ ] Headscale IP is assigned within 30s
- [ ] Discord OAuth flow completes
- [ ] Bot token is sent to container
- [ ] Container receives and stores token
- [ ] Discord client connects
- [ ] Dashboard loads with active agent

## Troubleshooting

### "Pop-up blocked"
- User needs to allow pop-ups for milady.fun
- Show clear error message with instructions

### "Container unreachable"
- Verify Headscale network is running
- Check container has joined network
- Ensure container API is listening on 0.0.0.0:2138
- Verify CORS is configured for milady.fun

### "Discord auth failed"
- Check Discord Client ID/Secret are correct
- Verify redirect URI matches exactly
- Check Discord application is not rate-limited

### "Session expired"
- User took too long to complete OAuth
- Clear sessionStorage and retry

## Security Considerations

1. **CORS**: Container API should only accept requests from milady.fun
2. **Rate Limiting**: Implement rate limits on OAuth endpoints
3. **Token Storage**: Bot tokens stored securely in container, never in frontend
4. **Headscale Access**: Private network prevents external access to containers
5. **API Key Handling**: ElizaCloud API keys stored in sessionStorage (cleared on logout)

## Production Checklist

- [ ] Discord app verified (if needed for >100 servers)
- [ ] Vercel environment variables set
- [ ] Custom domain (milady.fun) configured in Vercel
- [ ] SSL/TLS certificate valid
- [ ] Headscale network production-ready
- [ ] Container base image includes Headscale client
- [ ] Monitoring set up for container provisioning
- [ ] Error tracking (Sentry, etc.) configured
- [ ] Analytics (optional) configured

## Future Enhancements

1. **Container Health Checks**: Poll container health after provisioning
2. **Retry Logic**: Auto-retry failed container provisioning
3. **Multi-Region**: Deploy Headscale in multiple regions for lower latency
4. **Container Management UI**: Let users restart/configure containers
5. **Bot Permissions**: Fine-grained Discord permissions UI
6. **Team Features**: Multi-user container access
7. **Billing Integration**: Connect Stripe/etc. for paid tiers

## Support

For issues or questions:
- ElizaCloud: https://elizacloud.ai/support
- Milaidy Discord: https://discord.gg/milaidy
- GitHub Issues: https://github.com/your-org/milaidy-dev
