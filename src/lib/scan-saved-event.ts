// The handoff between the QR-scan landing (ScanSaveContact, on the card page)
// and the share-back sheet (inside SaveContactButton).
//
// A phone scan finishes in the OPERATING SYSTEM's "Add to Contacts" sheet — a
// surface no React code can see. ScanSaveContact watches for the visitor coming
// back and announces it; SaveContactButton listens and raises the same
// "Let <name> have yours too" sheet the button flow raises, so both journeys end
// identically. Shared constant rather than a string literal in two files: a typo
// on either side would silently mean the sheet just never appears.
export const SCAN_SAVED_EVENT = "swiftcard:scan-contact-saved";
