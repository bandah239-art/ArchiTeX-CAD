import type { ButtonHTMLAttributes, ReactNode } from 'react';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
};

export function Button({ children, className = '', type = 'button', ...rest }: ButtonProps) {
  return (
    <button
      type={type}
      className={[
        'py-2 px-4 bg-infra-highlight hover:bg-infra-highlight/80 disabled:opacity-50 disabled:cursor-not-allowed',
        'text-white text-sm font-semibold rounded transition-colors',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...rest}
    >
      {children}
    </button>
  );
}
