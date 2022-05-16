import { readFileSync, writeFileSync, watch } from "fs";

/**
 * @type {Map<string,{
 *  t : number,
 *  ip : string,
 *  cmpUrlStr : string,
 *  cmpUrl : Function,
 *  cmpStr : string,
 *  cmp : Function
 * }>}
 */
export const userMap = new Map();

var saveTime = 0;
export function saveList()
{
    var ulObj = [];
    userMap.forEach((o, i) =>
    {
        if (o.cmpStr)
            ulObj.push([i, o.t, o.ip, o.cmpUrl, o.cmpStr]);
        else if (o.t > 0)
            ulObj.push([i, o.t, o.ip]);
    });
    saveTime = Date.now();
    writeFileSync("./userList.json", JSON.stringify(ulObj), { encoding: "utf-8" });
}

export function readList()
{
    var ulObj = JSON.parse(readFileSync("./userList.json", { encoding: "utf-8" }));
    if (Array.isArray(ulObj))
    {
        ulObj.forEach((o) =>
        {
            userMap.set(o[0], {
                t: o[1],
                ip: o[2],
                cmpUrlStr: o[3],
                cmpUrl: (o[3] ? new Function("player_name", o[3]) : null),
                cmpStr: o[4],
                cmp: (o[4] ? new Function("player_name", o[4]) : null)
            });
        });
    }
    else
    {
        console.log("[Error] Reading List Failed");
        return;
    }
}

readList();

watch("./userList.json", () =>
{
    if (Math.abs(Date.now() - saveTime) > 900)
        setTimeout(readList, 100);
});