import { createServer, createConnection } from 'net';
import { watch, readFileSync, writeFileSync } from 'fs';

const userMap = new Map();

var saveTime = 0;
function saveList()
{
    var ulObj = [];
    userMap.forEach((o, i) =>
    {
        if (cmpStr)
            ulObj.push([i, o.t, o.ip, o.cmpStr]);
        else if (o > 0)
            ulObj.push([i, o.t, o.ip]);
    });
    writeFileSync("./userList.json", JSON.stringify(ulObj), { encoding: "utf-8" });
}

function readList()
{
    var ulObj = JSON.parse(readFileSync("./userList.json", { encoding: "utf-8" }));
    if (Array.isArray(ulObj))
    {
        ulObj.forEach((o) =>
        {
            userMap.set(o[0], {
                t: o[1],
                ip: o[2],
                cmp: (o[3] ? new Function("response", o[3]) : null),
                cmpStr: o[3]
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

var clientCount = 0;
function createSer(callBack, port)
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

class mcBuffer
{
    b = null;
    p = 0;
    s = 0;
    constructor()
    {
    }
    *readByte()// 读一byte
    {
        if (this.p < this.s)
            return this.b[this.p++];
        else
        {
            this.s = (this.b = yield).length;
            this.p = 1;
            return this.b[0];
        }
    }
    *readBytes(len)
    {
        var ret = new Uint8Array(len);
        var p = 0;
        while (this.s - this.p < len)
        {
            ret.set(this.b.subarray(this.p), p);
            p += this.s - this.p;
            len -= this.s - this.p;
            // this.p = this.s;
            this.s = (this.b = yield).length;
            this.p = 0;
        }
        ret.set(this.b.subarray(this.p, this.p + len), p);
        this.p += len;
        return ret;
    }
    *readAllBytes()
    {
        if (this.p < this.s)
        {
            var offset = this.p;
            this.p = this.s;
            return this.b.subarray(offset);
        }
        else
        {
            this.p = this.s = (this.b = yield).length;
            return this.b;
        }
    }
    *wait()
    {
        var y = null;
        while (y = yield)
        {
            if (this.p < this.s)
            {
                var n = new Uint8Array(this.s = (this.s - this.p + y.length));
                n.set(this.b.subarray(this.p));
                n.set(y, this.p);
                this.p = 0;
            }
            else
            {
                this.s = (this.b = y).length;
                this.p = 0;
            }
        }
    }


    *gVInt()// 读入变长型整数
    {
        var b = 0;// 当前byte
        var i = 0;// 数值
        var len = 0;// 长度
        do
        {
            i |= ((b = yield* this.readByte()) & 127) << (7 * len);
            if ((++len) > 10)
                throw "VInt is too big!";
        } while (b & 128);
        return i;
    }

    *gShort()// 读两个byte作为short
    {
        var high_b = yield* this.readByte();
        return (high_b << 8) | (yield* this.readByte());
    }

    *gStr(len)// 读字符串
    {
        return (new TextDecoder("utf-8")).decode(yield* this.readBytes(len));
    }

    *getT(t)
    {
        var ret = [];
        var len = 0;
        for (var i = 0, Li = t.length; i < Li; i++)
            switch (t[i])
            {
                case " ":
                    break;
                case "v":
                    ret.push(yield* this.gVInt());
                    break;
                case "l":
                    len = yield* this.gVInt();
                    break;
                case "s":
                    ret.push(yield* this.gStr(len));
                    break;
                case "2":
                    ret.push(yield* this.gShort());
                    break;
            }
        return ret;
    }
}

class mcSocket
{
    s = null;
    a = [];
    l = 0;
    constructor(soc, debugMode)
    {
        this.s = soc;
        if (debugMode)
        {
            var sendFunc = soc.write;
            soc.write = function (data)
            {
                console.log("debug ", data);
                sendFunc.call(soc, data);
            };
        }
    }

    pByte(b)
    {
        this.l++;
        this.a.push(b);
    }
    pBuffer(b)
    {
        this.l += b.length;
        this.a.push(b);
    }
    getA()
    {
        var b = new Uint8Array(this.l);
        var p = 0;
        this.a.forEach(e =>
        {
            if (typeof (e) != "object")
                b[p++] = e;
            else
            {
                b.set(e, p);
                p += e.length;
            }
        });
        this.a.length = 0;
        this.l = 0;
        return b;
    }
    sendA()
    {
        this.s.write(this.getA());
    }

    pVInt(value)// 写入一个变长形int
    {
        do
        {
            var temp = value & 127;
            value >>>= 7;
            if (value != 0)
                temp |= 128;
            this.pByte(temp);
        } while (value != 0);
    }

    pStr(str, withLength)// 写入一个String(是否写入其长度)
    {
        var b = (new TextEncoder("utf-8")).encode(str);
        if (withLength)
            this.pVInt(b.length);
        this.pBuffer(b);
    }

    pShort(n)// 写入一个short整数
    {
        this.pByte(n >>> 8);
        this.pByte(n & 0xff);
    }

    pInt(n)// 写入一个int整数
    {
        this.pShort(n >>> 16);
        this.pShort(n & 0xffff);
    }

    pLong(n)// 写入一个long整数
    {
        this.pInt(n >>> 32);
        this.pInt(n & 0xffffffff);
    }

    pushT(t, v)
    {
        var num = 0;
        for (var i = 0, Li = t.length; i < Li; i++)
            switch (t[i])
            {
                case " ":
                    break;
                case "v":
                    this.pVInt(v[num++]);
                    break;
                case "s":
                    this.pStr(v[num], (i > 0 && t[i - 1] == "l"));
                    num++;
                    break;
                case "2":
                    this.pShort(v[num++]);
                    break;
                case "4":
                    this.pInt(v[num++]);
                    break;
                case "8":
                    this.pLong(v[num++]);
                    break;
            }
    }
    writeP(t, v)
    {
        this.pushT(t, v);
        var b = this.getA();
        this.pVInt(b.length);
        this.sendA();
        this.s.write(b);
    }
}

var opt = JSON.parse(readFileSync("./option.json"));
if (!opt.modifyIp)
    opt.modifyIp = opt.remoteIP;
var MOTD_cache = null;
function createCont(cliObj, clientId)
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
        thr: false,
        so: null,
        CDK: "",
        startTime: 0,
        state: 0,
        user: false
    };
    var toClientThr = false;
    var nowModifyMOTD = false;
    function* toServerF()
    {
        yield* CliBuffer.gVInt();
        var p_handshaking = yield* CliBuffer.getT("v v ls 2 v");
        yield* CliBuffer.gVInt();
        var p_login = yield* CliBuffer.getT("ls");
        var player_name = p_login[0];
        if (opt.CDKey_mod)
        {
            if (userMap.has(player_name) && userMap.get(player_name).cmp)
            {
                if (ret.state == 2)
                {
                    if (userMap.get(player_name).cmp(player_name))
                        ret.user = true;
                    else
                        return;
                }
            }
            else if (userMap.has(CDK) && !userMap.get(player_name).cmp)
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
                    if (userMap.get(CDK).t > 0)
                        ret.user = true;
                    else
                        return;
                }
            }
        }

        server = new mcSocket(ret.o = createConnection(opt.remotePort, opt.remoteIP, function ()
        {
            console.log("[=]onCon: " + clientId);
            ret.o.setNoDelay(true);
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
                if (toClientThr)
                    cliObj.write(data);
                else
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
        ret.so = server.s;
        ret.thr = true;
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
                var user_time = userMap.get(ret.CDK).t;
                if (user_time > 0)
                    MOTD_Time = Math.floor(user_time / (60 * 60)) + "时" + (Math.floor(user_time / 60) % 60) + "分" + (user_time % 60) + "秒";
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
        toClientThr = true;
        while (1)
            cliObj.write(yield);
    }
    toServer.next();
    toClient.next();
    return ret;
}

createSer(createCont, opt.port);
