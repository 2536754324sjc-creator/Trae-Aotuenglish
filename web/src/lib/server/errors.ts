export class ServiceError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ServiceError';
  }
}

export function errorResponse(error: unknown): Response {
  if (error instanceof ServiceError) {
    return Response.json({ error: { code: error.code, message: error.message } }, { status: error.status });
  }
  console.error('[api] unexpected error', error);
  return Response.json(
    { error: { code: 'internal_error', message: '服务器内部错误' } },
    { status: 500 },
  );
}
