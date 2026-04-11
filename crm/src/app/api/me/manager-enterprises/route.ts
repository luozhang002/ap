import { NextResponse } from "next/server";
import {
  MANAGER_ENTERPRISES_DEFAULT_LIMIT,
  MANAGER_ENTERPRISES_MAX_LIMIT,
  queryManagerEnterprises,
} from "@/lib/crm-visited-enterprises";
import { getCrmUser } from "@/lib/session";

function parseIntParam(v: string | null, fallback: number, max: number): number {
  if (v == null || v === "") return fallback;
  const n = Number.parseInt(v, 10);
  if (!Number.isFinite(n) || n < 1) return fallback;
  return Math.min(n, max);
}

/** 当前客户经理名下企业：分页 + 企业名称 / 市（省市区）筛选 */
export async function GET(req: Request) {
  const user = await getCrmUser();
  if (!user) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const limit = parseIntParam(
    searchParams.get("limit"),
    MANAGER_ENTERPRISES_DEFAULT_LIMIT,
    MANAGER_ENTERPRISES_MAX_LIMIT,
  );
  const cursorRaw = searchParams.get("cursor");
  const cursor =
    cursorRaw != null && cursorRaw !== "" ? Number.parseInt(cursorRaw, 10) : undefined;
  const nameQ = searchParams.get("name") ?? "";
  const cityQ = searchParams.get("city") ?? "";

  const result = await queryManagerEnterprises(user.name, {
    limit,
    cursor: cursor != null && Number.isFinite(cursor) ? cursor : undefined,
    nameQ,
    cityQ,
  });

  return NextResponse.json(result);
}
