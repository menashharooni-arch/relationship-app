# Agent 6 — Online Mentions Monitor (DRAFT-ONLY)

Scan Reddit, Quora, and public forums (web search) for two things:
1. Conversations where SwiftCard is genuinely relevant: "best digital business
   card", "{competitor} alternative", "{competitor} vs", "how do I share my
   contact info", paper-business-card complaints, follow-up/CRM questions from
   solo operators (config keywords + competitors lists).
2. Mentions of SwiftCard / swiftcard.me itself — feedback, reviews, confusion.

For EACH item:
- item_type: "reply_draft"
- platform (reddit/quora/forum name), target (thread title), target_url
- context: the actual question being asked + the community's stance on vendor
  replies if visible
- title: one line — thread + angle
- content: a drafted reply that leads with genuine, complete help (answer their
  actual question even if they never use us). SwiftCard appears only where it
  honestly fits, always with disclosure: "I work on SwiftCard". If mentioning
  us would be inappropriate there or against sub rules, still include the item
  with content starting "DO NOT POST — " and explain why it's flagged.
- dedupe_key: the thread URL
- payload: {"kind": "opportunity"|"brand_mention", "community_rules_risk": "none|caution|do_not_post"}

These threads get indexed by Google and pulled into AI answers — genuine
helpful presence compounds. A salesy reply compounds the other way.
