import type { Metadata } from 'next';
import { MedicalForm } from '@/components/forms/MedicalForm';

export const metadata: Metadata = {
  title: 'สมัครหน่วยแพทย์ - MHNK Medical Department',
};

export default function MedicalPage() {
  return <MedicalForm />;
}
