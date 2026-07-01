import {
  Bot,
  MessageSquareText,
  Package,
  Factory,
  Settings2,
} from "lucide-react";
import type { ViewKey } from "@/lib/data";
import type { VisionArea } from "./types";

/**
 * Sales OS — the 5 Vision OS areas that regroup the 17 legacy dashboard views.
 *
 * Phase A reuses the existing view components unchanged: selecting an area sets
 * `useUIStore.activeView` to one of these legacy ViewKeys. Later phases collapse
 * each area's views into shared Vision OS components.
 *
 * NOTE: every legacy ViewKey is mapped exactly once so nothing becomes
 * unreachable when the shell is enabled.
 */
export const SALES_OS_AREAS: VisionArea[] = [
  {
    key: "home",
    label: "Home",
    icon: Bot,
    description: "Command center",
    views: ["command", "analytics", "activity"],
    defaultView: "command",
    unified: true,
  },
  {
    key: "conversations",
    label: "Conversations",
    icon: MessageSquareText,
    description: "WhatsApp + Director",
    views: ["chats", "director"],
    defaultView: "chats",
  },
  {
    key: "orders",
    label: "Orders & Money",
    icon: Package,
    description: "Lifecycle & payments",
    views: ["quotes", "payment", "dispatch", "trading", "cancelled"],
    defaultView: "quotes",
    unified: true,
  },
  {
    key: "production",
    label: "Production & Capacity",
    icon: Factory,
    description: "Corrugators, batches, ETA",
    views: ["corrugator", "production"],
    defaultView: "corrugator",
    unified: true,
  },
  {
    key: "config",
    label: "Configuration",
    icon: Settings2,
    description: "Pricing, templates, catalog",
    views: ["pricing", "templates", "knowledge", "seasonal", "settings"],
    defaultView: "pricing",
    unified: true,
  },
];

/** Find which area currently contains the active view (for highlighting). */
export function areaForView(view: ViewKey): VisionArea | undefined {
  return SALES_OS_AREAS.find((a) => a.views.includes(view));
}


