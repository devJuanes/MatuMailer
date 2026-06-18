'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { FAQ_ITEMS } from './content';

export function LandingFaq() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <div className="mx-auto max-w-3xl space-y-3">
      {FAQ_ITEMS.map((item, i) => {
        const isOpen = open === i;
        return (
          <article
            key={item.q}
            className="overflow-hidden rounded-2xl border border-white/70 bg-white/70 shadow-soft backdrop-blur-md"
          >
            <button
              type="button"
              className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
              aria-expanded={isOpen}
              onClick={() => setOpen(isOpen ? null : i)}
            >
              <h3 className="text-base font-semibold text-charcoal">{item.q}</h3>
              <ChevronDown
                className={cn(
                  'h-5 w-5 shrink-0 text-muted-foreground transition-transform',
                  isOpen && 'rotate-180',
                )}
              />
            </button>
            {isOpen && (
              <div className="border-t border-white/60 px-5 pb-4 pt-3">
                <p className="text-sm leading-relaxed text-muted-foreground">{item.a}</p>
              </div>
            )}
          </article>
        );
      })}
    </div>
  );
}
