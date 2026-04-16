import type { ButtonHTMLAttributes, ReactNode, JSX } from 'react';
import { cn } from '../../../lib/cn';

interface UiButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'link';
  size?: 'sm' | 'md' | 'lg';
  children: ReactNode;
}

export function UiButton(props: UiButtonProps): JSX.Element {
  const { variant = 'primary', size = 'md', className, children, ...rest } = props;

  const base = 'inline-flex items-center justify-center gap-1.5 rounded border text-xs transition-colors';

  const variantClasses: Record<NonNullable<UiButtonProps['variant']>, string> = {
    primary: 'border-emerald-500 bg-emerald-500 text-white hover:bg-emerald-600',
    secondary: 'border-zinc-600 bg-zinc-700 text-white hover:bg-zinc-600',
    outline: 'border-zinc-600 bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200',
    ghost: 'border-transparent bg-transparent text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200',
    link: 'border-transparent bg-transparent text-emerald-400 hover:text-emerald-300',
  };

  const sizeClasses: Record<NonNullable<UiButtonProps['size']>, string> = {
    sm: 'px-1.5 py-1',
    md: 'px-2 py-1.5',
    lg: 'px-3 py-2',
  };

  return (
    <button
      type="button"
      {...rest}
      className={cn(base, variantClasses[variant], sizeClasses[size], 'cursor-pointer', className)}
    >
      {children}
    </button>
  );
}

