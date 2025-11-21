# Production Deployment Guide for Client

## 🎯 Overview

This `prod` branch is production-ready for deployment on the client's Render account with custom domain `remembermycontext.com`.

---

## 📋 Pre-Deployment Checklist

### 1. Render Account Setup

#### A. Create New Web Service
1. Log into client's Render account
2. Click **"New +"** → **"Web Service"**
3. Connect to repository: `uikarsh-titbul/remembermycontext`
4. Select **branch: `prod`**
5. Configure:
   ```
   Name: remembermycontext
   Region: Choose closest to target users
   Branch: prod
   Build Command: pip install -r requirements.txt
   Start Command: uvicorn src.main:app --host 0.0.0.0 --port $PORT
   ```

#### B. Create PostgreSQL Database
1. In Render dashboard → **"New +"** → **"PostgreSQL"**
2. Configure:
   ```
   Name: remembermycontext-prod-db
   Database: remembermycontext_prod
   User: (auto-generated)
   Region: Same as web service
   PostgreSQL Version: 16
   ```
3. **Important:** Copy the **Internal Database URL** (starts with `postgresql://`)

### 2. Environment Variables

Add these in Render Web Service → **"Environment"** tab:

```bash
# Database
DATABASE_URL=<Internal Database URL from PostgreSQL service>

# Security
SECRET_KEY=<generate-new-secret-key-here>
ENCRYPTION_KEY=<generate-new-encryption-key-here>

# Email (if using)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=<client-email@domain.com>
SMTP_PASSWORD=<app-specific-password>

# Application
ENVIRONMENT=production
FRONTEND_URL=https://remembermycontext.com

# Optional: Rate limiting
RATE_LIMIT_PER_MINUTE=60
```

#### Generate Secret Keys:
```bash
# SECRET_KEY (32 characters minimum)
python -c "import secrets; print(secrets.token_urlsafe(32))"

# ENCRYPTION_KEY (32 bytes base64 encoded)
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

### 3. Custom Domain Configuration

#### A. In Render Dashboard:
1. Go to Web Service → **"Settings"** → **"Custom Domain"**
2. Click **"Add Custom Domain"**
3. Enter: `remembermycontext.com`
4. Render will show DNS records to add

#### B. In Domain Registrar (e.g., GoDaddy, Namecheap):
1. Go to DNS Management
2. Add these records:

**For Root Domain (remembermycontext.com):**
```
Type: CNAME
Name: @
Value: <provided-by-render>.onrender.com
TTL: 3600
```

**For WWW Subdomain:**
```
Type: CNAME
Name: www
Value: <provided-by-render>.onrender.com
TTL: 3600
```

**For API (if separate subdomain):**
```
Type: CNAME
Name: api
Value: <provided-by-render>.onrender.com
TTL: 3600
```

3. Wait 5-60 minutes for DNS propagation

#### C. Enable HTTPS:
- Render automatically provides free SSL certificate
- Check "Settings" → "Custom Domain" → Should show "SSL Active"

---

## 🚀 Deployment Steps

### Step 1: Initial Deployment
1. Push `prod` branch to GitHub:
   ```bash
   git push origin prod
   ```

2. In Render, the service will auto-deploy from `prod` branch

3. Monitor logs for "Your service is live" message

### Step 2: Database Migration
Once service is live, run migrations:

**Option A: Via Render Shell**
1. Render Dashboard → Web Service → **"Shell"** tab
2. Run:
   ```bash
   alembic upgrade head
   ```

**Option B: Local Connection**
```bash
# Connect to prod DB locally
export DATABASE_URL="<prod-database-url>"
alembic upgrade head
```

### Step 3: Create Admin User
```bash
# In Render Shell or via API
python -c "from src.crud.user import create_admin_user; create_admin_user()"
```

### Step 4: Verify Deployment
```bash
# Test health endpoint
curl https://remembermycontext.com/health

# Test API
curl https://remembermycontext.com/api/v1/health

