import {
    BasePacket,
    IpPacket,
    TcpPacket
} from "../PacketsStruct"

import BufferFormatter from "./BufferFormatter"
import IpPacketFormatter from "./IpPacketFormatter"

export default class TcpPacketFormatter extends IpPacketFormatter {

    static build(obj: TcpPacket): Buffer {
        if (obj.options == undefined) {
            obj.options = new Buffer(0);
        }
        if (obj.payload == undefined) {
            obj.payload = new Buffer(0);
        }
        var tcpPacketBuffer = Buffer.allocUnsafe(obj.tcpHeaderLength || (20 + obj.options.length));
        var bufferFormatter = new BufferFormatter(tcpPacketBuffer);
        bufferFormatter.writeUInt16BE(obj.sourcePort);
        bufferFormatter.writeUInt16BE(obj.destinationPort);
        bufferFormatter.writeUInt32BE(obj.sequenceNumber);
        bufferFormatter.writeUInt32BE(obj.acknowledgmentNumber);
        var lengtnAndflags: number = (tcpPacketBuffer.length / 4) << 12;
        if (obj.FIN === true) lengtnAndflags |= 0x0001;
        if (obj.SYN === true) lengtnAndflags |= 0x0002;
        if (obj.RST === true) lengtnAndflags |= 0x0004;
        if (obj.PSH === true) lengtnAndflags |= 0x0008;
        if (obj.ACK === true) lengtnAndflags |= 0x0010;
        if (obj.URG === true) lengtnAndflags |= 0x0020;
        if (obj.ECE === true) lengtnAndflags |= 0x0040;
        if (obj.CWR === true) lengtnAndflags |= 0x0080;
        if (obj.NS === true) lengtnAndflags |= 0x0100;
        bufferFormatter.writeUInt16BE(lengtnAndflags);
        bufferFormatter.writeUInt16BE(obj.window);
        // for computing checksum.
        bufferFormatter.writeUInt16BE(0);
        bufferFormatter.writeUInt16BE(obj.urgent || 0);
        bufferFormatter.writeBytes(obj.options);

        tcpPacketBuffer = Buffer.concat([tcpPacketBuffer, obj.payload]);

        var tcpPacketTotalLength = Buffer.allocUnsafe(2);
        tcpPacketTotalLength.writeUInt16BE(tcpPacketBuffer.length, 0);

        tcpPacketBuffer.writeUInt16BE(super.checksum(
            Buffer.concat([
                obj.sourceIp, obj.destinationIp,
                new Buffer([0x00, 0x06]), tcpPacketTotalLength,
                tcpPacketBuffer
            ])
        ), 16);

        obj.tcpipPayload = tcpPacketBuffer;

        return super.build(obj);
    }

    static format(bufs: Buffer): TcpPacket {
        var ipPacket: IpPacket = super.format(bufs);
        var bufferFormatter = new BufferFormatter(ipPacket.tcpipPayload);
        var packet = {
            sourcePort: bufferFormatter.readUInt16BE(),
            destinationPort: bufferFormatter.readUInt16BE(),
            sequenceNumber: bufferFormatter.readUInt32BE(),
            acknowledgmentNumber: bufferFormatter.readUInt32BE(),
            tcpHeaderLength: (bufferFormatter.readByte(false) >> 4) * 4,
            NS: (<number>bufferFormatter.readByte() & 0x01) != 0,
            FIN: (<number>bufferFormatter.readByte(false) & 0x01) != 0,
            SYN: (<number>bufferFormatter.readByte(false) & 0x02) != 0,
            RST: (<number>bufferFormatter.readByte(false) & 0x04) != 0,
            PSH: (<number>bufferFormatter.readByte(false) & 0x08) != 0,
            ACK: (<number>bufferFormatter.readByte(false) & 0x10) != 0,
            URG: (<number>bufferFormatter.readByte(false) & 0x20) != 0,
            ECE: (<number>bufferFormatter.readByte(false) & 0x40) != 0,
            CWR: (<number>bufferFormatter.readByte() & 0x80) != 0,
            window: bufferFormatter.readUInt16BE(),
            checksum: bufferFormatter.readUInt16BE(),
            urgent: bufferFormatter.readUInt16BE(),
            options: null,
            payload: null,
        };
        packet.options = bufferFormatter.readBuffer(packet.tcpHeaderLength - bufferFormatter.getOffset());
        packet.payload = bufferFormatter.readBuffer();

        packet = Object.assign(ipPacket, packet);
        return <TcpPacket>packet;
    }
}