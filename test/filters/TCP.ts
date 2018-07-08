import Config from "../Config";
import PacketUtils from "../PacketUtils";
import {
    TcpPacket,
    IpProtocol,
    EthernetType,
} from "../PacketsStruct";
import TcpPacketFormatter from "../formatters/TcpPacketFormatter";
import * as EventEmitter from "events";

const TCP_LOG_ENABLE = false;
// tslint:disable-next-line:interface-name
interface TcpConnection {
    ipversion: EthernetType;
    localAddress: Buffer;
    localIp: Buffer;
    localPort: number;
    targetAddress: Buffer;
    targetIp: Buffer;
    targetPort: number;
    targetReceiveWindow: number;
    localReceiveWindow: number;
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
    Closed,
}

/**
 * TcpServerSession包含的事件
 * connected : 已经建立连接
 * read      : 读取到数据包
 * closed    : 关闭连接
 */
export class TcpServerSession extends EventEmitter {

    private state: TcpConnectionState;

    private currentIdNum: number;
    private currentSeqNum: number = 0;
    private currentAckNum: number = 0;
    private currentWindowSize: number = 0;

    private nextExpectSeqNum: number = 0;

    private sendingBuffers: Array<Buffer> = [];

    private routers: Array<(data: Buffer, tcpPacket: TcpPacket) => void> = [];

    constructor(public connection: TcpConnection,
                private nativeWrite: (data: Buffer) => void,
            ) {
        super();
        this.setMaxListeners(1);

        this.state = TcpConnectionState.HandShake;
        this.currentIdNum = 100;

        this.routers[TcpConnectionState.HandShake] = this.handSharkFSM.bind(this);
        this.routers[TcpConnectionState.HandShake_ACK] = this.handSharkFSM.bind(this);
        this.routers[TcpConnectionState.Data] = this.dataFSM.bind(this);
        this.routers[TcpConnectionState.RemoteCloseWating] = this.closeFSM.bind(this);
        this.routers[TcpConnectionState.RemoteCloseWating_1] = this.closeFSM.bind(this);
        this.routers[TcpConnectionState.LocalCloseWating] = this.closeFSM.bind(this);
        this.routers[TcpConnectionState.LocalCloseWating_1] = this.closeFSM.bind(this);
    }

    public dataRouter(data: Buffer, tcpPacket: TcpPacket) {
        if (this.state === TcpConnectionState.Closed) {
            return;
        }
        if (tcpPacket.RST) {
            this.tcpRst(data, tcpPacket);
            return;
        }

        const func = this.routers[this.state];
        if (func) {
            func(data, tcpPacket);
        }
    }

    private handSharkFSM(data: Buffer, tcpPacket: TcpPacket){
        if (this.state === TcpConnectionState.HandShake) {
            if (!tcpPacket.SYN) {
                return;
            }
            this.currentAckNum = tcpPacket.sequenceNumber + 1;
            let ack: TcpPacket = {
                sequenceNumber: this.currentSeqNum,
                acknowledgmentNumber: this.currentAckNum,
                totalLength: 44,
                SYN: true,
                ACK: true,
                options: new Buffer([0x02, 0x04, 0x05, 0x78]),
            };
            ack = Object.assign(this.buildBaseTcpPacket(), ack);
            ack.identification = 0;
            const tcpAckpacket: Buffer = TcpPacketFormatter.build(ack);
            this.nativeWrite(tcpAckpacket);
            this.state = TcpConnectionState.HandShake_ACK;
            if(TCP_LOG_ENABLE)console.log("handshark")
            this.emit('connected');
            return;
        }
    
        if (this.state === TcpConnectionState.HandShake_ACK) {
            if (tcpPacket.acknowledgmentNumber !== this.currentSeqNum + 1) {
                return;
            }
            this.state = TcpConnectionState.Data;
            this.currentAckNum = tcpPacket.sequenceNumber;
            this.currentSeqNum = tcpPacket.acknowledgmentNumber;
            this.currentWindowSize = tcpPacket.window;
            if(TCP_LOG_ENABLE)console.log("handshark ack")
            return;
        }
    }

    private dataFSM(data: Buffer, tcpPacket: TcpPacket) {
        if(this.state !== TcpConnectionState.Data){
            return;
        }
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
            ack = Object.assign(this.buildBaseTcpPacket(), ack);
            const tcpAckpacket: Buffer = TcpPacketFormatter.build(ack);
            this.nativeWrite(tcpAckpacket);
            // if(TCP_LOG_ENABLE)console.log("recive data")
            this.emit("read",tcpPacket.payload)
        }

