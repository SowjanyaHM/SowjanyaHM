import { promises as fs } from "fs";
import path from "path";
export const saveFile = async (json, file) => {
  await fs.writeFile(
    path.resolve() + "/tmp/" + file,
    JSON.stringify(json),
    "utf8",
    function (err) {
      if (err) {
        console.log("An error occurred while writing JSON Object to File.");
        console.log(err);
      }
      console.log("JSON file has been saved in /tmp/" + file);
    }
  );
};

export const readFile = async (file) => {
  const data = await fs.readFile(
    path.resolve() + "/tmp/" + file,
    "utf8",
    function (err, data) {
      if (err) {
        console.log("An error occurred while reading JSON Object from File.");
        console.log(err);
      }
      console.log("JSON file has been read from /tmp/" + file);
    }
  );
  return JSON.parse(data);
};
