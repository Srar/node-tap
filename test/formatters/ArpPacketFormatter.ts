import {
    BasePacket,
    ArpPacket,
    EthernetType,
} from "../PacketsStruct"
import BasePacketFormatter from "./BasePacketFormatter"

export default class ArpPacketFormatter {

    static build(targetMac: Buffer, srcMac: Buffer, srcIp: Buffer, tarMac: Buffer, tarIp: Buffer): Buffer {
        return Buffer.concat([
            BasePacketFormatter.build({
                sourceAddress: srcMac,
                destinaltionAddress: targetMac,
                type: EthernetType.ARP
            }),
            new Buffer([0x00, 0x01]),
            new Buffer([0x08, 0x00]),
            new Buffer([0x06, 0x04]),
            new Buffer([0x00, 0x02]),
            srcMac,
            srcIp,
            tarMac,
            tarIp,
        ]);
    }
    
    static format(bufs: Buffer): ArpPacket {
        var packet = {
            hardwareType: bufs.slice(14, 16),
            protocolType: bufs.slice(16, 18),
            hardwareSize: bufs.slice(18, 19),
            protocalSize: bufs.slice(19, 20),
            opCode: bufs.slice(20, 22),
            senderMacAddress: bufs.slice(22, 28),
            senderIpAdress: bufs.slice(28, 32),
            targetMacAddress: bufs.slice(32, 38),
            targetIpAddeess: bufs.slice(38, 42),
        };
        packet = Object.assign(BasePacketFormatter.format(bufs), packet);
        return <ArpPacket>packet;
    }
}