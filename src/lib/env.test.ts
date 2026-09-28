import { describe, expect, it } from "vitest";
import { EnvError, getSupabaseConfig } from "./env";

const BASE = {
  NEXT_PUBLIC_SUPABASE_URL: "https://abc.supabase.co",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_x",
};

describe("getSupabaseConfig", () => {
  it("reads the required settings; the secret key and admin are optional", () => {
    expect(getSupabaseConfig(BASE)).toEqual({
      url: "https://abc.supabase.co",
      publishableKey: "sb_publishable_x",
      secretKey: null,
      adminUserId: null,
    });
  });

  it("reads the secret key and a lower-cased admin user ID", () => {
    const config = getSupabaseConfig({
      ...BASE,
      SUPABASE_SECRET_KEY: "sb_secret_y",
      ADMIN_USER_ID: "3F2B8C1E-9D4A-4C6B-8E2F-1A2B3C4D5E6F",
    });
    expect(config.secretKey).toBe("sb_secret_y");
    expect(config.adminUserId).toBe("3f2b8c1e-9d4a-4c6b-8e2f-1a2b3c4d5e6f");
  });

  it("treats blank values as unset and names every missing setting", () => {
    expect(() => getSupabaseConfig({ NEXT_PUBLIC_SUPABASE_URL: " " })).toThrow(
      "NEXT_PUBLIC_SUPABASE_URL is required; NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is required",
    );
  });

  it("allows a local http URL and rejects other schemes", () => {
    expect(getSupabaseConfig({ ...BASE, NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321" }).url).toBe("http://127.0.0.1:54321");
    expect(() => getSupabaseConfig({ ...BASE, NEXT_PUBLIC_SUPABASE_URL: "ftp://abc" })).toThrow("NEXT_PUBLIC_SUPABASE_URL must be the project URL");
  });

  it("never echoes values in its errors", () => {
    const secret = "not-a-uuid-sb_secret_leak";
    let message = "";
    try {
      getSupabaseConfig({ ...BASE, ADMIN_USER_ID: secret });
    } catch (error) {
      expect(error).toBeInstanceOf(EnvError);
      message = (error as Error).message;
    }
    expect(message).toContain("ADMIN_USER_ID must be a user UUID");
    expect(message).not.toContain(secret);
  });
});
