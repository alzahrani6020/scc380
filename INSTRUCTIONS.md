# 🚀 خطوة واحدة فقط لتفعيل النشر التلقائي

## ✅ الواجهة الأمامية (Vercel) — شغالة بالفعل!
رابط الموقع: [scc380-web.vercel.app](https://scc380-web.vercel.app)

## ❌ API (Render) — تحتاج خطوة واحدة

### الخطوة الوحيدة المطلوبة منك:

1. اذهب إلى **Render Dashboard** → [dashboard.render.com](https://dashboard.render.com)
2. أنشئ **Web Service** جديد
3. اربط مستودع **scc380**
4. الإعدادات:
   - **Name**: `scc-api`
   - **Root Directory**: `apps/api`
   - **Build Command**: `npm install && npx prisma generate && npm run build`
   - **Start Command**: `npm run start:prod`
5. أضف **Postgres** من Render (أو استخدم `render.yaml`)
6. انسخ رابط الـ API (مثل `https://scc-api.onrender.com`)

### ثم في Vercel:
1. اذهب إلى **Project Settings** → **Environment Variables**
2. أضف:
   - `NEXT_PUBLIC_API_URL` = `https://scc-api.onrender.com/api/v1`

---

## 🤖 أو استخدم GitHub Actions (أفضل)

تم إنشاء workflows تلقائية في `.github/workflows/`.

### أضف فقط هذه الـ Secrets في GitHub:

1. اذهب إلى GitHub → scc380 → Settings → Secrets and variables → Actions
2. أضف **New repository secret**:
   - `RENDER_DEPLOY_HOOK`: (انسخه من Render Dashboard → scc-api → Settings → Deploy Hook)

وبعدها كل push جديد ينشر تلقائياً! 🎉
