# DRAFT — Resolution Center reply for the 5.1.1(i)/5.1.2(i) portion

Status: NOT SENT. Menash reviews and sends (or approves sending) himself.
Covers only the privacy guideline; 3.1.1 needs its own answer once the
IAP decision is made. Send both together with the resubmission.

---

Hello,

Thank you for the detailed review. Regarding Guidelines 5.1.1(i) and 5.1.2(i):

The app shares data with a third-party AI service (Google, via the Gemini API)
only for four user-initiated features: scanning a photographed business card,
drafting a follow-up message to a contact, rebuilding a card design from an
uploaded photo, and answering messages typed to the in-app assistant.

We have revised the app so that, before any of this data is shared:

1. A consent sheet appears on the first signed-in screen of the app. It lists
   exactly what is sent for each feature (the card photo; the contact's name,
   company, meeting context and notes; the typed message) and names Google as
   the recipient. It offers "Allow" and "Don't allow" as equal choices.
2. Permission is enforced server-side: until the user taps Allow, every
   request from the app to an AI feature is refused before any data leaves our
   systems. Declining disables AI features while the rest of the app works
   fully, and the choice can be changed later in Settings.
3. Our privacy policy (swiftcard.me/privacy) identifies Google (the Gemini
   API) by name, lists each category of data sent and the purpose, states that
   we send it nowhere else, and confirms Google is bound by its API terms to
   protect it.

The demo account (applereview@swiftcard.me) has no stored consent decision, so
the consent sheet will appear immediately after signing in, before any AI
feature can be used.

Best regards,
The SwiftCard team
