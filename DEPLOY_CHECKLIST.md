# Vercel Deployment Checklist

Quick reference for deploying the cloud-only Milaidy frontend.

## Pre-Deployment

### 1. Discord Application Setup
- [ ] Created Discord application at https://discord.com/developers/applications
- [ ] Saved Client ID: `________________`
- [ ] Saved Client Secret: `________________`
- [ ] Added redirect URI: `https://milady.fun/discord-callback`
- [ ] Enabled bot with Send Messages permission
- [ ] Saved Bot Token: `________________`

### 2. Headscale Network
- [ ] Headscale server deployed and accessible
- [ ] Created `milaidy` namespace
- [ ] Configured API access for generating pre-auth keys
- [ ] Headscale URL: `________________`

### 3. Code Changes
- [ ] Verified `CloudLanding.tsx` exists and is complete
- [ ] Verified `DiscordCallback.tsx` exists
- [ ] Added POST `/api/discord/exchange` route ✅
- [ ] Added POST `/api/discord/configure` route ✅
- [ ] Updated `vercel.json` with environment variables ✅
- [ ] Created `.env.cloud-example` ✅

## Vercel Setup

### 1. Create/Link Project
```bash
cd ~/projects/milaidy-dev
vercel link
# Follow prompts to create or link project
```

### 2. Set Environment Variables

**Via CLI:**
```bash
vercel env add VITE_CLOUD_ONLY production
# Enter: true

vercel env add VITE_ELIZACLOUD_BASE production
# Enter: https://www.elizacloud.ai

vercel env add VITE_DISCORD_CLIENT_ID production
# Enter: your_discord_client_id

vercel env add VITE_DISCORD_REDIRECT_URI production
# Enter: https://milady.fun/discord-callback
```

**Via Dashboard:**
- [ ] Go to Vercel project → Settings → Environment Variables
- [ ] Add `VITE_CLOUD_ONLY` = `true` (Production)
- [ ] Add `VITE_ELIZACLOUD_BASE` = `https://www.elizacloud.ai` (Production)
- [ ] Add `VITE_DISCORD_CLIENT_ID` = `your_client_id` (Production)
- [ ] Add `VITE_DISCORD_REDIRECT_URI` = `https://milady.fun/discord-callback` (Production)

### 3. Deploy

```bash
# Deploy to production
vercel --prod

# Note the deployment URL
# Example: https://milaidy-dev-abc123.vercel.app
```

### 4. Custom Domain (if using milady.fun)
- [ ] Go to Vercel project → Settings → Domains
- [ ] Add `milady.fun`
- [ ] Update DNS records as instructed by Vercel
- [ ] Wait for SSL certificate provisioning (5-10 min)
- [ ] Verify https://milady.fun loads correctly

## Post-Deployment Testing

### 1. Basic Functionality
- [ ] Visit https://milady.fun (or deployment URL)
- [ ] CloudLanding component loads
- [ ] "Get started ✨" button is visible
- [ ] Page styles load correctly (no CORS errors in console)

### 2. ElizaCloud OAuth Flow
- [ ] Click "Get started"
- [ ] Pop-up opens for elizacloud.ai
- [ ] Can sign in / create account
- [ ] Pop-up closes after authentication
- [ ] "Creating your agent..." screen shows
- [ ] Progress indicators animate

### 3. Container Provisioning
- [ ] Container is created (check ElizaCloud dashboard)
- [ ] Headscale IP is assigned within 30s
- [ ] "Agent ready! 🎉" screen shows
- [ ] Container IP is visible on screen
- [ ] sessionStorage contains `container_ip` and `elizacloud_api_key`

### 4. Discord Integration
- [ ] "Add to Discord server" button is visible
- [ ] Click button → redirects to Discord OAuth
- [ ] Can select server and authorize
- [ ] Redirected to `/discord-callback`
- [ ] "Connecting to discord..." screen shows
- [ ] Bot token is exchanged
- [ ] Token is sent to container
- [ ] "All set! 🎉" screen shows
- [ ] Redirected to dashboard after 2 seconds

### 5. Error Handling
- [ ] Test pop-up blocker → shows clear error message
- [ ] Test invalid OAuth state → shows error
- [ ] Test container unreachable → shows retry option
- [ ] Test session expiration → can retry from beginning

## Container Configuration

### 1. Update ElizaCloud Container Dockerfile
- [ ] Added Tailscale client installation
- [ ] Added `container-init.sh` startup script
- [ ] Script connects to Headscale on boot
- [ ] Script reports IP back to ElizaCloud API
- [ ] Container exposes API on `0.0.0.0:2138`

### 2. Headscale Integration
- [ ] ElizaCloud API generates pre-auth keys
- [ ] Keys are single-use and expire after 24h
- [ ] Container receives `HEADSCALE_URL` and `HEADSCALE_AUTH_KEY` env vars
- [ ] Container joins network successfully
- [ ] IP assignment happens within 30s
- [ ] IP is stored in ElizaCloud database

### 3. Container API Endpoints
- [ ] POST `/api/discord/configure` accepts `{ botToken }`
- [ ] Endpoint stores token securely
- [ ] Discord client connects after receiving token
- [ ] CORS allows requests from `https://milady.fun`

## Monitoring Setup

### 1. Error Tracking
- [ ] Set up Sentry or similar
- [ ] Add Sentry DSN to Vercel env vars
- [ ] Test error reporting

### 2. Analytics (Optional)
- [ ] Set up Google Analytics, Plausible, or similar
- [ ] Add tracking code to frontend
- [ ] Verify events are being tracked

### 3. Uptime Monitoring
- [ ] Set up UptimeRobot or similar
- [ ] Monitor https://milady.fun
- [ ] Monitor Headscale server
- [ ] Alert if down for >2 minutes

## Production Checklist

- [ ] SSL certificate valid and auto-renewing
- [ ] Discord app verified (if needed for >100 servers)
- [ ] Headscale server has backups configured
- [ ] Database backups enabled (if using PostgreSQL)
- [ ] Rate limiting enabled on OAuth endpoints
- [ ] Cloudflare or DDoS protection configured (optional)
- [ ] Support email/Discord configured
- [ ] Privacy policy and terms of service pages created
- [ ] Legal compliance (GDPR, etc.) reviewed

## Rollback Plan

If deployment fails or has critical bugs:

```bash
# Redeploy previous version
vercel rollback <deployment-url>

# Or redeploy from specific commit
git checkout <previous-commit-sha>
vercel --prod
```

## Common Issues

### "Pop-up blocked"
**Solution:** User needs to allow pop-ups for milady.fun. Show clear instructions.

### "Container not ready yet"
**Solution:** Increase wait time for Headscale IP assignment from 30s to 60s.

### "Discord auth failed"
**Solution:** Verify Discord Client ID/Secret in Vercel env vars. Check redirect URI matches exactly.

### "Token exchange failed"
**Solution:** Check Discord Client Secret is correct. Verify backend can reach Discord API.

### Build fails on Vercel
**Solution:**
- Check `vercel.json` `buildCommand` is correct
- Verify all dependencies are in `package.json`
- Check build logs for specific errors
- Try building locally first: `npm run build`

## Support Resources

- Vercel Docs: https://vercel.com/docs
- Discord Developer Portal: https://discord.com/developers
- ElizaCloud: https://elizacloud.ai/support
- Headscale: https://github.com/juanfont/headscale

---

**Last Updated:** 2026-02-21  
**Maintained by:** Shadow (@wakesync)
