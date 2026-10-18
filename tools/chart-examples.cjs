







const TIERS = ['Stop', 'Warning', 'Caution', 'Positive', 'Neutral'];
const TREATMENTS = ['Overruled', 'Criticized', 'Distinguished', 'Followed', 'Cited'];


function row(index, year, court, tierIndex) {
  const name = `Illustrative citing opinion ${String(index + 1).padStart(3, '0')}`;
  return {
    row_id: `example-${index + 1}`,
    citing_case_name: name,
    citing_cluster_id: null,
    is_scoped: false,
    citing_court_display: court,
    citing_date_filed: `${year}-06-15`,
    citing_date_short: `06/15/${year}`,
    citing_docket_numbers: [],
    citing_citations: [],
    citing_n_mentions: 1 + (index % 8),
    search_text: `${name} ${court} ${year}`.toLowerCase().replace(/[^a-z0-9]+/g, ''),
    severity: TIERS[tierIndex],
    applied: [{ severity: TIERS[tierIndex], treatment: TREATMENTS[tierIndex], validation: 'unverified' }],
    recognized: [],
    recognized_filter: 'none',
    validation: 'unverified',
    evidence_cards: [],
    has_detail: false,
    severity_index: tierIndex * 10000 + index,
    name_index: index,
    recency_index: 20250000 - year * 10000 + index,
    mentions_index: 8 - (index % 8),
    court_index: index,
  };
}

function courtName(prefix, n) {
  return `${prefix} ${String(n).padStart(2, '0')}`;
}

function centuryRows() {
  const rows = [];
  for (let year = 1875; year <= 2025; year++) {
    for (let sample = 0; sample < 3; sample++) {
      const index = rows.length;
      rows.push(row(index, year, courtName('Illustrative Appellate Court', (index % 8) + 1), index % 5));
    }
  }
  return rows;
}

function denseRows() {
  const rows = [];
  for (let court = 1; court <= 64; court++) {
    for (let tier = 0; tier < 5; tier++) {
      const name = courtName('Illustrative Regional Appellate Court of the North Eastern District', court);
      rows.push(row(rows.length, 1990 + ((court + tier) % 36), name, tier));
    }
  }
  return rows;
}

function sparseRows() {
  const rows = [];
  for (const year of [1875, 1900, 1960, 2025]) {
    for (let tier = 0; tier < 5; tier++) {
      rows.push(row(rows.length, year, courtName('Illustrative Appellate Court', tier + 1), tier));
    }
  }
  for (let index = 0; index < 3; index++) {
    const undated = row(rows.length, 0, 'Illustrative Court with Undated References', index);
    undated.citing_date_filed = '';
    undated.citing_date_short = 'Undated';
    rows.push(undated);
  }
  return rows;
}

module.exports = { centuryRows, denseRows, sparseRows };
