import type { HTMLAttributes } from 'react';

/**
 * Silencia mismatches de atributos en hidratación (p. ej. bis_skin_checked de Bitdefender).
 * Usar solo en contenedores estáticos, no en contenido dinámico.
 */
export function SafeDiv({ children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div suppressHydrationWarning {...props}>
      {children}
    </div>
  );
}
