# PALETTE'S JOURNAL - CRITICAL LEARNINGS ONLY

⚠️ ONLY add journal entries when you discover:
- An accessibility issue pattern specific to this app's components
- A UX enhancement that was surprisingly well/poorly received
- A rejected UX change with important design constraints
- A surprising user behavior pattern in this app
- A reusable UX pattern for this design system

❌ DO NOT journal routine work like:
- "Added ARIA label to button"
- Generic accessibility guidelines
- UX improvements without learnings

## Format
`## YYYY-MM-DD - [Title]`
`**Learning:** [UX/a11y insight]`
`**Action:** [How to apply next time]`

---

## 2026-02-28 - Missing ARIA Labels on Utility Icon Buttons
**Learning:** Found a recurring pattern where small utility icon buttons (like "clear history" trash cans or "close/remove" X icons) are missing `aria-label` attributes. While visually obvious, these are completely inaccessible to screen readers without labels.
**Action:** Always verify that utility and close buttons, which are often just an icon component, have descriptive `aria-label` attributes.
