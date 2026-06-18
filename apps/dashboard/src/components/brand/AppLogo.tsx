import Image from 'next/image';
import { cn } from '@/lib/utils';
import { APP } from '@/lib/brand';

const SIZES = {
  xs: 'h-7',
  sm: 'h-9',
  md: 'h-11',
  lg: 'h-14',
  xl: 'h-[4.5rem]',
} as const;

type AppLogoProps = {
  size?: keyof typeof SIZES;
  className?: string;
  priority?: boolean;
};

export function AppLogo({ size = 'sm', className, priority }: AppLogoProps) {
  return (
    <Image
      src={APP.logo}
      alt={APP.fullName}
      width={512}
      height={512}
      priority={priority}
      className={cn('w-auto object-contain', SIZES[size], className)}
    />
  );
}
