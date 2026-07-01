import type { Tone } from "@/components/vision-os/tokens";

/**
 * Canonical order lifecycle stages — the single definition shared by the board,
 * filters, and drawer. Order matters (left → right on the board).
 */
export type LifecycleStage =
  | "enquiry"
  | "quote"
  | "token_pending"
  | "in_production"
  | "dispatch"
  | "completed"
  | "cancelled";

export interface StageMeta {
  key: LifecycleStage;
  label: string;
  tone: Tone;
}

export const LIFECYCLE_STAGES: StageMeta[] = [
  { key: "enquiry", label: "Enquiry", tone: "slate" },
  { key: "quote", label: "Quote / Approval", tone: "cyan" },
  { key: "token_pending", label: "Token Pending", tone: "amber" },
  { key: "in_production", label: "In Production", tone: "violet" },
  { key: "dispatch", label: "Dispatch", tone: "green" },
  { key: "completed", label: "Completed", tone: "green" },
  { key: "cancelled", label: "Cancelled", tone: "red" },
];

export const STAGE_META: Record<LifecycleStage, StageMeta> = Object.fromEntries(
  LIFECYCLE_STAGES.map((s) => [s.key, s]),
) as Record<LifecycleStage, StageMeta>;

export interface BoardOrder {
  id: string;
  orderId?: string | null;
  orderNo?: string | null;
  customerId: string;
  customerName: string;
  customerPhone?: string;
  spec: string;
  sizeInches?: number;
  grammage?: number;
  quality?: string;
  color?: string;
  lamination?: string;
  quantityKg?: number;
  deliveryCity?: string;
  amount?: number;
  quoteId?: string;
  ownerApproved?: number;
  status?: string;
  stage: LifecycleStage;
  createdAt?: string;
}
