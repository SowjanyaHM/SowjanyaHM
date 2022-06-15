import fs from "fs";

module.exports = () => {
  if (fs.existsSync("./content/all-urls.json")) {
    fs.unlinkSync("./content/all-urls.json");
  }
  if (fs.existsSync("./report/report.xlsx")) {
    fs.unlinkSync("./report/report.xlsx");
  }
  if (fs.existsSync("./content/interim-link.json")) {
    fs.unlinkSync("./content/interim-link.json");
  }
  if (fs.existsSync("./content/external-link.json")) {
    fs.unlinkSync("./content/external-link.json");
  }
};
