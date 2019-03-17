import {
    Ipv6Packet,
    Icmpv6Packet,
    IpProtocol,
} from "../PacketsStruct";

import BufferFormatter from "./BufferFormatter";
import IpPacketFormatter from "./IpPacketFormatter";

export default class Icmpv6Formatter extends IpPacketFormatter {

    public static build(obj: Icmpv6Packet): Buffer {

        const icmpv6Buffer = Buffer.allocUnsafe(24 + ((obj.options === null || obj.options === undefined) ? 0 : obj.options.length));
        const bufferFormatter = new BufferFormatter(icmpv6Buffer);

        bufferFormatter.writeByte(obj.icmpv6type);
        bufferFormatter.writeByte(obj.code);

        // for checksum
        bufferFormatter.writeUInt16BE(0);
        const checksumOffset: number = bufferFormatter.getOffset() - 2;

        bufferFormatter.writeBytes(obj.reserved);
        bufferFormatter.writeBytes(obj.targetAddress);

        if (icmpv6Buffer.length !== 24) {
            bufferFormatter.writeBytes(obj.options);
        }

        const checksumBuffer = Buffer.alloc(16 + 16 + 4 + 4);
        obj.sourceIp.copy(checksumBuffer, 0);
        obj.destinationIp.copy(checksumBuffer, 16);
        checksumBuffer.writeInt32BE(icmpv6Buffer.length, 32);
        checksumBuffer[checksumBuffer.length - 1] = 58;

        icmpv6Buffer.writeUInt16BE(super.checksum(Buffer.concat([checksumBuffer, icmpv6Buffer])), checksumOffset);

        obj.tcpipPayload = icmpv6Buffer;

        return super.build(obj);
    }

    public static format(bufs: Buffer): Icmpv6Packet {
        const ipPacket: Ipv6Packet = super.format(bufs);

        if (IpProtocol.ICMPv6 !== ipPacket.protocol) {
            throw new Error(`Unsupported protocol: ${ipPacket.protocol}`);
        }

        const bufferFormatter = new BufferFormatter(ipPacket.tcpipPayload);
        let packet: Icmpv6Packet = {
            icmpv6type: bufferFormatter.readByte(),
            code: bufferFormatter.readByte(),
            checksum: bufferFormatter.readUInt16BE(),
            reserved: bufferFormatter.readBuffer(4),
            targetAddress: bufferFormatter.readBuffer(16),
            options: null,
        };

        packet.options = bufferFormatter.readBuffer();
        packet = Object.assign(ipPacket, packet);
        return packet as Icmpv6Packet;
    }

}
