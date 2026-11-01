"use server";

// ---------------------------------------------------------------------------
// Administration server actions — member management and own-profile updates.
// Every action re-checks the caller's persisted role server-side.
// ---------------------------------------------------------------------------

import { revalidatePath } from "next/cache";
import { getStore } from "@/lib/db/store";
import { requireProfile, AuthError, validateEmail } from "@/lib/auth";
import { USER_ROLES } from "@/lib/types";
import type { UserRole } from "@/lib/types";

export interface AdminActionResult {
  ok: boolean;
  error?: string;
  message?: string;
}

function fail(error: string): AdminActionResult {
  return { ok: false, error };
}
function ok(message: string): AdminActionResult {
  return { ok: true, message };
}

async function handleError(e: unknown): Promise<AdminActionResult> {
  if (e instanceof AuthError) return fail(e.message);
  console.error(e);
  return fail("Something went wrong. Please try again.");
}

/** Change another member's role (administrators only). */
export async function setMemberRole(memberId: string, role: UserRole): Promise<AdminActionResult> {
  try {
    const admin = await requireProfile();
    if (admin.role !== "administrator") return fail("Only administrators can change roles.");
    if (!USER_ROLES.includes(role)) return fail("Invalid role.");

    const store = await getStore();
    const member = await store.getProfile(memberId);
    if (!member) return fail("Member not found.");

    // Guard: never let the last active administrator demote themselves.
    if (member.role === "administrator" && role !== "administrator") {
      const admins = (await store.getProfiles()).filter(
        (p) => p.role === "administrator" && p.isActive
      );
      if (admins.length <= 1) {
        return fail("At least one active administrator is required.");
      }
    }

    await store.updateProfile(memberId, { role });
    revalidatePath("/members");
    revalidatePath("/team");
    return ok(`${member.fullName} is now a ${role.replace("_", " ")}.`);
  } catch (e) {
    return handleError(e);
  }
}

/** Activate or deactivate a member account (administrators only). */
export async function setMemberActive(memberId: string, isActive: boolean): Promise<AdminActionResult> {
  try {
    const admin = await requireProfile();
    if (admin.role !== "administrator") return fail("Only administrators can change account status.");

    if (memberId === admin.id && !isActive) {
      return fail("You cannot deactivate your own account.");
    }

    const store = await getStore();
    const member = await store.getProfile(memberId);
    if (!member) return fail("Member not found.");

    if (!isActive) {
      const admins = (await store.getProfiles()).filter(
        (p) => p.role === "administrator" && p.isActive
      );
      if (member.role === "administrator" && admins.length <= 1) {
        return fail("At least one active administrator is required.");
      }
    }

    await store.updateProfile(memberId, { isActive });
    revalidatePath("/members");
    revalidatePath("/team");
    return ok(`${member.fullName} is now ${isActive ? "active" : "deactivated"}.`);
  } catch (e) {
    return handleError(e);
  }
}

/** Update the signed-in user's own profile (name, phone). */
export async function updateMyProfile(patch: {
  fullName?: string;
  phone?: string;
  email?: string;
}): Promise<AdminActionResult> {
  try {
    const profile = await requireProfile();

    const updates: { fullName?: string; phone?: string | null } = {};
    if (typeof patch.fullName === "string") {
      const name = patch.fullName.trim();
      if (name.length < 2) return fail("Enter your full name.");
      updates.fullName = name;
    }
    if (typeof patch.phone === "string") {
      updates.phone = patch.phone.trim() || null;
    }
    if (typeof patch.email === "string" && patch.email.trim().toLowerCase() !== profile.email.toLowerCase()) {
      // Email is identity-linked; changing it is not supported in this MVP.
      const err = validateEmail(patch.email);
      if (err) return fail(err);
      return fail("Email changes are not supported — it is linked to your sign-in.");
    }

    const store = await getStore();
    await store.updateProfile(profile.id, updates);
    revalidatePath("/settings");
    return ok("Profile updated.");
  } catch (e) {
    return handleError(e);
  }
}
