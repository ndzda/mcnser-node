import { readFileSync, writeFileSync, watch } from "fs";

export const userMap = new Map();

var saveTime = 0;
export function saveList()
{
    var str = "mcnser user list\n";
    userMap.forEach((o, i) =>
    {
        if (o > 0)
            str += i + " " + o + "\n";
    });
    str += "mcnser user list end";
    saveTime = Date.now();
    writeFileSync("./userList.txt", str, { encoding: "utf-8" });
}

export function readList()
{
    var str = readFileSync("./userList.txt", { encoding: "utf-8" }).replace("\r", "");
    var list = str.split("\n");
    if (list[0] != "mcnser user list" || list[list.length - 1] != "mcnser user list end")
    {
        console.log("[Error] Reading List Failed");
        return;
    }
    list.slice(1, -1);
    list.forEach((o, i) =>
    {
        var tmp = o.split(" ");
        userMap.set(tmp[0], parseInt(tmp[1]));
    });
}

readList();

watch("./userList.txt", () =>
{
    if (Math.abs(Date.now() - saveTime) > 900)
        setTimeout(readList, 100);
});