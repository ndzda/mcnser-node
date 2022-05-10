import { createServer } from "net";
import { mcClient } from "./mcClient.js";
import { option } from "./option.js";

/** 客户端计数 */
var clientCount = 0;

createServer(function (client)
{
    /** 客户端id */
    var clientSN = clientCount++;
    /** 客户端上下文 */
    var context = new mcClient(client, clientSN);

    console.log("[+]client connected: " + clientSN);
    client.setNoDelay(true);

    client.on("end", () =>
    {
        console.log("[-]client disconnect: " + clientSN);
        if (context.SerSock)
            context.SerSock.s.destroy();
    });

    client.on("error", () =>
    {
        console.log("[x]errFC: " + clientSN);
        client.destroy();
        if (context.SerSock)
            context.SerSock.s.destroy();
    });

    client.on("data", (data) =>
    {
        // console.log("[*]dataFC(" + clientId + "): ", data);
        if (context.toServerThr)
        {
            context.SerSock.s.write(data);
        }
        else
        {
            context.CliProt.resolve(data);
            if (false)
            {
                console.log("[-]kick: " + clientSN);
                client.destroy();
                if (context.SerSock)
                    context.SerSock.s.destroy();
            }
        }
    });

}).listen(option.port, () =>
{
    console.log("tcp service started on the port: " + option.port);
});