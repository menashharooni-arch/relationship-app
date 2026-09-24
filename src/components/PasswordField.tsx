"use client";

import { useState, type ReactNode, type Ref, type KeyboardEvent } from "react";
import type { PasswordAssessment } from "@/lib/password-policy";

// The one password input. Create-account, sign-in and reset all render this,
// so a label, a show/hide toggle, a caps-lock warning and the strength meter
// exist once and look the same everywhere.
//
// Rules it keeps:
//   • It renders nothing that reads `window` or `document`: LoginForm is
//     rendered with renderToStaticMarkup in tests, and the login page is
//     server-rendered first. Caps lock is learned from key events only.
//   • The eye toggle appears only once there is a value — never a dead control.
//   • No <form> here. The forms that own it carry method="post"
//     (tests/credentials-never-in-url.test.ts); this file has a `name` prop
//     precisely so the pre-hydration FormData read in those forms can see it.

type Props = {
  id: string;
  name: string;
  label: string;
  autoComplete: "new-password" | "current-password";
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  minLength?: number;
  disabled?: boolean;
  /** Field-level error, rendered under the box with role="alert". */
  error?: string | null;
  /** Static helper text under the box. */
  hint?: string;
  /** Live assessment; the meter shows only while there is a value. */
  strength?: PasswordAssessment | null;
  /** Rendered at the right of the label row (LoginForm puts "Forgot password?" here). */
  labelRight?: ReactNode;
  inputRef?: Ref<HTMLInputElement>;
};

const SEGMENT_COLOR: Record<number, string> = {
  0: "bg-red-500",
  1: "bg-red-500",
  2: "bg-amber-500",
  3: "bg-green-600",
};

const LABEL_COLOR: Record<number, string> = {
  0: "text-red-700",
  1: "text-red-700",
  2: "text-amber-700",
  3: "text-green-700",
};

export default function PasswordField({
  id,
  name,
  label,
  autoComplete,
  value,
  onChange,
  placeholder,
  required,
  minLength,
  disabled,
  error,
  hint,
  strength,
  labelRight,
  inputRef,
}: Props) {
  const [show, setShow] = useState(false);
  const [capsLock, setCapsLock] = useState(false);

  function onKey(e: KeyboardEvent<HTMLInputElement>) {
    // getModifierState is missing on some synthetic events; treat that as "off".
    const on = typeof e.getModifierState === "function" ? e.getModifierState("CapsLock") : false;
    if (on !== capsLock) setCapsLock(on);
  }

  const showMeter = !!strength && value.length > 0;
  const describedBy = [
    hint ? `${id}-hint` : null,
    showMeter ? `${id}-strength` : null,
    capsLock ? `${id}-caps` : null,
    error ? `${id}-error` : null,
  ].filter(Boolean).join(" ") || undefined;

  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="block text-xs font-semibold text-slate-600">
          {label}
        </label>
        {labelRight}
      </div>
      <div className="relative">
        <input
          id={id}
          name={name}
          type={show ? "text" : "password"}
          autoComplete={autoComplete}
          placeholder={placeholder}
          required={required}
          minLength={minLength}
          disabled={disabled}
          ref={inputRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKey}
          onKeyUp={onKey}
          onBlur={() => { if (capsLock) setCapsLock(false); }}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className="sc-input w-full bg-white border border-[#E4DDD4] text-slate-900 placeholder-slate-400 rounded-xl pl-4 pr-12 py-3 text-sm disabled:opacity-60"
        />
        {value.length > 0 && (
          <button
            type="button"
            onClick={() => setShow((v) => !v)}
            aria-label={show ? "Hide password" : "Show password"}
            aria-pressed={show}
            className="absolute inset-y-0 right-0 px-3.5 flex items-center text-slate-500 hover:text-slate-800 transition-colors"
          >
            {show ? (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} style={{ width: 18, height: 18 }} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} style={{ width: 18, height: 18 }} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.964-7.178z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            )}
          </button>
        )}
      </div>

      {hint && !error && (
        <p id={`${id}-hint`} className="text-xs text-slate-500">{hint}</p>
      )}

      {showMeter && strength && (
        <div className="space-y-1">
          <div className="flex gap-1" aria-hidden="true">
            {[1, 2, 3].map((n) => (
              <span
                key={n}
                data-segment={n}
                className={`h-1 flex-1 rounded-full ${n <= Math.max(strength.score, 1) ? SEGMENT_COLOR[strength.score] : "bg-[#E4DDD4]"}`}
              />
            ))}
          </div>
          {/* When the policy refuses it, the reason takes the label's place so
              typing never produces two red lines under one box. */}
          <p id={`${id}-strength`} aria-live="polite" className={`text-xs ${LABEL_COLOR[strength.score]}`}>
            {strength.ok ? `Password strength: ${strength.label}` : strength.reason}
          </p>
        </div>
      )}

      {capsLock && (
        <p id={`${id}-caps`} className="text-xs text-amber-700">Caps Lock is on.</p>
      )}

      {error && (
        <p id={`${id}-error`} role="alert" className="text-xs text-red-700">{error}</p>
      )}
    </div>
  );
}
