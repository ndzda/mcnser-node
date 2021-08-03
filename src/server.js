import { createServer } from "net";
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
            console.log("[*]dataFC(" + clientId + "): ", data);
            toServer.next(data);
        });
    }).listen(port, () =>
    {
        console.log("tcp service started on the port: " + port);
    });
}