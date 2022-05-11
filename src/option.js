import { readFileSync } from "fs";

export var option = JSON.parse(readFileSync("./option.json", "utf-8"));