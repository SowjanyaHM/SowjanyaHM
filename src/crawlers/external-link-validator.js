import { Cluster } from "puppeteer-cluster";
import _ from "lodash";
import { performance } from "perf_hooks";
import { saveFile, readFile } from "../util/util.js";
import { intervalToDuration } from "date-fns";
const pagesStatus = {
  200: [],
  404: [],
  pdf: [],
};
let iterate = 0;
const externalLinkValidator = async () => {
  const { externalLinksMap } = await readFile("pagesStatus.json");
  const t0 = performance.now();
  const urlChunks = _.chunk(Object.keys(externalLinksMap), 200);
  console.log("TOTAL ITERATION: ", urlChunks.length);
  while (iterate < urlChunks.length) {
    console.log("Iteration: ", iterate);
    const cluster = await Cluster.launch({
      concurrency: Cluster.CONCURRENCY_PAGE,
      maxConcurrency: 201,
      monitor: false,
      timeout: 180000,
      puppeteerOptions: {
        headless: true,
      },
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
        if (data.includes(".pdf")) {
          pagesStatus.pdf.push(pageData);
        } else {
          pagesStatus[404].push(pageData);
        }
      }
    });
    cluster.task(async ({ page, data: url }) => {
      await page.goto(url, { waitUntil: "networkidle2", timeout: 0 });
      const pageData = {
        page: url,
        message: "success",
      };
      pagesStatus[200].push(pageData);
    });
    let i = 0;
    for (const url of urlChunks[iterate]) {
      await cluster.queue(url);
    }
    await cluster.idle();
    await cluster.close();
    console.log("Cluster closed");
    iterate++;
    if (iterate === urlChunks.length) {
      console.log(
        "number of pages scrolled" +
          [...pagesStatus[200], ...pagesStatus[404], ...pagesStatus.pdf].length
      );
      console.log(`200: ${pagesStatus[200].length}`);
      console.log(`404: ${pagesStatus[404].length}`);
      console.log(`pdfs: ${pagesStatus.pdf.length}`);
      const t1 = performance.now();
      const { minutes, hours, seconds } = intervalToDuration({
        start: t0,
        end: t1,
      });
      console.log(
        `Time taken for externalLinksStatus: ${hours}h : ${minutes}m : ${seconds}s`
      );
      saveFile(pagesStatus, "externalLinksStatus.json");
    }
  }
};

export default externalLinkValidator;
