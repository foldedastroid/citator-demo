











const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const local = require(path.join(root, "tailwind.config.js")).theme.extend;
const upstream = require(path.join(root, "design/courtlistener-tailwind.cjs")).theme.extend;
const SOURCE_URL =
  "https://github.com/freelawproject/courtlistener/blob/7c5f8c72e143e2e0f94923259c93920c614cdbc2/cl/assets/tailwind/tailwind.config.js";

function flatten(value, prefix = []) {
  return Object.entries(value).flatMap(([key, val]) => {
    const keys = [...prefix, key];
    return val && typeof val === "object" && !Array.isArray(val) ? flatten(val, keys) : [{ path: keys.join("."), keys, value: val }];
  });
}


function variableName(keys) {
  return "--design-" + keys.join("-").replaceAll(".", "-").replace(/[A-Z]/g, (c) => "-" + c.toLowerCase());
}

const theirs = new Map(flatten(upstream).map((item) => [item.path, item.value]));
const entries = flatten(local).map((item) => {
  const known = theirs.has(item.path);
  const same = known && JSON.stringify(theirs.get(item.path)) === JSON.stringify(item.value);
  return {
    ...item,
    provenance: !known ? "local-addition" : same ? "courtlistener-identical" : "courtlistener-modified",
    ...(known && !same ? { courtlistenerValue: theirs.get(item.path) } : {}),
    cssVariables: [variableName(item.keys)],
  };
});

const report = {
  sourceUrl: SOURCE_URL,
  scope: "Explicit theme.extend tokens only; Tailwind defaults are not listed.",
  entries,
};
fs.writeFileSync(path.join(root, "design/tokens.json"), JSON.stringify(report, null, 2) + "\n");

const counts = entries.reduce((n, item) => ({ ...n, [item.provenance]: (n[item.provenance] || 0) + 1 }), {});
console.log(`design/tokens.json: ${entries.length} tokens`, counts);
