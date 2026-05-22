export default function ExpiredPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950" dir="rtl">
      <div className="text-center p-8">
        <h1 className="text-4xl font-bold text-white mb-4">⏰</h1>
        <h2 className="text-2xl font-bold text-white mb-2">الرابط منتهي</h2>
        <p className="text-slate-400">هذا الرابط إما استُخدم مسبقاً أو انتهت صلاحيته</p>
      </div>
    </div>
  );
}
