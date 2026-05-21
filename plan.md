# خطة التنفيذ الشاملة — الوحدات المالية والامتثال

## الهدف
تفعيل وتوصيل كامل الوحدات المالية في النظام: القيود اليومية، دفتر الأستاذ، ميزان المراجعة، المركز المالي، قائمة الدخل، التدفقات النقدية، شجرة الحسابات، وإضافة أزرار ZATCA في الفواتير.

---

## 1. توصيل صفحة التقارير المالية بالـ APIs الحقيقية
**الملف:** `apps/web/src/app/dashboard/financial-reports/page.tsx`

### التعديلات:
- استبدال البيانات الثابتة باستدعاءات حقيقية:
  - `GET /reports/trial-balance`
  - `GET /reports/income-statement`
  - `GET /reports/balance-sheet`
  - `GET /reports/vat?from=&to=`
- إضافة تبويب **دفتر الأستاذ** مع Dropdown لاختيار الحساب → `GET /reports/general-ledger/:accountId`
- إضافة تبويب **التدفقات النقدية** → `GET /reports/cash-flow`
- إضافة `loading` states و `error` handling
- الاحتفاظ بـ `exportToPDF` و `exportToExcel`

---

## 2. صفحة القيود اليومية (Journal Entries)
**ملفات جديدة:**
- `apps/web/src/app/dashboard/finance/journal-entries/page.tsx`

### المحتوى:
- جدول يعرض: رقم القيد، التاريخ، الوصف، الحساب، مدين، دائن، الحالة (مسودة/مرحّل/مقلوب)
- فلاتر: نوع القيد، الحالة، نطاق التاريخ
- زر إضافة قيد جديد (Modal):
  - حقول: رقم القيد، التاريخ، الوصف، مرجع، الحساب (Dropdown من COA)، مدين، دائن، نوع القيد
- زر تعديل + حذف
- ربط من صفحة `/dashboard/finance`

### API مستخدم:
- `GET /finance/journal-entries`
- `POST /finance/journal-entries`
- `PATCH /finance/journal-entries/:id`
- `DELETE /finance/journal-entries/:id`

---

## 3. صفحة دفتر الأستاذ (General Ledger)
**ملفات جديدة:**
- `apps/web/src/app/dashboard/finance/general-ledger/page.tsx`

### المحتوى:
- Dropdown لاختيار الحساب من `GET /finance/chart-of-accounts`
- جدول يعرض القيود: التاريخ، الوصف، المرجع، مدين، دائن، الرصيد الجاري
- عرض الرصيد النهائي
- ربط من صفحة `/dashboard/finance`

### API مستخدم:
- `GET /finance/chart-of-accounts`
- `GET /reports/general-ledger/:accountId`

---

## 4. صفحة شجرة الحسابات (Chart of Accounts)
**ملفات جديدة:**
- `apps/web/src/app/dashboard/finance/chart-of-accounts/page.tsx`

### المحتوى:
- جدول/شجرة تعرض: الكود، اسم الحساب، النوع (أصل/خصم/حقوق ملكية/إيراد/مصروف)، الرصيد، الحالة
- زر إضافة حساب (Modal): كود، اسم، نوع، حساب أب (اختياري)، رصيد ابتدائي
- زر تعديل + تفعيل/تعطيل + حذف
- ربط من صفحة `/dashboard/finance`

### API مستخدم:
- `GET /finance/chart-of-accounts`
- `POST /finance/chart-of-accounts`
- `PATCH /finance/chart-of-accounts/:id`
- `DELETE /finance/chart-of-accounts/:id`

---

## 5. قائمة التدفقات النقدية (Cash Flow Statement)
**ملف API جديد:**
- `apps/api/src/reports/reports.service.ts` — إضافة دالة `getCashFlow()`
- `apps/api/src/reports/reports.controller.ts` — إضافة `@Get('cash-flow')`

### منطق الـ API:
- يحسب من `JournalEntry` حيث الحساب = **النقدية** (كود 1110 أو نوع ASSET نقدي)
- التدفقات التشغيلية: من عمليات التشغيل
- التدفقات الاستثمارية: من الأصول الثابتة
- التدفقات التمويلية: من القروض/حقوق الملكية
- صافي التغير في النقدية + الرصيد الافتتاحي والختامي

