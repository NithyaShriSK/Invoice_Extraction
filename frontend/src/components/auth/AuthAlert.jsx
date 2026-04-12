import React from 'react';
import { AlertCircle, CheckCircle } from 'lucide-react';
import { cn } from '../../utils/cn';

export function AuthAlert({ type = 'error', children, className }) {
  if (children == null || children === '') return null;

  const isSuccess = type === 'success';

  return (
    <div
      role={isSuccess ? 'status' : 'alert'}
      className={cn(
        'flex gap-2 rounded-xl border px-4 py-3 text-sm',
        isSuccess
          ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
          : 'border-red-200 bg-red-50 text-red-900',
        className
      )}
    >
      {isSuccess ? (
        <CheckCircle className="h-5 w-5 shrink-0 text-emerald-600" aria-hidden />
      ) : (
        <AlertCircle className="h-5 w-5 shrink-0 text-red-600" aria-hidden />
      )}
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
