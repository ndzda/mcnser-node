export function logUint8(b)
{
    var s = "";
    for (var i = 0, Li = b.length; i < Li; i++)
        s += b[i] + " ";
    console.log("uint8", s);
}