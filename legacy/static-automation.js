import { createRequire } from "module";
const require = createRequire(import.meta.url);
const urls = require("./content/all-urls.json");
import _ from "lodash";
import axios from "axios";
import cheerio from "cheerio";
import { performance } from "perf_hooks";
import fs from "fs";
import { intervalToDuration } from "date-fns";
let EXTERNAL_LINKS = [];
let errorRetry = 2;
const statusCodes = {
  ENOTFOUND: "404",
  ECONNREFUSED: "404",
  OK: "200",
  ERR_FR_TOO_MANY_REDIRECTS: "404",
};
const pageStatus = {
  200: [],
  404: [],
  ECONNRESET: [],
  ETIMEDOUT: [],
};

(async () => {
  const t0 = performance.now();
  console.log(":: In main function ::");
  const perPageStatus = await pageStatusAndPages();
  const t1 = performance.now();
  const { minutes, seconds } = intervalToDuration({
    start: t0,
    end: t1,
  });
  console.log(`prepared the content and context in ${minutes}m:${seconds}s`);
  saveFile(JSON.stringify(perPageStatus), "interim-link.json");
  saveFile(JSON.stringify(EXTERNAL_LINKS), "external-link.json");
})();

async function visitPages(chunkData, iterate, type = "internal") {
  console.log(":: Chunk value ::" + iterate);
  return await Promise.all(
    chunkData.map(async (currentPage) => {
      try {
        const pageValue = await visitPage(currentPage, type);
        if (pageStatus[pageValue.status]) {
          pageStatus[pageValue.status].push(pageValue);
        } else {
          pageStatus[pageValue.status] = pageValue;
        }
      } catch (err) {
        console.log(err);
      }
    })
  );
}

async function visitPage(testPage, type) {
  try {
    return await axios.get(testPage).then(async (res) => {
      const canonical = await getCanonical(res.data);
      const title = await getPageTitle(res.data);
      const noFollow = await getNoFollowNoIndex(res.data);
      if (type === "internal") {
        EXTERNAL_LINKS = _.unionBy(
          EXTERNAL_LINKS,
          await getExternalLinks(res.data)
        );
        return {
          page: res.config.url,
          canonical: canonical,
          pageTitle: title,
          linkType: type,
          noFollow: noFollow,
          canonicalTestPassStatus:
            canonical === res.config.url ? "PASS" : "FAIL",
          status: statusCodes[res.statusText]
            ? statusCodes[res.statusText]
            : "UNKNOWNERROR",
        };
      } else {
        return {
          page: res.config.url,
          status: statusCodes[res.statusText]
            ? statusCodes[res.statusText]
            : "UNKNOWNERROR",
        };
      }
    });
  } catch (err) {
    if (type === "internal") {
      return {
        page: testPage,
        canonical: null,
        pageTitle: null,
        linkType: type,
        externalLinks: [],
        status: statusCodes[err.code] ? statusCodes[err.code] : "UNKNOWNERROR",
      };
    } else {
      return {
        page: testPage,
        status: statusCodes[err.code] ? statusCodes[err.code] : "UNKNOWNERROR",
      };
    }
  }
}
async function getCanonical(html) {
  const $ = cheerio.load(html);
  const canonical = $("link[rel='canonical']").attr("href");
  return canonical;
}

async function getPageTitle(html) {
  const $ = cheerio.load(html);
  const title = $("title").text();
  return title;
}
async function getNoFollowNoIndex(html) {
  const $ = cheerio.load(html);
  const noFollow = $("meta[rel='nofollow']").attr("content");
  return noFollow || "FALSE";
}
function getExternalLinks(html) {
  const $ = cheerio.load(html);
  const externalLinks = $("a[href^='http']")
    .map((i, link) => {
      if (!link.attribs.href.includes("asuonline.asu.edu")) {
        return $(link).attr("href");
      }
    })
    .get();
  return externalLinks;
}

function saveFile(result, fileName) {
  console.log("Creating JSON file...");
  fs.writeFile(`./content/${fileName}`, result, "utf8", function (err) {
    if (err) {
      console.log("An error occured while writing JSON Object to File.");
      return console.log(err);
    }

    console.log("JSON file has been saved.");
  });
}

async function pageStatusAndPages() {
  const chunk = _.chunk(urls, 100);
  let iterate = 0;
  while (iterate < chunk.length) {
    await visitPages(chunk[iterate], iterate);
    iterate++;
    if (iterate === chunk.length) {
      return pageStatus;
    }
  }
}

async function errorPagesChecking() {
  let retry = 0;
  while (retry < errorRetry) {
    pageStatus.ECONNRESET.forEach(async (page) => {
      const value = await visitPage(
        pageStatus.ECONNRESET.pop().page,
        "Retrying for ECONNRESET"
      );
      if (pageStatus[value.status]) {
        pageStatus[value.status].push(value);
      } else {
        pageStatus[value.status] = value;
      }
    });
    retry++;
  }
}

async function parseExternalLinks() {
  console.log(":: Parsing external links ::");
  const chunk = _.chunk(EXTERNAL_LINKS, 500);
  let iterate = 0;
  while (iterate < chunk.length) {
    await visitPages(chunk[iterate], iterate, "external");
    iterate++;
    if (iterate === chunk.length) {
      return pageStatus;
    }
  }
}
