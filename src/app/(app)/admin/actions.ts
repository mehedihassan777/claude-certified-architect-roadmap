"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export interface DeleteUserState {
  error?: string;
}

/** Deletes an account; its progress row goes with it (on delete cascade). Admin only, never yourself. */
export async function deleteUser(_: DeleteUserState, form: FormData): Promise<DeleteUserState> {
  const me = await getCurrentUser();
  if (!me?.isAdmin) return { error: "Only the admin can delete accounts." };
  const id = z.uuid().safeParse(form.get("userId"));
  if (!id.success) return { error: "Unknown account." };
  if (id.data === me.id) return { error: "You can't delete your own admin account here." };

  const { error } = await createSupabaseAdminClient().auth.admin.deleteUser(id.data);
  if (error) return { error: error.message };
  revalidatePath("/admin");
  return {};
}
