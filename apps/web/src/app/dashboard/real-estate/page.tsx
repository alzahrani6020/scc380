'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import { Building2, DoorOpen, FileSignature, Banknote, RefreshCw } from 'lucide-react';

export default function RealEstatePage() {
  const [summary,setSummary]=useState<any>(null);
  const [contracts,setContracts]=useState<any[]>([]);
  const [overdue,setOverdue]=useState<any>({count:0,totalOverdue:0});
  const [loading,setLoading]=useState(true);

  useEffect(()=>{
    Promise.all([
      api.get('/real-estate/properties/summary').then(r=>setSummary(r.data)),
      api.get('/real-estate/contracts?expiryDays=60').then(r=>setContracts(r.data.data||[])),
      api.get('/real-estate/payments/overdue').then(r=>setOverdue(r.data)),
    ]).catch(console.error).finally(()=>setLoading(false));
  },[]);

  if(loading) return <div className="h-72 flex items-center justify-center"><RefreshCw className="h-8 w-8 animate-spin text-primary-400"/></div>;

  const cards=[
    {href:'/dashboard/real-estate/properties',label:'العقارات',value:summary?.total||0,sub:`${summary?.active||0} نشط`,icon:Building2},
    {href:'/dashboard/real-estate/units',label:'الوحدات',value:summary?.totalUnits||0,sub:`${summary?.vacantUnits||0} شاغرة`,icon:DoorOpen},
    {href:'/dashboard/real-estate/contracts',label:'عقود الإيجار',value:contracts.length,sub:'تنتهي خلال 60 يومًا',icon:FileSignature},
    {href:'/dashboard/real-estate/payments',label:'المتأخرات',value:overdue?.count||0,sub:`${Number(overdue?.totalOverdue||0).toLocaleString()} ر.س`,icon:Banknote},
  ];

  return <div className="space-y-6 animate-fade-in-up">
    <div><h1 className="text-2xl font-bold text-white">إدارة العقارات</h1><p className="text-slate-400 text-sm mt-1">العقارات والوحدات والعقود والتحصيل في مساحة تشغيل واحدة</p></div>
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
      {cards.map(c=><Link key={c.href} href={c.href} className="scc-card-hover">
        <c.icon className="h-6 w-6 text-primary-400 mb-4"/>
        <p className="text-slate-400 text-sm">{c.label}</p>
        <p className="text-2xl font-bold text-white mt-1">{c.value}</p>
        <p className="text-slate-500 text-xs mt-1">{c.sub}</p>
      </Link>)}
    </div>
  </div>;
}
