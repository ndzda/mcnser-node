export class mcSocket
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
                default:
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