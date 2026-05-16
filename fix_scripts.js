const fs = require('fs');
const files = fs.readdirSync('.').filter(f => f.endsWith('.html'));
files.forEach(f => {
  let text = fs.readFileSync(f, 'utf8');
  // Removes all variations of i18n.js, web_config.js, and literal string errors
  text = text.replace(/(<script src="i18n\.js"><\/script>|<script src="web_config\.js"><\/script>|`r`n|`n|\n|\r|\s)+<script type="module">/g, '\n  <script src="i18n.js"></script>\n  <script src="web_config.js"></script>\n  <script type="module">');
  // specifically for index.html which doesn't have type="module" on the first script block, actually wait index.html does have type="module" now because I changed it? Oh no, I didn't change index.html to have type="module", wait, index.html does have <script type="module">.
  fs.writeFileSync(f, text);
});
console.log('Fixed HTML script tags');
