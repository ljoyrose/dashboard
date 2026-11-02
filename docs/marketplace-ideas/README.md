# Marketplace Product ideas: how it fits together

Items to SELL only. Not the App Factory. This route does not touch the Factory hub, AF-ENGINE or ClickUp.
Contract and field list: `CONTRACT.md`. Investigator prompt: `INVESTIGATOR-PROMPT.md`. Worked example: `EXAMPLE-GATE0.md`.

## 1. How an idea becomes a card

1. Lisa opens Marketplace > New stock > Product ideas > Add idea. Only the name is needed.
2. The hub checks the boxes, then writes ONE request file (`MKT-IDEA-REQ-<id>.json`) to the ideas folder in Drive. Nothing else is written.
3. The Marketplace engine (about every 10 minutes) turns it into one card on the Open work sheet and one item on the Infinity board "Marketplace - Product ideas". It writes the item's link into the card (`infinity_item`).
4. **The hub card is the master.** The board item mirrors it, one way. Edits made on the board are overwritten.

Not built yet: the engine side (open questions in the slip). Until it is, a sent request just waits in the folder, and the page says so after 30 minutes.

## 2. How the investigator is run on a chosen idea

1. A Claude session (outside this build) gets `INVESTIGATOR-PROMPT.md` and the idea's intake from the hub card.
2. It runs Gate 0 and stops with Go / Maybe / No. Gates 1 to 3 run only after Lisa says Go.
3. It drafts and recommends only. It buys, lists, sends and changes nothing.

## 3. What it writes back

ONE result file per run: `MKT-IDEA-RESULT-<id>.json` with a `patch`. The engine merges the patch into the card's detail JSON (`mergeResult()` in `marketplace/ideas.js` is the reference).
- Allowed: status, gate, verdict, classification, classification_assumed, margin_est, top3_risks, top3_unknowns, kill_rule, next_step, dropped_reason, evidence, gate1 to gate3, and the money and supplier fields New stock already reads (`unit_ex_p`, `unit_inc_p`, `profit_p`, `sell`, `moq`, `supplier`, `lines`, `terms`).
- Never: the intake, `infinity_item`, kind, version, or Lisa's answer cells.
- All or nothing: if the merged card would break the contract, nothing is merged.
- Every claim is marked verified (with a source) or assumed.

## 4. Proposal: how a new idea wakes the investigator (NOT built)

What I checked on 2 Nov 2026 (read only): the board exists with that name, has 0 items, and its only column is Name. The status, gate and verdict columns the mirror needs do not exist yet. I did not change the board. Not checked: whether Lisa's Infinity plan allows an "Item created" automation, and its rate limits.

| | A. Daily Claude pass | B. Infinity "Item created" calls a web address |
|---|---|---|
| How | Once a day a scheduled session lists new board items. A plain script step does this first. If there are none, it stops and uses no AI. For each new idea it reads the facts from the hub card (the master), not from board text. | Infinity calls a web address the moment the engine makes the item. That address must then start a Claude run. |
| Cost | One scheduled run a day. Zero AI when nothing is new. Gate 0 per idea is the real cost (size not measured). | Gate 0 per idea, same. Plus a public web address to build and keep. Whatever starts the Claude run needs its own key or trigger. |
| Speed | Up to a day. | Minutes. |
| Risk | Low. A missed day is caught the next day. Board text is untrusted, so the pass reads facts from the card. | Higher. A public address that starts paid runs can be hit by anyone who finds it, or fire twice. Needs a secret, a duplicate check and a daily cap. Depends on a plan feature I could not confirm. |
| Moving parts | One schedule. | Automation + web address + secret + run starter. |

**Recommendation: A, the daily pass.** Ideas arrive a few at a time, so a day's wait costs little, and A needs no public address and no new secret. If Lisa wants "now" for one idea, a manual run on a chosen idea does that without B. Revisit B only if ideas arrive many a day.

Either way, nothing here is built. Both need Lisa's OK first.
