import Config from "../Config"
import PacketUtils from "../PacketUtils"
import {
    BasePacket,
    IpPacket,
    TcpPacket,
    IpProtocol
} from "../PacketsStruct"
import ShadowsocksTcpClient from "../shadowsocks/ShadowsocksTcpClient"
import IpacketFormatter from "../formatters/IpPacketFormatter"
import TcpPacketFormatter from "../formatters/TcpPacketFormatter"
import * as EventEmitter from "events"

interface TcpConnection {
    localAddress: Buffer,
    localIp: Buffer,
    localPort: number,
    targetAddress: Buffer,
    targetIp: Buffer,
    targetPort: number,
    targetReceiveWindow: number,
    localReceiveWindow: number,
}

enum TcpConnectionState {
    HandShake,
    HandShake_ACK,
    Data,
    /* 远端主动FIN */
    RemoteCloseWating,
    RemoteCloseWating_1,
    /* 本端主动FIN */
    LocalCloseWating,
    LocalCloseWating_1,
    Closed
}

class TcpServerSession extends EventEmitter {

    private state: TcpConnectionState;
    private shadowsocks: ShadowsocksTcpClient;

    private currentIdNum: number;
    private currentSeqNum: number = 0;
    private currentAckNum: number = 0;
    private currentWindowSize: number = 0;

    private nextExpectSeqNum: number = 0;

    private sendingBuffers: Array<Buffer> = [];

    private routers: Array<Function> = [];

    constructor(
        public connection: TcpConnection,
        private nativeWrite: Function) {

        super();

        this.state = TcpConnectionState.HandShake;
        this.currentIdNum = 100;

        this.routers[TcpConnectionState.HandShake] = this.tcpHandshark.bind(this);
        this.routers[TcpConnectionState.HandShake_ACK] = this.tcpHandshark.bind(this);
        this.routers[TcpConnectionState.Data] = this.tcpClientData.bind(this);
        this.routers[TcpConnectionState.RemoteCloseWating] = this.tcpClientRequestToClose.bind(this);
        this.routers[TcpConnectionState.RemoteCloseWating_1] = this.tcpClientRequestToClose.bind(this);
        this.routers[TcpConnectionState.LocalCloseWating] = this.tcpShadowsocksClosed.bind(this);
        this.routers[TcpConnectionState.LocalCloseWating_1] = this.tcpShadowsocksClosed.bind(this);
        this.shadowsocks = new ShadowsocksTcpClient(
            Config.get("ShadowsocksTcpHost"),
            Config.get("ShadowsocksTcpPort"),
            Config.get("ShadowsocksTcpPasswd"),
            Config.get("ShadowsocksTcpMethod"),
        );
    }

    public dataRouter(data: Buffer, tcpPacket: TcpPacket) {

        if (this.state === TcpConnectionState.Closed) return;
        if (tcpPacket.RST) {
            this.tcpRst(data, tcpPacket);
            return;
        }

        var func: Function = this.routers[this.state];
        if (func) func(data, tcpPacket);
    }

    public tcpHandshark(data: Buffer, tcpPacket: TcpPacket) {
        if (this.state == TcpConnectionState.HandShake) {
            if (!tcpPacket.SYN) return;
            this.currentAckNum = tcpPacket.sequenceNumber + 1;
            var ack: TcpPacket = {
                sequenceNumber: this.currentSeqNum,
                acknowledgmentNumber: this.currentAckNum,
                totalLength: 44,
                SYN: true,
                ACK: true,
                options: new Buffer([0x02, 0x04, 0x05, 0xb4])
            };
            ack = Object.assign(this.buildBaseTcpPacket(), ack);
            ack.identification = 0;
            var tcpAckpacket: Buffer = TcpPacketFormatter.build(ack);
            this.nativeWrite(tcpAckpacket);
            this.state = TcpConnectionState.HandShake_ACK;
            this.shadowsocks.connect(PacketUtils.isIPv4(data), PacketUtils.ipAddressToString(this.connection.localIp), this.connection.localPort);
            this.shadowsocks.on("data", this.tcpShadowsocksData.bind(this));
            this.shadowsocks.on("disconnected", this.tcpShadowsocksClosed.bind(this));
            return;
        }

        if (this.state == TcpConnectionState.HandShake_ACK) {
            if (tcpPacket.acknowledgmentNumber != this.currentSeqNum + 1) return;
            this.state = TcpConnectionState.Data;
            this.currentAckNum = tcpPacket.sequenceNumber;
            this.currentSeqNum = tcpPacket.acknowledgmentNumber;
            this.currentWindowSize = tcpPacket.window;
            return;
        }
    }

