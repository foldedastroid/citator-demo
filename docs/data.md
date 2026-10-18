# Data contract

The site works like a citator's citation table. Each opinion's citation
groups (the cases its text cites, with how often each is mentioned and
the treatment applied) are first filtered to cases: a group with no case
name, no short name and no case reporter citation, such as a statute, a
law review article or an unattached "Id.", is not an authority
(`model_output.py`). The rest are resolved to opinions in the collection: by the
cluster id the extraction attached; else by a reporter citation the
opinion or its metadata lists; else by the first party's name, when only
one opinion in the collection has it. Every group resolved to an opinion
in the collection is one edge from the citing opinion to the cited
opinion. The Authorities tab is the edges
where an opinion is the citing side, in the active voice
("Distinguishes"); the Later Courts tab, the status rows and the home cards
are the edges where it is the cited side, in the passive ("Distinguished
by"); the mention count is the same number on both. A treatment a citing
opinion only reports another court applying is the "as recognized by"
form and keeps that treatment's severity. The Later Courts tab lists one row
per citing opinion, however many treatments run between the two. On
both tabs every treatment other than a plain "Cited by", applied or
recognized, gets an evidence card with its rationale and quote, the
case's citation or name in bold where the quote has it
(`model_output.mark_case_in_quote`); the rule and the card are shared (`taxonomy.has_evidence`,
`macros/evidence.njk`). The citing-scope CSVs say which citing opinions
were fetched for each anchor; they create no rows.

Treatments roll up into five severity tiers, most serious first: Stop,
Warning, Caution, Positive (Followed by, and an affirmance) and Neutral. The tier is the
taxonomy's (`scripts/taxonomy.py`), not the one recorded in the data
source, so a tier change reaches every page on the next build. The first three
are the negative tiers; only they produce text markers and
expert-disagreement marks (`scripts/taxonomy.py`). An opinion's own
disposition renders in the active voice, what this opinion did
("Affirms"), always in the neutral grey, as does every card on the
History tab (what that decision did, in its own severity); one the taxonomy has no label for shows the sentence that
disposed of the case on both, as plain text in place of a pill.

A treatment label the taxonomy does not know gets the tier "Other": its
row is listed and searchable, but the citing references matrix leaves it
out and says how many it left out, so a new label in the data never
breaks the build. A citation is only ruled out by dates when both
opinions have one; a citing opinion with no filing date is kept and
shows "Date not available".

`scripts/real_data.py` reads `data-source/`:

| Path | Contents |
|---|---|
| `anchor_opinions/{cluster_id}.json` | The anchor opinions. Required. |
| `authorities/`, `citing_opinions/`, `citing_opinions_round2/` | Further opinions, same payload shape. A cluster present in several folders is loaded once, with the first folder's tier (anchor, authority, citing). |
| `centralia/{cluster_id}.json` | A PDF re-read of an opinion whose source html is a text dump; used when `used` is true. |
| `citation_groups/{cluster_id}.json` | Citation extraction output: the writings' html, one group per cited case (`gid`, `n`, `name`, `cited_cluster_id`, `citations`, `cited_as`, `n_mentions`), kept and removed spans (`occurrences`), added mentions (`manual`). The group number `n` is the key the treatments use. |
| `treatments/{cluster_id}.json` | Per group: `applied`, `severity`, `direction`, `quote`, `rationale`, `recognized[]`; plus the opinion's `disposition`, `on_appeal` and expert `gold`. |
| `cited_metadata.json` | Date, status, court and citations for cited clusters. |
| `citing_counts_*.json` | How often cited opinions are cited, for pages outside the Later Courts scope. |
| `citing_edges.csv`, `citing_edges_round2.csv` | The citing scope: which citing opinions were fetched for which anchor (`citing_cluster_id`, and `anchor_opinion_id` or `anchor_cluster_id`). |

An opinion payload holds `cluster_id`, `case_name`, `docket_number`,
`citations`, `court`, `court_full_name`, `court_jurisdiction`,
`date_filed` and `opinions`, one entry per writing with `id`, `type`,
`author` and `html`. Citation lists are reordered with the primary
reporters first (U.S., F.3d, S. Ct., …; `real_data.order_citations`).

The build writes `_data/opinions/{cluster_id}.json` (one per page),
`index.json` (the home list), `scope.json` (counts for the About page),
`flags.json`, `courts.json`, `court_picker.json`, `court_categories.json`,
`court_jurisdictions.json`, `treatments.json` (the taxonomy table) and
`treatment_definitions.json` (every pill label mapped to its
definition, shown on hover and focus; each definition speaks from the
page it is on, where the opinion shown is always "this case").
