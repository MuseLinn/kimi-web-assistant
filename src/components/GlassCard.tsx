import React from 'react';

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
}

export function GlassCard({ children, className = '', hover = true }: GlassCardProps) {
  return (
    <div
      className={[
        'rounded-2xl border border-white/20 bg-white/[0.14] p-4 shadow-lg',
        'backdrop-blur-md',
        hover ? 'transition-all duration-200 hover:-translate-y-px hover:shadow-xl' : '',
        'dark:border-white/[0.12] dark:bg-white/[0.08]',
        className,
      ].join(' ')}
    >
      {children}
    </div>
  );
}
