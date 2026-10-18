

















const TIERS = ['Stop', 'Warning', 'Caution', 'Positive', 'Neutral'];
const MAX_COLUMNS = 250;
const PERIOD_SIZES = [
  ['year', 1, 'Year'],
  ['decade', 10, 'Decade'],
  ['century', 100, 'Century'],
];



function calendarYear(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value || '');
  if (!match) return null;
  const [year, month, day] = match.slice(1).map(Number);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return month >= 1 && month <= 12 && day >= 1 && day <= days[month - 1] ? year : null;
}

function emptyCounts() {
  return Object.fromEntries(TIERS.map((tier) => [tier, 0]));
}

function sum(counts) {
  return Object.values(counts).reduce((total, n) => total + n, 0);
}


function defaultPeriodMode(span) {
  if (span <= 24) return 'year';
  if (span <= 240) return 'decade';
  return 'century';
}

function periodGroup(mode, size, unit, years, dateStart, dateEnd) {
  const start = dateStart === null ? 0 : Math.floor(dateStart / size) * size;
  const end = dateEnd === null ? -1 : Math.floor(dateEnd / size) * size;
  const columnCount = end < start ? 0 : (end - start) / size + 1;
  const available = columnCount <= MAX_COLUMNS;
  const periods = [];
  if (available) {
    for (let first = start; first <= end; first += size) {
      const last = Math.min(9999, first + size - 1);
      const firstText = String(first).padStart(4, '0');
      const lastText = String(last).padStart(4, '0');
      const counts = emptyCounts();
      for (let year = first; year <= last; year++) {
        const yearCounts = years.get(year);
        if (yearCounts) for (const tier of TIERS) counts[tier] += yearCounts[tier];
      }
      periods.push({
        key: size === 1 ? firstText : `${firstText}:${lastText}`,
        label: size === 1 ? firstText : `${firstText}–${lastText}`,
        startYear: first,
        endYear: last,
        startDate: `${firstText}-01-01`,
        endDate: `${lastText}-12-31`,
        n: sum(counts),
        counts,
      });
    }
  }
  return { mode, size, unit, columnCount, available, periods };
}

function chartBreakdown(
  rows = [],
  list = 'cited-by',
  tierKey = 'severity',
  courtKey = 'citing_court_display',
  dateKey = 'citing_date_filed'
) {
  const records = Array.isArray(rows) ? rows : [];
  const totals = emptyCounts();
  const undated = emptyCounts();
  const courts = new Map();
  const years = new Map();
  let uncharted = 0;

  for (const row of records) {
    const tier = row[tierKey];
    if (!TIERS.includes(tier)) {
      uncharted += 1;
      continue;
    }
    totals[tier] += 1;

    const court = row[courtKey] || 'Court not identified';
    if (!courts.has(court)) {
      const rank = Number(row.court_index);
      courts.set(court, {
        key: court,
        label: court,
        n: 0,
        counts: emptyCounts(),
        rank: Number.isFinite(rank) ? rank : Number.MAX_SAFE_INTEGER,
      });
    }
    const group = courts.get(court);
    group.n += 1;
    group.counts[tier] += 1;

    const year = calendarYear(row[dateKey]);
    if (year === null) {
      undated[tier] += 1;
    } else {
      if (!years.has(year)) years.set(year, emptyCounts());
      years.get(year)[tier] += 1;
    }
  }

  const orderedYears = [...years.keys()].sort((a, b) => a - b);
  const dateStart = orderedYears.length ? orderedYears[0] : null;
  const dateEnd = orderedYears.length ? orderedYears[orderedYears.length - 1] : null;
  const span = dateStart === null ? 0 : dateEnd - dateStart + 1;
  const mode = defaultPeriodMode(span);
  const periodGroups = Object.fromEntries(
    PERIOD_SIZES.map(([key, size, unit]) => [key, periodGroup(key, size, unit, years, dateStart, dateEnd)])
  );
  const selected = periodGroups[mode];
  const charted = records.length - uncharted;
  const unknownDateCount = sum(undated);

  return {
    list,
    rows: records,
    tierKey,
    courtKey,
    dateKey,
    total: charted,
    uncharted,
    tiers: TIERS.map((tier) => ({ tier, n: totals[tier] })),
    courts: [...courts.values()].sort((a, b) => a.rank - b.rank || a.label.localeCompare(b.label)),
    periods: unknownDateCount
      ? selected.periods.concat([{ key: 'undated', label: 'Date not available', n: unknownDateCount, counts: undated }])
      : selected.periods,
    decades: mode === 'decade',
    periodUnit: selected.unit,
    periodWidth: selected.size,
    periodGroups,
    defaultPeriodMode: mode,
    dateStart,
    dateEnd,
    datedCount: charted - unknownDateCount,
    unknownDateCount,
    unknownDateCounts: undated,
    maxColumns: MAX_COLUMNS,
  };
}

module.exports = { chartBreakdown, calendarYear, TIERS };
