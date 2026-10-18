# Adopting this work upstream

I would offer this fork as a few focused upstream changes rather than one large UI patch. It retains the Free Law Project history; the comparison starts at `f57aac28fcec0c0773452afe2f0f060a50fb219d`. The two existing fork commits bundle many features and comment-only changes, so individual features need a scoped patch rather than an isolated cherry-pick of those commits.

## Suggested units

| Unit | Files and dependencies to keep together |
|---|---|
| Search pagination | `_includes/macros/pagination.njk`, its `icons.njk` import, pagination state in `assets/js/alpine/components/search_filter.js`, the call and result attributes in `src/index.njk`, pagination rules in `assets/css/styles.css`, and `tools/pagination.test.cjs`. A whole-page copy also keeps its `search_suggest.js` and `expandable.js` scripts. |
| Citation matrix and history views | `tools/chart-data.cjs`, `tools/filters.cjs`, `_data/court_abbr.js`, their registration in `.eleventy.js`, `macros/citing_chart.njk` with its icon/treatment imports, `partials/cited-by-tab.njk`, `partials/history-tab.njk`, `partials/history-timeline.njk`, `opinion_views.js`, `treatment_list.js`, `components/opinion-views.css`, and the breakdown inputs in `partials/opinion-page.njk`. Keep range/count filtering and `tools/chart-data.test.cjs` with the chart. |
| Reader, Find and citation popups | Start with `src/opinion.njk` and `partials/opinion-page.njk`, retaining that partial's imported macros and included tab partials. Keep its five page scripts: `opinion_tabs.js`, `treatment_list.js`, `opinion_views.js`, `doc_rail.js` and `case_actions.js`. Keep the matching reader/popup styles and the Find, occurrence and motion tests. |
| Sidebar and article navigation | The shell markup in `layouts/base.njk`, `macros/sidebar.njk`, `app_shell.js`, `shell_state.js` and `sidebar_tree.js` form the panel/sidebar contract. The About section control uses `article-navigation.js`, `components/article-navigation.css` and the article markup in `src/about.njk`. |

Template paths above are under `_includes/` unless stated otherwise; component scripts are under `assets/js/alpine/components/`, other scripts under `assets/js/`, and component CSS under `assets/css/`.

## Shared contract

I keep these dependencies explicit when moving a feature:

- Eleventy 3, Nunjucks, Tailwind 3 and `@alpinejs/csp` 3.15.9 remain the runtime/build stack. Retain the deferred script order in `layouts/base.njk`: composables, controllers and page scripts register before Alpine starts. Bindings reference component members.
- `tailwind.config.js` supplies the theme. `assets/css/styles.css` imports `fonts.css` and the opinion-view, citation-action and article-navigation component styles. Copying markup alone does not include these styles or the font files/notices.
- `.eleventy.js` registers `tools/filters.cjs`, which imports both `tools/chart-data.cjs` and `_data/court_abbr.js`. The shared layout uses `listCounts`; templates also use `citeTail`, `worstSignal`, `usdate` and `chartBreakdown`.
- `_data/site.js` supplies the app home and feedback URL. Opinion templates consume the generated `allOpinions`, opinion, court, treatment-definition and scope data; retain their current field names and the data contract in [data.md](data.md).
- The [separate style guide](https://github.com/foldedastroid/citator-preview-style-guide) is a reference and live specimen site. It is not an app build dependency. Its sync script lists the shared files; its `/search/` home override belongs only to the guide.

## Decisions to separate from the UI

I would ask upstream to decide the treatment policy explicitly. `scripts/taxonomy.py` adds Positive, moves **Affirmed by** from Neutral to Positive and classifies **Followed by** as Positive. This affects generated signals, filters, labels and summaries. The five-tier assumptions also appear in `tools/chart-data.cjs`, templates, controllers and styles; retaining upstream's four tiers requires adapting that contract consistently. A visual improvement does not by itself justify this policy change.

`scripts/build_data.py::validate_edge` now retains an edge when either filing date is missing, while still rejecting known backwards/same-date non-self citations. I would submit that behavior and its test separately for upstream approval. The pseudo-markdown footnote support and changed text in `scripts/mock_data.py` are fixture/rendering work, not newly collected legal records.

## Checks before adoption

```sh
npm ci
uv sync --group dev
CITATOR_DEMO_DATA=mock npm run build
npm test
npm run test:js
npm run lint
```

I would then build the proposed scope with upstream's real data and review desktop/phone behavior, keyboard focus, reduced motion, counts and passage destinations. Local fixture tests do not establish legal accuracy or complete treatment coverage, and hosted CI success should be checked separately. Keep the original LICENSE, source attribution and font notices with adopted files.
