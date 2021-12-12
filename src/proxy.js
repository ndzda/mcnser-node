import { readFileSync } from "fs";
import { mcBuffer } from "./mcProt.js";
import { createConnection } from "net";
import { mcSocket } from "./mcSock.js";
import { userMap } from "./userList.js";

export var opt = JSON.parse(readFileSync("./option.json"));
if (!opt.modifyIp)
    opt.modifyIp = opt.remoteIP;
var MOTD_cache = null;
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
        d: function ()
        {
            toServer.return();
            toClient.return();
        },
        CDK: "",
        startTime: 0,
        state: 0,
        user: false
    };
    var nowModifyMOTD = false;
    function* toServerF()
    {
        var p_len = yield* CliBuffer.gVInt();
        var p_handshaking = yield* CliBuffer.getT("v v ls 2 v");
        if (opt.CDKey_mod)
        {
            var o_ip = p_handshaking[2];
            var ind_ip = o_ip.indexOf(".");
            var CDK = o_ip.slice(0, ind_ip);
            if (!((/[0-9a-f]+/).test(CDK)))
                return;
            ret.CDK = CDK;
            ret.startTime = Date.now();
            ret.state = p_handshaking[4];
            if (ret.state == 2)
            {
                if (userMap.has(CDK) && userMap.get(CDK) > 0)
                    ret.user = true;
                else
                    return;
            }
        }

        server = new mcSocket(ret.o = createConnection(opt.remotePort, opt.remoteIP, function ()
        {
            console.log("[=]onCon: " + clientId);
            if (opt.modifyIp_HS)
            {
                let ind_ipSur = p_handshaking[2].indexOf("\0");
                let ipSuf = (ind_ipSur == -1 ? "" : p_handshaking[2].slice(ind_ipSur));
                p_handshaking[2] = opt.modifyIp + ipSuf;
            }
            //console.log(p_handshaking[2]);
            if (p_handshaking[4] == 1 && opt.modifyP_MOTD)
                nowModifyMOTD = true;
            server.s.on("data", function (data)
            {
                //console.log("[*]dataFS(" + clientId + "): ", data);
                toClient.next(data);
            });
            server.writeP("v v ls 2 v", p_handshaking);
            toServer.next();
            //server.writeP("v", [0]);
        }));

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
        var len = yield* SerBuffer.gVInt();
        if (nowModifyMOTD)
        {
            var pack = yield* SerBuffer.getT("v ls");
            if (!MOTD_cache)
            {
                MOTD_cache = JSON.parse(pack[1]);
            }
            MOTD_cache.description = opt.modifyMOTD;
            var MOTD_Time = "";
            if (userMap.has(ret.CDK))
            {
                var user_time = userMap.get(ret.CDK);
                if (user_time > 0)
                    MOTD_Time = Math.floor(user_time / 60) + "时" + (Math.floor(user_time / 60) % 60) + "分" + (user_time % 60) + "秒";
                else if (user_time <= 0)
                    MOTD_Time = "没有剩余时长啦";
            }
            else
                MOTD_Time = "已失效";
            MOTD_cache.description = MOTD_cache.description.replace("${time}", MOTD_Time);
            pack[1] = JSON.stringify(MOTD_cache);
            client.writeP("v ls", pack);
        }
        else
        {
            var b = yield* SerBuffer.readBytes(len);
            // console.log("toC", b);
            // logUint8(b);
            client.pushT("v", [len]);
            client.sendA();
            cliObj.write(b);
        }
        while (1)
            cliObj.write(yield);
    }
    toServer.next();
    toClient.next();
    return ret;
}