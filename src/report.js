import ExcelJS from "exceljs";
import { readFile } from "./util/util.js";
import { SendMail } from "./mail.js";
const internalWorkSheet = [
  { header: "Page", key: "page", width: 100 },
  { header: "Canonical", key: "canonical", width: 100 },
  { header: "200:OK", key: "pageStatus", width: 50 },
  { header: "Canonical found", key: "canonicalStatus", width: 50 },
  { header: "Meta-tags", key: "indexingStatus", width: 50 },
];
const externalWorkSheet = [
  { header: "Page", key: "page", width: 100 },
  { header: "message", key: "message", width: 500 },
];
var workbook = new ExcelJS.Workbook();

(async () => {
  const fileName = "ASUOnline Health check results.xlsx";
  const { pagesStatus } = await readFile("pagesStatus.json");
  const externalLinks = await readFile("externalLinksStatus.json");
  const pageMaker = {
    "Internal site 404 ERROR pages": pagesStatus[404],
    "External site 404 ERROR pages": externalLinks[404],
    "Unmatched canonicals": pagesStatus[200].filter(
      (link) => !link.isCanonicalMatch
    ),
    "External site 200 SUCCESS pages": [
      ...externalLinks.pdf,
      ...externalLinks[200],
    ],
    "Internal site 200 SUCCESS pages": pagesStatus[200],
  };
  try {
    await Promise.all(
      Object.keys(pageMaker).map((key) => {
        var worksheet = workbook.addWorksheet(key);
        worksheet.columns = key.includes("External")
          ? externalWorkSheet
          : internalWorkSheet;
        console.log(key);
        pageMaker[key].forEach((element) => {
          worksheet.addRow(rowAdder(element, key));
        });
      })
    );
    console.log("writing to file");
    var tempFilePath = "./report/" + fileName;
    workbook.xlsx.writeFile(tempFilePath);
    const buffer = await workbook.xlsx.writeBuffer();
    SendMail(fileName, buffer);
  } catch (err) {
    console.log("OOOOOOO this is the error: " + err);
  }
})();

function rowAdder(element, page) {
  if (page.includes("External")) {
    return {
      page: element.page,
    };
  } else {
    return {
      page: element.page,
      canonical: element.canonical || "Not Applicable",
      pageStatus: element.message || "Not Applicable",
      canonicalStatus: element.isCanonicalMatch
        ? "Canonical matches"
        : "Canonical does not match",
      indexingStatus: element.hasNofollowNoIndex
        ? "Crawlable"
        : "Non Crawlable",
    };
  }
}
