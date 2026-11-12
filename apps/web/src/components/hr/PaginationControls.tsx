'use client';

interface Props {
  page: number;
  totalPages: number;
  total: number;
  onPageChange: (page: number) => void;
}

export default function PaginationControls({ page, totalPages, total, onPageChange }: Props) {
  if (totalPages <= 1) {
    return <p className="text-xs text-slate-500 text-center">إجمالي {total} سجل</p>;
  }

  return (
    <div className="flex items-center justify-between gap-3 pt-2">
      <button
        type="button"
        className="px-3 py-2 rounded-lg bg-slate-800 text-slate-300 disabled:opacity-40"
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
      >
        السابق
      </button>
      <p className="text-sm text-slate-400">صفحة {page} من {totalPages} · إجمالي {total}</p>
      <button
        type="button"
        className="px-3 py-2 rounded-lg bg-slate-800 text-slate-300 disabled:opacity-40"
        disabled={page >= totalPages}
        onClick={() => onPageChange(page + 1)}
      >
        التالي
      </button>
    </div>
  );
}
