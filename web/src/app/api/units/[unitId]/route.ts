import { getUnitById } from '@/lib/server/courses';
import { errorResponse, ServiceError } from '@/lib/server/errors';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ unitId: string }> };

/** 便捷路由：学习端只拿得到 unitId，不需要先知道课程 slug */
export async function GET(_request: Request, { params }: Params) {
  try {
    const { unitId } = await params;
    const unit = await getUnitById(unitId);
    if (!unit) {
      throw new ServiceError(404, 'unit_not_found', `找不到单元 ${unitId}`);
    }
    return Response.json({ unit });
  } catch (error) {
    return errorResponse(error);
  }
}
