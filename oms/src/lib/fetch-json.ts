/**
 * 先读 text 再 JSON.parse，避免 Response 为空或非 JSON 时 res.json() 抛 SyntaxError。
 */
export async function parseJsonBody<T extends Record<string, unknown> = Record<string, unknown>>(
  res: Response
): Promise<T> {
  const text = await res.text();
  if (!text.trim()) {
    if (!res.ok) {
      return { error: `请求失败 (${res.status})` } as unknown as T;
    }
    return {} as T;
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    return {
      error: "服务器返回非 JSON，请检查接口或网络",
    } as unknown as T;
  }
}
