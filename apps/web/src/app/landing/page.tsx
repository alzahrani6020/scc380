'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import {
  Building2, Shield, Zap, Globe, BarChart3, Truck, Users, FileText,
  Check, ArrowLeft, Star, Play, ChevronDown, Menu, X,
  Cpu, Lock, Clock, Headphones, TrendingUp, Layers
} from 'lucide-react';

const features = [
  { icon: Users, title: 'CRM ذكي', desc: 'إدارة العملاء والفرص والمبيعات مع مسار مرئي كامل للعميل', color: 'from-blue-500 to-cyan-400', bg: 'bg-blue-500/10' },
  { icon: FileText, title: 'ERP متكامل', desc: 'فواتير إلكترونية، محاسبة، موردين، ومخزون في نظام واحد', color: 'from-emerald-500 to-teal-400', bg: 'bg-emerald-500/10' },
  { icon: Layers, title: 'موارد بشرية', desc: 'حضور، إجازات، رواتب، ومتابعة أداء الموظفين آليًا', color: 'from-violet-500 to-purple-400', bg: 'bg-violet-500/10' },
  { icon: Truck, title: 'إدارة الأسطول', desc: 'تتبع المركبات، صيانة، وقود، وإدارة رخص السائقين', color: 'from-orange-500 to-amber-400', bg: 'bg-orange-500/10' },
  { icon: BarChart3, title: 'تحليلات متقدمة', desc: 'لوحات تحكم تفاعلية وقرارات مبنية على البيانات', color: 'from-pink-500 to-rose-400', bg: 'bg-pink-500/10' },
  { icon: Globe, title: 'تكامل حكومي', desc: 'ربط مباشر مع ZATCA، أبشر، نفاذ، ووزارة التجارة', color: 'from-indigo-500 to-blue-400', bg: 'bg-indigo-500/10' },
  { icon: Cpu, title: 'مساعد ذكي AI', desc: 'ذكاء اصطناعي يساعدك في التحليل والتنبؤ والإجابة على استفساراتك', color: 'from-amber-500 to-yellow-400', bg: 'bg-amber-500/10' },
  { icon: Shield, title: 'أمان عسكري', desc: 'تشفير端到端، صلاحيات دقيقة، وسجل مراجعة كامل', color: 'from-red-500 to-orange-400', bg: 'bg-red-500/10' },
];

const stats = [
  { value: '500+', label: 'شركة تثق بنا' },
  { value: '99.9%', label: 'نسبة التوافر' },
  { value: '15+', label: 'تكامل حكومي' },
  { value: '< 2s', label: 'زمن الاستجابة' },
];

const steps = [
  { num: '01', title: 'سجل حسابك', desc: 'أنشئ حسابًا في دقيقتين واختر الخطة المناسبة لك' },
  { num: '02', title: 'اربط فروعك', desc: 'أضف فروع شركتك واربطها بالتكاملات الحكومية' },
  { num: '03', title: 'استمتع بالتحكم', desc: 'ادِر عملياتك بالكامل من لوحة تحكم ذكية واحدة' },
];

const testimonials = [
  { name: 'عبدالرحمن الفوزان', role: 'المدير التنفيذي', company: 'شركة التقنية المتقدمة', text: 'SCC 380 غيّر طريقة إدارتنا بالكامل. وفّر لنا أكثر من 40% من الوقت في العمليات المالية والموارد البشرية.' },
  { name: 'منى الدوسري', role: 'مديرة تقنية', company: 'حلول البرمجيات', text: 'المنصة سهلة الاستخدام والتكامل مع ZATCA كان سلسًا جدًا. فريق الدعم محترف وسريع الاستجابة.' },
  { name: 'سعد المطيري', role: 'مدير مبيعات', company: 'مؤسسة الأمل', text: 'نظام CRM ساعدنا في زيادة المبيعات بنسبة 30% خلال 3 أشهر فقط. أنصح به بشدة.' },
];

