import * as ip6 from "ip6"

function stringToIpv4Buffer(ip: string): Buffer {
    var nip = ip.split(".").map(function (item) {
        return parseInt(item);
    })
    return Buffer.from(nip);
};

function stringToIpv6Buffer(ip: string): Buffer {
    var ipv6string = ip6.normalize(ip);
    var buffer = Buffer.allocUnsafe(16);
    var offset = 0;
    ipv6string.split(":").forEach(item => {
        var num = parseInt(`0x${item}`);
        buffer.writeUInt16BE(num, offset);
        offset = offset + 2;
    });
    return buffer;
}

function ipv4BufferToString(ip: Buffer): string {
    return `${ip[0].toString(10)}.${ip[1].toString(10)}.${ip[2].toString(10)}.${ip[3].toString(10)}`;
}

function ipv6BufferToString(ip: Buffer): string {
    var ipstring = "";
    for(var i = 0; i < 16; i++) {
        var byte = ip[i];
        if(byte < 16) ipstring += "0";
        ipstring += byte.toString(16);
        if((i + 1) % 2 == 0) ipstring += ":";
    }
    ipstring = ipstring.slice(0, ipstring.length - 1);
    return ipstring;
}

export default class ShadowsocksFormatter {

    public static build(header: ShadowsocksHeader): Buffer {
        var buffer: Buffer = null;
        var ipBuffer: Buffer = null;

        switch (header.version) {
            case ShadowsocksHeaderVersion.IPv4:
                /* VER(1 byte) + IPv4(4) + Port(2) */
                buffer = Buffer.allocUnsafe(7);
                if (typeof header.address == "string") {
                    ipBuffer = stringToIpv4Buffer(header.address);
                } else {
                    ipBuffer = header.address;
                }
                buffer[0] = ShadowsocksHeaderVersion.IPv4;
                break;
            case ShadowsocksHeaderVersion.IPv6:
                /* VER(1 byte) + IPv6(16) + Port(2) */
                buffer = Buffer.allocUnsafe(19);
                if (typeof header.address == "string") {
                    ipBuffer = stringToIpv6Buffer(header.address);
                } else {
                    ipBuffer = header.address;
                }
                buffer[0] = ShadowsocksHeaderVersion.IPv6;
                break;
            case ShadowsocksHeaderVersion.Domain:
                /* VER(1 byte) + Domain length(1) + Domain + Port(2) */
                buffer = Buffer.allocUnsafe(4 + header.address.length);
                if (typeof header.address == "string") {
                    ipBuffer = Buffer.from(header.address);
                } else {
                    ipBuffer = header.address;
                }
                ipBuffer = Buffer.concat([new Buffer([ipBuffer.length]), ipBuffer]);
                buffer[0] = ShadowsocksHeaderVersion.Domain;
                break;
            default:
                throw new TypeError("Unknow Shadowsocks request version.");
                break;
        }

        for (let i = 0; i < ipBuffer.length; i++) {
            buffer[i + (header.version == ShadowsocksHeaderVersion.Domain ? 2 : 1)] = ipBuffer[i];
        }
        buffer[buffer.length - 2] = ((header.port >> 8) & 0xff);
        buffer[buffer.length - 1] = (header.port & 0xff);

        if (header.payload) {
            buffer = Buffer.concat([buffer, header.payload]);
        }

        return buffer;
    }

    public static format(buffer: Buffer): ShadowsocksHeader {
        var header: ShadowsocksHeader = {
            version: <any>buffer[0],
            address: "",
            port: 0,
            payload: null,
        }
        var addressLength = 0;
        switch (header.version) {
            case ShadowsocksHeaderVersion.IPv4:
                /* VER(1 byte) + IPv4(4) + Port(2) */
                addressLength = 4;
                header.address = ipv4BufferToString(buffer.slice(1));
                break;
            case ShadowsocksHeaderVersion.IPv6:
                /* VER(1 byte) + IPv6(16) + Port(2) */
                addressLength = 16;
                header.address = ipv6BufferToString(buffer.slice(1));
                break;
            case ShadowsocksHeaderVersion.Domain:
                /* VER(1 byte) + Domain length(1) + Domain + Port(2) */
                addressLength = buffer[1];
                header.address = buffer.slice(2, 2 + addressLength).toString();
                break;
            default:
                throw new TypeError("Unknow Shadowsocks request version.");
                break;
        }
        header.port = ((buffer[addressLength + 1] << 8) + buffer[addressLength + 2]);
        header.payload = buffer.slice(3 + addressLength);
        return header;
    }

}


export interface ShadowsocksHeader {
    version: ShadowsocksHeaderVersion,
    address: string | Buffer,
    port: number,
    payload?: Buffer
}

export enum ShadowsocksHeaderVersion {
    IPv4 = 0x01,
    IPv6 = 0x04,
    Domain = 0x03
}