import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const SIZES = {
  xs: 'h-4 w-4',
  sm: 'h-5 w-5',
  md: 'h-8 w-8',
  lg: 'h-10 w-10',
} as const;

type PreloadSize = keyof typeof SIZES;

type PreloadProps = {
  size?: PreloadSize;
  className?: string;
};

/** Spinner de carga — sin texto. */
export function Preload({ size = 'md', className }: PreloadProps) {
  return <Loader2 className={cn('animate-spin text-gold', SIZES[size], className)} aria-hidden />;
}

type PreloadBlockProps = {
  size?: PreloadSize;
  className?: string;
  minHeight?: string;
};

/** Área centrada con spinner (validaciones, fetch inicial, etc.). */
export function PreloadBlock({
  size = 'md',
  className,
  minHeight = 'min-h-[7rem]',
}: PreloadBlockProps) {
  return (
    <div
      className={cn('flex items-center justify-center', minHeight, className)}
      role="status"
      aria-busy="true"
      aria-label="Cargando"
    >
      <Preload size={size} />
    </div>
  );
}

/** Spinner inline (selectores, badges, etc.). */
export function PreloadInline({ className }: { className?: string }) {
  return <Preload size="sm" className={cn('inline-block', className)} />;
}

type PreloadGateProps = {
  /** Cuando es false, muestra el preload. */
  ready: boolean;
  children: React.ReactNode;
  fallback?: React.ReactNode;
  className?: string;
  minHeight?: string;
};

/** Muestra preload mientras `ready` es false; luego el contenido. */
export function PreloadGate({ ready, children, fallback, className, minHeight }: PreloadGateProps) {
  if (ready) return <>{children}</>;
  if (fallback) return <>{fallback}</>;
  return <PreloadBlock className={className} minHeight={minHeight} />;
}

/** true si alguna condición de carga sigue activa. */
export function isPreloading(...loadingFlags: boolean[]): boolean {
  return loadingFlags.some(Boolean);
}
