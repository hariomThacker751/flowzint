import type { LucideIcon } from "lucide-react";
import type { ViewKey } from "@/lib/data";

/**
 * Vision OS — foundation contracts.
 *
 * Vision OS is a *shell that hosts modules*. The current dashboard is the first
 * module (`sales-os`). Future modules (Trading OS, Procurement OS, Finance OS,
 * Logistics OS, …) implement the same `VisionModule` manifest and plug into the
 * shell's global slots (Approval Tray, Command Palette, Home metrics, Activity
 * Feed) WITHOUT requiring a redesign.
 *
 * Phase A only consumes `areas` (navigation regrouping over the existing views).
 * The `metrics` / `approvals` / `commands` / `activity` contributors are defined
 * now so the contract is stable for later phases and future modules.
 */

/**
 * A navigation area groups one or more existing dashboard views under a single
 * top-level destination. In Phase A the views are reused unchanged; in later
 * phases each area collapses its views into shared components.
 */
export interface VisionArea {
  /** Stable key, e.g. "home", "orders". */
  key: string;
  /** Sidebar label. */
  label: string;
  /** Sidebar icon. */
  icon: LucideIcon;
  /** Short helper text shown under the label when expanded. */
  description?: string;
  /** Existing legacy views grouped under this area (drives useUIStore.activeView). */
  views: ViewKey[];
  /** The view shown when the area is selected from the rail. */
  defaultView: ViewKey;
  /**
   * When true the area resolves to a single unified page (e.g. the Orders
   * lifecycle board), so the sidebar shows only the area entry and hides the
   * legacy sub-views. The `views` list is still kept for mapping/highlighting
   * and command-palette deep-links.
   */
  unified?: boolean;
}

/** A metric tile contributed to the global Home command center. */
export interface MetricContribution {
  id: string;
  label: string;
  /** Returns the display value + optional delta/tone. Implemented in later phases. */
  source: string; // endpoint or selector key resolved by the metrics service
}

export interface MetricSource {
  /** Endpoint that returns this module's metric contributions. */
  endpoint: string;
  metrics: MetricContribution[];
}

/** Approval items a module contributes to the global Approval Tray. */
export interface ApprovalSource {
  /** Endpoint returning the module's pending approvals. */
  endpoint: string;
  /** Roles permitted to act on this module's approvals (defense-in-depth UI hint). */
  approverRoles: string[];
}

/** A global Command Palette action contributed by a module. */
export interface CommandAction {
  id: string;
  title: string;
  /** Keywords for fuzzy search. */
  keywords?: string[];
  /** The view to navigate to (Phase A) — later phases may run a handler. */
  navigateTo?: ViewKey;
}

/** Activity events a module contributes to the global feed. */
export interface ActivitySource {
  endpoint: string;
}

/**
 * The manifest every Vision OS module implements.
 */
export interface VisionModule {
  /** Stable id, e.g. "sales-os". */
  id: string;
  /** Display name in the module rail. */
  label: string;
  /** Module rail icon. */
  icon: LucideIcon;
  /** Short tagline. */
  tagline?: string;
  /** Navigation areas this module exposes. */
  areas: VisionArea[];
  /** Optional global-slot contributors (used from Phase B onward). */
  metrics?: MetricSource;
  approvals?: ApprovalSource;
  commands?: CommandAction[];
  activity?: ActivitySource;
}
