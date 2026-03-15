# GTM Briefing — MapViewer-GL — 2026-03-14

## GTM Status

Pre-launch. The product is at v2.1.0, polished, with a live demo, clean README, and strong screenshots. No external marketing has been done. Zero users outside the author. No analytics by design (privacy-first). The GitHub repo exists but has not been promoted. This briefing documents the first GTM effort.

---

## Market Position

MapViewer-GL occupies a gap that no single competitor covers cleanly: a browser-native, SQL-capable geospatial viewer that works entirely client-side and handles real analyst formats (Parquet, Shapefile) with zero installation or account.

| Competitor | SQL? | Client-side? | Parquet? | Zero setup? |
|---|---|---|---|---|
| geojson.io | No | Yes | No | Yes |
| kepler.gl | No | Yes | Limited | No (Mapbox key) |
| Felt | No | No (cloud) | No | No (account) |
| QGIS | Yes | Yes (desktop) | Yes | No (install) |
| MapViewer-GL | Yes | Yes | Yes | Yes |

The strongest single differentiator is the combination of DuckDB-WASM SQL + 100% client-side + Parquet support. That combination does not exist in any free tool today.

For privacy-conscious users (government analysts, healthcare GIS, enterprise teams with data governance rules), the client-side guarantee is the entire story.

### Positioning Statement

For GIS analysts and data scientists who need to explore geospatial data quickly, MapViewer-GL is a browser-based viewer that runs entirely on your machine with real SQL support. Unlike kepler.gl or Felt, it requires no API key, no account, and sends zero data to any server.

---

## Launch Readiness

The product is ready to launch. What is missing before a full push:

- A 60-second screen recording showing the SQL spatial join workflow (most convincing demo asset)
- A dedicated landing page (GitHub README works but is not conversion-optimized)
- A Hacker News Show HN draft
- A LinkedIn post draft

The product does not need more features. Launch the message now.

---

## Recommended Launch Strategy

### Week 1 — Warm channels
- LinkedIn post targeting GIS/geospatial professionals — lead with privacy angle or Parquet support
- Reddit: r/gis, r/dataisbeautiful, r/geospatial — post with SQL spatial join screenshot

### Week 2 — Cold technical channels
- Show HN on Hacker News — Monday or Tuesday 9-11am PT
- Submit PR to awesome-geospatial and awesome-deckgl GitHub lists

### Ongoing (zero time cost)
- Reference the tool in relevant GIS Stack Exchange answers
- Add "Built with MapViewer-GL" to any map shared publicly

---

## Content and Messaging

### Primary tagline (technical audience)
Run SQL on your geodata. Visualize it on a map. Nothing ever leaves your browser.

### Secondary tagline (analyst/privacy audience)
The geospatial viewer for people who can't send their data to the cloud.

### One-liner for Hacker News
MapViewer-GL — browser-native geospatial viewer with DuckDB SQL, Parquet support, and zero server (Show HN)

### Core message hierarchy
1. Your data never leaves your browser (trust, privacy, works offline)
2. Real SQL via DuckDB-WASM — spatial joins, aggregations, filters across layers
3. Drag and drop GeoJSON, CSV, Shapefile, or Parquet — no install, no API key
4. Open source, MIT license

### What NOT to lead with
The tech stack (React, deck.gl). Lead with the problem, not the implementation.

### Content angles
- Before/after: "Used to open QGIS for a 2-minute data check. Now I just open a browser tab."
- Privacy use case: "Our team works with sensitive location data. We can't upload it anywhere. MapViewer-GL runs entirely in the browser — zero data leaves the machine."
- SQL demo: post the spatial join screenshot with a caption about what took 45 seconds in DuckDB vs. 15 minutes in traditional desktop GIS

---

## Growth Channels

Ranked by reach-to-effort ratio for a solo founder:

1. **LinkedIn** (GIS/geospatial network) — warm audience, existing network, 30-minute effort
2. **Hacker News Show HN** — developer/data-engineer audience, 1-2 hour effort, high upside
3. **Reddit** (r/gis 115K+ members, r/dataisbeautiful, r/geospatial) — 20-minute effort
4. **GitHub Awesome Lists** (awesome-geospatial, awesome-deckgl) — one-time 15-minute PR, permanent SEO asset
5. **GIS Stack Exchange** — profile link + relevant answers, long-tail organic discovery
6. **Twitter/X** #gischat #opendata — lower reach but worth a single post with the SQL screenshot

---

## Immediate GTM Actions — This Week

| Priority | Effort | Action | Expected Impact |
|---|---|---|---|
| P1 | 30 min | Write and post LinkedIn launch post with hero screenshot — lead with privacy or SQL angle, link to live demo | First 50 users from warm network |
| P1 | 60 min | Record 60-second screen recording of SQL spatial join workflow — no narration, text captions only | Reusable asset for every future launch post; embed in README |
| P2 | 90 min | Post Show HN on Hacker News — Monday/Tuesday 9-11am PT, plan 2 hours to respond to comments | 50-200 GitHub stars, developer word-of-mouth |
| P3 | 15 min | Submit PR to awesome-geospatial and awesome-deckgl | Permanent SEO and discovery asset |
| P3 | 15 min | Update README top section — replace current opener with primary tagline, add bolded "Try it now" CTA link above the fold | Converts GitHub page visitors from HN/awesome-lists |

---

## Decision Points for Founder

1. **Do you want a custom landing page before the HN post?** A custom landing page (even a single-page site on Vercel) would convert HN visitors better than the GitHub README. Trade-off: 2-4 hours of build time vs. launching 2 weeks earlier with the README. The README is good enough to validate interest before investing in a landing page.

2. **Video or no video for the LinkedIn post?** A static screenshot post is ready to write today. A native video post with the screen recording will get 3-5x more organic reach on LinkedIn. If you can record the 60-second demo first, hold the LinkedIn post by 2 days. If time is tight, post with the static hero screenshot now and follow up with the video as a second post.

---

## Signals and Feedback

No external user feedback yet (no public launch). The product quality signals are strong: v2.1.0 addressed 35+ fixes, the SQL spatial join demo is genuinely impressive, and the welcome screen and screenshot assets present well. The privacy angle is currently undersold relative to its actual value to the target audience.

---

## Prior Context

This is the first GTM briefing for MapViewer-GL. No prior launch posts, testimonials, or user feedback on record. Founder has a strong LinkedIn network in clean energy, EV, and geospatial data. Has a PhD from UW (technical credibility). Time constraint is the primary GTM limitation.

Next session: check whether LinkedIn post was published, note engagement numbers, and draft the Hacker News Show HN post.
