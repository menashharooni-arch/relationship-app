import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

// ── A password must never be able to reach a URL ─────────────────────────────
//
// THE BUG THIS PINS (found 2026-09-08, reproduced 3/3):
// /login renders `<form onSubmit={handleSubmit}>` with `name="email"` and
// `name="password"` on its inputs. handleSubmit calls e.preventDefault(), so
// once React has hydrated the form never navigates. BEFORE hydration there is
// no handler attached, so a submit — a fast typist hitting Enter, a password
// manager that fills and submits, a slow phone, a chunk that failed to load —
// takes the HTML default: a GET to the current URL with every named field in
// the query string.
//
//     http://localhost:3111/login?email=victim%40example.com&password=SuperSecret123%21
//
// That is the user's real password written into browser history, the server's
// access log, and the Referer header of every request the page makes next.
// It also looked, from the outside, exactly like a broken sign-in: the page
// reloads to a blank form with no error, so the click appears to do nothing.
//
// THE FIX: `method="post"` on the form. Post-hydration nothing changes at all
// (preventDefault still runs first). Pre-hydration the browser sends the fields
// in the request BODY instead of the query string, and POST /login renders the
// same login page, so the visible outcome is what it already was — minus the
// leak. It also holds when hydration never happens.
//
// Source scan on purpose: "the credentials cannot be serialized into a URL" is
// a property of the markup, and it has to hold for a form nobody has written
// yet as much as for the two that exist today.

const root = process.cwd();
const read = (p: string) => readFileSync(p, "utf8");

function globTsx(dir = join(root, "src"), out: string[] = []): string[] {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) globTsx(p, out);
    else if (e.name.endsWith(".tsx")) out.push(p);
  }
  return out;
}

/** Source with comments stripped — this file's own explanation quotes the shape it bans. */
const code = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

/** Every `<form …>` opening tag in a file, whole, across line breaks. */
function formTags(src: string): string[] {
  return [...src.matchAll(/<form\b[^>]*>/g)].map((m) => m[0]);
}

/**
 * Does this file declare a credential field?
 *
 * Deliberately not just `type="password"`: LoginForm — the file the bug was in
 * — computes both attributes (`type={showPassword ? "text" : "password"}`,
 * `autoComplete={mode === "signup" ? "new-password" : "current-password"}`), so
 * a literal-only match walked straight past the offender. Match the name, the
 * id and the autocomplete tokens as well.
 */
const SENSITIVE = /type="password"|"(current|new)-password"|(?:name|id)="[^"]*password[^"]*"/;

describe("a credential can never be serialized into a URL", () => {
  const files = globTsx();

  it("every form that contains a password field submits with POST", () => {
    const offenders: string[] = [];
    for (const f of files) {
      const src = code(read(f));
      if (!SENSITIVE.test(src)) continue;
      for (const tag of formTags(src)) {
        if (!/\bmethod=/.test(tag)) {
          offenders.push(`${f.replace(root + "/", "")} — ${tag.replace(/\s+/g, " ").slice(0, 80)}`);
        }
      }
    }
    expect(
      offenders,
      "A form holding a password must carry method=\"post\". Without it, a submit that " +
        "beats React's hydration takes the HTML default (GET) and writes the password " +
        "into the query string — history, access logs, and the Referer header.",
    ).toEqual([]);
  });

  it("no password form declares method=\"get\"", () => {
    const offenders: string[] = [];
    for (const f of files) {
      const src = code(read(f));
      if (!SENSITIVE.test(src)) continue;
      for (const tag of formTags(src)) {
        if (/method="get"/i.test(tag)) offenders.push(f.replace(root + "/", ""));
      }
    }
    expect(offenders).toEqual([]);
  });

  it("the sign-in handler still cancels the native submit first", () => {
    const src = code(read(join(root, "src/components/LoginForm.tsx")));
    const body = src.slice(src.indexOf("async function handleSubmit"));
    const head = body.slice(0, body.indexOf("\n", body.indexOf("{")) + 200);
    expect(
      /e\.preventDefault\(\)/.test(head),
      "handleSubmit must call e.preventDefault() before anything else — method=\"post\" " +
        "is the pre-hydration backstop, not a replacement for cancelling the submit.",
    ).toBe(true);
  });

  it("the sign-in fields keep the names password managers bind to", () => {
    // The names are why the leak was possible, and removing them is the wrong
    // fix: they were added deliberately so managers can fill the form at all.
    const src = read(join(root, "src/components/LoginForm.tsx"));
    expect(/name="email"/.test(src)).toBe(true);
    expect(/name="password"/.test(src)).toBe(true);
  });
});
