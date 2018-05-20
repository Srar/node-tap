import {
    BasePacket,
    IpPacket,
    IpProtocol,
    Ipv6Packet,
    EthernetType
} from "../PacketsStruct"
import BufferFormatter from "./BufferFormatter"
import BasePacketFormatter from "./BasePacketFormatter"

export default class IpPacketFormatter extends BasePacketFormatter {

    static build(obj: IpPacket | Ipv6Packet): Buffer {

        if (obj.type == undefined || obj.type == null || obj.type == EthernetType.IPv4) {
            const ipv4obj: IpPacket = obj;
            const ipPacketBuffer: Buffer = Buffer.allocUnsafe(20);
            const bufferFormatter = new BufferFormatter(ipPacketBuffer);
            bufferFormatter.writeByte((ipv4obj.version << 4) | (20 / 4));
            bufferFormatter.writeByte(ipv4obj.TOS);
            // set ip packet total length.
            bufferFormatter.writeUInt16BE(ipv4obj.totalLength);
            bufferFormatter.writeUInt16BE(ipv4obj.identification);
            // flags
            bufferFormatter.writeByte(0x40);
            // fragOffset
            bufferFormatter.writeByte(0x00);
            // ttl
            bufferFormatter.writeByte(ipv4obj.TTL);
            // protocol
            bufferFormatter.writeByte(ipv4obj.protocol);
            // checksum
            bufferFormatter.writeUInt16BE(0);
            bufferFormatter.writeBytes(ipv4obj.sourceIp);
            bufferFormatter.writeBytes(ipv4obj.destinationIp);
            ipPacketBuffer.writeUInt16BE(IpPacketFormatter.checksum(ipPacketBuffer), 10);

            let concatArray = [
                super.build({
                    sourceAddress: ipv4obj.sourceAddress,
                    destinaltionAddress: ipv4obj.destinaltionAddress,
                    type: EthernetType.IPv4
                }),
                ipPacketBuffer
            ];

            if (ipv4obj.tcpipPayload) {
                concatArray.push(ipv4obj.tcpipPayload);
            }
            return Buffer.concat(concatArray);
        } else if (obj.type == EthernetType.IPv6) {
            const ipv6obj: Ipv6Packet = obj;
            const ipPacketBuffer: Buffer = Buffer.allocUnsafe(40);
            const bufferFormatter = new BufferFormatter(ipPacketBuffer);
            if (ipv6obj.flow == undefined) {
                ipv6obj.flow = 0;
                ipv6obj.flow |= 0x60000000;
            }
            bufferFormatter.writeUInt32BE(ipv6obj.flow);
            bufferFormatter.writeUInt16BE(ipv6obj.tcpipPayload.length);
            bufferFormatter.writeByte(ipv6obj.protocol);
            bufferFormatter.writeByte(ipv6obj.hopLimit || 0xff);
            bufferFormatter.writeBytes(ipv6obj.sourceIp);
            bufferFormatter.writeBytes(ipv6obj.destinationIp);
            let concatArray = [
                super.build({
                    sourceAddress: ipv6obj.sourceAddress,
                    destinaltionAddress: ipv6obj.destinaltionAddress,
                    type: EthernetType.IPv6
                }),
                ipPacketBuffer
            ];

            if (ipv6obj.tcpipPayload) {
                concatArray.push(ipv6obj.tcpipPayload);
            }
            return Buffer.concat(concatArray);
        } else {
            throw new TypeError("Unsupport ethernet type.");
        }
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

    static format(buffer: Buffer): IpPacket | Ipv6Packet {
        let basePacket: BasePacket = super.format(buffer);
        let bufferFormatter = new BufferFormatter(buffer);
        bufferFormatter.setOffset(14);
        if (basePacket.type == EthernetType.IPv4) {
            let packet = {
                version: bufferFormatter.readByte(false) >> 4,
                ipHeaderLength: bufferFormatter.readByte() & 0x0F,
                TOS: bufferFormatter.readByte(),
                totalLength: bufferFormatter.readUInt16BE(),
                identification: bufferFormatter.readUInt16BE(),
                flags: bufferFormatter.readUInt16BE(false) >> 13,
                fragOffset: bufferFormatter.readUInt16BE() & 0x1FFF,
                TTL: bufferFormatter.readByte(),
                protocol: <IpProtocol>bufferFormatter.readByte(),
                checksum: bufferFormatter.readUInt16BE(),
                sourceIp: bufferFormatter.readBuffer(4),
                destinationIp: bufferFormatter.readBuffer(4),
                tcpipPayload: null,
            }
            packet.tcpipPayload = bufferFormatter.readBuffer();
            packet = Object.assign(basePacket, packet);
            return <IpPacket>packet;
        } else if (basePacket.type == EthernetType.IPv6) {
            let packet: Ipv6Packet = {};
            packet.version = bufferFormatter.readUInt32BE(false) >> 28,
            packet.flow = bufferFormatter.readUInt32BE();
            packet.payloadLength = bufferFormatter.readUInt16BE();
            packet.protocol = bufferFormatter.readByte();
            packet.hopLimit = bufferFormatter.readByte();
            packet.sourceIp = bufferFormatter.readBuffer(16);
            packet.destinationIp = bufferFormatter.readBuffer(16);
            packet.tcpipPayload = bufferFormatter.readBuffer();
            packet = Object.assign(basePacket, packet);
            return <IpPacket>packet;
        } else {
            throw new TypeError(`Unsupported ethernet type: ${basePacket.type}`);
        }
    }
}