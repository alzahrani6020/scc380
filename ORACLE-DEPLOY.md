# 🚀 Oracle Cloud Deployment Guide — SCC380

## المتطلبات
- حساب Oracle Cloud (مجاني)
- بطاقة بنكية للتحقق فقط (ما يخصمون)

---

## الخطوة 1: إنشاء حساب Oracle Cloud

1. روح **https://cloud.oracle.com**
2. اضغط **Sign Up** → **Sign Up for Free Tier**
3. املى البيانات (اسم، إيميل، دولة)
4. اضغط **Verify My Email**
5. افتح الإيميل واضغط على الرابط
6. املى بيانات البطاقة (للتحقق فقط — **مجاني 100%**)
7. اضغط **Complete Sign-Up**

---

## الخطوة 2: إنشاء خادم (VM)

1. سجل دخول → **Menu** (☰) → **Compute** → **Instances**
2. اضغط **Create Instance**
3. **Name**: `scc380-server`
4. **Image**: **Ubuntu 22.04** (أو Canonical Ubuntu)
5. **Shape**: 
   - اضغط **Change Shape**
   - اختار **VM.Standard.A1.Flex** (Arm) ← **هذا المجاني + قوي**
   - **OCPUs**: 2
   - **Memory**: 12 GB
6. **Networking**: اترك الافتراضي
7. **SSH Keys**: اختار **Generate** → حمّل الملف الخاص (`*.key`)
8. اضغط **Create**

---

## الخطوة 3: فتح المنافذ (Firewall)

1. في صفحة الـ Instance → اضغط على اسم **Subnet**
2. اضغط على **Default Security List**
3. اذهب لـ **Ingress Rules** → **Add Ingress Rules**
4. املى:
   - **Source CIDR**: `0.0.0.0/0`
   - **Destination Port Range**: `3001`
   - **Description**: `SCC API`
5. اضغط **Add Ingress Rules**
6. كرر نفس الخطوة مع Port `80` و `443` (لو تبي تربط Domain)

---

## الخطوة 4: الاتصال بالخادم

افتح الطرفية:

```bash
ssh -i ~/Downloads/ssh-key.key ubuntu@YOUR_VM_IP
```

> استبدل `YOUR_VM_IP` بعنوان الـ IP العام (Public IP) اللي يظهر في صفحة الـ Instance

---

## الخطوة 5: تشغيل السكريبت التلقائي

داخل الـ VM، نفذ:

```bash
curl -fsSL https://raw.githubusercontent.com/alzahrani6020/scc380/main/oracle-setup.sh | bash
```

> أو انسخ الملف `oracle-setup.sh` وشغّله:
> ```bash
> wget https://raw.githubusercontent.com/alzahrani6020/scc380/main/oracle-setup.sh
> chmod +x oracle-setup.sh
> ./oracle-setup.sh
> ```

السكريبت يسوي كل شي تلقائياً:
- ✅ يركب Docker
- ✅ ينسخ المشروع
- ✅ يبني الـ API
- ✅ يشغل Redis + API

---

## الخطوة 6: التحقق

```bash
docker-compose -f docker-compose.oracle.yml ps
```

لازم تشوف:
```
NAME                STATUS          PORTS
scc380-api-1        Up 2 minutes    0.0.0.0:3001->3001/tcp
scc380-redis-1      Up 2 minutes    127.0.0.1:6379->6379/tcp
```

اختبر الـ API:
```bash
curl http://localhost:3001/health
```

---

## الخطوة 7: ربط الـ Domain (اختياري)

### في Name.com:
1. روح **DNS Records**
2. أضف **A Record**:
   - **Host**: `api`
   - **Value**: `YOUR_VM_IP`
3. انتظر 5-10 دقايق

الآن الـ API يشتغل على:
```
https://api.dr-talal-h-alzahrani.com
```

---

## 🔧 أوامر مفيدة

| الأمر | الوصف |
|-------|-------|
| `docker-compose -f docker-compose.oracle.yml logs -f api` | شاهد سجلات الـ API |
| `docker-compose -f docker-compose.oracle.yml down` | أوقف الخدمات |
| `docker-compose -f docker-compose.oracle.yml up -d` | شغّل الخدمات |
| `docker system prune -a` | نظف المساحة |

---

## ⚠️ ملاحظات مهمة

1. **البطاقة البنكية**: للتحقق فقط — Oracle Cloud Free Tier **مجاني** وما يخصمون
2. **الـ VM**: اختار **Arm (A1.Flex)** — أقوى وأفضل من الـ AMD المجاني
3. **الـ DB**: نستخدم Supabase (موجود) → ما نحتاج PostgreSQL محلي
4. **الـ Redis**: يشتغل محلي داخل Docker

---

## 📞 دعم

لو واجهتك مشكلة، افتح Issue في:
https://github.com/alzahrani6020/scc380/issues
