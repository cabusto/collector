// server-only — never import from client components
import "server-only";

const COLLECTOR_URL = process.env.COLLECTOR_URL!;
const COLLECTOR_TOKEN = process.env.COLLECTOR_TOKEN!;
const COLLECTOR_ADMIN_TOKEN = process.env.COLLECTOR_ADMIN_TOKEN!;

type TokenType = "read" | "admin";

export async function collectorFetch(
  path: string,
  init: RequestInit = {},
  tokenType: TokenType = "read"
): Promise<Response> {
  const token =
    tokenType === "admin" ? COLLECTOR_ADMIN_TOKEN : COLLECTOR_TOKEN;

  const res = await fetch(`${COLLECTOR_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...init.headers,
    },
  });

  return res;
}
