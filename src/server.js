import { createServer } from "net";
import { userMap, saveList } from "./userList.js";

var clientCount = 0;
export function createSer(callBack, port)
{
    createServer(function (client)
    {
        var clientId = clientCount++;
        var context = callBack(client, clientId);
        console.log("[+]client connected: " + clientId);
        client.setNoDelay(true);
        var toServer = context.s;
        client.on("end", function ()
        {
            console.log("[-]client disconnect: " + clientId);
            if (context.user && context.state == 2)
            {
                userMap.set(context.CDK, userMap.get(context.CDK) - Math.round((Date.now() - context.startTime) / 1000));
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
                console.log("[-]kick: " + clientId);
                client.destroy();
                if (context.o)
                    context.o.destroy();
            }
        });
    }).listen(port, () =>
    {
        console.log("tcp service started on the port: " + port);
    });
}