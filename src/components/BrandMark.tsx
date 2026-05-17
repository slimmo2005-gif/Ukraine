import type { ReactNode } from 'react';
import { BRAND_LOGO_URL, BRAND_NAME } from '@/config/brand';

type WatermarkSize = 'sm' | 'md' | 'lg';

const watermarkHeight: Record<WatermarkSize, string> = {
  sm: 'h-5',
  md: 'h-7',
  lg: 'h-9',
};

const watermarkOpacity: Record<WatermarkSize, string> = {
  sm: 'opacity-[0.26]',
  md: 'opacity-[0.30]',
  lg: 'opacity-[0.36]',
};

type BrandedVisualProps = {
  children: ReactNode;
  className?: string;
  watermarkSize?: WatermarkSize;
};

/** Wraps charts/maps so screenshots retain a subtle corner logo. */
export function BrandedVisual({
  children,
  className = '',
  watermarkSize = 'md',
}: BrandedVisualProps) {
  return (
    <div className={`relative ${className}`.trim()}>
      {children}
      <BrandWatermark size={watermarkSize} />
    </div>
  );
}

type BrandWatermarkProps = {
  size?: WatermarkSize;
  className?: string;
};

export function BrandWatermark({ size = 'md', className = '' }: BrandWatermarkProps) {
  return (
    <div
      className={`pointer-events-none absolute bottom-2 right-2 z-20 flex items-end select-none ${className}`.trim()}
      aria-hidden
    >
      <img
        src={BRAND_LOGO_URL}
        alt=""
        draggable={false}
        className={`${watermarkHeight[size]} ${watermarkOpacity[size]} w-auto max-w-[min(38%,132px)] object-contain drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]`}
      />
    </div>
  );
}

type BrandHeaderLogoProps = {
  className?: string;
};

export function BrandHeaderLogo({ className = '' }: BrandHeaderLogoProps) {
  return (
    <div
      className={`flex shrink-0 items-center gap-2 border-l border-osint-border pl-3 sm:pl-4 ${className}`.trim()}
      title={BRAND_NAME}
    >
      <img
        src={BRAND_LOGO_URL}
        alt={BRAND_NAME}
        className="h-7 w-auto max-w-[140px] object-contain sm:h-8"
        draggable={false}
      />
    </div>
  );
}

type BrandFooterMarkProps = {
  className?: string;
};

export function BrandFooterMark({ className = '' }: BrandFooterMarkProps) {
  return (
    <div className={`flex flex-col items-start sm:items-end gap-2 ${className}`.trim()}>
      <p className="text-[10px] uppercase tracking-widest text-gray-600">Presented by</p>
      <img
        src={BRAND_LOGO_URL}
        alt={BRAND_NAME}
        className="h-7 w-auto max-w-[160px] object-contain opacity-90"
        draggable={false}
      />
    </div>
  );
}
