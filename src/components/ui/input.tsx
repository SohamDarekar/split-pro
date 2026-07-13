import * as React from 'react';

import { cn } from '~/lib/utils';

export type InputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  rightIcon?: React.ReactNode;
};

const Input: React.FC<InputProps> = ({ className, type, rightIcon, ...props }) => {
  return (
    <div className="relative w-full">
      <input
        type={type}
        data-slot="input"
        className={cn(
          'bg-muted/60 placeholder:text-muted-foreground text-foreground border border-transparent',
          'flex h-12 w-full rounded-xl px-3.5 py-2 text-sm file:border-0 file:bg-transparent file:text-sm file:font-medium',
          'focus-visible:border-primary focus-visible:bg-muted focus-visible:ring-primary/25 transition-colors duration-150 focus-visible:ring-2',
          'focus-visible:outline-hidden disabled:cursor-not-allowed disabled:opacity-50',
          className,
        )}
        {...props}
      />
      {rightIcon && <span className="absolute top-1/2 right-3 -translate-y-1/2">{rightIcon}</span>}
    </div>
  );
};

Input.displayName = 'Input';

export { Input };
