import { handleNativeGoogleLoginCallback } from "@/lib/native-google-login-server";

export const runtime = "nodejs";

/**
 * The dedicated Google return leg. NOT currently the registered redirect_uri:
 * Google Cloud's authorized-redirect list is console config, and the one
 * swiftcard.me URI already registered there is /api/integrations/google/callback,
 * which dispatches login-purpose states into this same handler. That is what
 * lets this fix ship as pure code.
 *
 * Kept live so registering https://swiftcard.me/api/auth/google/native/callback
 * in the console is a one-constant change (NATIVE_GOOGLE_REDIRECT_PATH) with no
 * other edits — and so this flow reads as its own route, where it belongs.
 */
export const GET = handleNativeGoogleLoginCallback;