### Frontend:
- إضافة تبويب في `/dashboard/financial-reports`

---

## 6. أزرار ZATCA في صفحة الفواتير
**الملف:** `apps/web/src/app/dashboard/erp/page.tsx`

### التعديلات:
- إضافة زرين لكل فاتورة (على hover):
  - **XML** (`<FileText>`) → فتح Modal يعرض XML content من `GET /zatca/invoices/:id/xml`
  - **QR** (`<QrCode>`) → فتح Modal يعرض QR code base64 image من `GET /zatca/invoices/:id/qr`
- إضافة حالة ZATCA (Pending / Reported) على بطاقة الفاتورة

---

## 7. بيانات تجريبية (Seed Data)
**الملف:** `apps/api/prisma/seed.ts`

### الإضافات:
1. **قيود يومية** (5 قيود):
   - قيد افتتاحي: مدين النقدية 150,000 / دائن رأس المال 150,000
   - قيد مبيعات: مدين العملاء 55,000 / دائن المبيعات 55,000
   - قيد مشتريات: مدين المشتريات 30,000 / دائن النقدية 30,000
   - قيد مصروفات: مدين الإيجار 8,000 / دائن النقدية 8,000
   - قيد تسوية: مدين المخزون 25,000 / دائن النقدية 25,000
2. **تحديث رصيد الموردين** في seed (5 موردين)
3. **تحديث أرصدة حسابات دليل الحسابات** بناءً على القيود

---

## 8. تحديث Sidebar و Finance Page
- **Sidebar** (`apps/web/src/components/layout/Sidebar.tsx`): إضافة روابط فرعية تحت "المالية":
  - القيود اليومية
  - دفتر الأستاذ
  - دليل الحسابات
- **Finance Page** (`apps/web/src/app/dashboard/finance/page.tsx`): إضافة Cards قابلة للنقر توجّه للصفحات الجديدة

---

## الملفات المطلوبة

### API (تعديلات):
| الملف | التعديل |
|-------|---------|
| `apps/api/src/reports/reports.service.ts` | إضافة `getCashFlow()` |
| `apps/api/src/reports/reports.controller.ts` | إضافة endpoint `@Get('cash-flow')` |
| `apps/api/prisma/seed.ts` | إضافة Journal Entries + Supplier seed |

### Web (صفحات جديدة + تعديلات):
| الملف | العمل |
|-------|-------|
| `apps/web/src/app/dashboard/financial-reports/page.tsx` | توصيل APIs الحقيقية + تبويب دفتر الأستاذ + تبويب التدفقات النقدية |
| `apps/web/src/app/dashboard/finance/journal-entries/page.tsx` | **جديد** — صفحة القيود اليومية |
| `apps/web/src/app/dashboard/finance/general-ledger/page.tsx` | **جديد** — صفحة دفتر الأستاذ |
| `apps/web/src/app/dashboard/finance/chart-of-accounts/page.tsx` | **جديد** — صفحة دليل الحسابات |
| `apps/web/src/app/dashboard/erp/page.tsx` | إضافة أزرار ZATCA XML/QR |
| `apps/web/src/components/layout/Sidebar.tsx` | إضافة روابط فرعية للمالية |
| `apps/web/src/app/dashboard/finance/page.tsx` | إضافة Cards توجيهية |

---

## خطة التنفيذ المرحلية

### المرحلة 1: API + Seed
1. إضافة Cash Flow API
2. إضافة Journal Entries + Supplier seed data
3. تشغيل seed + اختبار APIs

### المرحلة 2: Frontend — التقارير المالية
1. تعديل `financial-reports/page.tsx` لاستدعاء APIs الحقيقية
2. إضافة تبويب دفتر الأستاذ
3. إضافة تبويب التدفقات النقدية

### المرحلة 3: Frontend — صفحات المالية الجديدة
1. إنشاء `journal-entries/page.tsx`
2. إنشاء `general-ledger/page.tsx`
3. إنشاء `chart-of-accounts/page.tsx`

### المرحلة 4: Frontend — ZATCA + Navigation
1. إضافة أزرار ZATCA في صفحة الفواتير
2. تحديث Sidebar بروابط المالية
3. تحديث Finance page بـ Cards توجيهية
4. Build + اختبار
