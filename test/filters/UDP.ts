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
import DeviceConfiguration from "../DeviceConfiguration"
import RC4MD5 from "../shadowsocks/crypto/RC4MD5";

interface UdpConnection {
    crypto?: any,
    onFree?: Function
    udpClient: dgram.Socket,
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
        var udpClient = dgram.createSocket("udp4");
        connection = {
            identification: 100,
            sourceAddress: udpPacket.sourceAddress,
            targetAddress: udpPacket.destinaltionAddress,
            sourceIp: udpPacket.destinationIp,
            targetIp: udpPacket.sourceIp,
            sourcePort: udpPacket.destinationPort,
            targetPort: udpPacket.sourcePort,
            crypto: new RC4MD5(Config.get("ShadowsocksUdpPasswd")),
            udpClient: udpClient,
            onFree: function () {
                if (isClosed) return;
                isClosed = true;
                udpClient.close();
            }
        };
        udpClient.on("message", (data) => {
            data = connection.crypto.decryptDataWithoutStream(data)
            var udpPacket: Buffer = buildUdpPacket(connection, data.slice(7));
            connections.get(connectionId);
            write(udpPacket);
        });
        udpClient.once("close", () => {
            isClosed = true;
            udpClient.removeAllListeners();
            connections.remove(connectionId);
        })
        connections.add(connectionId, connection);
    }

    var header = Buffer.allocUnsafe(7);
    header[0] = 0x01;
    header[1] = udpPacket.destinationIp[0];
    header[2] = udpPacket.destinationIp[1];
    header[3] = udpPacket.destinationIp[2];
    header[4] = udpPacket.destinationIp[3];
    header[5] = ((udpPacket.destinationPort >> 8) & 0xff);
    header[6] = (udpPacket.destinationPort & 0xff);

    var bufs: Buffer = connection.crypto.encryptDataWithoutStream(Buffer.concat([header, udpPacket.payload]))
    connection.udpClient.send(bufs, 0, bufs.length, Config.get("ShadowsocksUdpPort"), Config.get("ShadowsocksUdpHost"), function () { });
}



