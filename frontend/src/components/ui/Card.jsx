import React from 'react';
import { cn } from '../../utils/cn';

export function Card({ children, className, ...props }) {
  return (
    <div
      className={cn(
        'rounded-2xl bg-white shadow-md border border-gray-100/80',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
