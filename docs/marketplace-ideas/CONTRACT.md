# Marketplace "Product ideas": the contract

Items to SELL only (physical or digital, B2C or B2B). Not the App Factory.
Code: `marketplace/ideas.js`. Tests: `tests/contract/marketplace-ideas.contract.spec.js`. Lists: `tests/contract/expected-ideas.json`.

## 1. How an idea becomes a card

What the hub does today: it only ANSWERS existing cards (writes cells G:J of a row). It never adds a row; the engine owns the tab.

**Route (smallest safe): one request file, like the Factory hub's New idea.**

1. Add idea form checks its fields, then writes ONE file `MKT-IDEA-REQ-<id>.json` into a Drive folder (`marketplace.ideasRequestsFolderId` in `config.js`, empty until Lisa sets it).
2. The engine (about every 10 minutes) reads new request files and appends ONE row, then marks the file done. Same key twice = no second row.
3. The card appears under New stock > Ideas.

| Row cell | Value |
|---|---|
| key | `IDEA|<id>` (id like `IDEA-20261102-1530-ab12`) |
| section | `idea` |
| category | `Ideas` |
| title | the name |
| detail | JSON below |

**Engine side (NOT built here: `marketplace-engine` was not reachable from this session).** Two small additions, each its own tested PR in that repo:
- A. Turn `MKT-IDEA-REQ-*.json` into a card row (`cardRow()` in `ideas.js` is the reference). Skip `dry_run: true` files.
- B. When an `idea` card is answered `Go` and its detail passes `goReady()`, make a `newprod` card `NEWPROD|<id>` copying `supplier`, `unit_ex_p`, `unit_inc_p`, `profit_p`, `sell`, `moq`, `lines`, `terms`.

Why not let the hub append the row itself: it can, with the Sheets scope it already has, but it would race the engine's own writes to the same tab. Fallback only if A cannot be built.

Consequence to know: until A exists, a sent request just sits in the folder. The page shows "Sent, waiting for the engine" from this browser's own record, and flags it after 30 minutes.

## 2. Request file (`kind: "mkt-idea"`, v1)

`kind, v, id, at, by, dry_run, name` plus intake, all text: `link, barcode, price_seen, where_seen, image_link, own_audience_fit, note` (empty string when not given). Only `name` is required. Rules (`validateIntake`): name up to 120 letters; barcode 8/12/13/14 digits with a correct check digit; links `https://` only; price a positive amount, saved as `£4.50`; other text up to 500 letters.

## 3. Card detail JSON (v1)

| Field | Type | Notes |
|---|---|---|
| kind | "idea" | required |
| v | number | required, 1 |
| status | new / screening / researching / testing / launched / dropped | required |
| gate | 0..3 | required |
| verdict | "" / go / maybe / no | required |
| intake | object | required: link, barcode, price_seen, where_seen, image_link, own_audience_fit, note |
| classification | object | product_type physical/digital; buyer b2c/b2b; branding white_label/own_brand/supplier_brand/resell; fulfilment hold_stock/dropship/made_to_order/digital; source maker/wholesaler/distributor/licence |
| margin_est | object | worst, expected, best: pence per unit, or null |
| top3_risks, top3_unknowns | list of words | at most 3 each |
| kill_rule, next_step, dropped_reason | words | dropped needs a reason; verdict no means dropped |
| evidence | list | `{claim, status: verified/assumed, source}`; verified needs a source |
| unit_ex_p, unit_inc_p, profit_p | number, pence | same names as New stock |
| sell, supplier | words | same names as New stock |
| moq | number | same name as New stock |
| lines | list of words | same as New stock money lines |
| terms | object | min_order, free_over, delivery, case rule (as supplier cards) |

Go to New stock needs: verdict go, `unit_inc_p`, `profit_p`, `supplier` (`goReady()`).

## 4. Answers Lisa gives on an idea card

`Investigate`, `Go`, `Maybe`, `No` (note = why). Same cells as every card (G:J). Engine support for these on section `idea` is open question 2 in the slip.

## 5. Tests

Names and types come from `expected-ideas.json` (kept apart from `expected-state.json` so `make-expected.js` cannot overwrite it); values come from `checkDetail()`. Fixtures are invented (every id has SAMPLE). `CONTRACT_PROVE_RED=1` flips every failure case.
