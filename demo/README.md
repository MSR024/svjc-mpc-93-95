# /demo — MPC 1993–95 Friends Directory

Map + directory of friends (adapted from SacramentoIndians.org). Live at https://www.svjc-mpc-93-95.in/demo/

## Files
- `index.html` — page layout (no inline scripts; a Content-Security-Policy `<meta>` tag blocks injected code, since GitHub Pages can't send security headers).
- `app.js` — all logic. Meet date/venue, map limits (Telangana), professions and areas live in the `CONFIG` block at the top.
- `classmates.json` — the data: Friends Directory v1.0 (12 friends, Oct 14, 2026). `no` keeps the master list's serial numbers; `name`, `work` (profession) and `city` (area) are copied exactly from the master list; `profession` is only the filter group; `area` is the town used for the town filter and pin.
- `styles.css` — pre-built Tailwind classes. `tailwind.config.js` + `src/tailwind.css` rebuild it:
  `npx tailwindcss@3 -c tailwind.config.js -i src/tailwind.css -o styles.css --minify`
- `vendor/leaflet-1.9.4/`, `fonts/` — self-hosted map library and Roboto (no third-party scripts).

## Adding a classmate
Copy an entry in `classmates.json`:
```json
{ "no": 13, "id": "f13", "name": "Full Name", "work": "Profession exactly as given", "city": "Area, Town as given",
  "profession": "Engineering & IT", "area": "Karimnagar", "lat": 18.4386, "lng": 79.1288, "location": "city" }
```
- `profession` must match a name in `CONFIG.professions`; `area` is the town name (the town filter is built from it).
- Use the **town centre** coordinates only — never a home address. People in the same city are spread out automatically.
- Living outside Telangana: `"location": "outside"`, `"area": "Outside Telangana"`, no `lat`/`lng`.
- Optional `"link": "https://..."` (LinkedIn etc.) shows a Profile button.
- Only add people who have agreed to be listed.

## Publishing changes
`index.html` loads `styles.css?v=…` and `app.js?v=…`. After changing either file, bump the `v=` number (e.g. to the current date-time) so phones fetch the new copy instead of a cached one. `classmates.json` is always fetched fresh.
