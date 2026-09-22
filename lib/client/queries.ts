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

  markPaid: (
    input: { pin: string; weekName: string; officerName: string; idempotencyKey?: string },
    signal?: AbortSignal
  ) => unwrap(client.api['mark-paid'].post(input, { fetch: { signal } })),

  /** Used to resolve a payment whose response was lost to a timeout. */
  paymentStatus: (key: string) =>
    unwrap(client.api['mark-paid'].status.get({ query: { key } })),

  register: (input: Parameters<typeof client.api.register.post>[0]) =>
    unwrap(client.api.register.post(input)),

  editRegister: (input: Parameters<(typeof client.api.register)['edit']['patch']>[0]) =>
    unwrap(client.api.register.edit.patch(input)),

  fetchRegister: (messageId: string, discordUserId?: string) =>
    unwrap(client.api.register.fetch({ messageId }).get({ query: { discordUserId } })),

  medical: (input: Parameters<typeof client.api.medical.post>[0]) =>
    unwrap(client.api.medical.post(input)),

  editMedical: (input: Parameters<(typeof client.api.medical)['edit']['patch']>[0]) =>
    unwrap(client.api.medical.edit.patch(input)),

  fetchMedical: (messageId: string, discordUserId?: string) =>
    unwrap(client.api.medical.fetch({ messageId }).get({ query: { discordUserId } })),

  /* ---- admin ---- */

  listPending: (pin: string) => unwrap(client.api.pending.post({ pin })),

  approvePending: (row: number, input: { pin: string; proctorDiscordId: string; proctorDiscordName?: string }) =>
    unwrap(client.api.pending.approve({ row }).post(input)),

  rejectPending: (row: number, pin: string) =>
    unwrap(client.api.pending.reject({ row }).post({ pin })),

  namePD: (pin: string) => unwrap(client.api.roster.namepd.post({ pin })),

  outDC: (pin: string) => unwrap(client.api.roster.outdc.post({ pin })),

  setRosterStatus: (row: number, pin: string, status: string) =>
    unwrap(client.api.roster.status({ row }).put({ pin, status })),

  moveOut: (row: number, pin: string, reason: string) =>
    unwrap(client.api.roster['move-out']({ row }).post({ pin, reason })),
};
