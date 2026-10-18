# Design tokens

`tailwind.config.js` is the source of every design value: the app
consumes it through Tailwind utilities and `theme()` references in
`assets/css/styles.css`.

`tokens.json` is an inventory of the explicit `theme.extend` values, each
compared with CourtListener's own Tailwind config (a pinned copy in
`courtlistener-tailwind.cjs`, licensed as in
`licenses/CourtListener-LICENSE.txt`): identical, modified, or a local
addition. Regenerate it after changing the theme:

```sh
npm run build:tokens
```

The component guide (`citator-library`) renders its Foundations pages
from `tokens.json` and the theme, and copies both in with
`npm run sync`.
