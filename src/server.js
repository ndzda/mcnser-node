import { createServer } from "net";
import { userMap, saveList } from "./userList.js";
import { option } from "./option.js";
import { get as httpGet } from "http";
import { get as httpsGet } from "https";


function pGet(src, callback)
{
    var getF = httpGet;
    if (src.slice(0, 8) == "https://")
        getF = httpsGet;
    getF(src, (req, res) =>
    {
        var str = "";
        req.on("data", (data) => { str += data; })
        req.on("end", () => { callback(str); })
    });
}

var clientCount = 0;
createServer(function (client)
{
    var clientId = clientCount++;
    var context = createCont(client, clientId);
    console.log("[+]client connected: " + clientId);
    client.setNoDelay(true);
    var toServer = context.s;
    client.on("end", function ()
    {
        console.log("[-]client disconnect: " + clientId);
        if (context.user && context.state == 2 && context.CDK)
        {
            userMap.get(context.CDK).t = (userMap.get(context.CDK).t - Math.round((Date.now() - context.startTime) / 1000));
            saveList();
        }
        if (context.o)
            context.o.destroy();
    });
    client.on("error", function ()
    {
        console.log("[x]errFC: " + clientId);
        client.destroy();
        if (context.o)
            context.o.destroy();
    });
    client.on("data", function (data)
    {
        //console.log("[*]dataFC(" + clientId + "): ", data);
        if (context.thr)
        {
            context.so.write(data);
        }
        else if (toServer.next(data).done)
        {
            var obj = toServer.next(data);
            if (typeof (obj.value) == "string")
            {
                pGet(obj.value, () => { });
            }
            if (obj.done)
            {
                console.log("[-]kick: " + clientId);
                client.destroy();
                if (context.o)
                    context.o.destroy();
            }
        }
    });
}).listen(option.port, () =>
{
    console.log("tcp service started on the port: " + option.port);
});