    public tcpClientData(data: Buffer, tcpPacket: TcpPacket) {
        if (tcpPacket.FIN) {
            this.state = TcpConnectionState.RemoteCloseWating;
            this.dataRouter(data, tcpPacket);
            return;
        }

        if (tcpPacket.acknowledgmentNumber > this.currentSeqNum) {
            this.currentSeqNum = tcpPacket.acknowledgmentNumber;
        }

        this.currentAckNum = tcpPacket.sequenceNumber + tcpPacket.payload.length;
        if (tcpPacket.payload.length > 0) {
            let ack: TcpPacket = {
                sequenceNumber: this.currentSeqNum,
                acknowledgmentNumber: this.currentAckNum,
                totalLength: 40,
                ACK: true,
            };
            ack = Object.assign(this.buildBaseTcpPacket(), ack);;
            let tcpAckpacket: Buffer = TcpPacketFormatter.build(ack);
            this.nativeWrite(tcpAckpacket);
            this.shadowsocks.write(tcpPacket.payload);
        }

        /* 只接受最新的ack包作为更新窗口大小 */
        if (tcpPacket.acknowledgmentNumber == this.currentSeqNum) {
            this.currentWindowSize = tcpPacket.window;
            this.tcpShadowsocksData();
        }

        // console.log(this.currentSeqNum, this.currentAckNum, this.currentWindowSize);
    }

    // TcpConnectionState.RemoteCloseWating
    public tcpClientRequestToClose(data: Buffer, tcpPacket: TcpPacket) {
        if (this.state == TcpConnectionState.RemoteCloseWating) {
            this.currentSeqNum = tcpPacket.acknowledgmentNumber;
            this.currentAckNum = tcpPacket.sequenceNumber + 1;
            let fin: TcpPacket = {
                sequenceNumber: this.currentSeqNum,
                acknowledgmentNumber: this.currentAckNum,
                totalLength: 40,
                ACK: true,
                FIN: true,
            };
            fin = Object.assign(this.buildBaseTcpPacket(), fin);
            let tcpFinPacket: Buffer = TcpPacketFormatter.build(fin);
            this.shadowsocks.removeAllListeners();
            this.shadowsocks.disconnect();
            this.sendingBuffers = [];
            this.nativeWrite(tcpFinPacket);
            this.state = TcpConnectionState.RemoteCloseWating_1;
            return;
        }

        if (this.state == TcpConnectionState.RemoteCloseWating_1) {
            this.emit("closed");
            this.state = TcpConnectionState.Closed;
            return;
        }
    }

    public tcpShadowsocksData(data?: Buffer) {
        if (this.state != TcpConnectionState.Data) return;
        if (data != undefined) {
            this.sendingBuffers = this.sendingBuffers.concat(this.slicePacket(data, 1446))
        }
        this.shadowsocks.pause(true);
        if (this.currentWindowSize <= 0) return;
        if (this.sendingBuffers.length == 0) {
            this.shadowsocks.pause(false);
            return;
        }

        var waitingBuffer: Buffer = this.sendingBuffers[0];

        if (waitingBuffer.length < this.currentWindowSize) {
            this.sendingBuffers.shift();
            this.currentWindowSize = this.currentWindowSize - waitingBuffer.length;
            this.sendDataPacket(waitingBuffer);
            this.tcpShadowsocksData();
        } else {
            var smallerData: Buffer = waitingBuffer.slice(0, this.currentWindowSize);
            this.sendingBuffers[0] = waitingBuffer.slice(this.currentWindowSize);
            this.currentWindowSize = 0;
            this.sendDataPacket(smallerData);
        }
    }

    public sendDataPacket(data: Buffer, log: boolean = false) {
        var dataPacket: TcpPacket = {
            sequenceNumber: this.currentSeqNum,
            acknowledgmentNumber: this.currentAckNum,
            ACK: true,
            PSH: true,
            payload: data
        };
        dataPacket = Object.assign(this.buildBaseTcpPacket(data.length), dataPacket);
        this.currentSeqNum = dataPacket.sequenceNumber + dataPacket.payload.length;
        var fullPacket = TcpPacketFormatter.build(dataPacket);
        this.nativeWrite(fullPacket);
    }

    public tcpShadowsocksClosed(data: Buffer, tcpPacket: TcpPacket) {

        if (this.state == TcpConnectionState.Data) {
            this.sendingBuffers = [];
            this.shadowsocks.removeAllListeners();
            this.state = TcpConnectionState.LocalCloseWating;
            let fin: TcpPacket = {
                sequenceNumber: this.currentSeqNum,
                acknowledgmentNumber: this.currentAckNum,
                totalLength: 40,
                ACK: true,
                FIN: true,
            };
            fin = Object.assign(this.buildBaseTcpPacket(), fin);
            let tcpFinPacket: Buffer = TcpPacketFormatter.build(fin);
            this.nativeWrite(tcpFinPacket);
            this.state = TcpConnectionState.LocalCloseWating_1;
            return;
        }

        if (this.state == TcpConnectionState.LocalCloseWating_1 && tcpPacket.FIN && tcpPacket.ACK) {
            this.currentSeqNum = tcpPacket.acknowledgmentNumber;
            this.currentAckNum = tcpPacket.sequenceNumber + 1;
            let fin: TcpPacket = {
                sequenceNumber: this.currentSeqNum,
                acknowledgmentNumber: this.currentAckNum,
                totalLength: 40,
                ACK: true,
            };
            fin = Object.assign(this.buildBaseTcpPacket(), fin);
            let tcpFinPacket: Buffer = TcpPacketFormatter.build(fin);
            this.nativeWrite(tcpFinPacket);
            this.state = TcpConnectionState.Closed;
            this.emit("closed");
        }
    }

