import { NextResponse } from 'next/server';
import { getPayment } from '@/lib/server/paymentStore';

export const dynamic = 'force-dynamic';

export function GET(request: Request) {
  const key = new URL(request.url).searchParams.get('key');
  if (!key) {
    return NextResponse.json({ success: false, found: false, error: 'Missing key' });
  }

  const entry = getPayment(key);
  if (!entry) {
    return NextResponse.json({
      success: false,
      found: false,
      error: 'ไม่พบสถานะการจ่ายเงิน (อาจไม่ถูกประมวลผล)',
    });
  }

  if (entry.status === 'processing') {
    return NextResponse.json({
      success: false,
      found: true,
      processing: true,
      error: 'กำลังประมวลผล',
    });
  }

  return NextResponse.json({ success: entry.success, found: true, message: entry.message });
}
