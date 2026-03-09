import { formatDistanceToNow, format, parseISO } from "date-fns";

export function timeAgo(iso: string): string {
  try {
    return formatDistanceToNow(parseISO(iso), { addSuffix: true });
  } catch {
    return "--";
  }
}

export function formatDateTime(iso: string): string {
  try {
    return format(parseISO(iso), "MMM d, yyyy HH:mm");
  } catch {
    return "--";
  }
}

export function formatDate(iso: string): string {
  try {
    return format(parseISO(iso), "MMM d, yyyy");
  } catch {
    return "--";
  }
}

export function formatChartDate(iso: string): string {
  try {
    return format(parseISO(iso), "MMM d");
  } catch {
    return "";
  }
}
