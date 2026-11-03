# Worked example: a full Gate 0 card

Every name, price and supplier here is INVENTED (SAMPLE). It shows what the investigator writes back for one idea after Gate 0. A test checks the JSON below against the contract.

**Lisa gave:** the name "SAMPLE bamboo pet brush", a price she saw (£4.50), where (a SAMPLE shop), a note "customers ask for eco brushes".

## The result file the investigator writes

```json
{
  "kind": "mkt-idea-result",
  "v": 1,
  "id": "IDEA-20261102-1530-sam1",
  "at": "2026-11-03T08:00:00.000Z",
  "by": "SAMPLE-INVESTIGATOR",
  "patch": {
    "status": "screening",
    "gate": 0,
    "verdict": "maybe",
    "classification_assumed": true,
    "classification": { "product_type": "physical", "buyer": "b2c", "branding": "white_label", "fulfilment": "hold_stock", "source": "wholesaler" },
    "margin_est": { "worst": 40, "expected": 120, "best": 210 },
    "top3_risks": [
      "SAMPLE: as white label I am the responsible party for safety and labelling",
      "SAMPLE: crowded marketplace, many near-identical brushes",
      "SAMPLE: returns on a low-price item can erase the margin"
    ],
    "top3_unknowns": [
      "SAMPLE: the trade price is not public",
      "SAMPLE: the minimum order",
      "SAMPLE: whether the bristles pass a pet-safety check"
    ],
    "kill_rule": "Stop if no trade price under £2.80 by 30 Nov",
    "next_step": "Ask one SAMPLE wholesaler for a trade price list and a minimum order",
    "unit_ex_p": 250,
    "unit_inc_p": 300,
    "profit_p": 120,
    "sell": "£7.99",
    "moq": 24,
    "lines": [
      "▶ SAMPLE: at an assumed £2.50 ex VAT, about £1.20 profit each",
      "⚠ SAMPLE: at an assumed £3.50 ex VAT, about £0.40 profit each"
    ],
    "evidence": [
      { "claim": "SAMPLE shop sells it at £4.50", "status": "verified", "source": "SAMPLE shop product page, seen 2 Nov 2026" },
      { "claim": "Sells for £7.99 on a marketplace", "status": "assumed", "source": "" },
      { "claim": "Trade price is about £2.50 ex VAT", "status": "assumed", "source": "" }
    ]
  }
}
```

## What Lisa sees on the card page

1. **Verdict:** Maybe. Gate 0, screening.
2. **Why (two lines):** It looks sellable to your puppy and grooming buyers as an add-on. The profit only works if the trade price is under about £2.80, and nobody has said what it is.
3. **Margin per unit:** worst £0.40, expected £1.20, best £2.10, at two assumed buy prices (£2.50 and £3.50), because the trade price is not public.
4. **Biggest risks and unknowns:** the three of each above.
5. **Stop rule:** stop if no trade price under £2.80 by 30 Nov.
6. **Single next step:** ask one wholesaler for a trade price list and a minimum order.
7. **Not checked:** the product itself (not seen in person), UK safety rules for bristles, and the real marketplace price. All marked assumed.

The card is not ready for New stock yet: `goReady` needs a Go verdict and a `supplier`.
