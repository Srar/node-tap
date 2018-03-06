var fs = require('fs');
var dns = require('dns');

export default class Ipip {

    private static ipDatabse: Buffer = null;

    public static load(filePath: string) {
        Ipip.ipDatabse = fs.readFileSync(filePath);
    }

    public static find(ip: string): Array<string> {
        if (Ipip.ipDatabse == null) {
            return null;
        }
        var ipArray = ip.trim().split('.'),
            ip2long = function (ip) { return new Buffer(ip.trim().split('.')).readInt32BE(0) },
            ipInt = ip2long(ip);

        var offset = Ipip.ipDatabse.readInt32BE(0);
        var indexBuffer = Ipip.ipDatabse.slice(4, offset - 4 + 4);
        var tmp_offset = <any>ipArray[0] * 4, max_comp_len = offset - 1028, index_offset = -1, index_length = -1, start = indexBuffer.slice(tmp_offset, tmp_offset + 4).readInt32LE(0);
        for (start = start * 8 + 1024; start < max_comp_len; start += 8) {
            if (indexBuffer.slice(start, start + 4).readInt32BE(0) >= ipInt) {
                index_offset = ((indexBuffer[start + 6] << 16) + (indexBuffer[start + 5] << 8) + indexBuffer[start + 4]);
                index_length = indexBuffer[start + 7];
                break;
            }
        }
        if (index_offset == -1 || index_length == -1) {
            return null;
        } else {
            return Ipip.ipDatabse.slice(offset + index_offset - 1024, offset + index_offset - 1024 + index_length).toString('utf-8').split("\t");
        }
    }

}