import { getCourseDetail } from '@/lib/server/courses';
import { errorResponse, ServiceError } from '@/lib/server/errors';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ slug: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    const { slug } = await params;
    const detail = await getCourseDetail(slug);
    if (!detail) {
      throw new ServiceError(404, 'course_not_found', `找不到课程 ${slug}`);
    }
    return Response.json(detail);
  } catch (error) {
    return errorResponse(error);
  }
}
