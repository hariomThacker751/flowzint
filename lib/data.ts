import {
  Activity,
  BadgeIndianRupee,
  BookOpen,
  Bot,
  Brain,
  ChartNoAxesCombined,
  ClipboardList,
  Factory,
  FileText,
  MessageSquareText,
  Settings,
} from "lucide-react";

export type ViewKey =
  | "command"
  | "chats"
  | "director"
  | "production"
  | "quotes"
  | "pricing"
  | "templates"
  | "knowledge"
  | "activity"
  | "analytics"
  | "settings"
  | "payment"
  | "dispatch"
  | "cancelled"
  | "trading"
  | "seasonal"
  | "corrugator";

export const navItems = [
  { key: "command", label: "Dashboard", icon: ChartNoAxesCombined, badge: "" },
  { key: "chats", label: "Customer Chats", icon: MessageSquareText, badge: "2" },
  { key: "quotes", label: "Deal Desk", icon: BadgeIndianRupee, badge: "1 Pending" },
  { key: "analytics", label: "Analytics", icon: ChartNoAxesCombined, badge: "" },
  { key: "templates", label: "Chat Templates", icon: FileText, badge: "" },
  { key: "settings", label: "Settings", icon: Settings, badge: "" },
] as const;

export const customers = [
  {
    id: "bio-green",
    company: "BIO PACKAGING PRIVATE LIMITED",
    contact: "Nandan Kumar",
    phone: "+91 93340 77587",
    gst: "10AAGCB8395L1ZD",
    city: "Patna",
    state: "Bihar",
    language: "Hindi",
    stage: "Negotiation",
    urgency: "High",
    confidence: 91,
    last: "Transport cost kya hoga?",
    tag: "AI Thinking",
    unread: 2,
  },
  {
    id: "kanhaiya",
    company: "M/S KANHAIYA LAL CARTONS",
    contact: "Kanhaiya Lal",
    phone: "+91 94310 83824",
    gst: "10AAIFK2642Q1Z8",
    city: "Muzaffarpur",
    state: "Bihar",
    language: "Hindi",
    stage: "Quote Sent",
    urgency: "Medium",
    confidence: 84,
    last: "Rate thoda kam karo, 2000 boxes 3-ply plain lenge.",
    tag: "Price Validation Pending",
    unread: 1,
  }
] as const;

export const chatMessages = [
  { role: "customer", text: "Namaste, 36x24x12 5-ply box chahiye. Printed, 800 pieces.", time: "10:18" },
  { role: "ai", text: "Noted. Size 36x24x12, 5-ply (Double Wall), Printed, 800 qty. City Patna confirm kar dijiye?", time: "10:19" },
  { role: "customer", text: "Patna. Transport cost kya hoga?", time: "10:21" },
  { role: "system", text: "Knowledge lookup failed: logistics_cost_patna", time: "10:21" },
  { role: "system", text: "Sales Agent requested clarification from Director", time: "10:22" },
] as const;

export const directorThreads = [
  { title: "Transport cost gaps", items: 2, active: true },
  { title: "Quote approvals", items: 1, active: false },
] as const;

export const directorMessages = [
  { role: "director", text: "Transport cost for 800 units to Patna is missing. Customer: BIO PACKAGING, Bihar." },
  { role: "owner", text: "Save it as INR 12 per box. Customer visible." },
  { role: "director", text: "Saved to knowledge base: logistics_cost_patna = 12 INR/box. Sales Agent can now answer." },
] as const;

export const activityEvents = [
  { label: "Director learned new rule", detail: "Logistics to Patna updated", time: "10:28", tone: "green" },
  { label: "Owner input required", detail: "Transport missing for Patna order", time: "10:22", tone: "amber" },
] as const;

export const memoryNodes = [
  { key: "pricing:kraft_paper_base", value: "INR 35/kg", type: "fact", scope: "internal_only", freshness: 100 },
  { key: "pricing:5ply_premium", value: "+INR 5/box", type: "rule", scope: "internal_only", freshness: 100 },
  { key: "logistics_cost_patna", value: "INR 12/box", type: "fact", scope: "customer_visible", freshness: 100 },
] as const;

export const kpiCards = [
  { label: "Active Conversations", value: "2", delta: "+1", color: "cyan" },
  { label: "Quotes Today", value: "4", delta: "INR 1.2L", color: "violet" },
  { label: "Corrugator Utilization", value: "78%", delta: "+2%", color: "green" },
  { label: "Revenue Pipeline", value: "INR 4.1L", delta: "2 hot deals", color: "amber" },
  { label: "AI Confidence", value: "91%", delta: "1 low", color: "cyan" },
  { label: "Pending Owner Inputs", value: "1", delta: "1 urgent", color: "red" },
] as const;

export const productionData = [
  { day: "Thu", corrugator: 76, booked: 58, available: 18 },
  { day: "Fri", corrugator: 84, booked: 71, available: 13 },
  { day: "Sat", corrugator: 91, booked: 86, available: 5 },
  { day: "Sun", corrugator: 62, booked: 43, available: 19 },
  { day: "Mon", corrugator: 88, booked: 73, available: 15 },
  { day: "Tue", corrugator: 79, booked: 65, available: 14 },
  { day: "Wed", corrugator: 82, booked: 69, available: 13 },
] as const;

export const priceData = [
  { name: "3-Ply", price: 32 },
  { name: "5-Ply", price: 45 },
  { name: "7-Ply", price: 60 },
] as const;

export const quotePipeline = [
  "Qualification complete",
  "Pricing engine triggered",
  "Owner approval pending",
  "Capacity verified",
  "Quote generated",
] as const;
