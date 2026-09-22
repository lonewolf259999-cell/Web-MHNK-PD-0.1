'use client';

import { useMemo, useState } from 'react';
import { SiteFooter, SiteHeader } from '@/components/SiteHeader';
import { NavTabs, type PageId } from '@/components/NavTabs';
import { SearchBar } from '@/components/SearchBar';
import { AllTimeTop10, WeeklyTop10 } from '@/components/Top10Sidebar';
import { RosterView } from '@/components/views/RosterView';
import { RulesView } from '@/components/views/RulesView';
import { FinesView } from '@/components/views/FinesView';
import { CasesView } from '@/components/views/CasesView';
import { ScheduleView } from '@/components/views/ScheduleView';
import { ErrorState, Loading } from '@/components/ui/States';
import { useApi } from '@/lib/client/api';
import { filterByQuery } from '@/lib/format';
import type {
  CaseItem,
  ConductItem,
  FineItem,
  Officer,
  RuleItem,
  ScheduleConfig,
} from '@/lib/types';

export default function HomePage() {
  const [page, setPage] = useState<PageId>('roster');
  const [query, setQuery] = useState('');

  const officers = useApi<Officer[]>('/api/officers', 'officers');
  const weeks = useApi<string[]>('/api/weeks', 'weeks');
  const cases = useApi<CaseItem[]>('/api/rules-data/cases', 'cases_data');
  const conduct = useApi<ConductItem[]>('/api/rules-data/conduct', 'conduct_data');
  const rules = useApi<RuleItem[]>('/api/rules-data/rules', 'rules_data');
  const fines = useApi<FineItem[]>('/api/rules-data/fines', 'fines_data');
  const schedule = useApi<ScheduleConfig>('/api/schedule-config', 'schedule_config');

  const allOfficers = useMemo(() => officers.data ?? [], [officers.data]);

  const filteredOfficers = useMemo(
    () => filterByQuery(allOfficers, query, ['name', 'code', 'rank']),
    [allOfficers, query]
  );

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between lg:gap-6">
          <SearchBar
            value={query}
            onChange={setQuery}
            resultCount={filteredOfficers.length}
            totalCount={allOfficers.length}
          />
          <NavTabs active={page} onChange={setPage} />
        </div>
      </SiteHeader>

      <div className="mx-auto flex w-full max-w-[1500px] flex-1 flex-col items-start gap-5 px-4 pt-6 pb-12 lg:flex-row lg:gap-7 lg:px-6">
        <div className="order-2 w-full lg:order-1 lg:w-auto">
          <WeeklyTop10 weeks={weeks.data ?? []} />
        </div>

        <main className="order-1 min-w-0 flex-1 lg:order-2">
          {page === 'roster' &&
            (officers.loading ? (
              <Loading />
            ) : officers.error ? (
              <ErrorState message={officers.error} onRetry={officers.reload} />
            ) : (
              <RosterView officers={filteredOfficers} total={allOfficers.length} />
            ))}

          {page === 'cases' && (
            <CasesView
              items={cases.data}
              loading={cases.loading}
              error={cases.error}
              query={query}
              onRetry={cases.reload}
            />
          )}

          {page === 'conduct' && (
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
          )}

          {page === 'rules' && (
            <RulesView
              items={rules.data}
              loading={rules.loading}
              error={rules.error}
              query={query}
              onRetry={rules.reload}
              groupField="category"
              icon="📖"
              title="กฎหมายและระเบียบตำรวจ"
              emptyTitle="ไม่พบกฎที่ค้นหา"
            />
          )}

          {page === 'fines' && (
            <FinesView
              items={fines.data}
              loading={fines.loading}
              error={fines.error}
              query={query}
              onRetry={fines.reload}
            />
          )}

          {page === 'schedule' &&
            (officers.loading ? (
              <Loading />
            ) : (
              <ScheduleView officers={filteredOfficers} config={schedule.data} />
            ))}
        </main>

        <div className="order-3 w-full lg:w-auto">
          <AllTimeTop10 officers={allOfficers} />
        </div>
      </div>

      <SiteFooter />
    </div>
  );
}
