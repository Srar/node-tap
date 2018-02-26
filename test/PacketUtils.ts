
import {
    BasePacket,
    ArpPacket,
    IpPacket
} from "./PacketsStruct"
import ArpPacketFormatter from "./formatters/ArpPacketFormatter"


export default {

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

    isIGMP: function (bufs): boolean {
        return bufs[23] === 0x02;
    },

    inetAddr: function (ip) {
        var nip = ip.split(".").map(function (item) {
            return parseInt(item);
        })
        var bufs = Buffer.from(nip);
        return bufs.readUInt32LE(0);
    },

    inetNtoa: function (number) {
        var bufs = new Buffer(4);
        bufs.writeUInt32BE(number, 0);
        return `${bufs[3].toString(10)}.${bufs[2].toString(10)}.${bufs[1].toString(10)}.${bufs[0].toString(10)}`;
    },

    formatIpPacket: function(bufs: Buffer): IpPacket {
        var basePacket: BasePacket = this.formatBasePacket(bufs);
        var packet = {
            
        }
        packet = Object.assign(basePacket, packet);
        return <IpPacket>packet;
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
}