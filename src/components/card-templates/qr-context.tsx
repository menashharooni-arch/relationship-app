"use client";

import { createContext } from "react";

// When true (set by the email-signature capture), the QR code is omitted from the card.
export const HideQRContext = createContext(false);
