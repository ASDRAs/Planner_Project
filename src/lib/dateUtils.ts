export function getLocalDateString(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getRelativeDateString(offset: number, baseDate: Date = new Date()): string {
  const d = new Date(baseDate);
  d.setDate(d.getDate() + offset);
  return getLocalDateString(d);
}

/**
 * YYYY-MM-DD 형식을 로컬 자정 기준으로 Date 객체로 변환합니다.
 * 하이픈(-)을 슬래시(/)로 바꾸면 JS 엔진이 로컬 타임존 자정으로 해석합니다.
 */
export function parseLocalDate(dateStr: string): Date {
  return new Date(dateStr.replace(/-/g, '/'));
}
