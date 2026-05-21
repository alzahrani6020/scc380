'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Bell, Search, Shield, Crown, Wifi, WifiOff, Store, ChevronDown } from 'lucide-react';
import { cn } from '@scc/utils';
import { useSocket } from '@/hooks/useSocket';
import api from '@/lib/api';

interface HeaderProps {
  user?: { email?: string; role?: string; firstName?: string; lastName?: string } | null;
}

interface Branch {
  id: string;
  name: string;
  code: string;
  isMain: boolean;
}

export default function Header({ user }: HeaderProps) {
  const { connected } = useSocket();
  const [unreadCount, setUnreadCount] = useState(0);
  const [alertCount, setAlertCount] = useState(0);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<Branch | null>(null);
  const [branchDropdownOpen, setBranchDropdownOpen] = useState(false);
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const displayName = user?.firstName && user?.lastName
    ? `${user.firstName} ${user.lastName}`
    : user?.email?.split('@')[0] || 'مستخدم';

  useEffect(() => {
    // Load branches
    api.get('/branches').then((res) => {
      const list = res.data || [];
      setBranches(list);
      const saved = localStorage.getItem('selectedBranchId');
      if (saved) {
        const found = list.find((b: Branch) => b.id === saved);
        if (found) setSelectedBranch(found);
      } else if (list.length > 0) {
        const main = list.find((b: Branch) => b.isMain) || list[0];
        setSelectedBranch(main);
        localStorage.setItem('selectedBranchId', main.id);
      }
    }).catch(() => {});

    // Notifications
    api.get('/notifications/unread-count').then((res) => {
      setUnreadCount(res.data.count || 0);
    }).catch(() => {});

    // Alerts
    api.get('/alerts/counts').then((res) => {
      setAlertCount(res.data.total || 0);
    }).catch(() => {});

    const interval = setInterval(() => {
      api.get('/notifications/unread-count').then((res) => {
        setUnreadCount(res.data.count || 0);
      }).catch(() => {});
      api.get('/alerts/counts').then((res) => {
        setAlertCount(res.data.total || 0);
      }).catch(() => {});
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  const selectBranch = (branch: Branch) => {
    setSelectedBranch(branch);
    localStorage.setItem('selectedBranchId', branch.id);
    setBranchDropdownOpen(false);
    window.location.reload();
  };

  const totalNotifications = unreadCount + alertCount;

  return (
    <header className="h-20 bg-slate-900/60 backdrop-blur-xl border-b border-slate-800 flex items-center justify-between px-8 sticky top-0 z-40">
      {/* Search */}
      <div className="flex items-center flex-1 max-w-xl gap-4">
        <div className="relative w-full">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500" />
          <input
            type="text"
            placeholder="البحث في النظام..."
            className="w-full bg-slate-800/60 border border-slate-700 rounded-xl pr-10 pl-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 transition-all"
          />
        </div>
      </div>

      {/* Right Side */}
      <div className="flex items-center gap-4 mr-6">
        {/* Branch Selector */}
        {branches.length > 0 && (
          <div className="relative">
            <button
              onClick={() => setBranchDropdownOpen(!branchDropdownOpen)}
              className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-800/60 border border-slate-700 text-white text-sm hover:bg-slate-700 transition-all"
            >
              <Store className="h-4 w-4 text-primary-400" />
              <span className="max-w-[120px] truncate">{selectedBranch?.name || 'اختر الفرع'}</span>
              <ChevronDown className="h-3 w-3 text-slate-500" />
            </button>
            {branchDropdownOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setBranchDropdownOpen(false)} />
                <div className="absolute left-0 top-full mt-2 w-56 bg-slate-800 border border-slate-700 rounded-xl shadow-xl z-20 overflow-hidden">
                  <div className="px-3 py-2 text-xs text-slate-500 border-b border-slate-700">الفروع</div>
                  {branches.map((b) => (
                    <button
                      key={b.id}
                      onClick={() => selectBranch(b)}
                      className={`w-full text-right px-3 py-2.5 text-sm flex items-center gap-2 transition-colors ${
                        selectedBranch?.id === b.id ? 'bg-primary-500/10 text-primary-400' : 'text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      <Store className="h-4 w-4" />
                      <span className="flex-1">{b.name}</span>
                      {b.isMain && <span className="text-[10px] bg-amber-500/10 text-amber-400 px-1.5 py-0.5 rounded-full">رئيسي</span>}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* Connection Status */}
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${connected ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`} title={connected ? 'متصل بالخادم' : 'غير متصل'}>
          {connected ? <Wifi className="h-4 w-4" /> : <WifiOff className="h-4 w-4" />}
        </div>

        {/* Notifications */}
        <Link href="/dashboard/notifications">
          <button className="relative w-10 h-10 rounded-xl bg-slate-800/60 border border-slate-700 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-700 transition-all">
            <Bell className="h-5 w-5" />
            {totalNotifications > 0 && (
              <span className="absolute -top-1 -left-1 w-5 h-5 bg-red-500 rounded-full text-white text-[10px] font-bold flex items-center justify-center">{totalNotifications > 99 ? '99+' : totalNotifications}</span>
            )}
          </button>
        </Link>

        {/* User */}
        <div className="flex items-center gap-3 pl-4 border-l border-slate-800">
          <div className="text-right">
            <p className="text-sm font-semibold text-white">{displayName}</p>
            <div className="flex items-center gap-1">
              {isSuperAdmin ? (
                <span className="badge-vip text-[10px]">
                  <Crown className="h-3 w-3" /> SUPER ADMIN
                </span>
              ) : (
                <span className="badge-active text-[10px]">
                  <Shield className="h-3 w-3" /> {user?.role}
                </span>
              )}
            </div>
          </div>
          <div className={cn(
            'w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm',
            isSuperAdmin
              ? 'bg-gradient-to-br from-amber-500 to-orange-600 shadow-lg shadow-amber-500/20'
              : 'bg-gradient-to-br from-primary-500 to-primary-700'
          )}>
            {displayName.charAt(0).toUpperCase()}
          </div>
        </div>
      </div>
    </header>
  );
}
