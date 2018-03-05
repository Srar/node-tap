import * as dgram from "dgram"
import PacketUtils from "../PacketUtils"
import {
    BasePacket,
    IpPacket,
    UdpPacket,
    IpProtocol,
} from "../PacketsStruct"
import ConnectionManager from "../ConnectionManager"
import UdpPacketFormatter from "../formatters/UdpPacketFormatter"
import DeviceConfiguration from "../DeviceConfiguration"
import RC4MD5 from "../shadowsocks/crypto/RC4MD5";

interface Connection {
    crypto?: any,
    onFree?: Function
    udpClient: dgram.Socket,
}

var connections = new ConnectionManager<Connection>();

function getConnectionId(udpPacket: UdpPacket): string {
    var sourceIp: string = PacketUtils.ipAddressToString(udpPacket.sourceIp);
    var destinationIp: string = PacketUtils.ipAddressToString(udpPacket.destinationIp);
    return `${sourceIp}:${udpPacket.sourcePort}-${destinationIp}:${udpPacket.destinationPort}`;
}


export default function (data: Buffer, write: Function, next: Function) {

    if (!PacketUtils.isIPv4(data)) {
        return next();
    }

    if (!PacketUtils.isUDP(data)) {
        return next();
    }

    /* unsupported large udp packet now. */
    if (data.length > 1400) return;

    var udpPacket: UdpPacket = UdpPacketFormatter.format(data);
    var connectionId: string = getConnectionId(udpPacket);

    var connection: Connection = connections.get(connectionId);
    if (connection == null) {
        var isClosed: boolean = false;
        var udpClient = dgram.createSocket("udp4");
        udpClient.once("close", () => {
            isClosed = true;
            connections.remove(connectionId);
        })
        connection = {
            crypto: new RC4MD5("a123456"),
            udpClient: udpClient,
            onFree: function () {
                if (isClosed) return;
                udpClient.close();
            }
        };
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

    var bufs: Buffer = connection.crypto.encryptDataWithoutStream(Buffer.concat([header, new Buffer(1000)]))
    connection.udpClient.send(bufs, 0, bufs.length, 1433, "udp.ss.example.com", function () { });
}



