# 🚀 دليل النشر على الإنترنت

## الخطة: Render.com (مجاني + سريع)

سننشر المشروع بالكامل على **Render.com** باستخدام ملف `render.yaml`.

---

## ✅ الخطوة 1: رفع الكود على GitHub

```bash
git add .
git commit -m "deploy: add render.yaml + Dockerfiles"
git push origin main
```

> إذا لم يكن المشروع على GitHub بعد:
> 1. أنشئ repo جديد على https://github.com/new
> 2. `git remote add origin https://github.com/YOUR_USERNAME/scc-380.git`
> 3. `git push -u origin main`

---

## ✅ الخطوة 2: إنشاء حساب Render

1. ادخل على https://render.com
2. سجل الدخول بـ GitHub
3. اذهب إلى **Dashboard → Blueprints**
4. اضغط **New Blueprint Instance**
5. اختار repo المشروع
6. اضغط **Apply**

Render سينشئ تلقائياً:
- 🗄️ **PostgreSQL** (قاعدة بيانات مجانية)
- 🔴 **Redis** (كاش مجاني)
- ⚙️ **scc-api** (الخلفية)
- 🌐 **scc-web** (الواجهة)

---

## ✅ الخطوة 3: تشغيل Seed Data (مرة واحدة)

بعد ما يصير الـ API أخضر (Running):

1. اذهب إلى **scc-api → Shell**
2. شغل:
```bash
cd packages/database && npx prisma db push && npx tsx src/seed.ts
```

---

## ✅ الخطوة 4: الوصول للموقع

| الخدمة | الرابط |
|--------|--------|
| الواجهة | `https://scc-web-xxx.onrender.com` |
| الـ API | `https://scc-api-xxx.onrender.com` |
| Swagger Docs | `https://scc-api-xxx.onrender.com/api/docs` |

> **ملاحظة:** Render Free tier يدخل في "sleep mode" بعد 15 دقيقة من عدم الاستخدام. أول طلب قد يستغرق 30-60 ثانية للاستيقاظ.

---

## 🔧 البديل: Railway.app (أسهل)

إذا واجهت مشاكل في Render، Railway أبسط:

1. ادخل https://railway.app
2. New Project → Deploy from GitHub repo
3. اضبط:
   - Root Directory: `apps/api`
   - Start Command: `node dist/main`
   - Build Command: `npm install && npm run build`
4. أضف **PostgreSQL** من addons
5. أضف متغير `DATABASE_URL`
6. اذهب لـ Vercel وانشر `apps/web`

---

## 🔧 البديل: VPS (أقوى)

إذا عندك سيرفر (DigitalOcean, AWS, Hetzner):

```bash
# على السيرفر
git clone https://github.com/YOUR_USERNAME/scc-380.git
cd scc-380
docker compose -f infrastructure/docker/prod/docker-compose.yml up -d
```

---

## ⚠️ ملاحظات مهمة

1. **البيانات المجانية** على Render تُحذف بعد 90 يوماً من عدم الاستخدام.
2. **Redis** على Render Free لا يدعم البيانات الدائمة.
3. **MinIO + AI + Keycloak** معطّلون في النسخة المجانية. يمكن تفعيلهم لاحقاً على سيرفر منفصل.
4. **ZATCA API Keys** يجب إضافتها يدوياً في environment variables.

---

## 📞 هل تحتاج مساعدة؟

إذا واجهتك أي مشكلة في النشر، ارسل رسالة مع:
- رابط Render Dashboard
- رسالة الخطأ (Logs)
