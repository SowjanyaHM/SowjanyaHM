import parser from "xml2json";
import axios from "axios";
import { performance } from "perf_hooks";
import { saveFile } from "./util/util.js";
import { intervalToDuration } from "date-fns";
import asuoPageCrawler from "./crawlers/asuo-page-crawler.js";
import externalLinkValidator from "./crawlers/external-link-validator.js";
(async () => {
  try {
    //Get all urls from sitemap
    const allPages = await getAllRoutesFromASUO();
    // visit each page and check if it is valid using puppeteer
    const t0 = performance.now();
    console.log(allPages.length);
    await asuoPageCrawler();
    await externalLinkValidator();
    const t1 = performance.now();
    const { minutes, hours, seconds } = intervalToDuration({
      start: t0,
      end: t1,
    });
    console.log(`Time taken: ${hours}h : ${minutes}m : ${seconds}s`);
    SendMail();
  } catch (err) {
    console.error(err);
  }
})();

async function getAllRoutesFromASUO() {
  let { data } = await axios.get("https://asuonline.asu.edu/sitemap.xml");
  const urls = await parser.toJson(data);
  const parsedRoutes = JSON.parse(urls).urlset.url.map((url) => url.loc);
  await saveFile(parsedRoutes, "asuo-pages.json");
  console.log("JSON saved in loc /tmp/" + "asuo-pages.json");
  return parsedRoutes;
}
