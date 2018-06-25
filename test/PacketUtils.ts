
import {
    TcpPacket,
    UdpPacket,
} from "./PacketsStruct";


export default {

    calculatenIpv4NetMask: function (netmask: number): string {
        if (netmask === 32) {
            return "255.255.255.255";
        }
        let calculatenCounter = netmask;
        let result: number = 0;
        for (let i = 31; i > 0; i--) {
            if (calculatenCounter-- > 0) {
                result |= 1;
            }
            result = result << 1;
        }
        const buf = Buffer.allocUnsafe(4);
        buf.writeInt32BE(result, 0);
        return `${buf[0].toString(10)}.${buf[1].toString(10)}.${buf[2].toString(10)}.${buf[3].toString(10)}`;
    },

    isBroadCast: function (buffer: Buffer): boolean {
        for (let i = 0; i < 6; i++) {
            if (buffer[i] !== 0xff) {
                return false;
            }
        }
        return true;
    },

    isBroadCastForIpv6: function (buffer: Buffer): boolean {
        return (buffer[0] === 0x33 && buffer[1] === 0x33);
    },

    isARP: function (buffer: Buffer): boolean {
        return buffer[12] === 0x08 && buffer[13] === 0x06;
    },

    isIPv4: function (buffer: Buffer): boolean {
        return buffer[12] === 0x08 && buffer[13] === 0x00;
    },

    isIPv6: function (buffer: Buffer): boolean {
        return buffer[12] === 0x86 && buffer[13] === 0xdd;
    },

    isTCP: function (buffer: Buffer): boolean {
        return buffer[23] === 0x06;
    },

    isTCPForIpv6: function (buffer: Buffer): boolean {
        return buffer[20] === 0x06;
    },

    isUDP: function (buffer: Buffer): boolean {
        return buffer[23] === 0x11;
    },

    isUDPForIpv6: function (buffer: Buffer): boolean {
        return buffer[20] === 0x11;
    },

    isIGMP: function (buffer: Buffer): boolean {
        return buffer[23] === 0x02;
    },

    stringToIpv4: function (ip: string): Buffer {
        const nip = ip.split(".").map(function (item) {
            return parseInt(item, 10);
        });
        return Buffer.from(nip);
    },

    ipToString: function (buffer: Buffer) {
        return buffer.length === 4 ? this.ipv4ToString(buffer) : this.ipv6ToString(buffer);
    },

    ipv4ToString: function (buffer: Buffer) {
        return `${buffer[0].toString(10)}.${buffer[1].toString(10)}.${buffer[2].toString(10)}.${buffer[3].toString(10)}`;
    },

    ipv6ToString: function (buffer: Buffer): string {
        let str = "";
        buffer.forEach((byte, index) => {
            if (byte < 16) {
                str += "0";
            }
            str += byte.toString(16);
            if ((index + 1) % 2 === 0) {
                str += ":";
            }
        });
        return str.substring(0, str.length - 1);
    },

    increaseNumber: function (value: number, maximumValue: number): number {
        value++;
        if (value === maximumValue) {
            value = 0;
        }
        return value;
    },

    getConnectionId: function (packet: TcpPacket | UdpPacket): string {
        const sourceIp: string = packet.sourceIp.length === 4 ? this.ipv4ToString(packet.sourceIp) : this.ipv6ToString(packet.sourceIp);
        const destinationIp: string = packet.destinationIp.length === 4 ? this.ipv4ToString(packet.destinationIp) : this.ipv6ToString(packet.destinationIp);
        return `${sourceIp}:${packet.sourcePort}-${destinationIp}:${packet.destinationPort}`;
    },

};
