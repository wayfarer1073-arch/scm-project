import { cn } from '@/lib/utils';

export type StockBoardLogoVariant = 'stack-pulse' | 'inventory-cube' | 'three-blocks' | 'lettermark';

interface StockBoardLogoProps {
  variant?: StockBoardLogoVariant;
  size?: number;
  className?: string;
  title?: string;
}

export function StockBoardLogo({ variant = 'stack-pulse', size = 32, className, title = 'StockBoard' }: StockBoardLogoProps) {
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 256 256',
    role: 'img',
    'aria-label': title,
    className,
  } as const;

  if (variant === 'inventory-cube') {
    return (
      <svg {...common}>
        <path d="M128 28 210 72 128 116 46 72Z" fill="#2563EB" />
        <path d="M46 72 128 116 128 212 46 168Z" fill="#0F1F33" />
        <path d="M210 72 128 116 128 212 210 168Z" fill="#F8FAFC" stroke="#E2E8F0" strokeWidth="4" />
        <rect x="150" y="146" width="14" height="38" rx="3" fill="#2563EB" />
        <rect x="171" y="126" width="14" height="58" rx="3" fill="#2563EB" />
        <rect x="192" y="104" width="14" height="80" rx="3" fill="#2563EB" />
      </svg>
    );
  }

  if (variant === 'three-blocks') {
    return (
      <svg {...common}>
        <path
          d="M50 52H88M50 52V90M206 52H168M206 52V90M50 204H88M50 204V166M206 204H168M206 204V166"
          fill="none"
          stroke="#0F1F33"
          strokeWidth="12"
          strokeLinecap="round"
        />
        <path d="M128 38 166 58 128 78 90 58Z" fill="#2563EB" />
        <path d="M90 58 128 78 128 122 90 102Z" fill="#2563EB" opacity=".78" />
        <path d="M166 58 128 78 128 122 166 102Z" fill="#1D4ED8" />
        <path d="M78 124 112 142 78 160 44 142Z" fill="#0F1F33" />
        <path d="M44 142 78 160 78 198 44 180Z" fill="#0F1F33" opacity=".78" />
        <path d="M112 142 78 160 78 198 112 180Z" fill="#1E293B" />
        <path d="M178 124 212 142 178 160 144 142Z" fill="#94A3B8" />
        <path d="M144 142 178 160 178 198 144 180Z" fill="#64748B" />
        <path d="M212 142 178 160 178 198 212 180Z" fill="#475569" />
      </svg>
    );
  }

  if (variant === 'lettermark') {
    return (
      <svg {...common}>
        <path
          d="M54 58C54 43 66 32 81 32h121v36H92c-6 0-10 4-10 10s4 10 10 10h72c31 0 56 25 56 56s-25 56-56 56H54v-36h108c13 0 22-8 22-20s-9-20-22-20H90c-28 0-50-22-50-50 0-6 1-11 3-16Z"
          fill="#0F1F33"
        />
        <path d="M52 112h124c13 0 22 8 22 20s-9 20-22 20H88c-20 0-36-16-36-36 0-1 0-3 .1-4Z" fill="#2563EB" />
      </svg>
    );
  }

  return (
    <svg {...common}>
      <path d="M48 74 L128 34 L208 74 L128 114 Z" fill="#0F1F33" />
      <path d="M48 118 L128 78 L208 118 L128 158 Z" fill="#334155" />
      <path d="M48 162 L128 122 L208 162 L128 202 Z" fill="#64748B" />
      <circle cx="174" cy="72" r="13" fill="#2DD4BF" stroke="#FFFFFF" strokeWidth="6" />
    </svg>
  );
}

interface StockBoardLogoLockupProps {
  iconSize?: number;
  textClassName?: string;
  className?: string;
}

export function StockBoardLogoLockup({ iconSize = 32, textClassName, className }: StockBoardLogoLockupProps) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <StockBoardLogo size={iconSize} />
      <span className={cn('font-semibold tracking-tight text-foreground', textClassName)}>StockBoard</span>
    </span>
  );
}
