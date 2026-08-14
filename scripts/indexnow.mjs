#!/usr/bin/env node
// Pings IndexNow so Bing (and the ChatGPT search index that draws on it) picks
// up changes in minutes instead of waiting for an organic crawl.
//
//   npm run seo:indexnow              submit every URL in the sitemap
//   npm run seo:indexnow -- /de /en   submit specific paths or absolute URLs

const HOST = "www.kinavela.com";
const KEY = "84df2443f90e74b07bd2fcb57bbc32d5";
const ORIGIN = `https://${HOST}`;
const ENDPOINT = "https://api.indexnow.org/indexnow";

async function urlsFromSitemap() {
  const response = await fetch(`${ORIGIN}/sitemap.xml`);
  if (!response.ok) {
    throw new Error(`sitemap fetch failed: HTTP ${response.status}`);
  }
  const xml = await response.text();
  // <loc> only — deliberately ignores the xhtml:link alternates, which repeat
  // the same URLs and would inflate the payload with duplicates.
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
}

function normalise(argument) {
  if (argument.startsWith("http://") || argument.startsWith("https://")) {
    return argument;
  }
  return ORIGIN + (argument.startsWith("/") ? argument : `/${argument}`);
}

const args = process.argv.slice(2);
const urlList = args.length ? args.map(normalise) : await urlsFromSitemap();

const offSite = urlList.filter((url) => !url.startsWith(`${ORIGIN}/`));
if (offSite.length) {
  console.error(`Refusing to submit URLs outside ${ORIGIN}:`);
  for (const url of offSite) console.error(`  ${url}`);
  process.exit(1);
}

const response = await fetch(ENDPOINT, {
  method: "POST",
  headers: { "Content-Type": "application/json; charset=utf-8" },
  body: JSON.stringify({
    host: HOST,
    key: KEY,
    keyLocation: `${ORIGIN}/${KEY}.txt`,
    urlList,
  }),
});

// 200 accepted, 202 accepted but key still being validated. Both are fine.
if (response.status === 200 || response.status === 202) {
  console.log(`Submitted ${urlList.length} URL(s) to IndexNow (HTTP ${response.status}).`);
  process.exit(0);
}

console.error(`IndexNow rejected the submission: HTTP ${response.status}`);
console.error((await response.text()).slice(0, 500));
process.exit(1);
