---
type: "explain"
date: "2026-09-11T10:27:19.088873+00:00"
question: "Is V3 (neighborhood conquest) meant to replace the region-level war/dominance system, or run alongside it permanently?"
contributor: "graphify"
outcome: "useful"
source_nodes: ["V3 Neighborhood-Level Conquest MVP", "Region Dominance / Conquest System", "index.js"]
---

# Q: Is V3 (neighborhood conquest) meant to replace the region-level war/dominance system, or run alongside it permanently?

## Answer

Runs alongside it permanently, not a replacement. src/index.js mounts /regions, /wars, and /neighborhoods concurrently (line 31 comment: 'V3(동단위 정복) — 기존 V2 라우트와 완전히 별개' = 'V3 is completely separate from the existing V2 routes'). Commit 85712ad's message states V3 is 'a new game layer on top of the existing 19 city regions'. The graph's own edges (V3 --conceptually_related_to--> README S6 Rank/Dominance, marked AMBIGUOUS) don't reach the region-conquest node in agora.html at all — no path exists between them in the graph — so this had to be resolved from source, not from the graph traversal alone.

## Outcome

- Signal: useful

## Source Nodes

- V3 Neighborhood-Level Conquest MVP
- Region Dominance / Conquest System
- index.js