import {
    IpPacket,
    TcpPacket,
} from "../PacketsStruct";

import BufferFormatter from "./BufferFormatter";
import IpPacketFormatter from "./IpPacketFormatter";

export default class TcpPacketFormatter extends IpPacketFormatter {

    public static build(obj: TcpPacket): Buffer {
        if (obj.options === undefined) {
            obj.options = new Buffer(0);
        }
        if (obj.payload === undefined) {
            obj.payload = new Buffer(0);
        }
        let tcpPacketBuffer = Buffer.allocUnsafe(obj.tcpHeaderLength || (20 + obj.options.length));
        const bufferFormatter = new BufferFormatter(tcpPacketBuffer);
        bufferFormatter.writeUInt16BE(obj.sourcePort);
        bufferFormatter.writeUInt16BE(obj.destinationPort);
        bufferFormatter.writeUInt32BE(obj.sequenceNumber);
        bufferFormatter.writeUInt32BE(obj.acknowledgmentNumber);

        let lengtnAndflags: number = (tcpPacketBuffer.length / 4) << 12;
        if (obj.FIN) {
            lengtnAndflags |= 0x0001;
        }
        if (obj.SYN) {
            lengtnAndflags |= 0x0002;
        }
        if (obj.RST) {
            lengtnAndflags |= 0x0004;
        }
        if (obj.PSH) {
            lengtnAndflags |= 0x0008;
        }
        if (obj.ACK) {
            lengtnAndflags |= 0x0010;
        }
        if (obj.URG) {
            lengtnAndflags |= 0x0020;
        }
        if (obj.ECE) {
            lengtnAndflags |= 0x0040;
        }
        if (obj.CWR) {
            lengtnAndflags |= 0x0080;
        }
        if (obj.NS) {
            lengtnAndflags |= 0x0100;
        }
        bufferFormatter.writeUInt16BE(lengtnAndflags);

        bufferFormatter.writeUInt16BE(obj.window);
        // for computing checksum.
        bufferFormatter.writeUInt16BE(0);
        bufferFormatter.writeUInt16BE(obj.urgent || 0);
        bufferFormatter.writeBytes(obj.options);

        tcpPacketBuffer = Buffer.concat([tcpPacketBuffer, obj.payload]);

        const tcpPacketTotalLength = Buffer.allocUnsafe(2);
        tcpPacketTotalLength.writeUInt16BE(tcpPacketBuffer.length, 0);

        tcpPacketBuffer.writeUInt16BE(super.checksum(
            Buffer.concat([
                obj.sourceIp, obj.destinationIp,
                new Buffer([0x00, 0x06]), tcpPacketTotalLength,
                tcpPacketBuffer,
            ]),
        ), 16);

        obj.tcpipPayload = tcpPacketBuffer;

        return super.build(obj);
    }

    public static format(bufs: Buffer): TcpPacket {
        const ipPacket: IpPacket = super.format(bufs);
        const bufferFormatter = new BufferFormatter(ipPacket.tcpipPayload);
        let packet = {
            sourcePort: bufferFormatter.readUInt16BE(),
            destinationPort: bufferFormatter.readUInt16BE(),
            sequenceNumber: bufferFormatter.readUInt32BE(),
            acknowledgmentNumber: bufferFormatter.readUInt32BE(),
            tcpHeaderLength: (bufferFormatter.readByte(false) >> 4) * 4,
            NS: ((bufferFormatter.readByte() as number) & 0x01) !== 0,
            FIN: ((bufferFormatter.readByte(false) as number) & 0x01) !== 0,
            SYN: ((bufferFormatter.readByte(false) as number) & 0x02) !== 0,
            RST: ((bufferFormatter.readByte(false) as number) & 0x04) !== 0,
            PSH: ((bufferFormatter.readByte(false) as number) & 0x08) !== 0,
            ACK: ((bufferFormatter.readByte(false) as number) & 0x10) !== 0,
            URG: ((bufferFormatter.readByte(false) as number) & 0x20) !== 0,
            ECE: ((bufferFormatter.readByte(false) as number) & 0x40) !== 0,
            CWR: ((bufferFormatter.readByte() as number) & 0x80) !== 0,
            window: bufferFormatter.readUInt16BE(),
            checksum: bufferFormatter.readUInt16BE(),
            urgent: bufferFormatter.readUInt16BE(),
            options: null,
            payload: null,
        };
        packet.options = bufferFormatter.readBuffer(packet.tcpHeaderLength - bufferFormatter.getOffset());
        packet.payload = bufferFormatter.readBuffer();

        packet = Object.assign(ipPacket, packet);
        return packet as TcpPacket;
    }
}
