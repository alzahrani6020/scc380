'use client';

import { useCallback } from 'react';
import api from '@/lib/api';
import AsyncCombobox, { type AsyncComboboxOption } from '@/components/ui/AsyncCombobox';

interface EmployeePickerProps {
  value: string;
  onChange: (value:string)=>void;
  activeOnly?: boolean;
  label?: string;
  required?: boolean;
  disabled?: boolean;
}

export default function EmployeePicker({
  value,onChange,activeOnly=false,label='الموظف',required=false,disabled=false,
}:EmployeePickerProps) {
  const loadOptions=useCallback(async(search:string,signal:AbortSignal):Promise<AsyncComboboxOption[]>=>{
    const params=new URLSearchParams({search,page:'1',limit:'25'});
    if(activeOnly)params.set('status','ACTIVE');
    const r=await api.get('/hr/employees?'+params.toString(),{signal});
    return (r.data?.data||[]).map((e:any)=>({
      value:e.id,label:`${e.firstName} ${e.lastName} · ${e.employeeCode}`,
    }));
  },[activeOnly]);

  const resolveValue=useCallback(async(id:string,signal:AbortSignal):Promise<AsyncComboboxOption|null>=>{
    const r=await api.get('/hr/employees/'+encodeURIComponent(id),{signal});
    const e=r.data;
    if(!e || (activeOnly&&e.status!=='ACTIVE'))return null;
    return {value:e.id,label:`${e.firstName} ${e.lastName} · ${e.employeeCode}`};
  },[activeOnly]);

  return <AsyncCombobox label={label} value={value} required={required} disabled={disabled}
    onChange={onChange} loadOptions={loadOptions} resolveValue={resolveValue}
    placeholder="اختر الموظف" searchPlaceholder="ابحث باسم الموظف أو رقمه"/>;
}
