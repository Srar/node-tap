import {
    BasePacket,
    IpPacket,
    IpProtocol,
    EthernetType
} from "../PacketsStruct"
import BasePacketFormatter from "./BasePacketFormatter"

export default class IpPacketFormatter extends BasePacketFormatter {

    static build(obj: IpPacket): Buffer {
        // unsupport ipv6 address.
        var ipPacketBuffer: Buffer = Buffer.allocUnsafe(20);
        ipPacketBuffer[0] = (obj.version << 4) | (20 / 4);
        ipPacketBuffer[1] = obj.TOS;
        // set ip packet total length.
        ipPacketBuffer.writeUInt16BE(obj.totalLength, 2);
        try {
            ipPacketBuffer.writeUInt16BE(obj.identification, 4);
        } catch (error) {
            console.log(obj.identification);
        }
        ipPacketBuffer.writeUInt16BE(obj.identification, 4);
        // flags
        ipPacketBuffer[6] = 0x40;
        // fragOffset
        ipPacketBuffer[7] = 0x00
        // time to live.
        ipPacketBuffer[8] = obj.TTL;
        ipPacketBuffer[9] = obj.protocol;
        // for computing checksum.
        ipPacketBuffer.writeUInt16BE(0, 10);
        obj.sourceIp.copy(ipPacketBuffer, 12);
        obj.destinationIp.copy(ipPacketBuffer, 16);
        ipPacketBuffer.writeUInt16BE(IpPacketFormatter.checksum(ipPacketBuffer), 10);
        return Buffer.concat([
            super.build({
                sourceAddress: obj.sourceAddress,
                destinaltionAddress: obj.destinaltionAddress,
                type: EthernetType.IPv4
            }),
            ipPacketBuffer
        ]);
    }

    // from https://stackoverflow.com/questions/8269693/crc-checking-done-automatically-on-tcp-ip
    static checksum(bufs): number {
        var length: number = bufs.length;
        var i: number = 0;
        var sum: number = 0;
        var data: number;

        // Handle all pairs
        while (length > 1) {
            // Corrected to include @Andy's edits and various comments on Stack Overflow
            data = (((bufs[i] << 8) & 0xFF00) | ((bufs[i + 1]) & 0xFF));
            sum += data;
            // 1's complement carry bit correction in 16-bits (detecting sign extension)
            if ((sum & 0xFFFF0000) > 0) {
                sum = sum & 0xFFFF;
                sum += 1;
            }
            i += 2;
            length -= 2;
        }

        // Handle remaining byte in odd length buffers
        if (length > 0) {
            // Corrected to include @Andy's edits and various comments on Stack Overflow
            sum += (bufs[i] << 8 & 0xFF00);
            // 1's complement carry bit correction in 16-bits (detecting sign extension)
            if ((sum & 0xFFFF0000) > 0) {
                sum = sum & 0xFFFF;
                sum += 1;
            }
        }
        // Final 1's complement value correction to 16-bits
        sum = ~sum;
        sum = sum & 0xFFFF;
        return sum;
    }

    static format(bufs: Buffer): IpPacket {
        var basePacket: BasePacket = super.format(bufs);
        var flagsfrags: number = bufs.readUInt16BE(20);
        var packet = {
            version: bufs[14] >> 4,
            ipHeaderLength: bufs[14] & 0x0F,
            TOS: bufs[15],
            totalLength: bufs.readUInt16BE(16),
            identification: bufs.readUInt16BE(18),
            flags: flagsfrags >> 13,
            fragOffset: flagsfrags & 0x1FFF,
            TTL: bufs[22],
            protocol: <IpProtocol>bufs[23],
            checksum: bufs.readUInt16BE(24),
            sourceIp: bufs.slice(26, 30),
            destinationIp: bufs.slice(30, 34),
        }
        packet = Object.assign(basePacket, packet);
        return <IpPacket>packet;
    }
}