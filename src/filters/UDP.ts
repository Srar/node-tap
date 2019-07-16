import Config from "../Config";
import PacketUtils from "../PacketUtils";
import {
    UdpPacket,
    IpProtocol,
    EthernetType,
} from "../PacketsStruct";
import UdpPacketFormatter from "../formatters/UdpPacketFormatter";
import ShadowsocksUdpClient from "../shadowsocks/ShadowsocksUdpClient";
import ConnectionManager, { ConnectionManagerInterface } from "../ConnectionManager";
import { ShadowsocksHeader, ShadowsocksHeaderVersion } from "../shadowsocks/ShadowsocksFormatter";

interface UdpConnection extends ConnectionManagerInterface {
    ipversion: EthernetType;
    onFree?: () => void;
    close?: () => void;
    udpClient: ShadowsocksUdpClient;
    sourceAddress: Buffer;
    sourceIp: Buffer;
    sourcePort: number;
    targetAddress: Buffer;
    identification: number;
}

const connections = new ConnectionManager<UdpConnection>();

function buildUdpPacket(connection: UdpConnection, data: Buffer, { srcIp, srcPort, dstIp, dstPort }): Buffer {
    connection.identification = PacketUtils.increaseNumber(connection.identification, 65536);
    return UdpPacketFormatter.build({
        type: connection.ipversion,
        version: connection.ipversion === EthernetType.IPv4 ? 4 : 6,
        sourceAddress: connection.targetAddress,
        destinaltionAddress: connection.sourceAddress,
        TTL: 64,
        protocol: IpProtocol.UDP,
        sourceIp: srcIp,
        destinationIp: dstIp,
        sourcePort: srcPort,
        destinationPort: dstPort,
        totalLength: 28 + data.length,
        identification: connection.identification,
        TOS: 0,
        flags: 0,
        payload: data,
    });
}

function buildUdpConnectionFromUdpPacket(udpPacket: UdpPacket): UdpConnection {
    let isClosed: boolean = false;
    const connection: UdpConnection = {
        ipversion: udpPacket.version === 4 ? EthernetType.IPv4 : EthernetType.IPv6,
        identification: 100,
        sourceAddress: udpPacket.sourceAddress,
        targetAddress: udpPacket.destinaltionAddress,
        sourceIp: udpPacket.sourceIp,
        sourcePort: udpPacket.sourcePort,
        udpClient: new ShadowsocksUdpClient(
            Config.get("ShadowsocksUdpHost"),
            Config.get("ShadowsocksUdpPort"),
            Config.get("ShadowsocksUdpPasswd"),
            Config.get("ShadowsocksUdpMethod"),
            udpPacket.version === 4,
            udpPacket.destinationIp,
            udpPacket.destinationPort,
        ),

        close() {
            if (isClosed) {
                return;
            }
            isClosed = true;
            connection.udpClient.close();
            connection.udpClient.removeAllListeners();
        },

        onFree() {
            connection.close();
        },
    };
    return connection;
}

export default function (data: Buffer, write: (data: Buffer) => void, next: () => void) {

    if (PacketUtils.isBroadCast(data)) {
        return next();
    }

    if (PacketUtils.isBroadCastForIpv6(data)) {
        return next();
    }

    if (PacketUtils.isIPv4(data)) {
        if (!PacketUtils.isUDP(data)) {
            return next();
        }
    } else if (PacketUtils.isIPv6(data)) {
        if (!PacketUtils.isUDPForIpv6(data)) {
            return next();
        }
    } else {
        return next();
    }

    /* unsupported large udp packet now. */
    if (data.length > 1410) {
        return;
    }

    const udpPacket: UdpPacket = UdpPacketFormatter.format(data);
    const connectionId: string =`${udpPacket.sourceIp}-${udpPacket.sourcePort}`;
    let connection: UdpConnection = connections.get(connectionId);

    if (connection === null) {
        connection = buildUdpConnectionFromUdpPacket(udpPacket);

        connection.udpClient.on("data", (shadowsocksData: ShadowsocksHeader) => {
            /* 更新连接存活时间 */
            connections.get(connectionId);

            const paddingSendPacket: Buffer = buildUdpPacket(
                connection,
                shadowsocksData.payload,
                { 
                    srcIp: PacketUtils.stringToIpv4(shadowsocksData.address as string), srcPort: shadowsocksData.port,
                    dstIp: connection.sourceIp, dstPort: connection.sourcePort,
                }
            );
            write(paddingSendPacket);
        });

        connection.udpClient.on("error", (err) => {
            connection.close();
            connections.remove(connectionId);
        });
        connections.add(connectionId, connection);
    }

    connection.udpClient.writeWithShadowsocksHeader(udpPacket.payload, {
        version: udpPacket.version === 4 ? ShadowsocksHeaderVersion.IPv4 : ShadowsocksHeaderVersion.IPv6,
        address: udpPacket.destinationIp,
        port: udpPacket.destinationPort,
    });
}



