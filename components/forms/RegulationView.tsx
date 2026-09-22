'use client';

import { useState } from 'react';
import { useApi } from '@/lib/client/api';
import { queries } from '@/lib/client/queries';
import { RulesView } from '@/components/views/RulesView';
import { SiteFooter } from '@/components/SiteHeader';
import { SearchBar } from '@/components/SearchBar';
import Link from 'next/link';

/** Standalone, read-only view of the conduct rules. */
export function RegulationView() {
  const [query, setQuery] = useState('');
  const conduct = useApi(queries.conduct, 'conduct_data');

  return (
    <div className="flex min-h-screen flex-col">
      <header className="relative z-10 border-b border-accent/12 bg-gradient-to-b from-[rgba(15,23,42,0.98)] to-[rgba(10,15,30,0.95)] px-4 py-3">
        <div className="mx-auto max-w-4xl space-y-3">
          <div className="flex items-center justify-between gap-3">
            <Link
              href="/"
              className="flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm font-semibold text-ink-dim transition hover:bg-accent/10 hover:text-accent"
            >
              <span aria-hidden>←</span> กลับ
            </Link>
            <div className="min-w-0 text-center">
              <h1 className="truncate text-sm font-bold text-ink md:text-base">
                ข้อปฏิบัติเจ้าหน้าที่
              </h1>
              <div className="text-[0.65rem] text-ink-dim">MHNK Police Department</div>
            </div>
            <span className="w-12" />
          </div>

          <SearchBar
            value={query}
            onChange={setQuery}
            resultCount={conduct.data?.length ?? 0}
            totalCount={conduct.data?.length ?? 0}
          />
        </div>
      </header>

      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-6">
        <RulesView
          items={conduct.data}
          loading={conduct.loading}
          error={conduct.error}
          query={query}
          onRetry={conduct.reload}
          groupField="title"
          icon="📚"
          title="ข้อปฏิบัติเจ้าหน้าที่"
          emptyTitle="ไม่พบข้อปฏิบัติที่ค้นหา"
        />
      </main>

      <SiteFooter />
    </div>
  );
}
