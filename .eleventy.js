








const addFilters = require("./tools/filters.cjs");

module.exports = function (eleventyConfig) {
  addFilters(eleventyConfig);
  eleventyConfig.addPassthroughCopy("assets/js");
  eleventyConfig.addPassthroughCopy("assets/fonts");



  eleventyConfig.addPassthroughCopy({
    "node_modules/@alpinejs/csp/dist/cdn.min.js": "assets/js/alpine.min.js",
  });

  return {
    dir: {
      input: "src",
      output: "_site",
      includes: "../_includes",
      data: "../_data",
    },
    templateFormats: ["njk", "md", "html"],
    htmlTemplateEngine: "njk",
    markdownTemplateEngine: "njk",
  };
};
