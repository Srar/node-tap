import Config from "../Config"
import * as dgram from "dgram"
import PacketUtils from "../PacketUtils"
import {
    BasePacket,
    IpPacket,
    UdpPacket,
    IpProtocol,
} from "../PacketsStruct"
import Ipip from "../Ipip"
import ConnectionManager from "../ConnectionManager"
import UdpPacketFormatter from "../formatters/UdpPacketFormatter"
import ShadowsocksUdpClient from "../shadowsocks/ShadowsocksUdpClient"

interface UdpConnection {
    onFree?: Function
    udpClient: ShadowsocksUdpClient,
    sourceAddress: Buffer,
    sourceIp: Buffer,
    sourcePort: number,
    targetAddress: Buffer,
    targetIp: Buffer,
    targetPort: number,
    identification: number
}

var connections = new ConnectionManager<UdpConnection>();

function buildUdpPacket(connection: UdpConnection, data: Buffer): Buffer {
    connection.identification = PacketUtils.increaseNumber(connection.identification, 65536);
    return UdpPacketFormatter.build({
        sourceAddress: connection.targetAddress,
        destinaltionAddress: connection.sourceAddress,
        version: 4,
        TTL: 64,
        protocol: IpProtocol.UDP,
        sourceIp: connection.sourceIp,
        destinationIp: connection.targetIp,
        sourcePort: connection.sourcePort,
        destinationPort: connection.targetPort,
        totalLength: 28 + data.length,
        identification: connection.identification,
        TOS: 0,
        flags: 0,
        payload: data
    });
}

export default function (data: Buffer, write: Function, next: Function) {

    if (PacketUtils.isBroadCast(data)) {
        return next();
    }

    if (!PacketUtils.isIPv4(data)) {
        return next();
    }

    if (!PacketUtils.isUDP(data)) {
        return next();
    }

    /* unsupported large udp packet now. */
    if (data.length > 1410) return;

    var udpPacket: UdpPacket = UdpPacketFormatter.format(data);

    var location: string = Ipip.find(PacketUtils.ipAddressToString(udpPacket.destinationIp))[0];
    if (location.length === 4 && location[0] === '保' && location[1] === '留' && location[2] === '地' && location[3] === '址') {
        return next();
    }

    var connectionId: string = PacketUtils.getConnectionId(udpPacket);

    var connection: UdpConnection = connections.get(connectionId);

    if (connection == null) {
        var isClosed: boolean = false;
        connection = {
            identification: 100,
            sourceAddress: udpPacket.sourceAddress,
            targetAddress: udpPacket.destinaltionAddress,
            sourceIp: udpPacket.destinationIp,
            targetIp: udpPacket.sourceIp,
            sourcePort: udpPacket.destinationPort,
            targetPort: udpPacket.sourcePort,
            udpClient: new ShadowsocksUdpClient(
                Config.get("ShadowsocksUdpHost"),
                Config.get("ShadowsocksUdpPort"),
                Config.get("ShadowsocksUdpPasswd"), 
                Config.get("ShadowsocksUdpMethod"),
                PacketUtils.isIPv4(data),
                udpPacket.destinationIp,
                udpPacket.destinationPort,
            ),
            onFree: function () {
                if (isClosed) return;
                isClosed = true;
                connection.udpClient.close();
            }
        };
        connection.udpClient.on("data", (data) => {
            var udpPacket: Buffer = buildUdpPacket(connection, data);
            connections.get(connectionId);
            write(udpPacket);
        });
        connection.udpClient.on("error", (err) => {
            isClosed = true;
            connection.udpClient.removeAllListeners();
            connections.remove(connectionId);
        });
        connections.add(connectionId, connection);
    }

    connection.udpClient.write(udpPacket.payload);
}