const plans = [
  {
    name: 'أساسي', price: '299', period: '/ شهر',
    desc: 'مناسب للشركات الناشئة والمؤسسات الصغيرة',
    features: ['CRM كامل', 'ERP - 50 فاتورة/شهر', 'HR - 10 موظفين', 'دعم فني بالبريد', 'تقارير أساسية'],
    cta: 'ابدأ الآن',
    popular: false,
  },
  {
    name: 'احترافي', price: '799', period: '/ شهر',
    desc: 'للشركات المتوسطة التي تحتاج لأدوات متقدمة',
    features: ['CRM + AI مساعد', 'ERP غير محدود', 'HR - 100 موظف', 'Fleet كامل', 'تكامل ZATCA', 'دعم فني مباشر 24/7', 'تحليلات متقدمة'],
    cta: 'جرب مجانًا',
    popular: true,
  },
  {
    name: 'مؤسسي', price: '2,499', period: '/ شهر',
    desc: 'للمؤسسات الكبرى والحكومية',
    features: ['كل شيء في الاحترافي', 'مستأجرين متعددين', 'API كامل', 'تخصيص كامل', 'مدير حساب مخصص', 'SLA مضمونة', 'تدريب على الموقع'],
    cta: 'تواصل معنا',
    popular: false,
  },
];

const faqs = [
  { q: 'هل يمكن تجربة المنصة قبل الاشتراك؟', a: 'نعم، نوفر نسخة تجريبية مجانية لمدة 14 يومًا مع جميع الميزات دون قيود.' },
  { q: 'هل المنصة متوافقة مع متطلبات هيئة الزكاة ZATCA؟', a: 'نعم، المنصة متكاملة مع ZATCA وتدعم الفوترة الإلكترونية بصيغة XML وQR Code وفقًا لأحدث المعايير.' },
  { q: 'هل يمكن ربط المنصة مع أنظمتنا الحالية؟', a: 'بالتأكيد، نوفر REST API كامل وWebhooks لربط سلس مع أي نظام خارجي.' },
  { q: 'كيف يتم تأمين بياناتي؟', a: 'نستخدم تشفير AES-256، فصل البيانات بين المستأجرين، ونسخ احتياطي يومي في مراكز بيانات متعددة.' },
];

function AnimatedCounter({ value }: { value: string }) {
  return <span className="text-4xl md:text-5xl font-bold text-white">{value}</span>;
}

