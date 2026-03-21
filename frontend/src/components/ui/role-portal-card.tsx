import * as React from 'react';
import { Link } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import { ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Color-tinted overlay on full-bleed photo (reference: green / blue / purple) */
export type RoleCardTheme = 'green' | 'blue' | 'purple';

const THEME_OVERLAY: Record<RoleCardTheme, string> = {
  // #00b87a → #00a86b with opacity so photo stays visible
  // Semi-transparent green on top of photo (photo stays visible, esp. upper area)
  green: `linear-gradient(180deg,
    rgba(0, 184, 122, 0.22) 0%,
    rgba(0, 184, 122, 0.38) 30%,
    rgba(0, 184, 122, 0.58) 58%,
    rgba(0, 168, 107, 0.82) 85%,
    rgba(0, 168, 107, 0.9) 100%)`,
  // #4a90d9 → #2563eb
  blue: `linear-gradient(180deg,
    rgba(74, 144, 217, 0.26) 0%,
    rgba(59, 130, 246, 0.45) 35%,
    rgba(37, 99, 235, 0.72) 68%,
    rgba(37, 99, 235, 0.9) 100%)`,
  // #7c3aed → #6d28d9
  purple: `linear-gradient(180deg,
    rgba(124, 58, 237, 0.28) 0%,
    rgba(124, 58, 237, 0.48) 32%,
    rgba(109, 40, 217, 0.75) 65%,
    rgba(109, 40, 217, 0.92) 100%)`,
};

const THEME_BADGE: Record<RoleCardTheme, string> = {
  green: 'bg-[#00b87a]',
  blue: 'bg-[#3b82f6]',
  purple: 'bg-[#7c3aed]',
};

export interface RolePortalCardProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onClick'> {
  title: string;
  description: string;
  features: string;
  icon: LucideIcon;
  to: string;
  imageUrl: string;
  theme: RoleCardTheme;
  ctaLabel?: string;
  onActivate?: () => void;
}

/** Fixed-height role card: photo cover + color gradient, rounded-square badge, full-width bottom CTA. */
const RolePortalCard = React.forwardRef<HTMLDivElement, RolePortalCardProps>(
  (
    {
      className,
      title,
      description,
      features,
      icon: Icon,
      to,
      imageUrl,
      theme,
      ctaLabel = 'Enter Dashboard',
      onActivate,
      ...props
    },
    ref,
  ) => {
    return (
      <div ref={ref} className={cn('min-w-0', className)} {...props}>
        <Link
          to={to}
          onClick={onActivate}
          className={cn(
            'group relative flex w-full flex-col overflow-hidden rounded-[20px]',
            // Fit in viewport: cap height so row + header + footer don’t clip the CTA
            'h-[min(420px,58svh)] max-h-[min(420px,58svh)]',
            'bg-slate-300 shadow-[0_4px_24px_-4px_rgba(15,23,42,0.12)] ring-1 ring-black/[0.06]',
            'transition-[transform,box-shadow] duration-300 ease-out',
            'hover:-translate-y-0.5 hover:shadow-[0_12px_40px_-8px_rgba(15,23,42,0.18)]',
            'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1a8c5b]',
          )}
          aria-label={`Open ${title} dashboard`}
        >
          {/* Layer 1: full-bleed photo (object-fit: cover) */}
          <div
            className="absolute inset-0 bg-cover bg-no-repeat transition-transform duration-500 ease-out group-hover:scale-[1.03]"
            style={{
              backgroundImage: `url(${imageUrl})`,
              backgroundPosition: 'center top',
            }}
          />

          {/* Layer 2: theme gradient on top of photo */}
          <div
            className="pointer-events-none absolute inset-0"
            style={{ background: THEME_OVERLAY[theme] }}
            aria-hidden
          />

          {/* Content — CTA bar is shrink-0 + fixed height so it is never clipped */}
          <div className="relative z-10 flex h-full min-h-0 flex-col text-left text-white">
            <div className="shrink-0 px-5 pt-5">
              <div
                className={cn(
                  'flex h-11 w-11 items-center justify-center rounded-[10px] shadow-md ring-1 ring-white/20',
                  THEME_BADGE[theme],
                )}
              >
                <Icon className="h-5 w-5 text-white" strokeWidth={2.25} aria-hidden />
              </div>
            </div>

            <div className="min-h-0 flex-1" aria-hidden />

            <div className="shrink-0 space-y-2 px-5 pb-4">
              <h3 className="text-[28px] font-bold leading-tight tracking-[-0.02em] text-white">
                {title}
              </h3>
              <p className="text-sm font-medium leading-snug text-white/[0.92]">{description}</p>
              <p className="text-xs font-medium leading-relaxed text-white/75">{features}</p>
            </div>

            {/* Full-width CTA — 48px, flush bottom, always visible */}
            <div
              className={cn(
                'flex h-12 w-full shrink-0 items-center justify-between gap-3 border-t border-white/20',
                'bg-black/40 px-5 backdrop-blur-[10px]',
              )}
            >
              <span className="text-sm font-bold tracking-wide text-white">{ctaLabel}</span>
              <ArrowRight
                className="h-4 w-4 shrink-0 text-white transition-transform duration-300 group-hover:translate-x-0.5"
                strokeWidth={2.5}
                aria-hidden
              />
            </div>
          </div>
        </Link>
      </div>
    );
  },
);
RolePortalCard.displayName = 'RolePortalCard';

export { RolePortalCard };
