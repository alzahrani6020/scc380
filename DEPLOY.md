# 🚀 دليل النشر على الإنترنت

تم تجهيز المشروع بالكامل للنشر. كل ما تحتاجه هو **3 خطوات** على المواقع.

---

## ✅ الخطوة 1: رفع الكود على GitHub (تم تلقائياً)

آخر إصدار من الكود موجود على:
```
https://github.com/alzahrani6020/scc380
```

---

## ✅ الخطوة 2: نشر Backend API على Render.com

### 2.1 أنشئ حساب Render
- ادخل: https://render.com
- سجل دخول بـ **GitHub**

### 2.2 نشر عبر Blueprint (أسهل طريقة)
```
Dashboard → Blueprints → New Blueprint Instance
```
- اختار repo: `alzahrani6020/scc380`
- اضغط **Apply**

Render سينشئ تلقائياً:
- 🗄️ **PostgreSQL** (scc_main)
- 🔴 **Redis** (caching)
- ⚙️ **scc-api** (Backend)

### 2.3 انتظر البناء (10-20 دقيقة)
تابع الـ Logs في `scc-api → Logs`

### 2.4 تشغيل Seed Data (مرة واحدة فقط)
بعد ما يصير API أخضر (Running):
```
scc-api → Shell
```
شغل:
```bash
cd packages/database && npx prisma db push && npx tsx src/seed.ts
```

### 2.5 احفظ رابط API
سيكون شكله:
```
https://scc-api-xxx.onrender.com
```

---

## ✅ الخطوة 3: ربط Frontend (Vercel) بالـ API

### 3.1 ادخل Vercel Dashboard
https://vercel.com/dashboard

### 3.2 اذهب لمشروع `scc380-web`

### 3.3 أضف Environment Variable
```
Settings → Environment Variables
```
- **Name**: `NEXT_PUBLIC_API_URL`
- **Value**: `https://scc-api-xxx.onrender.com` (الرابط من الخطوة 2.5)

### 3.4 أعد النشر
```
Deployments → Redeploy
```

---

## 🔗 الروابط بعد النشر

| الخدمة | الرابط | الحالة |
|--------|--------|--------|
| الواجهة (Vercel) | `https://scc380-web.vercel.app` | ✅ يعمل |
| الـ API (Render) | `https://scc-api-xxx.onrender.com` | ⏳ بعد الخطوة 2 |
| Swagger Docs | `https://scc-api-xxx.onrender.com/api/docs` | ⏳ بعد الخطوة 2 |

---

## ⚠️ ملاحظات مهمة

1. **Render Free tier**: 512 MB RAM — البناء قد يستغرق 10-20 دقيقة
2. **Sleep Mode**: API يدخل في سبات بعد 15 دقيقة بدون استخدام — أول طلب قد يستغرق 30-60 ثانية
3. **البيانات**: Postgres Free تُحذف بعد 90 يوماً من عدم الاستخدام
4. **MinIO + AI + Keycloak**: معطّلون في النسخة المجانية

---

## 🆘 إذا فشل Build على Render

ادخل `scc-api → Settings` وغيّر إلى **Native Environment**:

- **Runtime**: Node
- **Build Command**:
  ```bash
  npm install -g pnpm && pnpm install --frozen-lockfile && pnpm --filter @scc/database exec prisma generate && pnpm --filter @scc/database build && pnpm --filter @scc/auth build && pnpm --filter @scc/types build && pnpm --filter @scc/utils build && pnpm --filter @scc/api build
  ```
- **Start Command**:
  ```bash
  node apps/api/dist/main.js
  ```

---

## 📞 هل تحتاج مساعدة؟

أرسل لي:
- رابط Render Dashboard
- رسالة الخطأ (Logs)