export default function LandingPage() {
  const [mobileMenu, setMobileMenu] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-white overflow-x-hidden" dir="rtl">
      {/* Navbar */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? 'bg-slate-950/90 backdrop-blur-xl border-b border-slate-800 shadow-lg' : 'bg-transparent'}`}>
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center shadow-lg shadow-primary-500/20">
              <Building2 className="h-6 w-6 text-white" />
            </div>
            <span className="text-xl font-bold tracking-tight">SCC <span className="text-primary-400">380</span></span>
          </div>

          <div className="hidden md:flex items-center gap-8 text-sm font-medium">
            <a href="#features" className="text-slate-300 hover:text-white transition-colors">المميزات</a>
            <a href="#how-it-works" className="text-slate-300 hover:text-white transition-colors">كيف يعمل</a>
            <a href="#pricing" className="text-slate-300 hover:text-white transition-colors">الأسعار</a>
            <a href="#faq" className="text-slate-300 hover:text-white transition-colors">الأسئلة</a>
          </div>

          <div className="hidden md:flex items-center gap-3">
            <Link href="/auth/login" className="text-slate-300 hover:text-white transition-colors text-sm font-medium px-4 py-2">تسجيل الدخول</Link>
            <Link href="/auth/register" className="bg-primary-600 hover:bg-primary-500 text-white text-sm font-bold px-5 py-2.5 rounded-xl transition-all shadow-lg shadow-primary-600/20">ابدأ مجانًا</Link>
          </div>

          <button className="md:hidden p-2" onClick={() => setMobileMenu(!mobileMenu)}>
            {mobileMenu ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>

        {mobileMenu && (
          <div className="md:hidden bg-slate-900/95 backdrop-blur-xl border-t border-slate-800 px-6 py-4 space-y-3">
            <a href="#features" onClick={() => setMobileMenu(false)} className="block text-slate-300 py-2">المميزات</a>
            <a href="#how-it-works" onClick={() => setMobileMenu(false)} className="block text-slate-300 py-2">كيف يعمل</a>
            <a href="#pricing" onClick={() => setMobileMenu(false)} className="block text-slate-300 py-2">الأسعار</a>
            <a href="#faq" onClick={() => setMobileMenu(false)} className="block text-slate-300 py-2">الأسئلة</a>
            <hr className="border-slate-800" />
            <Link href="/auth/login" className="block text-slate-300 py-2">تسجيل الدخول</Link>
            <Link href="/auth/register" className="block bg-primary-600 text-white text-center py-2.5 rounded-xl font-bold">ابدأ مجانًا</Link>
          </div>
        )}
      </nav>

      {/* Hero */}
      <section className="relative pt-32 pb-20 md:pt-48 md:pb-32 overflow-hidden">
        <div className="absolute top-0 right-0 w-[900px] h-[900px] bg-primary-600/10 rounded-full blur-[180px] -translate-y-1/3 translate-x-1/4" />
        <div className="absolute bottom-0 left-0 w-[700px] h-[700px] bg-purple-600/10 rounded-full blur-[150px] translate-y-1/3 -translate-x-1/4" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-emerald-600/5 rounded-full blur-[200px]" />

        <div className="relative z-10 max-w-5xl mx-auto text-center px-6">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary-500/10 border border-primary-500/20 text-primary-400 text-sm mb-8 animate-fade-in-up">
            <Zap className="h-4 w-4" />
            المنصة الهجينة المتكاملة للشركات السعودية
          </div>

          <h1 className="text-5xl md:text-7xl font-bold mb-8 leading-[1.1] animate-fade-in-up">
            أدر شركتك بذكاء<br />
            <span className="bg-gradient-to-l from-primary-400 via-purple-400 to-emerald-400 bg-clip-text text-transparent">
              من مكان واحد
            </span>
          </h1>

          <p className="text-lg md:text-xl text-slate-400 mb-10 max-w-2xl mx-auto leading-relaxed animate-fade-in-up">
            SCC 380 تجمع بين CRM، ERP، HR، إدارة الأسطول، والتكاملات الحكومية في منصة SaaS
            متعددة المستأجرين مصممة خصيصًا للسوق السعودي
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-fade-in-up">
            <Link href="/auth/register" className="w-full sm:w-auto bg-primary-600 hover:bg-primary-500 text-white text-lg font-bold px-8 py-4 rounded-2xl transition-all shadow-xl shadow-primary-600/25 flex items-center justify-center gap-2">
              ابدأ تجربتك المجانية <ArrowLeft className="h-5 w-5" />
            </Link>
            <button className="w-full sm:w-auto bg-slate-800/80 hover:bg-slate-800 text-white text-lg px-8 py-4 rounded-2xl transition-all border border-slate-700 flex items-center justify-center gap-2">
              <Play className="h-5 w-5 text-primary-400" /> شاهد العرض التوضيحي
            </button>
          </div>

          {/* Stats */}
          <div className="mt-20 grid grid-cols-2 md:grid-cols-4 gap-6 max-w-3xl mx-auto">
            {stats.map((s) => (
              <div key={s.label} className="text-center p-4 rounded-2xl bg-slate-900/50 border border-slate-800 backdrop-blur-sm">
                <AnimatedCounter value={s.value} />
                <p className="text-slate-400 text-sm mt-1">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Trusted by */}
      <section className="py-12 border-y border-slate-800/50 bg-slate-900/30">
        <p className="text-center text-slate-500 text-sm mb-6">تثق بنا شركات رائدة في السوق السعودي</p>
        <div className="flex flex-wrap items-center justify-center gap-8 md:gap-16 opacity-50">
          {['STC', 'أرامكو', 'سابك', 'مصرف الراجحي', 'الراجحي'].map((name) => (
            <span key={name} className="text-slate-400 font-bold text-lg tracking-wider">{name}</span>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-24 relative">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <span className="text-primary-400 text-sm font-bold tracking-wider uppercase mb-2 block">المميزات</span>
            <h2 className="text-4xl md:text-5xl font-bold mb-4">كل ما تحتاجه في منصة واحدة</h2>
            <p className="text-slate-400 max-w-2xl mx-auto">وحدات متكاملة تعمل معًا بسلاسة لتغطي جميع جوانب عملك اليومية</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((f) => (
              <div key={f.title} className="group relative p-6 rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-primary-500/30 transition-all hover:-translate-y-1 hover:shadow-xl hover:shadow-primary-500/5">
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${f.color} flex items-center justify-center mb-4 shadow-lg group-hover:scale-110 transition-transform`}>
                  <f.icon className="h-6 w-6 text-white" />
                </div>
                <h3 className="font-bold text-lg mb-2">{f.title}</h3>
                <p className="text-slate-400 text-sm leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="py-24 bg-slate-900/30 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary-600/5 rounded-full blur-[150px]" />
        <div className="max-w-5xl mx-auto px-6 relative z-10">
          <div className="text-center mb-16">
            <span className="text-primary-400 text-sm font-bold tracking-wider uppercase mb-2 block">خطوات البدء</span>
            <h2 className="text-4xl md:text-5xl font-bold mb-4">ابدأ في 3 خطوات بسيطة</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {steps.map((step, i) => (
              <div key={step.num} className="relative text-center">
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary-500/20 to-primary-600/5 border border-primary-500/20 flex items-center justify-center mx-auto mb-6">
                  <span className="text-2xl font-bold text-primary-400">{step.num}</span>
                </div>
                {i < 2 && (
                  <div className="hidden md:block absolute top-10 left-0 w-full h-[2px] bg-gradient-to-l from-primary-500/20 to-transparent" style={{ transform: 'translateX(50%)' }} />
                )}
                <h3 className="text-xl font-bold mb-3">{step.title}</h3>
                <p className="text-slate-400 text-sm">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-24">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <span className="text-primary-400 text-sm font-bold tracking-wider uppercase mb-2 block">آراء العملاء</span>
            <h2 className="text-4xl md:text-5xl font-bold mb-4">ما يقوله عملاؤنا عنا</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {testimonials.map((t) => (
              <div key={t.name} className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 relative">
                <div className="flex items-center gap-1 mb-4">
                  {[...Array(5)].map((_, i) => <Star key={i} className="h-4 w-4 text-amber-400 fill-amber-400" />)}
                </div>
                <p className="text-slate-300 text-sm leading-relaxed mb-6">{t.text}</p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-500 to-purple-500 flex items-center justify-center text-white font-bold text-sm">
                    {t.name[0]}
                  </div>
                  <div>
                    <p className="font-bold text-sm">{t.name}</p>
                    <p className="text-slate-500 text-xs">{t.role} — {t.company}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-24 bg-slate-900/30">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <span className="text-primary-400 text-sm font-bold tracking-wider uppercase mb-2 block">خطط الأسعار</span>
            <h2 className="text-4xl md:text-5xl font-bold mb-4">اختر الخطة المناسبة لك</h2>
            <p className="text-slate-400">أسعار شفافة بدون رسوم خفية. يمكنك الترقية أو التخفيض في أي وقت</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
            {plans.map((plan) => (
              <div key={plan.name} className={`relative rounded-2xl p-6 border ${plan.popular ? 'bg-slate-900 border-primary-500/40 shadow-xl shadow-primary-500/10 scale-105 z-10' : 'bg-slate-900/60 border-slate-800'}`}>
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-primary-600 text-white text-xs font-bold px-4 py-1.5 rounded-full">
                    الأكثر شيوعًا
                  </div>
                )}
                <h3 className="text-xl font-bold mb-2">{plan.name}</h3>
                <p className="text-slate-400 text-sm mb-6">{plan.desc}</p>
                <div className="flex items-baseline gap-1 mb-6">
                  <span className="text-4xl font-bold text-white">{plan.price}</span>
                  <span className="text-slate-500 text-sm">ريال {plan.period}</span>
                </div>
                <ul className="space-y-3 mb-8">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm text-slate-300">
                      <Check className="h-4 w-4 text-emerald-400 shrink-0" /> {f}
                    </li>
                  ))}
                </ul>
                <Link href="/auth/register" className={`block text-center py-3 rounded-xl font-bold transition-all ${plan.popular ? 'bg-primary-600 hover:bg-primary-500 text-white shadow-lg shadow-primary-600/20' : 'bg-slate-800 hover:bg-slate-700 text-white border border-slate-700'}`}>
                  {plan.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="py-24">
        <div className="max-w-3xl mx-auto px-6">
          <div className="text-center mb-16">
            <span className="text-primary-400 text-sm font-bold tracking-wider uppercase mb-2 block">الأسئلة الشائعة</span>
            <h2 className="text-4xl md:text-5xl font-bold mb-4">هل لديك سؤال؟</h2>
          </div>

          <div className="space-y-4">
            {faqs.map((faq, i) => (
              <div key={i} className="rounded-2xl bg-slate-900/60 border border-slate-800 overflow-hidden">
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between p-5 text-right"
                >
                  <span className="font-bold">{faq.q}</span>
                  <ChevronDown className={`h-5 w-5 text-slate-400 shrink-0 transition-transform ${openFaq === i ? 'rotate-180' : ''}`} />
                </button>
                {openFaq === i && (
                  <div className="px-5 pb-5 text-slate-400 text-sm leading-relaxed">
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary-600/10 to-purple-600/10" />
        <div className="max-w-4xl mx-auto px-6 text-center relative z-10">
          <div className="p-10 md:p-16 rounded-3xl bg-slate-900/80 border border-slate-700 backdrop-blur-xl shadow-2xl">
            <h2 className="text-4xl md:text-5xl font-bold mb-4">جاهز لتجربة المستقبل؟</h2>
            <p className="text-slate-400 text-lg mb-8 max-w-xl mx-auto">انضم إلى مئات الشركات السعودية التي تثق بمركز القيادة الذكي في إدارة عملياتها</p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/auth/register" className="w-full sm:w-auto bg-primary-600 hover:bg-primary-500 text-white text-lg font-bold px-8 py-4 rounded-2xl transition-all shadow-xl shadow-primary-600/25">
                ابدأ تجربتك المجانية
              </Link>
              <Link href="/auth/login" className="w-full sm:w-auto bg-slate-800 hover:bg-slate-700 text-white text-lg px-8 py-4 rounded-2xl transition-all border border-slate-700">
                تسجيل الدخول
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-800 bg-slate-950 pt-16 pb-8">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-10 mb-12">
            <div className="md:col-span-1">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center">
                  <Building2 className="h-6 w-6 text-white" />
                </div>
                <span className="text-xl font-bold">SCC <span className="text-primary-400">380</span></span>
              </div>
              <p className="text-slate-500 text-sm leading-relaxed">
                منصة SaaS هجينة متكاملة للشركات السعودية. CRM، ERP، HR، Fleet، وتوافق ZATCA.
              </p>
            </div>
            <div>
              <h4 className="font-bold mb-4">المنتج</h4>
              <ul className="space-y-2 text-sm text-slate-400">
                <li><a href="#features" className="hover:text-white transition-colors">المميزات</a></li>
                <li><a href="#pricing" className="hover:text-white transition-colors">الأسعار</a></li>
                <li><a href="#" className="hover:text-white transition-colors">API Docs</a></li>
                <li><a href="#" className="hover:text-white transition-colors">التكاملات</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold mb-4">الشركة</h4>
              <ul className="space-y-2 text-sm text-slate-400">
                <li><a href="#" className="hover:text-white transition-colors">من نحن</a></li>
                <li><a href="#" className="hover:text-white transition-colors">المدونة</a></li>
                <li><a href="#" className="hover:text-white transition-colors">الوظائف</a></li>
                <li><a href="#" className="hover:text-white transition-colors">اتصل بنا</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold mb-4">الدعم</h4>
              <ul className="space-y-2 text-sm text-slate-400">
                <li><a href="#faq" className="hover:text-white transition-colors">الأسئلة الشائعة</a></li>
                <li><a href="#" className="hover:text-white transition-colors">مركز المساعدة</a></li>
                <li><a href="#" className="hover:text-white transition-colors">الشروط والأحكام</a></li>
                <li><a href="#" className="hover:text-white transition-colors">سياسة الخصوصية</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-slate-800 pt-6 flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-slate-500 text-sm">© 2026 Smart Command Center 380. جميع الحقوق محفوظة.</p>
            <div className="flex items-center gap-4 text-slate-500">
              <Lock className="h-4 w-4" />
              <span className="text-xs">مؤمن بتشفير 256-bit</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
