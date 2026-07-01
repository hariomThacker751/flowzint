import {
  AlertTriangle,
  Clock3,
  Database,
  Factory,
  FileText,
  MessageCircle,
  Activity,
  type LucideIcon,
} from "lucide-react";

/**
 * Maps icon names returned by server endpoints (e.g. /api/metrics) to Lucide
 * components. Keeps the API JSON-serializable while letting the UI render real
 * icons. Add new names here as metrics grow.
 */
export const ICONS: Record<string, LucideIcon> = {
  MessageCircle,
  FileText,
  Factory,
  Database,
  Clock3,
  AlertTriangle,
  Activity,
};

export function resolveIcon(name?: string): LucideIcon {
  return (name && ICONS[name]) || Activity;
}

