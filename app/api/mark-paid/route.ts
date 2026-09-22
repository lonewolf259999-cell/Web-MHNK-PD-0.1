import { NextResponse } from 'next/server';
import { markOfficerAsPaid } from '@/lib/server/sheets';
import { ApiError, handle, readJson, requirePin } from '@/lib/server/http';
import {
  clearPayment,
  getPayment,
  markProcessing,
  setPaymentResult,
} from '@/lib/server/paymentStore';

export const dynamic = 'force-dynamic';

interface Body {
  weekName?: string;
  officerName?: string;
  idempotencyKey?: string;
  pin?: string;
}

export function POST(request: Request) {
  return handle(async () => {
    const body = await readJson<Body>(request);
    requirePin(body);

    const { weekName, officerName, idempotencyKey } = body;
    if (!weekName || !officerName) {
      throw new ApiError('Missing required fields: weekName, officerName', 400);
    }

    if (idempotencyKey) {
      const prev = getPayment(idempotencyKey);
      if (prev?.status === 'processing') {
        return NextResponse.json({ success: false, processing: true, message: 'กำลังประมวลผล' });
      }
      if (prev) {
        return NextResponse.json({
          success: prev.success,
          message: prev.message,
          idempotencyKey,
        });
      }
      markProcessing(idempotencyKey);
    }

    try {
      const result = await markOfficerAsPaid(weekName, officerName);
      const message = `อัปเดตแถวที่ ${result.rowIndex} สำเร็จ`;

      if (idempotencyKey) setPaymentResult(idempotencyKey, true, message);

      return NextResponse.json({ success: true, message, idempotencyKey });
    } catch (err) {
      // Drop the key so a retry is allowed rather than pinned at "processing".
      if (idempotencyKey) clearPayment(idempotencyKey);
      throw err;
    }
  });
}
