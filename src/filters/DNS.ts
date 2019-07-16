import * as dgram from "dgram";
import Config from "../Config";
import PacketUtils from "../PacketUtils";
import {
    UdpPacket,
    IpProtocol,
    EthernetType,
} from "../PacketsStruct";
import UdpPacketFormatter from "../formatters/UdpPacketFormatter";
import ConnectionManager, { ConnectionManagerInterface } from "../ConnectionManager";

interface UdpConnection extends ConnectionManagerInterface{
    ipversion: EthernetType;
    onFree?: () => void;
    udpClient: dgram.Socket;
    sourceAddress: Buffer;
    sourceIp: Buffer;
    sourcePort: number;
    targetAddress: Buffer;
    targetIp: Buffer;
    targetPort: number;
    identification: number;
}

const connections = new ConnectionManager<UdpConnection>();

function buildUdpPacket(connection: UdpConnection, data: Buffer): Buffer {
    connection.identification = PacketUtils.increaseNumber(connection.identification, 65536);
    return UdpPacketFormatter.build({
        type: connection.ipversion,
        version: connection.ipversion === EthernetType.IPv4 ? 4 : 6,
        sourceAddress: connection.targetAddress,
        destinaltionAddress: connection.sourceAddress,
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
        payload: data,
    });
}

export default function (data: Buffer, write: (data: Buffer) => void, next: () => void) {

    if (!PacketUtils.isIPv4(data)) {
        return next();
    }

    if (!PacketUtils.isUDP(data)) {
        return next();
    }

    if (!Config.get("SkipDNS")) {
        return next();
    }

    const udpPacket: UdpPacket = UdpPacketFormatter.format(data);

    if (udpPacket.destinationPort !== 53) {
        return next();
    }

    const connectionId: string = PacketUtils.getConnectionId(udpPacket);

    let connection: UdpConnection = connections.get(connectionId);

    if (connection === null) {
        let isClosed: boolean = false;
        connection = {
            ipversion: udpPacket.version === 4 ? EthernetType.IPv4 : EthernetType.IPv6,
            identification: 100,
            sourceAddress: udpPacket.sourceAddress,
            targetAddress: udpPacket.destinaltionAddress,
            sourceIp: udpPacket.destinationIp,
            targetIp: udpPacket.sourceIp,
            sourcePort: udpPacket.destinationPort,
            targetPort: udpPacket.sourcePort,
            udpClient: dgram.createSocket("udp4"),
            onFree() {
                if (isClosed) {
                    return;
                }
                isClosed = true;
                connection.udpClient.close();
            },
        };
        // tslint:disable-next-line:no-shadowed-variable
        connection.udpClient.on("message", (data) => {
            // tslint:disable-next-line:no-shadowed-variable
            const udpPacket: Buffer = buildUdpPacket(connection, data);
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

    connection.udpClient.send(udpPacket.payload, 53, Config.get("DNS"));
}

