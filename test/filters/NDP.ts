import {
    IpProtocol,
    Icmpv6Packet,
} from "../PacketsStruct"
import * as raw from "raw-socket"
import PacketUtils from "../PacketUtils"
import DeviceConfiguration from "../DeviceConfiguration"
import IpacketFormatter from "../formatters/IpPacketFormatter"
import Icmpv6Formatter from "../formatters/Icmpv6Formatter"

export default function (data: Buffer, write: Function, next: Function) {
    if (!PacketUtils.isIPv6(data)) {
        return next();
    }

    let packet: Icmpv6Packet = null;

    try {
        packet = Icmpv6Formatter.format(data);
    } catch (error) {
        return next();
    }

    // NDP
    if (packet.icmpv6type !== 135) {
        return next();
    }

    if (PacketUtils.ipV6AddressToString(packet.sourceIp) !== "fd05:5dd5:b158:0b23:0000:0000:0000:0005") {
        return next();
    }

    if (PacketUtils.ipV6AddressToString(packet.targetAddress) !== "fd05:5dd5:b158:0b23:0000:0000:0000:0004") {
        return next();
    }

    const gatewayMac: Buffer = Buffer.allocUnsafe(6);
    DeviceConfiguration.GATEWAY_ADDRESS.split(":").forEach(function (item, index) {
        gatewayMac[index] = parseInt(`0x${item}`);
    });

    console.log(packet.sourceAddress, packet.destinaltionAddress);

    let responsePacket: Icmpv6Packet = { ...packet };
    responsePacket.sourceAddress = gatewayMac;
    responsePacket.destinaltionAddress = packet.options.slice(packet.options.length - 6);
    responsePacket.sourceIp = packet.targetAddress;
    responsePacket.destinationIp = packet.sourceIp;
    responsePacket.icmpv6type = 136;
    responsePacket.reserved = new Buffer([0x06, 0x00, 0x00, 0x00]);
    responsePacket.options = new Buffer([0x02, 0x01, ...responsePacket.destinaltionAddress]);

    const responseBuffer: Buffer = Icmpv6Formatter.build(responsePacket);

    write(responseBuffer);
}