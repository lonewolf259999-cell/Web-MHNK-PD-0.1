import type { Metadata } from 'next';
import { ProctorPanel } from '@/components/forms/ProctorPanel';

export const metadata: Metadata = {
  title: 'Admin - MHNK Police Department',
};

export default function ProctorPage() {
  return <ProctorPanel />;
}
