# HerWay — Product Plan (for review, nothing gets built yet)

This plan answers your planning brief. Nothing will be built until you approve it. If you approve, I start with Phase 1 only.

## 1. Product summary
HerWay is a map-first safety and community platform for women in Bangladesh. People can look at community reports on a map, share what happened, find support, and later talk to each other. It is clearly **not** a police database, an emergency service, a crime predictor, or a list of offenders. Every screen says plainly what the information can and cannot tell you.

## 2. Information architecture
```text
Explore (home map) ─┬─ Incident detail (bottom sheet / side panel)
                    ├─ Search, Filters, Legend & "About this data"
                    └─ Report an incident (5-step flow) → Confirmation → Status page
Community ── Rooms → Room → Post → Replies  | Guidelines
Messages ── Requests | Chats (1:1, group)  | Blocked
Support ── Emergency (999, 109 — to verify) | Services | Guidance   (no login needed)
Profile ── Display name | Privacy | Notifications | Saved places | My reports | Blocked | Delete account
Moderator dashboard (separate, role-gated) ── Queue | Report review | Flags | Audit log | Appeals
```
- Mobile: bottom tab bar (Explore, Community, Report [centre button], Messages, Profile). Support is always one tap away from a shield icon in the header.
- Desktop: left rail with the same items. The HerWay wordmark always goes back to Explore.

## 3. Key user journeys
1. **Checking an area before commuting:** open Explore → search "Mirpur 10" → filter to last 90 days → tap a cluster → read incident details → save the place privately.
2. **Reporting a firsthand incident:** Report → "It happened to me" → category and approximate date → choose a rough location on the map → review what will be public → reference ID → status page.
3. **Reporting what a friend told you:** same flow, marked "Disclosed to me" all the way through. It asks whether the friend agreed to share, never asks who she is, and shows extra privacy guidance.
4. **Moderator:** queue → open a report → check the rounded location and possible duplicates → remove personal details → approve, decline, or ask a question → the reason is logged.
5. **Urgent help:** Support is reachable without an account → tap-to-call 999 or 109 → a notice explains HerWay cannot send help.

## 4. Page-by-page UX (main points)
- **Explore:** full-screen map. Floating search, filter chips (category, period, report type, area) and a legend button. Bottom sheet with three heights on mobile; filter sidebar plus detail panel on desktop.
  - National zoom: district outlines and clusters only. Local zoom: individual pins at rounded locations, so zooming in never reveals more detail.
  - Coverage labels: "Recently assessed", "Limited information", "Insufficient data". The data period and last update are always visible.
  - Empty state: "No reports match these filters. This does not mean the area is safe."
- **Incident detail:** category, general area, broad date window, report type badge (with icon and text, not colour alone), status "Reviewed by moderators" (never "verified"), a privacy-safe summary, a flag/correct button, a support link, and the required disclaimer.
- **Report flow:** 5 steps with a progress bar, a save-and-exit draft, and optional fields that can be skipped. No GPS needed, and description length is limited.
  - Step 4 shows a side-by-side "Public vs Private" preview.
  - Confirmation shows a reference ID. The status page shows: awaiting review, needs clarification (with a private reply box), published, or not published (with an appeal option).
- **Community:** room list by topic. Before a first post, a "What public means" explainer appears. Each post has a report/mute/block menu. Text that looks like a name or phone number triggers a warning before posting.
- **Messages:** friend requests, plus a separate "message requests" inbox for people who aren't friends yet. Block, report, and mute controls. No end-to-end encryption claims.
- **Support:** verified resources only. Each one shows a "last checked" date. Nothing is made up; unverified items stay hidden until confirmed.
- **Profile/Settings:** display name only (no real name), optional location, saved places, my reports, blocked users, and account deletion with a clear explanation of what happens to your data.
- **Moderator dashboard:** a queue with filters, a review screen (original private location vs proposed public location, duplicate suggestions, a tool to remove personal details), decision with a required reason, an audit history, and an appeals queue.

## 5. Visual direction (to confirm after approval)
- Feeling: calm, confident, discreet. Like a well-made navigation app, not a campaign poster. No heavy pink and no alarm-red map effects.
- Proposed palette: deep ink-teal primary, warm off-white background, a muted terracotta accent. Category colours are soft and paired with distinct icons: Harassment (speech), Stalking (footsteps), Sexual assault (shield), Other (dot).
- Type: a confident modern sans for headings plus a highly readable body font with Bangla support later (e.g. Hind Siliguri pairing).
- Pins: rounded teardrop with the category icon. Clusters are neutral numbered circles, so no area looks "hot".
- Before building I will show you 3 rendered design directions to choose from.

## 6. MVP phases and trade-offs
- **Phase 1 (build first):** Explore map with clearly labelled sample data, incident detail, filters, the 5-step report flow (all 3 types), accounts and report status pages, moderator dashboard and workflow, privacy settings, Support page.
- **Phase 2:** community rooms, posts and replies, blocking, abuse reporting, more moderation tools.
- **Phase 3:** friend requests, 1:1 and group chat, Bangla interface, accessibility improvements.
- Why this order: messaging carries the highest abuse risk and needs mature moderation first. Community depends on blocking and reporting from Phase 1. Recommended deferrals: photo uploads, push notifications, and gender verification (no claims of "verified women").

## 7. Safety and privacy commitments
- All permissions are enforced on the server and in the database, not just hidden in the interface.
- Exact locations are stored privately. Public pins are rounded (about a 300–500 m grid, nudged at random) and times are coarsened to a date window.
- Moderators cannot read private messages. Abuse reports include only the messages that were reported.
- Rate limits on submissions, duplicate detection, warnings when text looks like personal information, an audit log for every moderator action, and real data deletion.
- Only sample data during development. A security scan and access-control tests happen before any launch.

## 8. Testing before launch
- Acceptance checks for: the map on phone and desktop, all 3 report types through publication, privacy (public pages never show exact location or reporter), moderator-only access, blocked users unable to reach you, account deletion, Support working without login.
- Accessibility pass: contrast, keyboard use, screen reader labels, large touch targets.

## Technical details
- **Stack:** TanStack Start (current project) plus Lovable Cloud for login, database, file storage, and realtime (Phase 3 chat).
- **Map:** MapLibre GL with OpenStreetMap-based tiles (e.g. MapTiler free tier, about 100k loads/month) and built-in clustering. No per-user tracking by Google. Place search via the MapTiler geocoding API. Alternative: Mapbox (better polish, cost grows with use). District outlines from an open Bangladesh admin-boundary GeoJSON file.
- **Main data tables (public / private split):**
  - `profiles` (public display name) vs. private account data.
  - `user_roles` (separate table, moderator/admin) and a `has_role()` check.
  - `incident_reports` (private: precise location, raw text, reporter_id, consent context) and a separate `published_incidents` table (public: category, report type, rounded location, date window, cleaned summary). Only moderators write to it.
  - `report_duplicates`, `moderation_actions` (append-only audit), `clarification_messages`, `flags_corrections`, `appeals`.
  - `saved_places` (owner-only), `support_resources` (public read, admin write, `last_verified_at`).
  - Phase 2: `rooms`, `posts`, `replies`, `content_reports`, `blocks`, `mutes`.
  - Phase 3: `friend_requests`, `friendships`, `conversations`, `conversation_members`, `messages` (members only).
- **Access rules:**
  - Reporters can read their own reports. Moderators can read and update the queue. Visitors can only read `published_incidents` and `support_resources`.
  - Rounding locations and publishing happen in a server function, so precise coordinates never reach the browser outside moderator tools.
