import {
    ArpPacket,
    EthernetType,
} from "../PacketsStruct";
import BasePacketFormatter from "./BasePacketFormatter";

export default class ArpPacketFormatte extends BasePacketFormatter {

    public static build(obj: ArpPacket) {
        return Buffer.concat([
            super.build({
                sourceAddress: obj.sourceAddress,
                destinaltionAddress: obj.targetMacAddress,
                type: EthernetType.ARP,
            }),
            obj.hardwareType,
            obj.protocolType,
            obj.hardwareSize,
            obj.protocalSize,
            obj.opCode,
            obj.senderMacAddress,
            obj.senderIpAdress,
            obj.targetMacAddress,
            obj.targetIpAddeess,
        ]);
    }

   public  static format(bufs: Buffer): ArpPacket {
        let packet = {
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
        return packet as ArpPacket;
    }
}
