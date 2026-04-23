const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

const pluralize = (value: number, unit: string): string => {
  return `${value} ${unit}${value === 1 ? "" : "s"} ago`;
};

export const formatTimeAgo = (dateValue: string | Date): string => {
  const date = dateValue instanceof Date ? dateValue : new Date(dateValue);
  const timestamp = date.getTime();

  if (!Number.isFinite(timestamp)) {
    return "just now";
  }

  const diff = Date.now() - timestamp;

  if (diff < MINUTE_MS) {
    return "just now";
  }

  if (diff < HOUR_MS) {
    return pluralize(Math.max(1, Math.floor(diff / MINUTE_MS)), "minute");
  }

  if (diff < DAY_MS) {
    return pluralize(Math.max(1, Math.floor(diff / HOUR_MS)), "hour");
  }

  return pluralize(Math.max(1, Math.floor(diff / DAY_MS)), "day");
};
