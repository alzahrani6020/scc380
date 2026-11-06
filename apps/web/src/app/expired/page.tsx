export default function ExpiredPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950" dir="rtl">
      <div className="text-center p-8">
        <h1 className="text-4xl font-bold text-white mb-4">⏰</h1>
        <h2 className="text-2xl font-bold text-white mb-2">الرابط منتهي</h2>
        <p className="text-slate-400 mb-6">هذا الرابط إما استُخدم مسبقاً أو انتهت صلاحيته</p>
        <div className="flex gap-3 justify-center">
          <a href="/auth/login"
            className="px-5 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-500 text-white font-bold transition-colors">
            تسجيل الدخول
          </a>
          <a href="/landing"
            className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold transition-colors">
            العودة للرئيسية
          </a>
        </div>
      </div>
    </div>
  );
}