        /* 只接受最新的ack包作为更新窗口大小 */
        if (tcpPacket.acknowledgmentNumber === this.currentSeqNum) {
            this.currentWindowSize = tcpPacket.window;
        }
    }

    private closeFSM(data: Buffer, tcpPacket: TcpPacket) {

        if (this.state === TcpConnectionState.LocalCloseWating_1 && tcpPacket.FIN && tcpPacket.ACK) {
            this.currentSeqNum = tcpPacket.acknowledgmentNumber;
            this.currentAckNum = tcpPacket.sequenceNumber + 1;
            let fin: TcpPacket = {
                sequenceNumber: this.currentSeqNum,
                acknowledgmentNumber: this.currentAckNum,
                totalLength: 40,
                ACK: true,
            };
            fin = Object.assign(this.buildBaseTcpPacket(), fin);
            const tcpFinPacket: Buffer = TcpPacketFormatter.build(fin);
            this.nativeWrite(tcpFinPacket);
            this.state = TcpConnectionState.Closed;
            this.emit("closed");
        }

        if (this.state === TcpConnectionState.RemoteCloseWating) {
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
            const tcpFinPacket: Buffer = TcpPacketFormatter.build(fin);
            this.sendingBuffers = [];
            this.nativeWrite(tcpFinPacket);
            this.state = TcpConnectionState.RemoteCloseWating_1;
            return;
        }

        if (this.state === TcpConnectionState.RemoteCloseWating_1) {
            this.emit("closed");
            this.state = TcpConnectionState.Closed;
            return;
        }
    }

    public write(data?: Buffer) {
        if(TCP_LOG_ENABLE)console.log(`tcp write current state is ${this.state == TcpConnectionState.Data ? "data" : "not data"}`);
        if (this.state !== TcpConnectionState.Data) {
            return;
        }
        if (data !== undefined) {
            this.sendingBuffers = this.sendingBuffers.concat(this.slicePacket(data, 1446));
        }
        if (this.currentWindowSize <= 0) {
            return;
        }
        if (this.sendingBuffers.length === 0) {
            return;
        }

        const waitingBuffer: Buffer = this.sendingBuffers[0];

        if (waitingBuffer.length < this.currentWindowSize) {
            this.sendingBuffers.shift();
            this.currentWindowSize = this.currentWindowSize - waitingBuffer.length;
            this.sendDataPacket(waitingBuffer);
            this.write();
        } else {
            const smallerData: Buffer = waitingBuffer.slice(0, this.currentWindowSize);
            this.sendingBuffers[0] = waitingBuffer.slice(this.currentWindowSize);
            this.currentWindowSize = 0;
            this.sendDataPacket(smallerData);
        }
    }

    public close(){
        if (this.state === TcpConnectionState.Data) {
            this.sendingBuffers = [];
            this.state = TcpConnectionState.LocalCloseWating;
            let fin: TcpPacket = {
                sequenceNumber: this.currentSeqNum,
                acknowledgmentNumber: this.currentAckNum,
                totalLength: 40,
                ACK: true,
                FIN: true,
            };
            fin = Object.assign(this.buildBaseTcpPacket(), fin);
            const tcpFinPacket: Buffer = TcpPacketFormatter.build(fin);
            this.nativeWrite(tcpFinPacket);
            this.state = TcpConnectionState.LocalCloseWating_1;
            return;
        }
    }

    public sendDataPacket(data: Buffer, log: boolean = false) {
        let dataPacket: TcpPacket = {
            sequenceNumber: this.currentSeqNum,
            acknowledgmentNumber: this.currentAckNum,
            ACK: true,
            PSH: true,
            payload: data,
        };
        dataPacket = Object.assign(this.buildBaseTcpPacket(data.length), dataPacket);
        this.currentSeqNum = dataPacket.sequenceNumber + dataPacket.payload.length;
        const fullPacket = TcpPacketFormatter.build(dataPacket);
        this.nativeWrite(fullPacket);
    }

    public tcpRst(data: Buffer, tcpPacket: TcpPacket) {
        this.sendingBuffers = [];
        this.state = TcpConnectionState.Closed;
        if(TCP_LOG_ENABLE)console.log("close")
        this.emit("closed");
    }

    public buildBaseTcpPacket(dataLength: number = 0): TcpPacket {
        this.currentIdNum = PacketUtils.increaseNumber(this.currentIdNum, 65536);
        return {
            type: this.connection.ipversion,
            version: this.connection.ipversion === EthernetType.IPv4 ? 4 : 6,
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
        };
    }

    public slicePacket(data: Buffer, sliceSize: number): Array<Buffer> {
        const bufsArray: Array<Buffer> = [];
        if (data.length <= sliceSize) {
            bufsArray.push(data);
            return bufsArray;
        }

        let sliceCount = data.length / sliceSize;
        // is float.
        if (sliceCount !== Math.floor(sliceCount)) {
            sliceCount++;
        }
        sliceCount = Math.floor(sliceCount);

        let lastIndex: number = 0;
        let targetIndex: number = sliceSize;

        for (let i = 0; i < sliceCount; i++) {
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

    // tslint:disable-next-line:member-ordering
    public toString(): string {
        let str = "";
        str += `localAddress: ${this.connection.localAddress.map((x) => x.toString(16) as any).join(":")}\n`;
        str += `targetAddress: ${this.connection.targetAddress.map((x) => x.toString(16) as any).join(":")}\n`;
        str += `localIp: ${PacketUtils.ipv4ToString(this.connection.localIp)}\n`;
        str += `targetIp: ${PacketUtils.ipv4ToString(this.connection.targetIp)}\n`;
        str += `localPort: ${this.connection.localPort}\n`;
        str += `targetPort: ${this.connection.targetPort}`;
        return str;
    }
}

const connections = new Map<string, TcpServerSession>();

export class TcpStack extends EventEmitter{
    public connections = new Map<string,TcpServerSession>();
    constructor(
        private output:(data:Buffer)=>void,
    ){
        super();
        this.setMaxListeners(1);
    }

    public input(data:Buffer){
        /** 跳过非tcp协议的数据包处理 */
        if (PacketUtils.isIPv4(data)) {
            if (!PacketUtils.isTCP(data)) { 
                return; 
            }
        } else if (PacketUtils.isIPv6(data)) {
            if (!PacketUtils.isTCPForIpv6(data)) { 
                return; 
            }
        } else {
            return;
        }

        const tcpPacket: TcpPacket = TcpPacketFormatter.format(data);
        const tcpConnectionId: string = PacketUtils.getConnectionId(tcpPacket);

        let session = connections.get(tcpConnectionId);
        if (session === undefined || session == null) {
            session = new TcpServerSession({
                ipversion: tcpPacket.version === 4 ? EthernetType.IPv4 : EthernetType.IPv6,
                localAddress: tcpPacket.sourceAddress,
                targetAddress: tcpPacket.destinaltionAddress,
                localIp: tcpPacket.destinationIp,
                targetIp: tcpPacket.sourceIp,
                localPort: tcpPacket.destinationPort,
                targetPort: tcpPacket.sourcePort,
                localReceiveWindow: 65535,
                targetReceiveWindow: tcpPacket.window,
            }, this.output);
            session.once("closed", () => {
                delete connections[tcpConnectionId];
                // if(TCP_LOG_ENABLE)console.log("bye bye", PacketUtils.ipAddressToString(tcpPacket.destinationIp), "source port", session.connection.targetPort);
            });
            connections.set(tcpConnectionId, session);
            if(TCP_LOG_ENABLE)console.log("got new session")
            // if(TCP_LOG_ENABLE)console.log("connect", PacketUtils.ipAddressToString(tcpPacket.destinationIp), "source port", tcpPacket.sourcePort);
            session.once("connected",()=>{
                this.emit("accept",session);
            })
        }
        session.dataRouter(data, tcpPacket);
    }
}

export default function (data: Buffer, write: (data: Buffer) => void, next: () => void) {

    if (PacketUtils.isIPv4(data)) {
        if (!PacketUtils.isTCP(data)) {
            return next();
        }
    } else if (PacketUtils.isIPv6(data)) {
        if (!PacketUtils.isTCPForIpv6(data)) {
            return next();
        }
    } else {
        return next();
    }

    const tcpPacket: TcpPacket = TcpPacketFormatter.format(data);
    const tcpConnectionId: string = PacketUtils.getConnectionId(tcpPacket);

    let session = connections.get(tcpConnectionId);
    if (session === undefined || session == null) {
        session = new TcpServerSession({
            ipversion: tcpPacket.version === 4 ? EthernetType.IPv4 : EthernetType.IPv6,
            localAddress: tcpPacket.sourceAddress,
            targetAddress: tcpPacket.destinaltionAddress,
            localIp: tcpPacket.destinationIp,
            targetIp: tcpPacket.sourceIp,
            localPort: tcpPacket.destinationPort,
            targetPort: tcpPacket.sourcePort,
            localReceiveWindow: 65535,
            targetReceiveWindow: tcpPacket.window,
        }, write);
        session.once("closed", () => {
            delete connections[tcpConnectionId];
            // if(TCP_LOG_ENABLE)console.log("bye bye", PacketUtils.ipAddressToString(tcpPacket.destinationIp), "source port", session.connection.targetPort);
        });
        connections.set(tcpConnectionId, session);
        // if(TCP_LOG_ENABLE)console.log("connect", PacketUtils.ipAddressToString(tcpPacket.destinationIp), "source port", tcpPacket.sourcePort);
    }
    session.dataRouter(data, tcpPacket);
}
