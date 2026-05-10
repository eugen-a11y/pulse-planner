import { format, formatRelative, formatDistanceToNow, parseISO } from "date-fns";
import { de } from "date-fns/locale";

export function formatDate(iso: string): string {
  return format(parseISO(iso), "dd.MM.yyyy", { locale: de });
}

export function formatDateTime(iso: string): string {
  return format(parseISO(iso), "dd.MM.yyyy HH:mm", { locale: de });
}

export function formatTime(iso: string): string {
  return format(parseISO(iso), "HH:mm", { locale: de });
}

export function relative(iso: string): string {
  return formatRelative(parseISO(iso), new Date(), { locale: de });
}

export function timeAgo(iso: string): string {
  return formatDistanceToNow(parseISO(iso), { addSuffix: true, locale: de });
}

export function elapsedSeconds(startedAtIso: string, nowMs: number = Date.now()): number {
  return Math.max(0, Math.floor((nowMs - parseISO(startedAtIso).getTime()) / 1000));
}

export function formatHms(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600).toString().padStart(2, "0");
  const m = Math.floor((totalSeconds % 3600) / 60).toString().padStart(2, "0");
  const s = (totalSeconds % 60).toString().padStart(2, "0");
  return `${h}:${m}:${s}`;
}
