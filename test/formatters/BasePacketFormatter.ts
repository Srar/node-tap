import {
    BasePacket,
    EthernetType,
} from "../PacketsStruct";

export default class BasePacketFormatter {

    public static build(obj: BasePacket) {
        const typeBuffer = Buffer.alloc(2);
        if (obj.type === undefined) {
            obj.type = EthernetType.IPv4;
        }
        switch (obj.type) {
            case EthernetType.IPv4:
                typeBuffer[0] = 0x08;
                break;
            case EthernetType.ARP:
                typeBuffer[0] = 0x08;
                typeBuffer[1] = 0x06;
                break;
            case EthernetType.IPv6:
                typeBuffer[0] = 0x86;
                typeBuffer[1] = 0xDD;
                break;
        }

        return Buffer.concat([
            obj.destinaltionAddress,
            obj.sourceAddress,
            typeBuffer,
        ], 14);
    }

    public static format(bufs: Buffer): BasePacket {
        let ethernetType: EthernetType = EthernetType.IPv4;
        if (bufs[12] === 0x08 && bufs[13] === 0x06) {
            ethernetType = EthernetType.ARP;
        }
        if (bufs[12] === 0x86 && bufs[13] === 0xDD) {
            ethernetType = EthernetType.IPv6;
        }
        return {
            sourceAddress: bufs.slice(0, 6),
            destinaltionAddress: bufs.slice(6, 12),
            type: ethernetType,
        };
    }
}
