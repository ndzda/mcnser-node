import { readFileSync } from "fs";
import { mcBuffer } from "./mcProt.js";
import { createConnection } from "net";
import { mcSocket } from "./mcSock.js";

export var opt = JSON.parse(readFileSync("./option.json"));
if (!opt.modifyIp)
    opt.modifyIp = opt.remoteIP;

export function createCont(cliObj, clientId)
{
    var SerBuffer = new mcBuffer();
    var CliBuffer = new mcBuffer();
    var server = null;
    var client = new mcSocket(cliObj);
    var toServer = toServerF();
    var toClient = toClientF();
    var ret = {
        s: toServer,
        c: toClient,
        o: null,
        d: function()
        {
            toServer.return();
            toClient.return();
        }
    };
    function* toServerF()
    {
        var p_len = yield* CliBuffer.gVInt();
        var p_handshaking = yield* CliBuffer.getT("v v ls 2 v");
        //var p_len_2 = yield* CliBuffer.gVInt();
        //var p_handshaking_2 = yield* CliBuffer.getT("v");
        //p_handshaking[2] = "syuu.net\0FML\0";

        server = new mcSocket(ret.o = createConnection(opt.remotePort, opt.remoteIP, function ()
        {
            server.s.on("data", function (data)
            {
                console.log("[*]dataFS(" + clientId + "): ", data);
                toClient.next(data);
            });
            server.writeP("v v ls 2 v", p_handshaking);
            toServer.next();
            //server.writeP("v", [0]);
        }), true);

        server.s.on("error", function ()
        {
            console.log("[x]errFS: " + clientId);
            server.s.destroy();
            cliObj.destroy();
        });
        server.s.on("end", function ()
        {
            cliObj.destroy();
        });

        yield* CliBuffer.wait();
        server.s.write(yield* CliBuffer.readAllBytes());
        while (1)
            server.s.write(yield);
    }
    function* toClientF()
    {
        while (1)
            cliObj.write(yield);
    }
    toServer.next();
    toClient.next();
    return ret;
}