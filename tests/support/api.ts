import { randomInt } from "node:crypto";

type Handler = (request: Request, ctx: { params: Promise<Record<string, string>> }) => Promise<Response>;

/** IP acak per pemanggil agar rate limit antar-tes tidak saling mengganggu. */
export const randomIp = () => `10.${randomInt(256)}.${randomInt(256)}.${randomInt(1, 255)}`;

/** Memanggil route handler App Router secara langsung (tanpa server HTTP). */
export async function call<T = Record<string, unknown>>(
  handler: Handler,
  options: {
    method?: string;
    path?: string;
    params?: Record<string, string>;
    token?: string;
    body?: unknown;
    ip?: string;
  } = {},
): Promise<{ status: number; body: T }> {
  const headers: Record<string, string> = { "x-forwarded-for": options.ip ?? randomIp() };
  if (options.token) headers.authorization = `Bearer ${options.token}`;
  if (options.body !== undefined) headers["content-type"] = "application/json";

  const request = new Request(`http://localhost:3000${options.path ?? "/"}`, {
    method: options.method ?? (options.body === undefined ? "GET" : "POST"),
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const res = await handler(request, { params: Promise.resolve(options.params ?? {}) });
  const text = await res.text();
  return { status: res.status, body: (text ? JSON.parse(text) : {}) as T };
}
