"use server";

import { redirect } from "next/navigation";
import { serverApi } from "@/lib/api/server";

/** Server Action: revoke the session and clear cookies (§8.3 logout). */
export async function logoutAction() {
  const api = await serverApi();
  await api.POST("/api/v1/auth/logout");
  redirect("/login");
}
