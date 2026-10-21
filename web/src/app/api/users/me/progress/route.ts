import { getProgress } from '@/lib/server/courses';
import { errorResponse } from '@/lib/server/errors';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    return Response.json(await getProgress());
  } catch (error) {
    return errorResponse(error);
  }
}
