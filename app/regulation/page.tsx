import type { Metadata } from 'next';
import { RegulationView } from '@/components/forms/RegulationView';

export const metadata: Metadata = {
  title: 'ข้อปฏิบัติเจ้าหน้าที่ - MHNK Police Department',
};

export default function RegulationPage() {
  return <RegulationView />;
}
