import type { SessionInput } from '@/lib/types';
import { recordSession } from '@/lib/server/sessions';
import { errorResponse, ServiceError } from '@/lib/server/errors';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as Partial<SessionInput> | null;
    if (
      !body ||
      typeof body.unitId !== 'string' ||
      !Array.isArray(body.results) ||
      typeof body.durationSec !== 'number'
    ) {
      throw new ServiceError(400, 'invalid_body', '需要 { unitId, results, durationSec }');
    }

    const result = await recordSession({
      unitId: body.unitId,
      results: body.results as boolean[],
      durationSec: body.durationSec,
    });
    return Response.json(result, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
