import { getCourseDetail, getCourseUnit } from '@/lib/server/courses';
import { errorResponse, ServiceError } from '@/lib/server/errors';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ slug: string; unitId: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    const { slug, unitId } = await params;
    const detail = await getCourseDetail(slug);
    if (!detail) {
      throw new ServiceError(404, 'course_not_found', `找不到课程 ${slug}`);
    }
    const unit = await getCourseUnit(slug, unitId);
    if (!unit) {
      throw new ServiceError(404, 'unit_not_found', `课程 ${slug} 中找不到单元 ${unitId}`);
    }
    return Response.json({ unit });
  } catch (error) {
    return errorResponse(error);
  }
}
