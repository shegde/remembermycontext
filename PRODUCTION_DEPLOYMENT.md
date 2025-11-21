# Production Deployment Guide

## 🎯 Overview

This guide will deploy RememberMyContext to production on **remembermycontext.com** using the `prod` branch.

**Important:** Even though Render gives you an `onrender.com` URL, users will ONLY see `remembermycontext.com` because we set `FRONTEND_URL` to the custom domain.

---

## 📋 Quick Setup Checklist

- [ ] Push `prod` branch to GitHub
- [ ] Create Render Web Service from `prod` branch
- [ ] Create PostgreSQL database
- [ ] Add all environment variables (see below)
- [ ] Configure custom domain in Render
- [ ] Update DNS records in domain registrar
- [ ] Wait for SSL activation
- [ ] Test deployment

---

## 🚀 Step 1: Push Production Branch

```bash
git push -u origin prod
```

---

## 🗄️ Step 2: Create PostgreSQL Database

1. Go to https://dashboard.render.com
2. Click **"New +"** → **"PostgreSQL"**
3. Configure:
   ```
   Name: remembermycontext-prod-db
   Database: remembermycontext_prod
   Region: Choose closest to your users
   PostgreSQL Version: 16
   Plan: Free (upgrade later if needed)
   ```
4. Click **"Create Database"**
5. **IMPORTANT:** Copy the **Internal Database URL** (it will look like):
   ```
   postgresql://username:password@dpg-xxxxx-a.oregon-postgres.render.com/dbname
   ```

---

## 🌐 Step 3: Create Web Service

1. In Render Dashboard → **"New +"** → **"Web Service"**
2. Connect to your GitHub repository
3. Configure:

   ```
   Name: remembermycontext
   Region: Same as database
   Branch: prod  ← IMPORTANT: Select prod branch
   Root Directory: (leave blank)
   Runtime: Python 3
   Build Command: pip install -r requirements.txt
   Start Command: uvicorn src.main:app --host 0.0.0.0 --port $PORT
   Plan: Free (upgrade when needed)
   ```

