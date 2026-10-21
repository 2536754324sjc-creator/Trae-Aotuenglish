import { listCourses } from '@/lib/server/courses';
import { errorResponse } from '@/lib/server/errors';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const level = new URL(request.url).searchParams.get('level') ?? undefined;
    return Response.json({ courses: await listCourses(level) });
  } catch (error) {
    return errorResponse(error);
  }
}
