# Citator Demo

This is my [working fork](https://github.com/foldedastroid/citator-demo) of the [Free Law Project Citator demo](https://github.com/freelawproject/citator-demo). I’m refining its reading, search and citation-review interface while keeping the original Eleventy, Nunjucks, Tailwind and Alpine CSP stack.

The site is a static preview of citator output: how an opinion treats the cases it cites, how later opinions treat it, and its appellate history. Python builds the data; Eleventy renders the pages. There is no application backend. This fork is not an official Free Law Project release. Original attribution, source references and font notices are recorded in [ATTRIBUTION.md](ATTRIBUTION.md).

## Run locally

Install Node 20+, Python 3.13+ and [uv](https://docs.astral.sh/uv/), then install the dependencies:

```sh
npm ci
uv sync --group dev
```

Build with the included illustrative fixtures:

```sh
CITATOR_DEMO_DATA=mock npm run build
python3 -m http.server 8080 -d _site
```

Open [localhost:8080](http://localhost:8080/). Fixture records exercise the interface; they are not a substitute for collected citator data.

To build with compatible data in `data-source/`, run `npm run build` without the mock flag. Real data is not included in this repository. The [data contract](docs/data.md) describes the inputs, citation resolution, treatment taxonomy and generated JSON.

`npm run build` runs `build:data`, `build:css` and `build:eleventy` in that order. When only editing the interface, reuse the generated data:

```sh
npm run build:css
npm run build:eleventy
```

For live development, run `npm run dev:css` and `npm run dev:eleventy` in separate terminals after building the data. Eleventy watches templates and scripts; the CSS watcher compiles stylesheet changes.

## Preview scope

The preview covers a limited collection of opinions and their available citation records. Counts describe the loaded collection or the stated controlling/equal-court citing scope; an absent record does not establish that no treatment exists. The About page shows the counts generated for the current build.

Treatments come from the citator pipeline and retain their source and expert-comparison fields. The five signal tiers are **Stop, Warning, Caution, Positive and Neutral**. Unknown labels remain visible in lists as Other and are explicitly excluded from the signal matrix. The preview does not independently certify a classification or an opinion’s current legal status.

| Build variable | Default | Effect |
|---|---|---|
| `CITATOR_DEMO_DATA` | `real` | Set to `mock` to use `scripts/mock_data.py`. |
| `CITATOR_DEMO_VALIDATION` | off | Set to `1` to show expert-comparison marks and validation filters. |

## Interface

- **Search opinions:** name and citation search, suggestions with loading/error states, court and signal filters, URL-backed filter state, sorting and accessible pagination. When the Filters panel is closed, an inline button shows the number of active conditions.
- **Opinion:** document text, Authorities, Later Courts and History tabs. Citation and footnote popovers link to their actual destinations. Citation copying and selected-passage links use the opinion’s citation and text.
- **Reading:** a fine proportional rail appears only on the Opinion tab, with a compact marker and keyboard-accessible section links. Find expands the same search control to the right. A query reveals bounded excerpts from actual matches, with a count and previous/next navigation across every match. Selecting an excerpt exposes and focuses its highlight; focusing or editing the input restores the excerpt list.
- **Citation review:** signal summaries, evidence cards and a matrix of citing opinions by court or inclusive date range. Selecting a nonzero matrix count narrows the corresponding list exactly. Undated records have their own bucket.
- **About:** scope and signal explanations, a preview/production comparison and feedback links. Its section control stays above the footer.

The shell supports desktop panels and phone drawers, keyboard navigation and reduced motion. The desktop layout provides the fullest reading and citation-review view. A configured missing-page route offers a CourtListener link for an opinion outside this preview.

## Source layout

| Path | Purpose |
|---|---|
| `src/` | Page entry templates. |
| `_includes/layouts/`, `macros/`, `partials/` | Shared shell, reusable markup and opinion sections. |
| `assets/css/` | Ordered Tailwind entry point and feature styles under `components/`. |
| `assets/js/alpine/` | CSP-compatible controllers and reader feature factories under `composables/`. |
| `assets/js/` | Shared reading, tooltip, search and navigation behavior. |
| `scripts/` | Data loading, citation processing, taxonomy, rendering and Python tests. |
| `tools/` | Template filters, chart aggregation, token export and JavaScript tests. |
| `_data/` | Generated JSON and small shared configuration modules. |
| `design/` | Token inventory and pinned CourtListener design-source notices. |
| `_site/` | Generated site output, ignored by Git. |

`tailwind.config.js` is the design-token source. Regenerate the explicit inventory with `npm run build:tokens`; see [design/README.md](design/README.md). Repeated interface patterns use existing Nunjucks macros and component CSS rather than a second runtime framework.

The reader controller owns tabs and lifecycle; Find, citation occurrences, popovers and passage actions have separate per-reader factories. `src/opinion.njk` declares their script order before Alpine starts. The [adoption notes](docs/adoption.md) describe the feature boundaries and dependencies for a scoped upstream contribution.

## Checks

```sh
npm test
npm run test:js
npm run lint
```

These run the Python suite, JavaScript behavior/count contracts, Ruff and mypy. The GitHub Actions build workflow runs the Python and JavaScript tests and a complete fixture build. Passing checks validate implementation behavior, not legal classifications.

## Static hosting

Serve `_site/` as the HTTP root; assets use root-relative URLs. Configure the host to serve `404.html` for missing routes while preserving the requested URL. Plain `python3 -m http.server` serves existing pages but uses its own generic missing-page response.

Build CSS and pages together before publishing static output. Avoid having a development watcher rewrite that output during a production build.

## License

[BSD-2-Clause](LICENSE). Keep the retained source and font notices with redistributed files.
