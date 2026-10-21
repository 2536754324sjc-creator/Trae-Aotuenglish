import type {
  Course,
  CourseDetail,
  SessionInput,
  SessionResult,
  TodayProgress,
  Unit,
  WeeklyReportResponse,
} from './types';

/** 浏览器侧的唯一数据入口；页面不再直接 import mock。 */

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    cache: 'no-store',
    ...init,
    headers: init?.body ? { 'content-type': 'application/json' } : undefined,
  });

  const payload = (await response.json().catch(() => null)) as
    | ({ error?: { code?: string; message?: string } } & T)
    | null;

  if (!response.ok) {
    throw new ApiError(
      response.status,
      payload?.error?.code ?? 'request_failed',
      payload?.error?.message ?? `请求失败（${response.status}）`,
    );
  }
  if (!payload) {
    throw new ApiError(response.status, 'empty_response', '服务器返回了空响应');
  }
  return payload;
}

export function fetchProgress(): Promise<TodayProgress> {
  return request<TodayProgress>('/api/users/me/progress');
}

export function fetchCourses(): Promise<{ courses: Course[] }> {
  return request<{ courses: Course[] }>('/api/courses');
}

export function fetchCourse(slug: string): Promise<CourseDetail> {
  return request<CourseDetail>(`/api/courses/${encodeURIComponent(slug)}`);
}

export function fetchUnit(unitId: string): Promise<{ unit: Unit }> {
  return request<{ unit: Unit }>(`/api/units/${encodeURIComponent(unitId)}`);
}

export function postSession(input: SessionInput): Promise<SessionResult> {
  return request<SessionResult>('/api/users/me/sessions', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function fetchWeeklyReport(week?: string): Promise<WeeklyReportResponse> {
  const query = week ? `?week=${encodeURIComponent(week)}` : '';
  return request<WeeklyReportResponse>(`/api/reports/weekly${query}`);
}