    public tcpRst(data: Buffer, tcpPacket: TcpPacket) {
        this.sendingBuffers = [];
        this.shadowsocks.removeAllListeners();
        this.shadowsocks.destroy();
        this.state = TcpConnectionState.Closed;
        this.emit("closed");
    }

    public buildBaseTcpPacket(dataLength: number = 0): TcpPacket {
        this.currentIdNum = PacketUtils.increaseNumber(this.currentIdNum, 65536);
        return {
            version: 4,
            TTL: 64,
            protocol: IpProtocol.TCP,
            sourceIp: this.connection.localIp,
            destinationIp: this.connection.targetIp,
            sourceAddress: this.connection.localAddress,
            destinaltionAddress: this.connection.targetAddress,
            sourcePort: this.connection.localPort,
            destinationPort: this.connection.targetPort,
            window: this.connection.localReceiveWindow,
            totalLength: 40 + dataLength,
            identification: this.currentIdNum,
            TOS: 0,
        }
    }

    public slicePacket(data: Buffer, sliceSize: number): Array<Buffer> {
        var bufsArray: Array<Buffer> = [];
        if (data.length <= sliceSize) {
            bufsArray.push(data);
            return bufsArray;
        }

        var sliceCount = data.length / sliceSize;
        // is float.
        if (sliceCount != Math.floor(sliceCount)) sliceCount++;
        sliceCount = Math.floor(sliceCount);

        var lastIndex: number = 0;
        var targetIndex: number = sliceSize;

        for (var i = 0; i < sliceCount; i++) {
            bufsArray.push(data.slice(lastIndex, targetIndex));
            lastIndex = targetIndex;
            targetIndex += sliceSize;
            if (targetIndex > data.length) {
                targetIndex = data.length;
            }
        }
        return bufsArray;
    }

    private getRandomNumber(minimum: number, maximum: number): number {
        return Math.floor(Math.random() * (maximum - minimum + 1)) + minimum;
    }

    public toString(): string {
        var str = "";
        str += `localAddress: ${this.connection.localAddress.map(x => <any>x.toString(16)).join(":")}\n`;
        str += `targetAddress: ${this.connection.targetAddress.map(x => <any>x.toString(16)).join(":")}\n`;
        str += `localIp: ${PacketUtils.ipAddressToString(this.connection.localIp)}\n`;
        str += `targetIp: ${PacketUtils.ipAddressToString(this.connection.targetIp)}\n`;
        str += `localPort: ${this.connection.localPort}\n`;
        str += `targetPort: ${this.connection.targetPort}`;
        return str;
    }
}

var connections = new Map<string, TcpServerSession>();

export default function (buffer: Buffer, write: Function, next: Function) {
    if (!PacketUtils.isIPv4(buffer)) return next();
    if (!PacketUtils.isTCP(buffer)) return next();

    var tcpPacket: TcpPacket = TcpPacketFormatter.format(buffer);
    var tcpConnectionId: string = PacketUtils.getConnectionId(tcpPacket);

    // console.log("SYN:", tcpPacket.SYN, "RST:", tcpPacket.RST, "ACK:", tcpPacket.ACK, "PSH", tcpPacket.PSH, "LEN:", buffer.length);
    // console.log("SEQ:", tcpPacket.sequenceNumber, "DATA_LEN:", tcpPacket.payload.length);

    var session = connections.get(tcpConnectionId);
    if (session == undefined || session == null) {
        session = new TcpServerSession({
            localAddress: tcpPacket.sourceAddress,
            targetAddress: tcpPacket.destinaltionAddress,
            localIp: tcpPacket.destinationIp,
            targetIp: tcpPacket.sourceIp,
            localPort: tcpPacket.destinationPort,
            targetPort: tcpPacket.sourcePort,
            localReceiveWindow: 65535,
            targetReceiveWindow: tcpPacket.window,
        }, write);
        session.once("closed", function () {
            delete connections[tcpConnectionId];
            // console.log("bye bye", PacketUtils.ipAddressToString(tcpPacket.destinationIp), "source port", session.connection.targetPort);
        });
        connections.set(tcpConnectionId, session);
        // console.log("connect", PacketUtils.ipAddressToString(tcpPacket.destinationIp), "source port", tcpPacket.sourcePort);
    }
    session.dataRouter(buffer, tcpPacket);
}