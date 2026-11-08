# The Board: staff page

Phone page for staff. No Google sign-in. Published at `cdhub/staff/`. Holds no data, codes or the save address.

`lib/` holds copies of `cdhub-write/client/{bld-save,occupancy}.js` and `cdhub-write/screens/*`, because only `cdhub/` is published. Copy again after changing those.

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
