import { getWeeklyReport } from '@/lib/server/sessions';
import { errorResponse } from '@/lib/server/errors';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const week = new URL(request.url).searchParams.get('week') ?? undefined;
    return Response.json(await getWeeklyReport(week));
  } catch (error) {
    return errorResponse(error);
  }
}
