import { NextRequest, NextResponse } from "next/server";
import { describe, expect, it, vi } from "vitest";

import { updateSession } from "./lib/supabase/proxy";
import { config, proxy } from "./proxy";

vi.mock("./lib/supabase/proxy", () => ({
  updateSession: vi.fn(),
}));

describe("Next.js proxy", () => {
  it("delegates session refresh for matching requests", async () => {
    const request = new NextRequest("http://localhost:3000/dashboard");
    const response = NextResponse.next();
    vi.mocked(updateSession).mockResolvedValue(response);

    await expect(proxy(request)).resolves.toBe(response);
    expect(updateSession).toHaveBeenCalledWith(request);
  });

  it("excludes framework assets and common static images", () => {
    expect(config.matcher).toEqual([
      "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
    ]);
  });
});
