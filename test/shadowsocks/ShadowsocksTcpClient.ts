import * as net from "net"
import * as EventEmitter from "events"

import SSCrypto from "./crypto/SSCrypto"
import ShadowsocksFormatter, { ShadowsocksHeaderVersion } from "./ShadowsocksFormatter"

export default class ShadowsocksTcpClient extends EventEmitter {

    private method: any;

    private readonly socket: net.Socket = new net.Socket();

    private buffersCache: Array<Buffer> = [];
    private isConnected: boolean = false;

    constructor(
        private host: string,
        private port: number,
        password: string, method: string,
        private isIpv4Address: boolean = true,
        private targetHost: string = "",
        private targetPort: number = 0,
    ) {
        super();
        this.method = SSCrypto.createCryptoMethodObject(method, password);
        this.socket.setNoDelay(true);
    }

    public connect(isIpv4Address: boolean, targetHost?: string, targetPort?: number) {
        this.socket.on("data", this.onData.bind(this));
        this.socket.on("error", this.disconnect.bind(this));
        this.socket.connect(this.port, this.host, this.onConnected.bind(this));
        if (targetHost) this.targetHost = targetHost;
        if (targetPort) this.targetPort = targetPort;
        if (isIpv4Address) this.isIpv4Address = isIpv4Address;
    }

    public disconnect() {
        if (!this.isConnected) return;
        this.socket.end();
        this.emit("disconnected");
        this.removeAllListeners();
    }

    public destroy() {
        if (!this.isConnected) return;
        this.socket.destroy();
        this.emit("destroy");
        this.removeAllListeners();
    }

    /* support ipv4, ipv6 without domain */
    private onConnected() {
        var headerBuffer: Buffer = ShadowsocksFormatter.build({
            version: this.isIpv4Address ? ShadowsocksHeaderVersion.IPv4 : ShadowsocksHeaderVersion.IPv6,
            address: this.targetHost,
            port: this.targetPort
        });
        this.socket.write(this.method.encryptData(headerBuffer));
        for (let buffer of this.buffersCache) this.socket.write(this.method.encryptData(buffer));
        this.buffersCache = [];
        this.isConnected = true;
        this.emit("connected", this);
    }

    public write(data: Buffer): Promise<void> {
        return new Promise(function (resolve, reject) {
            if (!this.isConnected) {
                this.buffersCache.push(data);
                return resolve();
            }
            this.socket.write(this.method.encryptData(data), resolve);
        }.bind(this));
    }

    public pause(p: boolean = true) {
        if (this.isConnected) {
            // console.log("pause", p);
            p ? this.socket.pause() : this.socket.resume();
        }
    }

    private onData(data) {
        this.emit("data", this.method.decryptData(data));
    }
}