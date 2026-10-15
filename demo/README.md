# /demo — MPC 1993–95 Batch Map

Map + directory of classmates (adapted from SacramentoIndians.org). Live at https://www.svjc-mpc-93-95.in/demo/

## Files
- `index.html` — page layout (no inline scripts; a Content-Security-Policy `<meta>` tag blocks injected code, since GitHub Pages can't send security headers).
- `app.js` — all logic. Meet date/venue, map limits (Telangana), professions and areas live in the `CONFIG` block at the top.
- `classmates.json` — the data. **Currently sample entries only** (`"sample": true`).
- `styles.css` — pre-built Tailwind classes. `tailwind.config.js` + `src/tailwind.css` rebuild it:
  `npx tailwindcss@3 -c tailwind.config.js -i src/tailwind.css -o styles.css --minify`
- `vendor/leaflet-1.9.4/`, `fonts/` — self-hosted map library and Roboto (no third-party scripts).

## Adding a classmate
Copy an entry in `classmates.json`:
```json
{ "id": "k01", "name": "Full Name", "profession": "Engineering & IT", "work": "What they do",
  "city": "Karimnagar", "area": "Karimnagar – Huzurabad", "lat": 18.4386, "lng": 79.1288, "location": "city" }
```
- `profession` must match a name in `CONFIG.professions`; `area` one of `CONFIG.areas`.
- Use the **city centre** coordinates only — never a home address. People in the same city are spread out automatically.
- Living outside Telangana: `"location": "outside"`, `"area": "Outside Telangana"`, no `lat`/`lng`.
- Optional `"link": "https://..."` (LinkedIn etc.) shows a Profile button.
- Only add people who have agreed to be listed.
