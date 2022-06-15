import parser from "xml2json";
import fs from "fs";
import axios from "axios";

(async () => {
  let { data } = await axios.get("https://asuonline.asu.edu/sitemap.xml");

  const url = await parser.toJson(data);
  saveFile(url);
})();

function saveFile(result) {
  console.log("Creating JSON file...");
  const stringifyResult = JSON.parse(result);
  const prepareRoutes = stringifyResult.urlset.url.map((url) => url.loc);
  fs.writeFile(
    "./content/all-urls.json",
    JSON.stringify(prepareRoutes),
    "utf8",
    function (err) {
      if (err) {
        console.log("An error occured while writing JSON Object to File.");
        return console.log(err);
      }

      console.log("JSON file has been saved.");
    }
  );
}
