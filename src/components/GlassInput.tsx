import React from 'react';

type GlassInputProps = React.InputHTMLAttributes<HTMLInputElement>;

export const GlassInput = React.forwardRef<HTMLInputElement, GlassInputProps>(
  ({ className = '', ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={[
          'w-full rounded-full border border-white/20 bg-white/[0.14] px-4 py-2.5 text-sm',
          'text-kwa-gray-800 backdrop-blur-md placeholder:text-kwa-gray-400',
          'outline-none transition focus:border-kwa-primary focus:ring-2 focus:ring-kwa-primary/20',
          'dark:border-white/10 dark:bg-white/[0.06] dark:text-kwa-gray-50',
          className,
        ].join(' ')}
        {...props}
      />
    );
  }
);
GlassInput.displayName = 'GlassInput';
