import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { DEVICE_COOKIE, DEVICE_LIMIT, deviceLabel, isDeviceId, newDeviceId } from "@/lib/device";

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
const PROXY = read("src/proxy.ts");
const SQL = read("supabase/device-limit.sql");

describe("device identity", () => {
  it("ids are random, and two are never the same", () => {
    const seen = new Set(Array.from({ length: 500 }, () => newDeviceId()));
    expect(seen.size).toBe(500);
  });

  it("ids are long enough not to be guessed or collided into", () => {
    // 128 bits. A device id is a capability — anything short enough to brute
    // force is a way to occupy somebody else's slot.
    expect(newDeviceId()).toMatch(/^[0-9a-f]{32}$/);
  });

  it("only accepts ids of our own shape", () => {
    expect(isDeviceId(newDeviceId())).toBe(true);
    for (const bad of ["", "abc", "../../etc", "x".repeat(32), undefined, null, "A".repeat(32)]) {
      expect({ bad, ok: isDeviceId(bad as string) }).toMatchObject({ ok: false });
    }
  });
});

describe("device labels", () => {
  it.each([
    ["Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1", "iPhone · Safari"],
    ["Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/131.0 Safari/537.36", "Mac · Chrome"],
    ["Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0 Safari/537.36 Edg/131.0", "Windows · Edge"],
    ["Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15) Gecko/20100101 Firefox/133.0", "Mac · Firefox"],
    ["Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/131.0 Mobile Safari/537.36", "Android · Chrome"],
    ["Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Safari/604.1", "iPad · Safari"],
  ])("reads %s as its platform and browser", (ua, expected) => {
    expect(deviceLabel(ua)).toBe(expected);
  });

  // Every browser's UA contains "Safari", and Edge and Opera both contain
  // "Chrome". Getting the order wrong labels the whole world Safari.
  it("does not call Chrome Safari, or Edge Chrome", () => {
    expect(deviceLabel("Mozilla/5.0 (Macintosh) AppleWebKit/537.36 Chrome/131.0 Safari/537.36")).toContain("Chrome");
    expect(deviceLabel("Mozilla/5.0 (Windows) Chrome/131.0 Safari/537.36 Edg/131.0")).toContain("Edge");
    expect(deviceLabel("Mozilla/5.0 (Windows) Chrome/131.0 Safari/537.36 OPR/117.0")).toContain("Opera");
  });

  it("names the app rather than guessing a browser", () => {
    expect(deviceLabel("anything at all", true)).toBe("SwiftCard app");
  });

  it("never throws or returns empty on junk", () => {
    for (const ua of ["", null, undefined, "🙂", "x".repeat(4000)]) {
      const out = deviceLabel(ua as string);
      expect(typeof out).toBe("string");
      expect(out.length).toBeGreaterThan(0);
    }
  });
});

describe("the proxy gate", () => {
  // THE RULE THIS FILE EXISTS FOR. Every auth check in the proxy fails OPEN
  // after the 2026-08-27 Supabase brownout, and a device limit is the easiest
  // one to get wrong: a failed query looks a lot like "this device is not
  // allowed". Locking somebody out of their own account because a database was
  // slow is far worse than a third device getting in during an outage.
  it("only a definite FALSE blocks — an error never does", () => {
    expect(PROXY).toContain("const { data, error } = await supabase.rpc(\"claim_device_slot\"");
    expect(PROXY).toMatch(/if \(!error && data === false\)/);
    // The catch must not redirect.
    const block = PROXY.slice(PROXY.indexOf("claim_device_slot"));
    const katch = block.slice(block.indexOf("} catch {"), block.indexOf("} catch {") + 260);
    expect(katch).not.toContain("redirect");
  });

  it("a denial is never cached, so freeing a slot works immediately", () => {
    expect(PROXY).toContain("deviceCheckCache.delete(key)");
    expect(PROXY).not.toMatch(/deviceCheckCache\.set\([^)]*ok:\s*false/);
  });

  it("only a success is read from the cache", () => {
    expect(PROXY).toMatch(/cached && cached\.ok && Date\.now\(\) - cached\.at </);
  });

  it("the devices page itself is exempt, or a blocked device could never recover", () => {
    expect(PROXY).toContain('!request.nextUrl.pathname.startsWith("/settings/devices")');
  });

  it("the cookie is httpOnly, long-lived, and same-site", () => {
    const set = PROXY.slice(PROXY.indexOf("supabaseResponse.cookies.set(DEVICE_COOKIE"));
    expect(set).toContain("httpOnly: true");
    expect(set).toContain('sameSite: "lax"');
    expect(set).toContain("maxAge: DEVICE_COOKIE_MAX_AGE");
  });

  it("the cookie is planted only behind the login wall, never on the marketing site", () => {
    const gate = PROXY.slice(PROXY.indexOf("// ── The two-device limit"));
    expect(gate).toMatch(/if \(userId && isProtected/);
  });

  it("the cache cannot grow without bound", () => {
    expect(PROXY).toContain("if (deviceCheckCache.size > 5000) deviceCheckCache.clear()");
  });
});

describe("the database decides, not the application", () => {
  it("the limit is claimed in one statement, under a lock", () => {
    // SELECT-count-then-INSERT from the app races with itself: two devices
    // signing in together both read "1" and both insert, leaving three.
    // Match the LOCK, not the words. "for update" also appears in the RLS
    // update policy, so a looser check passed happily with the lock deleted.
    expect(SQL).toMatch(/perform 1 from public\.user_devices\s+where user_id = v_user for update;/);
    expect(SQL).toContain("create or replace function public.claim_device_slot");
  });

  it("runs as the caller, so RLS still applies", () => {
    expect(SQL).toContain("security invoker");
    expect(SQL).not.toContain("security definer");
  });

  it("a full account returns false rather than throwing", () => {
    // The caller has to tell "denied" from "database is down"; an exception
    // would blur them and the proxy would fail open on a real denial.
    expect(SQL).toMatch(/if v_count >= p_limit then\s*\n\s*return false;/);
  });

  it("every policy is scoped to the caller's own rows", () => {
    const policies = SQL.match(/create policy[\s\S]*?;/g) ?? [];
    expect(policies.length).toBe(4); // select, insert, update, delete
    for (const p of policies) expect(p).toContain("auth.uid() = user_id");
  });

  it("rows disappear with the account", () => {
    expect(SQL).toContain("references auth.users(id) on delete cascade");
  });

  it("the limit the proxy passes is the one this app means", () => {
    expect(DEVICE_LIMIT).toBe(2);
    expect(PROXY).toContain("p_limit: DEVICE_LIMIT");
  });

  it("only signed-in users may claim a slot", () => {
    expect(SQL).toContain("grant execute on function public.claim_device_slot(text, text, text, boolean, int) to authenticated");
    expect(SQL).toMatch(/revoke all on function public\.claim_device_slot[^;]*from public;/);
  });
});

describe("the cookie name is shared, not retyped", () => {
  it("every reader imports it", () => {
    expect(DEVICE_COOKIE).toBe("sc_device");
    for (const f of ["src/proxy.ts", "src/app/api/devices/route.ts", "src/app/settings/devices/page.tsx"]) {
      expect({ f, ok: read(f).includes("DEVICE_COOKIE") }).toMatchObject({ ok: true });
      expect({ f, literal: /"sc_device"/.test(read(f)) }).toMatchObject({ literal: false });
    }
  });
});
