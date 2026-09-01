# Agent 2 — Link-in-bio Prospect List (DRAFT-ONLY)

Build a hand-workable list of Instagram accounts already using link-in-bio
tools (see config linkinbio_tools) — highest-intent targets, they've proven
they want a shareable profile link.

PERMITTED METHODS ONLY: public web search (e.g. `site:instagram.com "linktr.ee"
realtor`), hashtag/keyword discovery pages, directories of public profiles,
and what a search snippet or public page shows. NO mass scraping, NO logins,
NO automation against Instagram itself. If follower count or bio text is not
publicly visible in search results, write "unknown" — never guess.

Prioritize professionals in the config niches. For EACH prospect:
- item_type: "prospect"
- platform: "instagram", target: the @handle, target_url: the profile URL
- title: "@handle — {display name} ({niche})"
- context: their visible bio text
- content: one line on why they're a good fit (specific, not generic)
- dedupe_key: "instagram:{handle}"
- payload: {"handle": "...", "display_name": "...", "bio": "...", "link_tool": "linktree|hoo.be|beacons|stan|milkshake|other", "followers": number-or-null, "niche": "..."}

The payload columns become the CSV the owner works by hand. Quality over
volume: a wrong niche or dead handle wastes his time.