4. Click **"Create Web Service"** (don't add env vars yet)

---

## 🔧 Step 4: Add Environment Variables

In Render Web Service → **"Environment"** tab → Click **"Add Environment Variable"**

### Copy these EXACT values (update the marked ones):

```bash
# API Configuration
API_PREFIX=/api/v1

# Frontend URLs - IMPORTANT: Use custom domain, NOT onrender URL
FRONTEND_URL=https://remembermycontext.com
ALLOWED_ORIGINS=https://remembermycontext.com,https://www.remembermycontext.com

# Database - REPLACE with your Internal Database URL from Step 2
DATABASE_URL=postgresql://username:password@dpg-xxxxx-a.oregon-postgres.render.com/dbname

# Security - GENERATE NEW VALUES (instructions below)
JWT_SECRET=GENERATE_NEW_SECRET_HERE
FERNET_KEY=GENERATE_NEW_FERNET_KEY_HERE
ADMIN_PASSWORD=GENERATE_NEW_STRONG_PASSWORD_HERE

# Email Service (use your Resend API key)
RESEND_API_KEY=re_LJgocdhj_LtVevNDLaZF6WSZ5MJHdxW8z
FROM_EMAIL=admin@remembermycontext.com
USE_RESEND_DEFAULT_DOMAIN=true

# Email Verification
EMAIL_VERIFICATION_REQUIRED=true
EMAIL_VERIFICATION_EXPIRY_HOURS=24
VERIFICATION_TOKEN_EXPIRE_HOURS=24

# Password Reset
ENABLE_PASSWORD_RESET=true
PASSWORD_RESET_EXPIRY_HOURS=1
PASSWORD_RESET_TOKEN_EXPIRE_HOURS=1

# Features
ENABLE_ONBOARDING=true
CALENDLY_LINK=https://cal.com/shailesh-hegde-arsvcf/remembermycontext

# Rate Limiting & Security
RATE_LIMIT_PER_MINUTE=60
MAX_CONTEXT_LENGTH=50000
ACCESS_TOKEN_EXPIRE_MINUTES=10080
ACCOUNT_DELETION_GRACE_DAYS=7

# Logging
LOG_LEVEL=INFO
ECHO_SQL=false
```

---

## 🔐 Step 5: Generate New Security Keys

**NEVER reuse test keys in production!** Generate new ones:

### Generate JWT_SECRET:
```bash
python3 -c "import secrets; print(secrets.token_urlsafe(32))"
```
Example output: `Ge_u_yR0TzbQEoqtnrl2JOaC4BW5BR6SWM-O1rTsgYQ`

### Generate FERNET_KEY:
```bash
python3 -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```
Example output: `9bRv0j2nMtzNzHW6CZDMVmm_yTLW0vGve3Ay-iLePuo=`

### Generate ADMIN_PASSWORD:
Use a strong password (min 8 chars, letters + numbers):
```
Example: MyStr0ngP@ssw0rd2024!
```

**Copy these generated values to the environment variables above.**

---

## 🌍 Step 6: Configure Custom Domain

### A. In Render Dashboard:

1. Go to your Web Service → **"Settings"** → **"Custom Domain"**
2. Click **"Add Custom Domain"**
3. Enter: `remembermycontext.com`
4. Render will show you DNS records like:
   ```
   CNAME: remembermycontext-xxxx.onrender.com
   ```
5. Keep this page open, you'll need these values for DNS

### B. In Your Domain Registrar (GoDaddy, Namecheap, etc.):

1. Log into your domain registrar
2. Go to **DNS Management** for `remembermycontext.com`
3. Add these records:

**For Root Domain (@):**
```
Type: CNAME
Name: @ (or leave blank)
Value: remembermycontext-xxxx.onrender.com  ← From Render dashboard
TTL: 3600 (1 hour)
```

**For WWW Subdomain:**
```
Type: CNAME
Name: www
Value: remembermycontext-xxxx.onrender.com  ← Same value as above
TTL: 3600
```

4. **Save changes**

### C. Wait for DNS Propagation:
- Usually takes 5-30 minutes
- Can take up to 24 hours in rare cases
- Check status: https://dnschecker.org

### D. SSL Certificate:
- Render automatically provisions SSL certificate
- Once DNS propagates, SSL will activate automatically
- Check in Render: "Settings" → "Custom Domain" → Should show "SSL Active"

---

## ✅ Step 7: Verify Deployment

### Wait for Service to Deploy:
- In Render → "Logs" tab
- Wait for message: **"Your service is live 🎉"**

### Test Endpoints:

```bash
# Test custom domain health
curl https://remembermycontext.com/health
# Expected: {"status":"healthy"}

# Test API health
curl https://remembermycontext.com/api/v1/health
# Expected: 200 OK

# Test in browser
https://remembermycontext.com/docs
# Should show API documentation

# Test dashboard
https://remembermycontext.com/dashboard
# Should show login page

# Test admin
https://remembermycontext.com/admin
# Should show admin login
```

---

## 🔍 Step 8: Database Migrations (If Needed)

If you need to run migrations:

### Option A: Using Render Shell
1. Render Dashboard → Web Service → **"Shell"** tab
2. Run:
   ```bash
   alembic upgrade head
   ```

### Option B: From Local Machine
```bash
# Connect to prod database
export DATABASE_URL="<your-production-database-url>"
alembic upgrade head
```

---

## 🎨 Step 9: Test Extension

### Load Extension:
1. Open Chrome
2. Go to `chrome://extensions/`
3. Enable **"Developer mode"**
4. Click **"Load unpacked"**
5. Select the `extension/` folder from `prod` branch

### Verify Extension Config:
- Extension should connect to `https://remembermycontext.com/api/v1`
- Open extension popup
- Create account
- Test context box creation
- Test insertion on ChatGPT/Claude

### Check Extension Console:
1. Right-click extension icon → **"Inspect popup"**
2. Check Console tab for any errors
3. Network tab should show requests to `remembermycontext.com` (NOT onrender)

---

## 🎯 Why FRONTEND_URL Matters

### Email Links Use This URL:
```python
# In src/services/email.py
verification_url = f"{settings.FRONTEND_URL}/verify-email?token={token}"
reset_url = f"{settings.FRONTEND_URL}/reset-password?token={token}"
```

**If you set:**
- ✅ `FRONTEND_URL=https://remembermycontext.com`  
  → Users see: `https://remembermycontext.com/verify-email?token=...`

- ❌ `FRONTEND_URL=https://remembermycontext-xxxx.onrender.com`  
  → Users see ugly onrender URL (NOT PROFESSIONAL)

**Always use your custom domain in FRONTEND_URL!**

---

## 📊 Monitoring & Maintenance

### Set Up Uptime Monitoring:
1. Go to https://uptimerobot.com (free)
2. Add monitor:
   ```
   URL: https://remembermycontext.com/health
   Check interval: 5 minutes
   Alert: Email
   ```

### Check Logs Regularly:
- Render Dashboard → "Logs" tab
- Look for errors, warnings
- Monitor performance

### Database Backups:
- Free tier: No automatic backups
- Standard ($7/month): Daily automatic backups
- Manual backup:
  ```bash
  pg_dump $DATABASE_URL > backup-$(date +%Y%m%d).sql
  ```

---

## 🔄 Future Updates

### To Deploy New Features:

```bash
# 1. Develop on main branch
git checkout main
# ... make changes ...
git push origin main
# Test on remembermycontexttest.onrender.com

# 2. When stable, merge to prod
git checkout prod
git merge main
git push origin prod
# Auto-deploys to remembermycontext.com
```

### Rollback if Needed:
In Render Dashboard:
1. Go to **"Events"** tab
2. Find last working deployment
3. Click **"Rollback to this version"**

---

## 🐛 Troubleshooting

### Issue: 502 Bad Gateway

**Causes:**
- Service is spinning up (wait 1-2 minutes on free tier)
- Missing environment variables
- Database connection failed

**Solution:**
```bash
# Check logs in Render Dashboard
# Look for errors after "Starting server..."
# Verify DATABASE_URL is correct (use Internal URL)
```

### Issue: Custom Domain Not Working

**Causes:**
- DNS not propagated yet
- Wrong CNAME value
- SSL not activated

**Solution:**
```bash
# Check DNS propagation
https://dnschecker.org

# Verify CNAME record
dig remembermycontext.com

# Wait for SSL (can take 30 min after DNS propagates)
```

### Issue: CORS Errors in Extension

**Causes:**
- `ALLOWED_ORIGINS` not set correctly
- Wrong domain in origins

**Solution:**
```bash
# Verify environment variable
ALLOWED_ORIGINS=https://remembermycontext.com,https://www.remembermycontext.com

# Restart service after changing env vars
```

### Issue: Email Links Point to onrender.com

**Cause:**
- `FRONTEND_URL` is set to onrender URL

**Solution:**
```bash
# Change environment variable
FRONTEND_URL=https://remembermycontext.com
# (NOT the onrender URL)

# Restart service
```

---

## 📈 Scaling Recommendations

### Free Tier Limitations:
- Service sleeps after 15 min inactivity
- 750 hours/month (shared across services)
- Limited CPU/RAM
- No automatic backups

### When to Upgrade:

**Starter Plan ($7/month):**
- Good for 100-500 active users
- No sleep, always on
- Faster response times

**Standard Plan ($25/month):**
- Good for 500-2000 users
- More RAM/CPU
- Autoscaling

**Database:**
- **Standard ($7/month):**  
  1GB RAM, 10GB storage, daily backups
  
- **Pro ($25/month):**  
  4GB RAM, 50GB storage, continuous backups

---

## 🔒 Security Checklist

- [ ] New `JWT_SECRET` generated (not reused from test)
- [ ] New `FERNET_KEY` generated (not reused from test)
- [ ] Strong `ADMIN_PASSWORD` (min 8 chars, alphanumeric)
- [ ] `FRONTEND_URL` uses HTTPS (not HTTP)
- [ ] `ALLOWED_ORIGINS` includes custom domain
- [ ] Database uses Internal URL (better security)
- [ ] Email verification enabled
- [ ] Rate limiting enabled
- [ ] SSL certificate active on custom domain
- [ ] Regular backups configured

---

## ✅ Final Checklist

Before going live, verify:

- [ ] Web service deployed successfully
- [ ] "Your service is live 🎉" in logs
- [ ] Database connected (no connection errors)
- [ ] Custom domain DNS propagated
- [ ] SSL certificate active
- [ ] `https://remembermycontext.com/health` returns 200
- [ ] `https://remembermycontext.com/docs` loads
- [ ] Dashboard accessible at `/dashboard`
- [ ] Admin panel accessible at `/admin`
- [ ] Extension connects successfully
- [ ] Can create account via extension
- [ ] Can create context box
- [ ] Can insert context in LLM
- [ ] Email verification works
- [ ] Password reset works
- [ ] Uptime monitoring configured

---

## 📞 Support

**Render Status:** https://status.render.com  
**Render Docs:** https://render.com/docs  
**Render Support:** https://render.com/support

---

## 🎉 Deployment Complete!

Once all checks pass:
✅ Production is live on `https://remembermycontext.com`  
✅ Users only see your custom domain  
✅ Backend runs securely on Render  
✅ Extension works seamlessly  
✅ Ready for real users!

**Test everything thoroughly before sharing with users!**
