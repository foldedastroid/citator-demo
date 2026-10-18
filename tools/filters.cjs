




const { chartBreakdown, TIERS } = require("./chart-data.cjs");
const courtAbbr = require("../_data/court_abbr.js");




function usdate(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || "");
  return m ? `${m[2]}/${m[3]}/${m[1]}` : iso || "";
}





function citeTail(o) {
  if (!o) return "";
  const year = (o.date_filed || "").slice(0, 4);
  const court = Object.prototype.hasOwnProperty.call(courtAbbr, o.court) ? courtAbbr[o.court] : o.court_display || "";
  const inside = [court, year].filter(Boolean).join(" ");
  const paren = inside ? ` (${inside})` : "";
  if (o.citations && o.citations.length) return `${o.citations[0]}${paren}`;
  if (o.docket_numbers && o.docket_numbers.length) return `No. ${o.docket_numbers[0]}${paren}`;
  return paren.trim();
}




function worstSignal(summary) {
  const found = [summary?.cr_severity, summary?.dh_severity].filter((t) => TIERS.includes(t));
  return found.sort((a, b) => TIERS.indexOf(a) - TIERS.indexOf(b))[0] || "";
}




const countsCache = new WeakMap();
function listCounts(opinions) {
  if (!Array.isArray(opinions)) return {};
  if (!countsCache.has(opinions)) {
    const counts = {};
    for (const o of opinions) {
      counts[o.cluster_id] = {
        authorities: (o.cited_authorities || []).length,
        citedBy: (o.cited_by || []).length,
      };
    }
    countsCache.set(opinions, counts);
  }
  return countsCache.get(opinions);
}

const filters = { chartBreakdown, usdate, citeTail, worstSignal, listCounts };

module.exports = function addFilters(eleventyConfig) {
  for (const [name, fn] of Object.entries(filters)) eleventyConfig.addFilter(name, fn);
};
module.exports.filters = filters;
