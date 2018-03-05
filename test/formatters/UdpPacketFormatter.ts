import {
    BasePacket,
    IpPacket,
    TcpPacket,
    UdpPacket,
} from "../PacketsStruct"
import PacketUtils from "../PacketUtils"

import IpPacketFormatter from "./IpPacketFormatter"

export default class UdpPacketFormatter extends IpPacketFormatter {

    static build(obj: UdpPacket): Buffer {
        var udpPacketBuffer = Buffer.allocUnsafe(8);
        udpPacketBuffer.writeUInt16BE(obj.sourcePort, 0);
        udpPacketBuffer.writeUInt16BE(obj.destinationPort, 2);
        udpPacketBuffer.writeUInt16BE(udpPacketBuffer.length + obj.payload.length, 4);
        udpPacketBuffer.writeUInt16BE(0, 6);
        udpPacketBuffer = Buffer.concat([udpPacketBuffer, obj.payload]);

        var udpPacketTotalLength = Buffer.allocUnsafe(2);
        udpPacketTotalLength.writeUInt16BE(udpPacketBuffer.length, 0);

        udpPacketBuffer.writeUInt16BE(super.checksum(
            Buffer.concat([
                obj.sourceIp, obj.destinationIp,
                new Buffer([0x00, obj.protocol]),
                udpPacketTotalLength,
                udpPacketBuffer
            ])
        ), 6);

        return Buffer.concat([
            super.build(obj),
            udpPacketBuffer
        ]);
    }

    static format(bufs: Buffer): UdpPacket {
        var ipPacket: IpPacket = super.format(bufs);
        var startOffset: number = 14 + ipPacket.ipHeaderLength * 4;
        var packet: UdpPacket = {
            sourcePort: bufs.readUInt16BE(startOffset),
            destinationPort: bufs.readUInt16BE(startOffset + 2),
            totalLength: bufs.readUInt16BE(startOffset + 4),
            checksum: bufs.readUInt16BE(startOffset + 6),
            payload: null,
        };
        packet.payload = bufs.slice(startOffset + 8);

        packet = Object.assign(ipPacket, packet);
        return <UdpPacket>packet;
    }

}