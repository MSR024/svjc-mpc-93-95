// Tailwind build config. Rebuild styles.css after changing classes in index.html or app.js:
//   npx tailwindcss@3 -c tailwind.config.js -i src/tailwind.css -o styles.css --minify
// Neutral greys from SacramentoIndians.org; "brand" = batch maroon, "saffron" = festive accent.
module.exports = {
  content: ['./index.html', './app.js'],
  theme: { extend: {
    fontFamily: { sans: ['Roboto', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'] },
    colors: {
      slate: { 50:'#F8F9FA',100:'#F1F3F4',200:'#DADCE0',300:'#BDC1C6',400:'#9AA0A6',500:'#5F6368',600:'#5F6368',700:'#3C4043',800:'#3C4043',900:'#202124' },
      brand: { 50:'#FBEDEF', 600:'#8B1E2D', 700:'#6E1424' },
      saffron: { 600:'#E8871E' }
    }
  } }
};