# Test docs
https://remembermycontext.com/docs
```

---

## 🔧 Post-Deployment Configuration

### 1. Extension Deployment

**For Chrome Web Store:**
1. Zip the `extension/` folder:
   ```bash
   cd extension
   zip -r remembermycontext-extension.zip * -x "*.git*"
   ```

2. Upload to Chrome Web Store:
   - Go to https://chrome.google.com/webstore/devconsole
   - Create new item
   - Upload zip
   - Submit for review

**For Internal Testing:**
1. Go to `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select `extension/` folder

### 2. Frontend URLs

All frontend is served from backend:
- Dashboard: `https://remembermycontext.com/dashboard`
- Admin Panel: `https://remembermycontext.com/admin`
- API Docs: `https://remembermycontext.com/docs`

### 3. CORS Configuration

Backend is configured to allow:
```python
allow_origins=[
    "https://remembermycontext.com",
    "https://www.remembermycontext.com",
    "chrome-extension://*"
]
```

---

## 📊 Monitoring

### Render Dashboard
- **Metrics**: CPU, Memory, Response times
- **Logs**: Real-time application logs
- **Events**: Deployment history

### Health Checks
Set up monitoring with:
- UptimeRobot (free): https://uptimerobot.com
- Pingdom
- StatusCake

Monitor: `https://remembermycontext.com/health`

### Database Backups
- Render PostgreSQL: Automatic daily backups (Standard plan)
- Manual backup:
  ```bash
  pg_dump $DATABASE_URL > backup.sql
  ```

---

## 🔄 Updates & Rollbacks

### Deploy New Version
```bash
git checkout prod
git merge main  # or cherry-pick specific commits
git push origin prod
```
Render auto-deploys on push to `prod` branch.

### Rollback
In Render Dashboard:
1. Go to "Events" tab
2. Click on previous successful deployment
3. Click "Rollback to this version"

---

## 🐛 Troubleshooting

### Issue: 502 Bad Gateway
**Solution:**
- Check Render logs for errors
- Verify DATABASE_URL is set
- Check if service is using correct PORT

### Issue: CORS Errors
**Solution:**
- Verify FRONTEND_URL in environment
- Check CORS middleware in `src/main.py`

### Issue: Database Connection Failed
**Solution:**
- Use **Internal Database URL** (not External)
- Format: `postgresql://user:pass@internal-host/db`

### Issue: Extension Can't Connect
**Solution:**
- Verify API_BASE in `extension/config-shared.js`
- Check manifest.json host_permissions
- Reload extension in Chrome

---

## 📞 Support Contacts

- **Render Support**: https://render.com/support
- **Domain Support**: Your domain registrar
- **SSL Issues**: Render auto-handles SSL

---

## 🔒 Security Best Practices

1. ✅ Keep SECRET_KEY and ENCRYPTION_KEY secret
2. ✅ Use environment variables, never hardcode
3. ✅ Enable HTTPS only (no HTTP)
4. ✅ Regular database backups
5. ✅ Monitor logs for suspicious activity
6. ✅ Keep dependencies updated
7. ✅ Use strong passwords for SMTP/Database

---

## 📈 Scaling (Future)

When ready to scale beyond free tier:

**Render Plans:**
- **Starter ($7/month)**: No sleep, faster instance
- **Standard ($25/month)**: Autoscaling, more RAM
- **Pro ($85/month)**: High performance

**Database:**
- **Standard ($7/month)**: 1GB RAM, 10GB storage, backups
- **Pro ($25/month)**: 4GB RAM, 50GB storage

---

## ✅ Deployment Completion Checklist

- [ ] Render Web Service created
- [ ] PostgreSQL database created
- [ ] Environment variables configured
- [ ] Custom domain added in Render
- [ ] DNS records updated in registrar
- [ ] SSL certificate active
- [ ] Service deployed successfully
- [ ] Database migrations run
- [ ] Admin user created
- [ ] Health endpoints responding
- [ ] Extension tested and working
- [ ] Monitoring set up
- [ ] Backup strategy in place

---

**Production deployment is complete when all checks pass!** ✅

