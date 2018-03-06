import PacketUtils from "../PacketUtils"
import {
    BasePacket,
    IpPacket,
    TcpPacket,
    IpProtocol,
    ArpPacket
} from "../PacketsStruct"
import ArpPacketFormatter from "../formatters/ArpPacketFormatter"
import DeviceConfiguration from "../DeviceConfiguration"


export default function (data: Buffer, write: Function, next: Function) {
    if (!PacketUtils.isARP(data)) {
        return next();
    }

    var arpPacket = ArpPacketFormatter.format(<Buffer>data);

    if (PacketUtils.ipAddressToString(arpPacket.senderIpAdress) != DeviceConfiguration.LOCAL_IP_ADDRESS)
        return;

    if (PacketUtils.ipAddressToString(arpPacket.targetIpAddeess) != DeviceConfiguration.GATEWAY_IP_ADDRESS)
        return;

    var gatewayMac: Buffer = Buffer.allocUnsafe(6);
    DeviceConfiguration.GATEWAY_ADDRESS.split(":").forEach(function (item, index) {
        gatewayMac[index] = parseInt(`0x${item}`);
    });

    var responsePacket: Buffer = ArpPacketFormatter.build({
        sourceAddress: gatewayMac,
        destinaltionAddress: arpPacket.destinaltionAddress,
        /* 1 */
        hardwareType: new Buffer([0x00, 0x01]),
        /* ipv4 0x0800 */
        protocolType: new Buffer([0x08, 0x00]),
        /* 6 */
        hardwareSize: new Buffer([0x06]),
        /* 4 */
        protocalSize: new Buffer([0x04]),
        /* reply */
        opCode: new Buffer([0x00, 0x02]),
        senderMacAddress: gatewayMac,
        senderIpAdress: PacketUtils.stringToIpAddress(DeviceConfiguration.GATEWAY_IP_ADDRESS),
        targetMacAddress: arpPacket.destinaltionAddress,
        targetIpAddeess: PacketUtils.stringToIpAddress(DeviceConfiguration.LOCAL_IP_ADDRESS),
    });

    write(responsePacket);
}