"use client";

import { ApiError, CSRF, isProblem } from "@cbs/api-client";

const CSRF_COOKIES = ["__Host-csrf", "cbs_csrf", "cbs-csrf"];

function readCookie(name: string): string | undefined {
  const match = document.cookie.match(
    new RegExp("(?:^|; )" + name.replace(/([.$?*|{}()[\]\\/+^])/g, "\\$1") + "=([^;]*)"),
  );
  return match ? decodeURIComponent(match[1]!) : undefined;
}

export async function postForm<T>(path: string, body: FormData): Promise<T> {
  const token = CSRF_COOKIES.map(readCookie).find(Boolean);
  const res = await fetch(path, {
    method: "POST",
    credentials: "include",
    headers: token ? { [CSRF.HEADER]: token } : undefined,
    body,
  });
  const payload = await res.json().catch(() => undefined);
  if (!res.ok) {
    throw new ApiError(
      isProblem(payload)
        ? payload
        : {
            title: "Request failed",
            status: res.status,
            code: "UPLOAD_FAILED",
            detail: res.statusText,
          },
    );
  }
  return payload as T;
}

export async function uploadCatalogueImages<T>({
  path,
  main,
  gallery,
}: {
  path: string;
  main?: File | null;
  gallery?: File[];
}): Promise<T> {
  const fd = new FormData();
  if (main) fd.append("main", main);
  for (const file of gallery ?? []) {
    fd.append("gallery", file);
  }
  return postForm<T>(path, fd);
}
