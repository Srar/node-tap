import {
    BasePacket,
    IpPacket,
    TcpPacket
} from "../PacketsStruct"

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
        tcpPacketBuffer.writeUInt16BE(obj.sourcePort, 0);
        tcpPacketBuffer.writeUInt16BE(obj.destinationPort, 2);
        tcpPacketBuffer.writeUInt32BE(obj.sequenceNumber, 4);
        tcpPacketBuffer.writeUInt32BE(obj.acknowledgmentNumber, 8);
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
        tcpPacketBuffer.writeUInt16BE(lengtnAndflags, 12);
        tcpPacketBuffer.writeUInt16BE(obj.window, 14);
        // for computing checksum.
        tcpPacketBuffer.writeUInt16BE(0, 16);
        tcpPacketBuffer.writeUInt16BE(obj.urgent || 0, 18);

        for (let i = 20, j = 0; j < obj.options.length; i++ , j++) {
            tcpPacketBuffer[i] = obj.options[j];
        }

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

        return Buffer.concat([
            super.build(obj),
            tcpPacketBuffer
        ]);
    }

    static format(bufs: Buffer): TcpPacket {
        var ipPacket: IpPacket = super.format(bufs);
        var startOffset: number = 14 + ipPacket.ipHeaderLength * 4;
        var packet = {
            sourcePort: bufs.readUInt16BE(startOffset),
            destinationPort: bufs.readUInt16BE(startOffset + 2),
            sequenceNumber: bufs.readUInt32BE(startOffset + 4),
            acknowledgmentNumber: bufs.readUInt32BE(startOffset + 8),
            tcpHeaderLength: (bufs[startOffset + 12] >> 4) * 4,
            NS: (<number>bufs[startOffset + 12] & 0x01) != 0,
            FIN: (<number>bufs[startOffset + 13] & 0x01) != 0,
            SYN: (<number>bufs[startOffset + 13] & 0x02) != 0,
            RST: (<number>bufs[startOffset + 13] & 0x04) != 0,
            PSH: (<number>bufs[startOffset + 13] & 0x08) != 0,
            ACK: (<number>bufs[startOffset + 13] & 0x10) != 0,
            URG: (<number>bufs[startOffset + 13] & 0x20) != 0,
            ECE: (<number>bufs[startOffset + 13] & 0x40) != 0,
            CWR: (<number>bufs[startOffset + 13] & 0x80) != 0,
            window: bufs.readUInt16BE(startOffset + 14),
            checksum: bufs.readUInt16BE(startOffset + 16),
            urgent: bufs.readUInt16BE(startOffset + 18),
            options: null,
            payload: null,
        };
        packet.options = bufs.slice(startOffset + 20, startOffset + packet.tcpHeaderLength);
        packet.payload = bufs.slice(startOffset + packet.tcpHeaderLength);

        packet = Object.assign(ipPacket, packet);
        return <TcpPacket>packet;
    }
}