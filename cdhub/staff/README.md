# The Board: staff page

Phone page for staff. No Google sign-in. Published at `cdhub/staff/`. Holds no data, codes or the save address.

`lib/` holds copies of `cdhub-write/client/{bld-save,occupancy}.js` and `cdhub-write/screens/*`, because only `cdhub/` is published. Copy again after changing those.

## How a phone gets in

1. Lisa opens `print/` on her own set-up device and shows **Phone set-up QR**. It carries the save address, built on her device; the address is never in this repo.
2. The person scans it and types their own staff code once. It stays on that phone. Lisa switching the code off wipes it on the next read or save.
   Or, with no typing: **Private set-up QR** on `print/`. Lisa pastes one person's code and it is drawn on her screen only, for 2 minutes (`#join=<code>&url=<save address>`, in the # part so it never reaches a server). Nothing is saved, printed or logged. The phone removes it from the address bar and history before anything else runs, and keeps the code only if the script accepts it. Printed room, dog and litter QRs never carry a code: they only open a screen, and a scan is not proof that anyone was there.

## QR codes

Each QR is `<site>/cdhub/staff/#s/XXXXXXXX`: a random id, never a name or health detail. `BLD-qr_tag` says what it means, read with the phone's code, so a phone that is not set up sees only the set-up screen. Printed cards depend on the site address; moving the site means reprinting or redirecting.

Any phone camera works: the room being filled is remembered on the phone for 30 minutes between scans.

## Adding a screen (module)

Put it in `modules/<name>/module.js` and add the path to `FILES` in `shell.js`. `modules/temperature/module.js` is already in the list, and the page copes if it is missing.

```js
StaffPage.register({
  id: 'temperature',            // unique
  title: 'Room temperatures',
  desc: 'One line under the title',
  icon: StaffPage.ctx.icons.temp, // svg string, ours only
  order: 20,                    // lower comes first on Home
  open: function (host, ctx) {  // draw into host; may return a tidy-up function
  }
});
```

`ctx`:

| | |
|---|---|
| `save` | a BLDSave with the phone's code already set: `submit`, `read`, `banner`, `checkStatus` |
| `data()` | Promise of `{ok, areas, dogs, subjects, skipped, raw}` (or `{ok:false, code, message}`); loaded once |
| `refresh()` | same, loaded again |
| `readOptional(key)` | a list that may not be on yet; never fails, gives `{ok, rows, code, message}` |
| `addTable(key, spec)` | teach `save` a table it does not know (spec shape: `TABLES` in `bld-save.js`) |
| `go(path)` | `'home'`, `'m/<id>'` |
| `h(tag, attrs, kids)` | small DOM helper |
| `today()` | London date, YYYY-MM-DD |
| `params` | route values |

A `BAD_CODE` answer wipes the phone and returns to set-up; modules need do nothing. Colours: use the tokens in `staff.css` (`--card --ink --mut --line --accent --good --warn --bad --chip`).
