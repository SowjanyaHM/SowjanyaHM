import { Cluster } from "puppeteer-cluster";
import vanillaPuppeteer from "puppeteer";
import _ from "lodash";
import { performance } from "perf_hooks";
import { addExtra } from "puppeteer-extra";
import Stealth from "puppeteer-extra-plugin-stealth";
import { saveFile, readFile } from "../util/util.js";

import { intervalToDuration } from "date-fns";
const pagesStatus = {
  200: [],
  404: [],
  pdf: [],
};
let externalLinksMap = {};
const asuoPageCrawler = async () => {
  const asuoLinks = await readFile("asuo-pages.json");
  const puppeteer = addExtra(vanillaPuppeteer);
  puppeteer.use(Stealth());
  const t0 = performance.now();
  // todo: Remove splice
  const urlChunks = _.chunk(asuoLinks, 30);
  console.log("TOTAL ITERATION ON ASUO PAGES: ", urlChunks.length);
  let iterate = 0;
  while (iterate < urlChunks.length) {
    console.log("Iteration: ", iterate);
    const cluster = await Cluster.launch({
      concurrency: Cluster.CONCURRENCY_PAGE,
      maxConcurrency: 199,
      monitor: false,
      timeout: 300000,
      puppeteer,
      puppeteerOptions: {
        headless: true,
      },
      args: [
        "--disable-web-security",
        "--autoplay-policy=no-user-gesture-required",
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--remote-debugging-port=9222",
        "--allow-insecure-localhost",
      ],
    });
    cluster.on("taskerror", (err, data, willRetry) => {
      if (willRetry) {
        console.warn(
          `Encountered an error while crawling ${data}. ${err.message}\nThis job will be retried`
        );
      } else {
        const pageData = {
          page: data,
          message: err.message,
        };
        console.error(`Failed to crawl ${data}: ${err.message}`);
        if (data.endsWith(".pdf")) {
          pagesStatus.pdf.push(pageData);
        } else {
          pagesStatus[404].push(pageData);
        }
      }
    });
    cluster.task(async ({ page, data: url }) => {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 300000 });
      await page.setRequestInterception(true);
      page.on("request", (request) => {
        if (request.resourceType() === "document") {
          request.continue();
        } else {
          request.abort();
        }
      });
      const pageData = {
        page: url,
        message: "success",
        title: await page.title(),
        canonical: await getCanonical(page),
        description: await getPageDescription(page),
        hasNofollowNoIndex: await getHasNofollowNoIndex(page),
        isCanonicalMatch: url === (await getCanonical(page)),
      };
      pagesStatus[200].push(pageData);
      await prepareExternalLinks(page);
    });
    for (const url of urlChunks[iterate]) {
      await cluster.queue(url);
    }
    await cluster.idle();
    await cluster.close();
    console.log("Cluster closed on AUSUO PAGES");
    iterate++;
    if (iterate === urlChunks.length) {
      console.log(
        "number of pages visited::" +
          [...pagesStatus[200], ...pagesStatus[404], ...pagesStatus.pdf].length
      );
      console.log(`200: ${pagesStatus[200].length}`);
      console.log(`404: ${pagesStatus[404].length}`);
      const t1 = performance.now();
      const { minutes, hours, seconds } = intervalToDuration({
        start: t0,
        end: t1,
      });
      console.dir(
        `Time taken for asuo page crawler: ${hours}h : ${minutes}m : ${seconds}s`
      );
      await saveFile(
        {
          pagesStatus,
          externalLinksMap,
        },
        "pagesStatus.json"
      );
      return {
        pagesStatus,
        externalLinksMap,
      };
    }
  }
};

export default asuoPageCrawler;

async function getCanonical(page) {
  const canonical = await page.evaluate(() => {
    const canonical = document.querySelector("link[rel=canonical]");
    if (canonical) {
      return canonical.href;
    }
    return null;
  });
  return canonical;
}

async function getPageDescription(page) {
  const description = await page.evaluate(() => {
    const description =
      document.querySelector("meta[name=Description]") ||
      document.querySelector("meta[name=description]");
    if (description) {
      return description.content;
    }
    return null;
  });
  return description;
}

async function getHasNofollowNoIndex(page) {
  const hasNofollowNoIndex = await page.evaluate(() => {
    const nofollow = document.querySelector("meta[name=robots]");
    if (nofollow) {
      return nofollow.content.includes("nofollow");
    }
    return false;
  });
  return hasNofollowNoIndex;
}

async function prepareExternalLinks(page) {
  const links = await page.$$("a");
  for (const link of links) {
    const href = await link.getProperty("href");
    const url = await href.jsonValue();
    if (url.startsWith("http") && !url.includes("asuonline")) {
      if (!externalLinksMap[url]) {
        externalLinksMap[url] = {
          count: 1,
          status: null,
          page: [await page.url()],
        };
      } else {
        externalLinksMap[url].count++;
        externalLinksMap[url].page.push(await page.url());
      }
    }
  }
}
