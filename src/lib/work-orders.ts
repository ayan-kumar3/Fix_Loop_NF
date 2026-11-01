// ---------------------------------------------------------------------------
// Work-order lifecycle rules shared by the server actions (authoritative) and
// the work-orders UI (affordance only). The server re-checks every transition.
// ---------------------------------------------------------------------------

import type { UserRole, WorkOrderStatus } from "@/lib/types";

/** Who is allowed to set each work-order status. */
export const WORK_STATUS_PERMISSIONS: Record<WorkOrderStatus, UserRole[]> = {
  unassigned: ["administrator"],
  acknowledged: ["field_staff", "administrator"],
  in_progress: ["field_staff", "administrator"],
  submitted_for_verification: ["field_staff", "administrator"],
  completed: ["administrator"],
};

/** Linear forward progression used for the quick "advance" action. */
export const WORK_ORDER_NEXT: Record<WorkOrderStatus, WorkOrderStatus | null> = {
  unassigned: "acknowledged",
  acknowledged: "in_progress",
  in_progress: "submitted_for_verification",
  submitted_for_verification: "completed",
  completed: null,
};

export function canSetWorkStatus(role: UserRole, status: WorkOrderStatus): boolean {
  return WORK_STATUS_PERMISSIONS[status]?.includes(role) ?? false;
}

/** Statuses this user may move the work order into right now. */
export function allowedNextStatuses(role: UserRole, current: WorkOrderStatus): WorkOrderStatus[] {
  const all: WorkOrderStatus[] = ["unassigned", "acknowledged", "in_progress", "submitted_for_verification", "completed"];
  return all.filter((s) => s !== current && canSetWorkStatus(role, s));
}
