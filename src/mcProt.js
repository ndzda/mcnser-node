
export class mcBuffer
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
                default:
            }
        return ret;
    }
}