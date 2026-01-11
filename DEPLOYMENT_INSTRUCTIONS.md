# Manual Deployment Instructions

Quick guide on how to manually deploy your frontend and backend to Cloudflare.

---

## Backend Deployment (Cloudflare Workers)

### Prerequisites
- Make sure you're logged into Cloudflare via Wrangler: `wrangler login`
- Navigate to the backend directory: `cd cf_ai_memchat\worker`

### Deploy Command
```powershell
cd "C:\Users\aravi\cloudflare project\cf_ai_memchat\worker"
npm run deploy
```

Or directly:
```powershell
cd "C:\Users\aravi\cloudflare project\cf_ai_memchat\worker"
wrangler deploy
```

### What This Does
- Builds your Worker code
- Deploys to Cloudflare Workers
- Makes it available at: `https://cf-ai-memchat-worker.aravindpillarisetty.workers.dev`

### Verify Deployment
- Check the URL in your browser
- Should see: `{"status":"ok","message":"✅ Cloudflare AI Study Planner is running"}`

---

## Frontend Deployment (Cloudflare Pages)

### Option 1: Using Wrangler CLI (Quick)

1. **Build the frontend:**
```powershell
cd "C:\Users\aravi\cloudflare project\frontend"
npm run build
```

2. **Deploy to Cloudflare Pages:**
```powershell
cd "C:\Users\aravi\cloudflare project\frontend"
wrangler pages deploy dist --project-name=cloudflare-ai-chat
```

### Option 2: Using GitHub Integration (Automatic)

If you've set up GitHub integration in Cloudflare Dashboard:
1. Push to GitHub (you just did this!)
2. Cloudflare automatically deploys from the `main` branch
3. Check the Cloudflare Dashboard → Pages → Your project → Deployments

### Prerequisites for Option 2
- GitHub repository connected to Cloudflare Pages
- Build command: `npm run build`
- Output directory: `dist`
- Root directory: `frontend` (if repository root is parent folder)

---

## Full Deployment (Both Backend & Frontend)

### Step-by-Step:

1. **Commit and push all changes to GitHub:**
```powershell
cd "C:\Users\aravi\cloudflare project"
git add .
git commit -m "Your commit message"
git push origin main
```

2. **Deploy Backend:**
```powershell
cd "C:\Users\aravi\cloudflare project\cf_ai_memchat\worker"
npm run deploy
```

3. **Deploy Frontend:**
```powershell
cd "C:\Users\aravi\cloudflare project\frontend"
npm run build
wrangler pages deploy dist --project-name=cloudflare-ai-chat
```

---

## Using PowerShell Scripts (If Available)

If you have the deployment scripts:

**Deploy Backend:**
```powershell
cd "C:\Users\aravi\cloudflare project"
.\deploy-backend.ps1
```

**Deploy Frontend:**
```powershell
cd "C:\Users\aravi\cloudflare project"
.\deploy-frontend.ps1
```

**Deploy Both:**
```powershell
cd "C:\Users\aravi\cloudflare project"
.\deploy-all.ps1
```

---

## Verify Your Deployment

### Backend
- URL: `https://cf-ai-memchat-worker.aravindpillarisetty.workers.dev`
- Health check: Visit the URL in browser, should see JSON response

### Frontend
- URL: Check Cloudflare Dashboard → Pages → Your project → Production URL
- Usually: `https://cloudflare-ai-chat.pages.dev` (or similar)

---

## Common Issues

### Backend Deployment Fails
- Make sure you're logged in: `wrangler login`
- Check `wrangler.json` has correct configuration
- Verify all dependencies are installed: `npm install`

### Frontend Deployment Fails
- Make sure you built first: `npm run build`
- Check that `dist` folder exists after build
- Verify project name matches Cloudflare Pages project

### GitHub Auto-Deploy Not Working
- Check Cloudflare Dashboard → Pages → Your project → Settings → Builds & deployments
- Verify GitHub connection is active
- Check build settings (build command, output directory, root directory)

---

## Quick Reference

```powershell
# Push to GitHub
cd "C:\Users\aravi\cloudflare project"
git add .
git commit -m "Your message"
git push origin main

# Deploy Backend
cd "C:\Users\aravi\cloudflare project\cf_ai_memchat\worker"
wrangler deploy

# Deploy Frontend
cd "C:\Users\aravi\cloudflare project\frontend"
npm run build
wrangler pages deploy dist --project-name=cloudflare-ai-chat
```

