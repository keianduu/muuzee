type AdminLoginCredentials = {
  email: string;
  password: string;
};

type AdminLoginResult =
  | { ok: true; redirectTo: "/admin" }
  | { ok: false; message: string };

type FetchLogin = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

function loginErrorMessage(code: unknown) {
  switch (code) {
    case "invalid_input":
      return "メールアドレスとパスワードを確認してください。";
    case "invalid_credentials":
    case "unauthenticated":
      return "メールアドレスまたはパスワードが正しくありません。";
    case "rate_limited":
      return "試行回数が多すぎます。時間をおいて再度お試しください。";
    default:
      return "ログインできませんでした。時間をおいて再度お試しください。";
  }
}

export async function submitAdminLogin(
  credentials: AdminLoginCredentials,
  request: FetchLogin = fetch,
): Promise<AdminLoginResult> {
  try {
    const response = await request("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(credentials),
    });
    const result = await response.json() as {
      ok?: unknown;
      status?: unknown;
      error?: { code?: unknown };
    };
    if (response.ok && result.ok === true && result.status === "authenticated") {
      return { ok: true, redirectTo: "/admin" };
    }
    return { ok: false, message: loginErrorMessage(result.error?.code) };
  } catch {
    return { ok: false, message: loginErrorMessage("temporary") };
  }
}
