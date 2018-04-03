import {
    BasePacket,
    IpPacket,
    TcpPacket,
    UdpPacket,
    Ipv6Packet,
} from "../PacketsStruct"
import PacketUtils from "../PacketUtils"

import BufferFormatter from "./BufferFormatter"
import IpPacketFormatter from "./IpPacketFormatter"

export default class UdpPacketFormatter extends IpPacketFormatter {

    static build(obj: UdpPacket): Buffer {
        var udpPacketBuffer = Buffer.allocUnsafe(8);
        var bufferFormatter = new BufferFormatter(udpPacketBuffer);
        bufferFormatter.writeUInt16BE(obj.sourcePort);
        bufferFormatter.writeUInt16BE(obj.destinationPort);
        bufferFormatter.writeUInt16BE(udpPacketBuffer.length + obj.payload.length);
        bufferFormatter.writeUInt16BE(0);
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

        obj.tcpipPayload = udpPacketBuffer;

        return super.build(obj);
    }

    static format(bufs: Buffer): UdpPacket {
        var ipPacket: IpPacket | Ipv6Packet = super.format(bufs);
        var bufferFormatter = new BufferFormatter(ipPacket.tcpipPayload);
        var packet: UdpPacket = {
            sourcePort: bufferFormatter.readUInt16BE(),
            destinationPort: bufferFormatter.readUInt16BE(),
            totalLength: bufferFormatter.readUInt16BE(),
            checksum: bufferFormatter.readUInt16BE(),
            payload: null,
        };
        packet.payload = bufferFormatter.readBuffer();
        packet = Object.assign(ipPacket, packet);
        return <UdpPacket>packet;
    }

}