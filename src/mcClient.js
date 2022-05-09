import { createConnection } from "net";
import { mcProt } from "./mcProt.js";
import { mcSocket } from "./mcSock.js";
import { option } from "./option.js";

var MOTD_cache = null;

export class mcClient
{
    /** @type {import("net").Socket} */
    client = null;
    sn = -1;
    /** @type {mcSocket} */
    CliSock = null;
    /** @type {mcSocket} */
    SerSock = null;
    /** @type {mcProt} */
    CliProt = null;
    /** @type {mcProt} */
    SerProt = null;
    toClientThr = false;
    toServerThr = false;

    meta = {};

    /**
     * @param {import("net").Socket} client
     * @param {number} sn
     */
    constructor(client, sn)
    {
        this.client = client;
        this.sn = sn;
    }

    async toServer()
    {
        var p_len = await this.CliProt.gVInt();
        var p_handshaking = await this.CliProt.getT("v v ls 2 v");
        if (option.CDKey_mod)
        {
            var o_ip = p_handshaking[2];
            var ind_ip = o_ip.indexOf(".");
            var CDK = o_ip.slice(0, ind_ip);
            if (!((/[0-9a-f]+/).test(CDK)))
                return;
            this.meta.CDK = CDK;
            this.meta.startTime = Date.now();
            this.meta.state = p_handshaking[4];
            if (this.meta.state == 2)
            {
                //if (userMap.has(CDK) && userMap.get(CDK) > 0)
                this.meta.user = true;
                //else
                //    return;
            }
        }

        this.SerSock = new mcSocket(createConnection(option.remotePort, option.remoteIP, () =>
        {
            console.log("[=]onCon: " + this.sn);
            this.meta.o.setNoDelay(true);
            if (option.modifyIp_HS)
            {
                let ind_ipSur = p_handshaking[2].indexOf("\0");
                let ipSuf = (ind_ipSur == -1 ? "" : p_handshaking[2].slice(ind_ipSur));
                p_handshaking[2] = option.modifyIp + ipSuf;
            }
            //console.log(p_handshaking[2]);
            if (p_handshaking[4] == 1 && option.modifyP_MOTD)
                nowModifyMOTD = true;
            this.SerSock.s.on("data", function (data)
            {
                //console.log("[*]dataFS(" + this.sn + "): ", data);
                if (this.toClientThr)
                    this.CliSock.s.write(data);
                else
                    toClient.next(data);
            });
            this.SerSock.writeP("v v ls 2 v", p_handshaking);
            toServer.next();
            //server.writeP("v", [0]);
        }));

        this.SerSock.s.on("error", () =>
        {
            console.log("[x]errFS: " + this.sn);
            this.SerSock.s.destroy();
            this.CliSock.s.destroy();
        });
        this.SerSock.s.on("end", function ()
        {
            this.CliSock.s.destroy();
        });

        await this.CliProt.wait();
        this.SerSock.s.write(await this.CliProt.readAllBytes());
        this.meta.so = this.SerSock.s;
        this.meta.thr = true;
        while (1)
            this.SerSock.s.write(await);
    }

    async toClient()
    {
        var len = await this.SerProt.gVInt();
        if (option.modifyIp_HS)
        {
            var pack = await this.SerProt.getT("v ls");
            if (!MOTD_cache)
            {
                MOTD_cache = JSON.parse(pack[1]);
            }
            MOTD_cache.description = option.modifyMOTD;
            var MOTD_Time = "";
            if (userMap.has(this.meta.CDK))
            {
                var user_time = userMap.get(this.meta.CDK);
                if (user_time > 0)
                    MOTD_Time = Math.floor(user_time / (60 * 60)) + "时" + (Math.floor(user_time / 60) % 60) + "分" + (user_time % 60) + "秒";
                else if (user_time <= 0)
                    MOTD_Time = "没有剩余时长啦";
            }
            else
                MOTD_Time = "已失效";
            MOTD_cache.description = MOTD_cache.description.replace("${time}", MOTD_Time);
            pack[1] = JSON.stringify(MOTD_cache);
            this.CliSock.writeP("v ls", pack);
        }
        else
        {
            var b = await this.SerProt.readBytes(len);
            // console.log("toC", b);
            // logUint8(b);
            this.CliSock.pushT("v", [len]);
            this.CliSock.sendA();
            this.CliSock.s.write(b);
        }
        this.toClientThr = true;
        while (1)
            this.CliSock.write(await);
    }
}