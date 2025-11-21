# Differences Between Test and Production

## 🔄 Branch Strategy

| Aspect | Test (main branch) | Production (prod branch) |
|--------|-------------------|-------------------------|
| **Branch** | `main` | `prod` |
| **Domain** | remembermycontexttest.onrender.com | remembermycontext.com |
| **Render Account** | Your account | Client's account |
| **Database** | Test database | Production database |
| **Purpose** | Development & testing | Live for end users |

---

## 📝 File Changes in `prod` Branch

### 1. `extension/config-shared.js`
```javascript
// main branch (test)
PRODUCTION_API: 'https://remembermycontexttest.onrender.com/api/v1'

// prod branch (production)
PRODUCTION_API: 'https://remembermycontext.com/api/v1'
```

### 2. `extension/manifest.json`
```json
// main branch (test)
"host_permissions": [
  "https://remembermycontexttest.onrender.com/*",
  "https://*.onrender.com/*",
  ...
]

// prod branch (production)
"host_permissions": [
  "https://remembermycontext.com/*",
  "https://www.remembermycontext.com/*",
  ...
]
```

### 3. Backend Environment Variables

**Test (main):**
```bash
DATABASE_URL=postgresql://test_db_url
SECRET_KEY=test_secret
FRONTEND_URL=https://remembermycontexttest.onrender.com
```

**Production (prod):**
```bash
DATABASE_URL=postgresql://prod_db_url  # New production database
SECRET_KEY=prod_secret  # New secret key
FRONTEND_URL=https://remembermycontext.com
```

---

## 🚀 Deployment Workflow

### For Development/Testing (main branch):
```bash
git checkout main
# Make changes
git add .
git commit -m "Add feature X"
git push origin main
# Auto-deploys to remembermycontexttest.onrender.com
```

### For Production (prod branch):
```bash
# After testing on main, merge to prod
git checkout prod
git merge main  # or cherry-pick specific commits
git push origin prod
# Auto-deploys to remembermycontext.com (client's Render)
```

---

## 🔒 Security Differences

| Item | Test | Production |
|------|------|------------|
| SECRET_KEY | Test key | Strong unique key |
| ENCRYPTION_KEY | Test key | Strong unique key |
| Database | Shared/test data | Real user data |
| Backups | Optional | **REQUIRED** |
| Monitoring | Optional | **REQUIRED** |
| SSL | Render subdomain | Custom domain SSL |

---

## 📊 Configuration Matrix

| Configuration | Test (main) | Production (prod) |
|--------------|-------------|-------------------|
| **API URL** | remembermycontexttest.onrender.com | remembermycontext.com |
| **Extension Config** | Points to test API | Points to prod API |
| **Database** | Test DB | Production DB |
| **USE_LOCAL** | `false` | `false` |
| **Error Logging** | Verbose | Production-level |
| **Analytics** | Test events | Real usage |
| **Email Service** | Test SMTP | Production SMTP |

---

## 🎯 When to Use Which Branch

### Use `main` branch when:
- ✅ Developing new features
- ✅ Testing bug fixes
- ✅ Experimenting with changes
- ✅ Breaking changes are okay
- ✅ Can reset database anytime

### Use `prod` branch when:
- ✅ Deploying to client
- ✅ Releasing to end users
- ✅ Features are tested and stable
- ✅ Database contains real user data
- ✅ Downtime affects real users

---

## 🔄 Syncing Strategy

### Recommended Workflow:

1. **Develop on main**
   ```bash
   git checkout main
   # develop and test
   ```

2. **Test thoroughly on test deployment**
   - Test all features
   - Check extension works
   - Verify database migrations
   - Check for errors

3. **Merge to prod when stable**
   ```bash
   git checkout prod
   git merge main
   git push origin prod
   ```

4. **Monitor production**
   - Check logs after deployment
   - Test critical paths
   - Monitor for errors

---

## ⚠️ Important Notes

1. **Never merge untested code to prod**
2. **Always test on main branch first**
3. **Keep prod branch stable at all times**
4. **Production database is sacred - no experiments**
5. **Document all production changes**
6. **Have rollback plan ready**

---

## 🔧 Emergency Rollback

If production breaks:

```bash
# In Render Dashboard
1. Go to "Events" tab
2. Find last working deployment
3. Click "Rollback"

# Or via Git
git checkout prod
git revert HEAD  # or specific commit
git push origin prod
```

---

**Remember: Test thoroughly on `main` before deploying to `prod`!** 🚀

