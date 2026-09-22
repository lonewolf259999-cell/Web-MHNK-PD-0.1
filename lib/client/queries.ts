'use client';

/* Typed API calls. Every path, param and result here is inferred from the
   Elysia server — change a route and these stop compiling. */

import { client, unwrap } from './eden';
import type { CaseItem, ConductItem, FineItem, RuleItem } from '@/lib/types';

/* /rules-data/:type serves four shapes behind one route, so Eden infers the
   union of all of them. The literal passed in determines which arm comes
   back, which only these wrappers know — hence the narrowing here. */
type RulesUnion = ConductItem[] | RuleItem[] | CaseItem[];

const narrow = <T extends RulesUnion>(p: Promise<RulesUnion>) => p as Promise<T>;

export const queries = {
  officers: () => unwrap(client.api.officers.get()),

  weeks: () => unwrap(client.api.weeks.get()),

  weekData: (name: string) => unwrap(client.api['week-data'].get({ query: { name } })),

  weekTop10: () => unwrap(client.api['week-top10'].get()),

  scheduleConfig: () => unwrap(client.api['schedule-config'].get()),

  cases: () => narrow<CaseItem[]>(unwrap(client.api['rules-data']({ type: 'cases' }).get())),

  conduct: () =>
    narrow<ConductItem[]>(unwrap(client.api['rules-data']({ type: 'conduct' }).get())),

  rules: () => narrow<RuleItem[]>(unwrap(client.api['rules-data']({ type: 'rules' }).get())),

  fines: () => narrow<FineItem[]>(unwrap(client.api['rules-data']({ type: 'fines' }).get())),
};

export const mutations = {
  refresh: (pin: string) => unwrap(client.api.refresh.post({ pin })),

  markPaid: (input: {
    pin: string;
    weekName: string;
    officerName: string;
    idempotencyKey?: string;
  }) => unwrap(client.api['mark-paid'].post(input)),
};
