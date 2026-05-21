export const seedTemplates = [
  // ======================== HR ========================
  {
    name: 'Employment Contract',
    nameAr: 'عقد عمل سعودي',
    category: 'HR',
    subcategory: 'contracts',
    description: 'عقد عمل متوافق مع نظام العمل السعودي ومنصة قوى',
    templateKey: 'employment_contract',
    paperSize: 'A4',
    orientation: 'portrait',
    icon: 'FileText',
    sortOrder: 1,
    isSystem: true,
    tags: ['عقد', 'عمل', 'قوى', 'سعودي'],
    defaultData: {
      companyName: 'شركة التقنية المتقدمة',
      companyAddress: 'الرياض، المملكة العربية السعودية',
      companyCr: '1010123456',
      employeeName: 'أحمد محمد عبدالله',
      employeeIdNumber: '1234567890',
      employeeNationality: 'سعودي',
      jobTitle: 'مدير الموارد البشرية',
      department: 'الموارد البشرية',
      contractStartDate: '2025-01-01',
      contractEndDate: '2026-01-01',
      basicSalary: '15000',
      housingAllowance: '3000',
      transportAllowance: '1500',
      contractType: 'سنوي',
      probationPeriod: '90',
      workingHours: '8',
      annualLeaveDays: '21',
    },
    htmlTemplate: `<div class="contract-page">
  <div class="contract-header">
    <h1>{{companyName}}</h1>
    <p>السجل التجاري: {{companyCr}}</p>
    <p>{{companyAddress}}</p>
  </div>
  <div class="contract-title">عقد عمل</div>
  <div class="contract-body">
    <p>في يوم {{date}} تم الاتفاق بين كل من:</p>
    <p><strong>الطرف الأول (صاحب العمل):</strong> {{companyName}}</p>
    <p><strong>الطرف الثاني (الموظف):</strong> {{employeeName}} - الجنسية: {{employeeNationality}} - رقم الهوية: {{employeeIdNumber}}</p>
    <p>حيث اتفق الطرفان على ما يلي:</p>
    <div class="contract-clauses">
      <div class="clause"><strong>1. طبيعة العمل:</strong> يعمل الطرف الثاني لدى الطرف الأول بمهنة {{jobTitle}} في قسم {{department}}.</div>
      <div class="clause"><strong>2. مدة العقد:</strong> {{contractType}} تبدأ من {{contractStartDate}} وتنتهي في {{contractEndDate}}.</div>
      <div class="clause"><strong>3. فترة التجربة:</strong> {{probationPeriod}} يوماً.</div>
      <div class="clause"><strong>4. الراتب:</strong> الراتب الأساسي {{basicSalary}} ريال + بدل سكن {{housingAllowance}} ريال + بدل نقل {{transportAllowance}} ريال.</div>
      <div class="clause"><strong>5. ساعات العمل:</strong> {{workingHours}} ساعات يومياً وفقاً لنظام العمل السعودي.</div>
      <div class="clause"><strong>6. الإجازة السنوية:</strong> {{annualLeaveDays}} يوماً مدفوعة الأجر.</div>
    </div>
    <div class="signatures">
      <div class="signature-box"><p>توقيع الطرف الأول</p><div class="sign-line"></div></div>
      <div class="signature-box"><p>توقيع الطرف الثاني</p><div class="sign-line"></div></div>
    </div>
  </div>
</div>`,
    cssStyles: `.contract-page { max-width: 800px; margin: 0 auto; font-family: 'Segoe UI', sans-serif; line-height: 1.8; color: #1a1a1a; }
.contract-header { text-align: center; border-bottom: 3px double #1a1a1a; padding-bottom: 16px; margin-bottom: 24px; }
.contract-header h1 { font-size: 20px; margin: 0 0 8px; }
.contract-title { text-align: center; font-size: 24px; font-weight: bold; margin: 24px 0; padding: 12px; background: #f8f9fa; border-radius: 8px; }
.contract-body { font-size: 14px; }
.contract-clauses { margin: 20px 0; }
.clause { margin-bottom: 12px; padding: 10px 14px; background: #fafafa; border-right: 4px solid #1a1a1a; }
.signatures { display: flex; justify-content: space-between; margin-top: 48px; }
.signature-box { text-align: center; width: 200px; }
.sign-line { border-top: 1px solid #333; margin-top: 48px; }`,
  },

  {
    name: 'Payslip',
    nameAr: 'قسيمة راتب',
    category: 'HR',
    subcategory: 'payroll',
    description: 'مسير رواتب شهري مع تفاصيل البدلات والخصومات',
    templateKey: 'payslip',
    paperSize: 'A4',
    orientation: 'portrait',
    icon: 'Receipt',
    sortOrder: 2,
    isSystem: true,
    tags: ['راتب', 'مسير', 'رواتب', 'قسيمة'],
    defaultData: {
      employeeName: 'أحمد محمد عبدالله',
      employeeId: 'EMP-001',
      employeeJobTitle: 'مدير الموارد البشرية',
      employeeDepartment: 'الموارد البشرية',
      monthYear: 'مايو 2025',
      basicSalary: '15000.00',
      housingAllowance: '3000.00',
      transportAllowance: '1500.00',
      otherAllowances: '0.00',
      totalEarnings: '19500.00',
      gosiDeduction: '900.00',
      taxDeduction: '0.00',
      otherDeductions: '500.00',
      totalDeductions: '1400.00',
      netSalary: '18100.00',
    },
    htmlTemplate: `<div class="payslip-page">
  <div class="payslip-header">
    <h1>{{companyName}}</h1>
    <p>قسيمة راتب شهر {{monthYear}}</p>
  </div>
  <div class="payslip-info">
    <div class="info-row"><span>الاسم:</span> <strong>{{employeeName}}</strong></div>
    <div class="info-row"><span>الرقم الوظيفي:</span> <strong>{{employeeId}}</strong></div>
    <div class="info-row"><span>المسمى الوظيفي:</span> <strong>{{employeeJobTitle}}</strong></div>
    <div class="info-row"><span>القسم:</span> <strong>{{employeeDepartment}}</strong></div>
  </div>
  <table class="payslip-table">
    <thead><tr><th>البيان</th><th>المبلغ (ريال)</th></tr></thead>
    <tbody>
      <tr class="section-header"><td colspan="2">الاستحقاقات</td></tr>
      <tr><td>الراتب الأساسي</td><td class="num">{{basicSalary}}</td></tr>
      <tr><td>بدل السكن</td><td class="num">{{housingAllowance}}</td></tr>
      <tr><td>بدل المواصلات</td><td class="num">{{transportAllowance}}</td></tr>
      <tr><td>بدلات أخرى</td><td class="num">{{otherAllowances}}</td></tr>
      <tr class="total-row"><td>إجمالي الاستحقاقات</td><td class="num">{{totalEarnings}}</td></tr>
      <tr class="section-header"><td colspan="2">الاستقطاعات</td></tr>
      <tr><td>التأمينات الاجتماعية</td><td class="num">{{gosiDeduction}}</td></tr>
      <tr><td>الضريبة</td><td class="num">{{taxDeduction}}</td></tr>
      <tr><td>خصومات أخرى</td><td class="num">{{otherDeductions}}</td></tr>
      <tr class="total-row"><td>إجمالي الاستقطاعات</td><td class="num">{{totalDeductions}}</td></tr>
      <tr class="net-row"><td>صافي الراتب</td><td class="num">{{netSalary}}</td></tr>
    </tbody>
  </table>
  <div class="payslip-footer">
    <p>تم إعداد هذه القسيمة إلكترونياً ولا تحتاج إلى توقيع</p>
    <p>{{companyName}} - {{date}}</p>
  </div>
</div>`,
    cssStyles: `.payslip-page { max-width: 700px; margin: 0 auto; font-family: 'Segoe UI', sans-serif; }
.payslip-header { text-align: center; border-bottom: 2px solid #1a1a1a; padding-bottom: 12px; margin-bottom: 20px; }
.payslip-header h1 { font-size: 18px; margin: 0; }
.payslip-info { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 20px; font-size: 13px; }
.info-row { display: flex; justify-content: space-between; padding: 6px 10px; background: #f8f9fa; border-radius: 4px; }
.payslip-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.payslip-table th { background: #1a1a1a; color: #fff; padding: 10px; text-align: right; }
.payslip-table td { padding: 8px 10px; border-bottom: 1px solid #e5e7eb; }
.payslip-table .num { text-align: left; direction: ltr; font-family: monospace; }
.section-header td { background: #f3f4f6; font-weight: bold; color: #374151; }
.total-row td { font-weight: bold; background: #f9fafb; }
.net-row td { font-weight: bold; font-size: 15px; background: #1a1a1a; color: #fff; }
.payslip-footer { text-align: center; margin-top: 24px; font-size: 11px; color: #6b7280; }`,
  },

  {
    name: 'Leave Request',
    nameAr: 'طلب إجازة',
    category: 'HR',
    subcategory: 'forms',
    description: 'نموذج طلب إجازة رسمي مع بيانات الرصيد',
    templateKey: 'leave_request',
    paperSize: 'A4',
    orientation: 'portrait',
    icon: 'CalendarDays',
    sortOrder: 3,
    isSystem: true,
    tags: ['إجازة', 'طلب', 'استمارة'],
    defaultData: {
      employeeName: 'أحمد محمد عبدالله',
      employeeId: 'EMP-001',
      employeeDepartment: 'الموارد البشرية',
      employeeJobTitle: 'مدير الموارد البشرية',
      leaveType: 'سنوية',
      leaveStartDate: '2025-06-01',
      leaveEndDate: '2025-06-10',
      leaveDays: '10',
      leaveBalance: '21',
      leaveReason: 'ظروف شخصية',
    },
    htmlTemplate: `<div class="form-page">
  <div class="form-header">
    <h1>{{companyName}}</h1>
    <h2>نموذج طلب إجازة</h2>
  </div>
  <div class="form-body">
    <div class="form-row"><label>الاسم:</label><div class="field">{{employeeName}}</div></div>
    <div class="form-row"><label>الرقم الوظيفي:</label><div class="field">{{employeeId}}</div></div>
    <div class="form-row"><label>القسم:</label><div class="field">{{employeeDepartment}}</div></div>
    <div class="form-row"><label>المسمى الوظيفي:</label><div class="field">{{employeeJobTitle}}</div></div>
    <div class="form-row"><label>نوع الإجازة:</label><div class="field">{{leaveType}}</div></div>
    <div class="form-row"><label>تاريخ البدء:</label><div class="field">{{leaveStartDate}}</div></div>
    <div class="form-row"><label>تاريخ الانتهاء:</label><div class="field">{{leaveEndDate}}</div></div>
    <div class="form-row"><label>عدد الأيام:</label><div class="field">{{leaveDays}}</div></div>
    <div class="form-row"><label>الرصيد المتبقي:</label><div class="field">{{leaveBalance}} يوم</div></div>
    <div class="form-row"><label>السبب:</label><div class="field">{{leaveReason}}</div></div>
  </div>
  <div class="form-approvals">
    <div class="approval-box"><p>موافقة المدير المباشر</p><div class="sign-line"></div><p class="date">التاريخ: ____/____/________</p></div>
    <div class="approval-box"><p>موافقة الموارد البشرية</p><div class="sign-line"></div><p class="date">التاريخ: ____/____/________</p></div>
  </div>
</div>`,
    cssStyles: `.form-page { max-width: 700px; margin: 0 auto; font-family: 'Segoe UI', sans-serif; padding: 20px; }
.form-header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #1a1a1a; padding-bottom: 16px; }
.form-header h1 { font-size: 18px; margin: 0 0 8px; }
.form-header h2 { font-size: 22px; margin: 0; color: #2563eb; }
.form-body { margin-bottom: 30px; }
.form-row { display: flex; align-items: center; padding: 10px 0; border-bottom: 1px solid #e5e7eb; }
.form-row label { width: 160px; font-weight: 600; color: #374151; }
.form-row .field { flex: 1; padding: 8px 12px; background: #f9fafb; border: 1px solid #d1d5db; border-radius: 6px; min-height: 20px; }
.form-approvals { display: flex; gap: 40px; margin-top: 40px; }
.approval-box { flex: 1; text-align: center; }
.sign-line { border-top: 1px solid #333; margin: 40px auto 8px; width: 80%; }
.date { font-size: 11px; color: #6b7280; }`,
  },

  // ======================== ACCOUNTING ========================
  {
    name: 'Tax Invoice',
    nameAr: 'فاتورة ضريبية',
    category: 'ACCOUNTING',
    subcategory: 'invoices',
    description: 'فاتورة ضريبة القيمة المضافة متوافقة مع ZATCA',
    templateKey: 'tax_invoice',
    paperSize: 'A4',
    orientation: 'portrait',
    icon: 'Receipt',
    sortOrder: 1,
    isSystem: true,
    tags: ['فاتورة', 'VAT', 'ZATCA', 'ضريبة'],
    defaultData: {
      invoiceNumber: 'INV-2025-001',
      invoiceDate: '2025-05-14',
      invoiceDueDate: '2025-06-14',
      companyName: 'شركة التقنية المتقدمة',
      companyVat: '300012345600003',
      companyAddress: 'الرياض، المملكة العربية السعودية',
      customerName: 'شركة المستقبل التجارية',
      customerVat: '300098765400002',
      customerAddress: 'جدة، المملكة العربية السعودية',
      subtotal: '10000.00',
      taxRate: '15',
      taxAmount: '1500.00',
      discount: '0.00',
      total: '11500.00',
      items: [
        { description: 'خدمات استشارية', quantity: 10, unitPrice: 500, total: 5000 },
        { description: 'ترخيص برنامج سنوي', quantity: 2, unitPrice: 2500, total: 5000 },
      ],
    },
    htmlTemplate: `<div class="invoice-page">
  <div class="invoice-header">
    <div class="company-info">
      <h1>{{companyName}}</h1>
      <p>الرقم الضريبي: {{companyVat}}</p>
      <p>{{companyAddress}}</p>
    </div>
    <div class="invoice-meta">
      <div class="meta-box"><span>رقم الفاتورة</span><strong>{{invoiceNumber}}</strong></div>
      <div class="meta-box"><span>التاريخ</span><strong>{{invoiceDate}}</strong></div>
      <div class="meta-box"><span>تاريخ الاستحقاق</span><strong>{{invoiceDueDate}}</strong></div>
    </div>
  </div>
  <div class="invoice-parties">
    <div class="party"><strong>مِن:</strong><p>{{companyName}}</p><p>الرقم الضريبي: {{companyVat}}</p></div>
    <div class="party"><strong>إلى:</strong><p>{{customerName}}</p><p>الرقم الضريبي: {{customerVat}}</p></div>
  </div>
  <table class="invoice-table">
    <thead><tr><th>#</th><th>البيان</th><th>الكمية</th><th>السعر</th><th>الإجمالي</th></tr></thead>
    <tbody>
      {{#each items}}
      <tr><td>{{index}}</td><td>{{description}}</td><td class="num">{{quantity}}</td><td class="num">{{unitPrice}}</td><td class="num">{{total}}</td></tr>
      {{/each}}
    </tbody>
  </table>
  <div class="invoice-totals">
    <div class="total-row"><span>المجموع</span><strong>{{subtotal}} ر.س</strong></div>
    <div class="total-row"><span>الخصم</span><strong>{{discount}} ر.س</strong></div>
    <div class="total-row"><span>الضريبة ({{taxRate}}%)</span><strong>{{taxAmount}} ر.س</strong></div>
    <div class="total-row grand"><span>الإجمالي مع الضريبة</span><strong>{{total}} ر.س</strong></div>
  </div>
  <div class="invoice-footer">
    <p>شكراً لتعاملكم معنا</p>
  </div>
</div>`,
    cssStyles: `.invoice-page { max-width: 800px; margin: 0 auto; font-family: 'Segoe UI', sans-serif; padding: 24px; }
.invoice-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; border-bottom: 2px solid #1a1a1a; padding-bottom: 16px; }
.company-info h1 { font-size: 20px; margin: 0 0 6px; }
.invoice-meta { display: flex; gap: 12px; }
.meta-box { background: #f3f4f6; padding: 10px 16px; border-radius: 6px; text-align: center; }
.meta-box span { display: block; font-size: 11px; color: #6b7280; }
.meta-box strong { display: block; font-size: 14px; }
.invoice-parties { display: flex; gap: 24px; margin-bottom: 24px; }
.party { flex: 1; padding: 12px; background: #f9fafb; border-radius: 6px; }
.invoice-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 13px; }
.invoice-table th { background: #1a1a1a; color: #fff; padding: 10px; text-align: center; }
.invoice-table td { padding: 10px; border-bottom: 1px solid #e5e7eb; text-align: center; }
.invoice-table td:nth-child(2) { text-align: right; }
.invoice-table .num { font-family: monospace; direction: ltr; }
.invoice-totals { width: 300px; margin-right: auto; margin-left: 0; }
.total-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e5e7eb; }
.total-row.grand { font-size: 16px; font-weight: bold; background: #1a1a1a; color: #fff; padding: 12px; border-radius: 6px; margin-top: 8px; }
.invoice-footer { text-align: center; margin-top: 30px; font-size: 12px; color: #6b7280; }`,
  },

  {
    name: 'Journal Entry',
    nameAr: 'قيد يومية',
    category: 'ACCOUNTING',
    subcategory: 'ledger',
    description: 'سجل قيد محاسبي للدفتر اليومي',
    templateKey: 'journal_entry',
    paperSize: 'A4',
    orientation: 'portrait',
    icon: 'BookOpen',
    sortOrder: 2,
    isSystem: true,
    tags: ['قيود', 'يومية', 'محاسبة', 'دفتر'],
    defaultData: {
      entryNumber: 'JE-2025-001',
      entryDate: '2025-05-14',
      description: 'شراء أثاث مكتبي',
      reference: 'PO-2025-008',
      debitAccount: 'أثاث ومفروشات',
      debitAmount: '5000.00',
      creditAccount: 'البنك',
      creditAmount: '5000.00',
      preparedBy: 'محمد العلي',
      approvedBy: 'أحمد الكعبي',
    },
    htmlTemplate: `<div class="journal-page">
  <div class="journal-header">
    <h1>{{companyName}}</h1>
    <h2>سجل قيد يومية</h2>
  </div>
  <div class="journal-meta">
    <div class="meta-row"><span>رقم القيد:</span> <strong>{{entryNumber}}</strong></div>
    <div class="meta-row"><span>التاريخ:</span> <strong>{{entryDate}}</strong></div>
    <div class="meta-row"><span>المرجع:</span> <strong>{{reference}}</strong></div>
    <div class="meta-row"><span>البيان:</span> <strong>{{description}}</strong></div>
  </div>
  <table class="journal-table">
    <thead><tr><th>الحساب</th><th>مدين</th><th>دائن</th></tr></thead>
    <tbody>
      <tr><td>{{debitAccount}}</td><td class="num">{{debitAmount}}</td><td class="num">-</td></tr>
      <tr><td>{{creditAccount}}</td><td class="num">-</td><td class="num">{{creditAmount}}</td></tr>
      <tr class="total"><td>المجموع</td><td class="num">{{debitAmount}}</td><td class="num">{{creditAmount}}</td></tr>
    </tbody>
  </table>
  <div class="journal-footer">
    <div class="footer-row"><span>أعدّه:</span> {{preparedBy}}</div>
    <div class="footer-row"><span>راجعه:</span> {{approvedBy}}</div>
  </div>
</div>`,
    cssStyles: `.journal-page { max-width: 700px; margin: 0 auto; font-family: 'Segoe UI', sans-serif; padding: 24px; }
.journal-header { text-align: center; margin-bottom: 24px; border-bottom: 2px solid #1a1a1a; padding-bottom: 12px; }
.journal-header h2 { color: #2563eb; margin: 8px 0 0; }
.journal-meta { margin-bottom: 20px; }
.meta-row { display: flex; padding: 6px 0; border-bottom: 1px dashed #d1d5db; }
.meta-row span { width: 100px; color: #6b7280; }
.journal-table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
.journal-table th { background: #1a1a1a; color: #fff; padding: 10px; text-align: center; }
.journal-table td { padding: 10px; border-bottom: 1px solid #e5e7eb; text-align: center; }
.journal-table td:first-child { text-align: right; }
.journal-table .num { font-family: monospace; direction: ltr; }
.journal-table .total td { font-weight: bold; background: #f3f4f6; }
.journal-footer { display: flex; gap: 40px; margin-top: 40px; }
.footer-row { flex: 1; padding-top: 8px; border-top: 1px solid #333; }`,
  },

  {
    name: 'Balance Sheet',
    nameAr: 'الميزانية العمومية',
    category: 'ACCOUNTING',
    subcategory: 'financial_statements',
    description: 'قائمة المركز المالي (الميزانية العمومية)',
    templateKey: 'balance_sheet',
    paperSize: 'A4',
    orientation: 'portrait',
    icon: 'Scale',
    sortOrder: 3,
    isSystem: true,
    tags: ['ميزانية', 'عمومية', 'قائمة', 'مركز', 'مالي'],
    defaultData: {
      reportDate: '2025-05-14',
      period: '31 ديسمبر 2024',
      cash: '50000.00',
      bank: '150000.00',
      inventory: '75000.00',
      receivables: '120000.00',
      currentAssets: '395000.00',
      fixedAssets: '500000.00',
      totalAssets: '895000.00',
      payables: '80000.00',
      shortTermLoans: '50000.00',
      currentLiabilities: '130000.00',
      longTermLoans: '200000.00',
      totalLiabilities: '330000.00',
      capital: '400000.00',
      retainedEarnings: '165000.00',
      totalEquity: '565000.00',
      totalLiabilitiesEquity: '895000.00',
    },
    htmlTemplate: `<div class="bs-page">
  <div class="bs-header">
    <h1>{{companyName}}</h1>
    <h2>الميزانية العمومية</h2>
    <p>في {{period}}</p>
  </div>
  <div class="bs-columns">
    <div class="bs-column">
      <h3>الأصول</h3>
      <div class="bs-section">
        <h4>الأصول المتداولة</h4>
        <div class="bs-line"><span>النقدية</span><span class="num">{{cash}}</span></div>
        <div class="bs-line"><span>البنوك</span><span class="num">{{bank}}</span></div>
        <div class="bs-line"><span>المخزون</span><span class="num">{{inventory}}</span></div>
        <div class="bs-line"><span>الذمم المدينة</span><span class="num">{{receivables}}</span></div>
        <div class="bs-line total"><span>إجمالي الأصول المتداولة</span><span class="num">{{currentAssets}}</span></div>
      </div>
      <div class="bs-section">
        <h4>الأصول غير المتداولة</h4>
        <div class="bs-line total"><span>إجمالي الأصول غير المتداولة</span><span class="num">{{fixedAssets}}</span></div>
      </div>
      <div class="bs-line grand"><span>إجمالي الأصول</span><span class="num">{{totalAssets}}</span></div>
    </div>
    <div class="bs-column">
      <h3>الخصوم وحقوق الملكية</h3>
      <div class="bs-section">
        <h4>الخصوم المتداولة</h4>
        <div class="bs-line"><span>الذمم الدائنة</span><span class="num">{{payables}}</span></div>
        <div class="bs-line"><span>قروض قصيرة الأجل</span><span class="num">{{shortTermLoans}}</span></div>
        <div class="bs-line total"><span>إجمالي الخصوم المتداولة</span><span class="num">{{currentLiabilities}}</span></div>
      </div>
      <div class="bs-section">
        <h4>الخصوم غير المتداولة</h4>
        <div class="bs-line"><span>قروض طويلة الأجل</span><span class="num">{{longTermLoans}}</span></div>
        <div class="bs-line total"><span>إجمالي الخصوم</span><span class="num">{{totalLiabilities}}</span></div>
      </div>
      <div class="bs-section">
        <h4>حقوق الملكية</h4>
        <div class="bs-line"><span>رأس المال</span><span class="num">{{capital}}</span></div>
        <div class="bs-line"><span>الأرباح المحتجزة</span><span class="num">{{retainedEarnings}}</span></div>
        <div class="bs-line total"><span>إجمالي حقوق الملكية</span><span class="num">{{totalEquity}}</span></div>
      </div>
      <div class="bs-line grand"><span>إجمالي الخصوم وحقوق الملكية</span><span class="num">{{totalLiabilitiesEquity}}</span></div>
    </div>
  </div>
</div>`,
    cssStyles: `.bs-page { max-width: 900px; margin: 0 auto; font-family: 'Segoe UI', sans-serif; padding: 24px; }
.bs-header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #1a1a1a; padding-bottom: 16px; }
.bs-header h2 { color: #2563eb; margin: 8px 0; }
.bs-columns { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
.bs-column h3 { font-size: 16px; background: #1a1a1a; color: #fff; padding: 10px; border-radius: 6px; margin-bottom: 12px; }
.bs-section { margin-bottom: 16px; }
.bs-section h4 { font-size: 13px; color: #6b7280; margin: 8px 0; padding-bottom: 4px; border-bottom: 1px solid #e5e7eb; }
.bs-line { display: flex; justify-content: space-between; padding: 6px 0; font-size: 13px; }
.bs-line.total { font-weight: bold; background: #f3f4f6; padding: 8px; border-radius: 4px; margin-top: 4px; }
.bs-line.grand { font-weight: bold; font-size: 15px; background: #1a1a1a; color: #fff; padding: 10px; border-radius: 6px; margin-top: 12px; }
.num { font-family: monospace; direction: ltr; }`,
  },

  // ======================== ADMIN ========================
  {
    name: 'Meeting Minutes',
    nameAr: 'محضر اجتماع',
    category: 'ADMIN',
    subcategory: 'documents',
    description: 'محضر اجتماع رسمي مع قائمة الحضور والقرارات',
    templateKey: 'meeting_minutes',
    paperSize: 'A4',
    orientation: 'portrait',
    icon: 'Users',
    sortOrder: 1,
    isSystem: true,
    tags: ['اجتماع', 'محضر', 'قرارات'],
    defaultData: {
      meetingNumber: 'MTG-2025-045',
      meetingDate: '2025-05-14',
      meetingTime: '10:00 ص',
      meetingLocation: 'قاعة الاجتماعات الرئيسية',
      meetingSubject: 'مراجعة الأداء الربع سنوي',
      attendees: 'أحمد الكعبي، محمد العلي، سارة الفهد، خالد السعيد',
      agenda: '1. مراجعة الأهداف الربع سنوية\n2. تقييم أداء الفرق\n3. خطط الفصل القادم',
      decisions: '1. تمديد مشروع X حتى نهاية يونيو\n2. تعيين 3 موظفين جدد\n3. زيادة ميزانية التسويق 20%',
      nextMeetingDate: '2025-06-15',
      secretary: 'سارة الفهد',
    },
    htmlTemplate: `<div class="minutes-page">
  <div class="minutes-header">
    <h1>{{companyName}}</h1>
    <h2>محضر اجتماع</h2>
  </div>
  <div class="minutes-meta">
    <div class="meta-grid">
      <div><span>رقم الاجتماع:</span> <strong>{{meetingNumber}}</strong></div>
      <div><span>التاريخ:</span> <strong>{{meetingDate}}</strong></div>
      <div><span>الوقت:</span> <strong>{{meetingTime}}</strong></div>
      <div><span>المكان:</span> <strong>{{meetingLocation}}</strong></div>
      <div class="full"><span>الموضوع:</span> <strong>{{meetingSubject}}</strong></div>
    </div>
  </div>
  <div class="minutes-section">
    <h3>الحضور</h3>
    <p>{{attendees}}</p>
  </div>
  <div class="minutes-section">
    <h3>جدول الأعمال</h3>
    <pre>{{agenda}}</pre>
  </div>
  <div class="minutes-section">
    <h3>القرارات</h3>
    <pre>{{decisions}}</pre>
  </div>
  <div class="minutes-footer">
    <div><span>تاريخ الاجتماع القادم:</span> <strong>{{nextMeetingDate}}</strong></div>
    <div><span>السكرتير:</span> <strong>{{secretary}}</strong></div>
  </div>
</div>`,
    cssStyles: `.minutes-page { max-width: 750px; margin: 0 auto; font-family: 'Segoe UI', sans-serif; padding: 24px; }
.minutes-header { text-align: center; margin-bottom: 24px; border-bottom: 2px solid #1a1a1a; padding-bottom: 12px; }
.minutes-header h2 { color: #2563eb; }
.meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 20px; }
.meta-grid .full { grid-column: 1 / -1; }
.meta-grid div { padding: 8px 12px; background: #f9fafb; border-radius: 6px; font-size: 13px; }
.meta-grid span { color: #6b7280; }
.minutes-section { margin-bottom: 20px; }
.minutes-section h3 { font-size: 15px; background: #f3f4f6; padding: 8px 12px; border-radius: 6px; margin-bottom: 10px; }
.minutes-section pre { white-space: pre-wrap; font-family: inherit; line-height: 1.8; padding: 0 8px; }
.minutes-footer { display: flex; justify-content: space-between; margin-top: 40px; padding-top: 16px; border-top: 2px solid #1a1a1a; font-size: 13px; }`,
  },

  {
    name: 'Purchase Order',
    nameAr: 'أمر شراء',
    category: 'ADMIN',
    subcategory: 'procurement',
    description: 'أمر شراء رسمي للموردين',
    templateKey: 'purchase_order',
    paperSize: 'A4',
    orientation: 'portrait',
    icon: 'ShoppingCart',
    sortOrder: 2,
    isSystem: true,
    tags: ['شراء', 'PO', 'مورد'],
    defaultData: {
      poNumber: 'PO-2025-012',
      poDate: '2025-05-14',
      vendorName: 'شركة التوريدات الحديثة',
      vendorAddress: 'الدمام، المملكة العربية السعودية',
      vendorPhone: '013-5678900',
      deliveryDate: '2025-06-01',
      paymentTerms: '30 يوماً',
      subtotal: '25000.00',
      taxAmount: '3750.00',
      total: '28750.00',
      items: [
        { description: 'حاسب محمول Dell Latitude', quantity: 5, unitPrice: 3500, total: 17500 },
        { description: 'شاشة 27 بوصة', quantity: 5, unitPrice: 1500, total: 7500 },
      ],
    },
    htmlTemplate: `<div class="po-page">
  <div class="po-header">
    <div class="company"><h1>{{companyName}}</h1><p>{{companyAddress}}</p></div>
    <div class="po-title"><h2>أمر شراء</h2><p>رقم: {{poNumber}}</p><p>التاريخ: {{poDate}}</p></div>
  </div>
  <div class="po-vendor">
    <strong>المورد:</strong>
    <p>{{vendorName}}</p>
    <p>{{vendorAddress}}</p>
    <p>هاتف: {{vendorPhone}}</p>
  </div>
  <table class="po-table">
    <thead><tr><th>#</th><th>البيان</th><th>الكمية</th><th>السعر</th><th>الإجمالي</th></tr></thead>
    <tbody>
      {{#each items}}
      <tr><td>{{index}}</td><td>{{description}}</td><td class="num">{{quantity}}</td><td class="num">{{unitPrice}}</td><td class="num">{{total}}</td></tr>
      {{/each}}
    </tbody>
  </table>
  <div class="po-totals">
    <div class="total-row"><span>المجموع</span><strong>{{subtotal}} ر.س</strong></div>
    <div class="total-row"><span>الضريبة</span><strong>{{taxAmount}} ر.س</strong></div>
    <div class="total-row grand"><span>الإجمالي</span><strong>{{total}} ر.س</strong></div>
  </div>
  <div class="po-terms">
    <p><strong>تاريخ التسليم:</strong> {{deliveryDate}}</p>
    <p><strong>شروط الدفع:</strong> {{paymentTerms}}</p>
  </div>
  <div class="po-signatures">
    <div class="sign-box"><p>المُفوّض</p><div class="line"></div></div>
    <div class="sign-box"><p>المُدير المالي</p><div class="line"></div></div>
  </div>
</div>`,
    cssStyles: `.po-page { max-width: 800px; margin: 0 auto; font-family: 'Segoe UI', sans-serif; padding: 24px; }
.po-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; border-bottom: 2px solid #1a1a1a; padding-bottom: 16px; }
.po-title { text-align: left; direction: ltr; }
.po-title h2 { color: #2563eb; margin: 0; }
.po-vendor { background: #f9fafb; padding: 12px; border-radius: 6px; margin-bottom: 20px; }
.po-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 13px; }
.po-table th { background: #1a1a1a; color: #fff; padding: 10px; text-align: center; }
.po-table td { padding: 10px; border-bottom: 1px solid #e5e7eb; text-align: center; }
.po-table td:nth-child(2) { text-align: right; }
.num { font-family: monospace; direction: ltr; }
.po-totals { width: 280px; margin-right: auto; }
.total-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e5e7eb; }
.total-row.grand { font-weight: bold; background: #1a1a1a; color: #fff; padding: 12px; border-radius: 6px; margin-top: 8px; }
.po-terms { margin: 20px 0; font-size: 13px; }
.po-signatures { display: flex; gap: 40px; margin-top: 40px; }
.sign-box { flex: 1; text-align: center; }
.line { border-top: 1px solid #333; margin: 40px auto 8px; width: 80%; }`,
  },

  // ======================== LEGAL ========================
  {
    name: 'NDA Agreement',
    nameAr: 'اتفاقية سرية',
    category: 'LEGAL',
    subcategory: 'contracts',
    description: 'اتفاقية عدم إفشاء سرية بين طرفين',
    templateKey: 'nda_agreement',
    paperSize: 'A4',
    orientation: 'portrait',
    icon: 'Shield',
    sortOrder: 1,
    isSystem: true,
    tags: ['سرية', 'NDA', 'عقد'],
    defaultData: {
      party1Name: 'شركة التقنية المتقدمة',
      party1Cr: '1010123456',
      party1Address: 'الرياض، المملكة العربية السعودية',
      party2Name: 'شركة المستقبل التجارية',
      party2Cr: '1010987654',
      party2Address: 'جدة، المملكة العربية السعودية',
      agreementDate: '2025-05-14',
      agreementDuration: '3 سنوات',
      jurisdiction: 'الرياض، المملكة العربية السعودية',
    },
    htmlTemplate: `<div class="legal-page">
  <div class="legal-header">
    <h1>اتفاقية عدم إفشاء</h1>
    <p>Non-Disclosure Agreement</p>
  </div>
  <div class="legal-body">
    <p>في يوم {{agreementDate}} تم الاتفاق بين:</p>
    <div class="party"><strong>الطرف الأول:</strong> {{party1Name}}، سجل تجاري: {{party1Cr}}، العنوان: {{party1Address}}</div>
    <div class="party"><strong>الطرف الثاني:</strong> {{party2Name}}، سجل تجاري: {{party2Cr}}، العنوان: {{party2Address}}</div>
    <p>واتفق الطرفان على ما يلي:</p>
    <div class="clauses">
      <div class="clause"><strong>1. التعريف:</strong> يُقصد بالمعلومات السرية أي بيانات تقنية أو تجارية أو مالية أو غيرها يتم تبادلها بين الطرفين.</div>
      <div class="clause"><strong>2. الالتزام:</strong> يلتزم الطرفان بعدم إفشاء المعلومات السرية لأي طرف ثالث دون موافقة خطية.</div>
      <div class="clause"><strong>3. المدة:</strong> تبدأ الاتفاقية من تاريخ التوقيع وتستمر لمدة {{agreementDuration}}.</div>
      <div class="clause"><strong>4. القانون الواجب التطبيق:</strong> تخضع هذه الاتفاقية لقوانين المملكة العربية السعودية، وتكون محاكم {{jurisdiction}} مختصة بالنظر في المنازعات.</div>
    </div>
    <div class="legal-signatures">
      <div class="sign-box"><p>توقيع الطرف الأول</p><div class="line"></div><p>{{party1Name}}</p></div>
      <div class="sign-box"><p>توقيع الطرف الثاني</p><div class="line"></div><p>{{party2Name}}</p></div>
    </div>
  </div>
</div>`,
    cssStyles: `.legal-page { max-width: 750px; margin: 0 auto; font-family: 'Segoe UI', sans-serif; padding: 24px; line-height: 1.9; }
.legal-header { text-align: center; margin-bottom: 30px; border-bottom: 3px double #1a1a1a; padding-bottom: 16px; }
.legal-header h1 { font-size: 22px; margin: 0; }
.legal-header p { color: #6b7280; margin: 4px 0 0; }
.party { background: #f9fafb; padding: 12px; border-radius: 6px; margin: 12px 0; }
.clauses { margin: 20px 0; }
.clause { margin-bottom: 14px; padding: 12px 16px; background: #fafafa; border-right: 4px solid #2563eb; }
.legal-signatures { display: flex; gap: 40px; margin-top: 48px; }
.sign-box { flex: 1; text-align: center; }
.line { border-top: 1px solid #333; margin: 40px auto 8px; width: 80%; }`,
  },

  // ======================== FLEET ========================
  {
    name: 'Vehicle Maintenance Request',
    nameAr: 'طلب صيانة مركبة',
    category: 'FLEET',
    subcategory: 'maintenance',
    description: 'نموذج طلب صيانة للمركبات مع تفاصيل الأعطال',
    templateKey: 'vehicle_maintenance',
    paperSize: 'A4',
    orientation: 'portrait',
    icon: 'Wrench',
    sortOrder: 1,
    isSystem: true,
    tags: ['صيانة', 'مركبة', 'أسطول'],
    defaultData: {
      requestNumber: 'MNT-2025-089',
      requestDate: '2025-05-14',
      vehiclePlate: 'أ ب ج 1234',
      vehicleMake: 'تويوتا',
      vehicleModel: 'لاند كروزر',
      vehicleYear: '2024',
      vehicleVin: 'JTMBU4DV3B5000000',
      driverName: 'خالد سعد الفهد',
      maintenanceType: 'صيانة دورية',
      mileage: '45000',
      issueDescription: 'تغيير زيت المحرك + فلتر + فحص الفرامل',
      estimatedCost: '2500.00',
      serviceCenter: 'وكالة عبداللطيف جميل',
      expectedCompletion: '2025-05-16',
    },
    htmlTemplate: `<div class="form-page">
  <div class="form-header">
    <h1>{{companyName}}</h1>
    <h2>طلب صيانة مركبة</h2>
  </div>
  <div class="form-body">
    <div class="form-row"><label>رقم الطلب:</label><div class="field">{{requestNumber}}</div></div>
    <div class="form-row"><label>التاريخ:</label><div class="field">{{requestDate}}</div></div>
    <div class="form-row"><label>لوحة المركبة:</label><div class="field">{{vehiclePlate}}</div></div>
    <div class="form-row"><label>النوع / الموديل:</label><div class="field">{{vehicleMake}} {{vehicleModel}} {{vehicleYear}}</div></div>
    <div class="form-row"><label>رقم الهيكل:</label><div class="field">{{vehicleVin}}</div></div>
    <div class="form-row"><label>السائق:</label><div class="field">{{driverName}}</div></div>
    <div class="form-row"><label>نوع الصيانة:</label><div class="field">{{maintenanceType}}</div></div>
    <div class="form-row"><label>العداد:</label><div class="field">{{mileage}} كم</div></div>
    <div class="form-row"><label>وصف العطل:</label><div class="field">{{issueDescription}}</div></div>
    <div class="form-row"><label>التكلفة المتوقعة:</label><div class="field">{{estimatedCost}} ر.س</div></div>
    <div class="form-row"><label>مركز الصيانة:</label><div class="field">{{serviceCenter}}</div></div>
    <div class="form-row"><label>تاريخ الإنجاز المتوقع:</label><div class="field">{{expectedCompletion}}</div></div>
  </div>
  <div class="form-approvals">
    <div class="approval-box"><p>توقيع السائق</p><div class="sign-line"></div></div>
    <div class="approval-box"><p>توقيع مدير الأسطول</p><div class="sign-line"></div></div>
  </div>
</div>`,
    cssStyles: `.form-page { max-width: 700px; margin: 0 auto; font-family: 'Segoe UI', sans-serif; padding: 20px; }
.form-header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #1a1a1a; padding-bottom: 16px; }
.form-header h1 { font-size: 18px; margin: 0 0 8px; }
.form-header h2 { font-size: 22px; margin: 0; color: #ea580c; }
.form-body { margin-bottom: 30px; }
.form-row { display: flex; align-items: center; padding: 10px 0; border-bottom: 1px solid #e5e7eb; }
.form-row label { width: 160px; font-weight: 600; color: #374151; }
.form-row .field { flex: 1; padding: 8px 12px; background: #f9fafb; border: 1px solid #d1d5db; border-radius: 6px; min-height: 20px; }
.form-approvals { display: flex; gap: 40px; margin-top: 40px; }
.approval-box { flex: 1; text-align: center; }
.sign-line { border-top: 1px solid #333; margin: 40px auto 8px; width: 80%; }`,
  },

  {
    name: 'Vehicle Inspection',
    nameAr: 'كشف حالة مركبة',
    category: 'FLEET',
    subcategory: 'inspection',
    description: 'كشف فحص دوري لحالة المركبة',
    templateKey: 'vehicle_inspection',
    paperSize: 'A4',
    orientation: 'portrait',
    icon: 'ClipboardList',
    sortOrder: 2,
    isSystem: true,
    tags: ['فحص', 'مركبة', 'كشف', 'جرد'],
    defaultData: {
      inspectionDate: '2025-05-14',
      vehiclePlate: 'أ ب ج 1234',
      vehicleMake: 'تويوتا',
      vehicleModel: 'لاند كروزر',
      vehicleYear: '2024',
      vehicleColor: 'أبيض',
      vehicleVin: 'JTMBU4DV3B5000000',
      mileage: '45000',
      inspectorName: 'فهد السالم',
      tiresCondition: 'جيد',
      brakesCondition: 'جيد',
      oilLevel: 'ممتاز',
      lightsCondition: 'جيد',
      batteryCondition: 'مقبول',
      notes: 'يوصى بتغيير البطارية خلال 3 أشهر',
    },
    htmlTemplate: `<div class="form-page">
  <div class="form-header">
    <h1>{{companyName}}</h1>
    <h2>كشف فحص مركبة</h2>
  </div>
  <div class="form-body">
    <div class="form-row"><label>تاريخ الفحص:</label><div class="field">{{inspectionDate}}</div></div>
    <div class="form-row"><label>المركبة:</label><div class="field">{{vehicleMake}} {{vehicleModel}} {{vehicleYear}} - {{vehicleColor}}</div></div>
    <div class="form-row"><label>اللوحة:</label><div class="field">{{vehiclePlate}}</div></div>
    <div class="form-row"><label>رقم الهيكل:</label><div class="field">{{vehicleVin}}</div></div>
    <div class="form-row"><label>العداد:</label><div class="field">{{mileage}} كم</div></div>
    <div class="form-row"><label>الفاحص:</label><div class="field">{{inspectorName}}</div></div>
    <div class="form-row"><label>حالة الإطارات:</label><div class="field">{{tiresCondition}}</div></div>
    <div class="form-row"><label>حالة الفرامل:</label><div class="field">{{brakesCondition}}</div></div>
    <div class="form-row"><label>مستوى الزيت:</label><div class="field">{{oilLevel}}</div></div>
    <div class="form-row"><label>حولة الأنوار:</label><div class="field">{{lightsCondition}}</div></div>
    <div class="form-row"><label>حالة البطارية:</label><div class="field">{{batteryCondition}}</div></div>
    <div class="form-row"><label>ملاحظات:</label><div class="field">{{notes}}</div></div>
  </div>
  <div class="form-approvals">
    <div class="approval-box"><p>توقيع الفاحص</p><div class="sign-line"></div></div>
    <div class="approval-box"><p>توقيع مدير الأسطول</p><div class="sign-line"></div></div>
  </div>
</div>`,
    cssStyles: `.form-page { max-width: 700px; margin: 0 auto; font-family: 'Segoe UI', sans-serif; padding: 20px; }
.form-header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #1a1a1a; padding-bottom: 16px; }
.form-header h1 { font-size: 18px; margin: 0 0 8px; }
.form-header h2 { font-size: 22px; margin: 0; color: #ea580c; }
.form-body { margin-bottom: 30px; }
.form-row { display: flex; align-items: center; padding: 10px 0; border-bottom: 1px solid #e5e7eb; }
.form-row label { width: 160px; font-weight: 600; color: #374151; }
.form-row .field { flex: 1; padding: 8px 12px; background: #f9fafb; border: 1px solid #d1d5db; border-radius: 6px; min-height: 20px; }
.form-approvals { display: flex; gap: 40px; margin-top: 40px; }
.approval-box { flex: 1; text-align: center; }
.sign-line { border-top: 1px solid #333; margin: 40px auto 8px; width: 80%; }`,
  },

  // ======================== SALES ========================
  {
    name: 'Quotation',
    nameAr: 'عرض سعر',
    category: 'SALES',
    subcategory: 'quotes',
    description: 'عرض سعر رسمي للعملاء',
    templateKey: 'quotation',
    paperSize: 'A4',
    orientation: 'portrait',
    icon: 'FileText',
    sortOrder: 1,
    isSystem: true,
    tags: ['عرض', 'سعر', 'عميل', ' quotation'],
    defaultData: {
      quoteNumber: 'QT-2025-056',
      quoteDate: '2025-05-14',
      validUntil: '2025-06-14',
      customerName: 'شركة المستقبل التجارية',
      customerAddress: 'جدة، المملكة العربية السعودية',
      customerContact: 'أحمد الفهد',
      customerPhone: '050-1234567',
      projectName: 'تطوير نظام ERP متكامل',
      subtotal: '75000.00',
      taxRate: '15',
      taxAmount: '11250.00',
      discount: '5000.00',
      total: '81250.00',
      notes: 'الأسعار شاملة الضريبة - صالحة لمدة 30 يوماً',
      items: [
        { description: 'تحليل متطلبات النظام', quantity: 1, unitPrice: 10000, total: 10000 },
        { description: 'تصميم وتطوير الوحدات الأساسية', quantity: 1, unitPrice: 40000, total: 40000 },
        { description: 'اختبار وجودة', quantity: 1, unitPrice: 15000, total: 15000 },
        { description: 'تدريب ونشر', quantity: 1, unitPrice: 10000, total: 10000 },
      ],
    },
    htmlTemplate: `<div class="quote-page">
  <div class="quote-header">
    <div class="company"><h1>{{companyName}}</h1><p>{{companyAddress}}</p><p>الرقم الضريبي: {{companyVat}}</p></div>
    <div class="quote-meta">
      <h2>عرض سعر</h2>
      <p>رقم: {{quoteNumber}}</p>
      <p>التاريخ: {{quoteDate}}</p>
      <p>صالح حتى: {{validUntil}}</p>
    </div>
  </div>
  <div class="quote-customer">
    <strong>العميل:</strong> {{customerName}}<br/>
    <strong>العنوان:</strong> {{customerAddress}}<br/>
    <strong>جهة الاتصال:</strong> {{customerContact}} - {{customerPhone}}
  </div>
  <div class="quote-project"><strong>المشروع:</strong> {{projectName}}</div>
  <table class="quote-table">
    <thead><tr><th>#</th><th>البيان</th><th>الكمية</th><th>السعر</th><th>الإجمالي</th></tr></thead>
    <tbody>
      {{#each items}}
      <tr><td>{{index}}</td><td>{{description}}</td><td class="num">{{quantity}}</td><td class="num">{{unitPrice}}</td><td class="num">{{total}}</td></tr>
      {{/each}}
    </tbody>
  </table>
  <div class="quote-totals">
    <div class="total-row"><span>المجموع</span><strong>{{subtotal}} ر.س</strong></div>
    <div class="total-row"><span>الخصم</span><strong>{{discount}} ر.س</strong></div>
    <div class="total-row"><span>الضريبة ({{taxRate}}%)</span><strong>{{taxAmount}} ر.س</strong></div>
    <div class="total-row grand"><span>الإجمالي</span><strong>{{total}} ر.س</strong></div>
  </div>
  <div class="quote-notes"><p>{{notes}}</p></div>
  <div class="quote-footer">
    <div class="sign-box"><p>توقيع مندوب المبيعات</p><div class="line"></div></div>
  </div>
</div>`,
    cssStyles: `.quote-page { max-width: 800px; margin: 0 auto; font-family: 'Segoe UI', sans-serif; padding: 24px; }
.quote-header { display: flex; justify-content: space-between; margin-bottom: 24px; border-bottom: 2px solid #1a1a1a; padding-bottom: 16px; }
.quote-meta { text-align: left; direction: ltr; }
.quote-meta h2 { color: #2563eb; margin: 0; }
.quote-customer { background: #f9fafb; padding: 12px; border-radius: 6px; margin-bottom: 16px; font-size: 13px; }
.quote-project { font-weight: bold; margin-bottom: 16px; }
.quote-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 13px; }
.quote-table th { background: #1a1a1a; color: #fff; padding: 10px; text-align: center; }
.quote-table td { padding: 10px; border-bottom: 1px solid #e5e7eb; text-align: center; }
.quote-table td:nth-child(2) { text-align: right; }
.num { font-family: monospace; direction: ltr; }
.quote-totals { width: 300px; margin-right: auto; }
.total-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e5e7eb; }
.total-row.grand { font-weight: bold; background: #1a1a1a; color: #fff; padding: 12px; border-radius: 6px; margin-top: 8px; }
.quote-notes { margin: 16px 0; padding: 12px; background: #fef3c7; border-radius: 6px; font-size: 13px; }
.quote-footer { margin-top: 40px; }
.sign-box { text-align: center; width: 250px; }
.line { border-top: 1px solid #333; margin: 40px auto 8px; width: 80%; }`,
  },

  // ======================== PROJECTS ========================
  {
    name: 'Project Status Report',
    nameAr: 'تقرير حالة المشروع',
    category: 'PROJECTS',
    subcategory: 'reports',
    description: 'تقرير أسبوعي لحالة المشروع والمهام',
    templateKey: 'project_status_report',
    paperSize: 'A4',
    orientation: 'portrait',
    icon: 'Kanban',
    sortOrder: 1,
    isSystem: true,
    tags: ['مشروع', 'تقرير', 'حالة', 'مهام'],
    defaultData: {
      projectName: 'تطوير نظام ERP متكامل',
      projectManager: 'أحمد الكعبي',
      reportDate: '2025-05-14',
      reportWeek: 'الأسبوع 20',
      overallProgress: '65',
      budgetUsed: '325000',
      budgetTotal: '500000',
      budgetPercent: '65',
      tasksCompleted: '45',
      tasksTotal: '68',
      tasksPercent: '66',
      risks: 'تأخر في تسليم وحدة المحاسبة بسبب تغيير المتطلبات',
      nextMilestones: '1. اكتمال وحدة الموارد البشرية بحلول 30 مايو\n2. بدء اختبار التكامل بحلول 15 يونيو',
      issues: '1. نقص في موارد التطوير\n2. صعوبة في تكامل ZATCA',
    },
    htmlTemplate: `<div class="report-page">
  <div class="report-header">
    <h1>{{companyName}}</h1>
    <h2>تقرير حالة المشروع</h2>
    <p>{{reportDate}} - {{reportWeek}}</p>
  </div>
  <div class="report-project">
    <div class="project-info">
      <div><span>المشروع:</span> <strong>{{projectName}}</strong></div>
      <div><span>مدير المشروع:</span> <strong>{{projectManager}}</strong></div>
    </div>
  </div>
  <div class="report-metrics">
    <div class="metric-box">
      <span>نسبة الإنجاز</span>
      <strong>{{overallProgress}}%</strong>
    </div>
    <div class="metric-box">
      <span>الميزانية</span>
      <strong>{{budgetUsed}} / {{budgetTotal}} ر.س</strong>
    </div>
    <div class="metric-box">
      <span>المهام</span>
      <strong>{{tasksCompleted}} / {{tasksTotal}}</strong>
    </div>
  </div>
  <div class="report-section">
    <h3>المخاطر</h3>
    <p>{{risks}}</p>
  </div>
  <div class="report-section">
    <h3>المراحل القادمة</h3>
    <pre>{{nextMilestones}}</pre>
  </div>
  <div class="report-section">
    <h3>القضايا العالقة</h3>
    <pre>{{issues}}</pre>
  </div>
</div>`,
    cssStyles: `.report-page { max-width: 800px; margin: 0 auto; font-family: 'Segoe UI', sans-serif; padding: 24px; }
.report-header { text-align: center; margin-bottom: 24px; border-bottom: 2px solid #1a1a1a; padding-bottom: 12px; }
.report-header h2 { color: #2563eb; margin: 8px 0; }
.project-info { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 20px; }
.project-info div { padding: 10px 12px; background: #f9fafb; border-radius: 6px; font-size: 13px; }
.project-info span { color: #6b7280; }
.report-metrics { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 24px; }
.metric-box { background: #f3f4f6; padding: 16px; border-radius: 8px; text-align: center; }
.metric-box span { display: block; font-size: 12px; color: #6b7280; margin-bottom: 6px; }
.metric-box strong { display: block; font-size: 20px; color: #1a1a1a; }
.report-section { margin-bottom: 20px; }
.report-section h3 { font-size: 15px; background: #1a1a1a; color: #fff; padding: 8px 12px; border-radius: 6px; margin-bottom: 10px; }
.report-section p, .report-section pre { padding: 0 8px; line-height: 1.8; white-space: pre-wrap; font-family: inherit; }`,
  },
];
