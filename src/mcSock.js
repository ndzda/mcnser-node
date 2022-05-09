export class mcSocket
{
    /** @type {import("net").Socket} */
    s = null;
    a = [];
    l = 0;
    /**
     * @param {import("net").Socket} soc
     * @param {boolean} [debugMode]
     */
    constructor(soc, debugMode)
    {
        this.s = soc;
        if (debugMode)
        {
            var sendFunc = soc.write;
            // @ts-ignore
            soc.write = function (data)
            {
                console.log("debug ", data);
                sendFunc.call(soc, data);
            };
        }
    }

    /** 压入一字节数据 */
    pByte(b)
    {
        this.l++;
        this.a.push(b);
    }
    /** 压入一段数据 */
    pBuffer(b)
    {
        this.l += b.length;
        this.a.push(b);
    }
    /** 获取所有缓存的包 */
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
    /** 发送所有缓存的包 */
    sendA()
    {
        this.s.write(this.getA());
    }

    pVInt(value)// 压入一个变长形int
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

    pStr(str, withLength)// 压入一个String(是否写入其长度)
    {
        var b = (new TextEncoder()).encode(str);
        if (withLength)
            this.pVInt(b.length);
        this.pBuffer(b);
    }

    pShort(n)// 压入一个short整数
    {
        this.pByte(n >>> 8);
        this.pByte(n & 0xff);
    }

    pInt(n)// 压入一个int整数
    {
        this.pShort(n >>> 16);
        this.pShort(n & 0xffff);
    }

    pLong(n)// 压入一个long整数
    {
        this.pInt(n >>> 32);
        this.pInt(n & 0xffffffff);
    }

    /** 压包 */
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
                default:
            }
    }
    /** 发包 */
    writeP(t, v)
    {
        this.pushT(t, v);
        var b = this.getA();
        this.pVInt(b.length);
        this.sendA();
        this.s.write(b);
    }
}