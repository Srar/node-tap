
import {
    BasePacket,
    ArpPacket,
    IpPacket,
    TcpPacket,
    UdpPacket
} from "./PacketsStruct"

let privateIpAddressRangeCache: Array<Array<number>> = [];

export default {

    isPrivateIpAddress: function (ip: string | Buffer): boolean {
        if (privateIpAddressRangeCache.length == 0) {
            const privateIpAddress = [
                "10.0.0.0/8",
                "100.64.0.0/10",
                "127.0.0.0/8",
                "169.254.0.0/16",
                "172.16.0.0/12",
                "192.0.0.0/24",
                "192.0.2.0/24",
                "192.88.99.0/24",
                "192.168.0.0/16",
                "198.18.0.0/15",
                "198.51.100.0/24",
                "203.0.113.0/24",
                "224.0.0.0/4",
                "255.255.255.255/32"
            ];
            for (let ipRange of privateIpAddress) {
                const ip = ipRange.substring(0, ipRange.indexOf("/"));
                const ipArray = new Buffer(ip.split("."));
                if (ipArray.length !== 4) continue;
                const ipLong = ipArray.readInt32BE(0);
                const netmask = parseInt(ipRange.substring(ipRange.indexOf("/") + 1, ipRange.length));
                const range = 2 << (32 - netmask - 1);
                privateIpAddressRangeCache.push([ipLong, ipLong + range])
            }
        }

        let ipLong = -1;
        if (typeof ip === "string") {
            let ipBuffer = new Buffer(ip.split("."));
            let ipLong = ipBuffer.readInt32BE(0);
        } else {
            ipLong = ip.readInt32BE(0);
        }
        for (let item of privateIpAddressRangeCache) {
            let [start, end] = item;
            if (ipLong >= start && ipLong <= end) {
                return true;
            }
        }
        return false;
    },

    isBroadCast: function (bufs): boolean {
        for (var i = 0; i < 6; i++) {
            if (bufs[i] != 0xff) {
                return false;
            }
        }
        return true;
    },

    isARP: function (bufs): boolean {
        return bufs[12] == 0x08 && bufs[13] == 0x06
    },

    isIPv4: function (bufs): boolean {
        return bufs[12] === 0x08 && bufs[13] === 0x00;
    },

    isTCP: function (bufs): boolean {
        return bufs[23] === 0x06;
    },

    isUDP: function (bufs): boolean {
        return bufs[23] === 0x11;
    },

    isIGMP: function (bufs): boolean {
        return bufs[23] === 0x02;
    },

    stringToIpAddress: function (ip): Buffer {
        var nip = ip.split(".").map(function (item) {
            return parseInt(item);
        })
        return Buffer.from(nip);
    },

    ipAddressToString: function (bufs) {
        return `${bufs[0].toString(10)}.${bufs[1].toString(10)}.${bufs[2].toString(10)}.${bufs[3].toString(10)}`;
    },

    increaseNumber: function (value: number, maximumValue: number): number {
        value++;
        if (value == maximumValue) {
            value = 0;
        }
        return value;
    },

    getConnectionId: function (packet: TcpPacket | UdpPacket): string {
        var sourceIp: string = this.ipAddressToString(packet.sourceIp);
        var destinationIp: string = this.ipAddressToString(packet.destinationIp);
        return `${sourceIp}:${packet.sourcePort}-${destinationIp}:${packet.destinationPort}`;
    }
}