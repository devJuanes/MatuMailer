'use client';

import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Preload } from '@/lib/preload';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

const inputCompact = 'h-10 text-sm';

type PasswordInputProps = {
  id: string;
  name: string;
  label: string;
  placeholder?: string;
  required?: boolean;
  minLength?: number;
  autoComplete?: string;
};

export function PasswordInput({
  id,
  name,
  label,
  placeholder = '••••••••',
  required,
  minLength,
  autoComplete = 'current-password',
}: PasswordInputProps) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="space-y-1">
      <Label htmlFor={id} className="text-xs">
        {label}
      </Label>
      <div className="relative">
        <Input
          id={id}
          name={name}
          type={visible ? 'text' : 'password'}
          required={required}
          minLength={minLength}
          placeholder={placeholder}
          autoComplete={autoComplete}
          className={cn(inputCompact, 'pr-10')}
        />
        <button
          type="button"
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-charcoal"
          aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
          onClick={() => setVisible((v) => !v)}
        >
          {visible ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
        </button>
      </div>
    </div>
  );
}

export function AuthAlert({
  variant,
  children,
}: {
  variant: 'error' | 'info';
  children: React.ReactNode;
}) {
  return (
    <p
      role="alert"
      className={cn(
        'rounded-xl px-3 py-2 text-xs',
        variant === 'error' && 'bg-red-50 text-red-600',
        variant === 'info' && 'bg-gold/20 text-charcoal',
      )}
    >
      {children}
    </p>
  );
}

export function AuthSubmitButton({
  loading,
  children,
  variant = 'default',
}: {
  loading: boolean;
  children: React.ReactNode;
  variant?: 'default' | 'gold';
}) {
  return (
    <Button type="submit" className="h-10 w-full text-sm" variant={variant} disabled={loading}>
      {loading ? <Preload size="sm" /> : children}
    </Button>
  );
}

export { inputCompact };
