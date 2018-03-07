import * as net from "net";
import * as EventEmitter from "events";
import { Socket } from "net";

import RC4MD5 from "./crypto/RC4MD5";

export default class ShadowsocksClientSocket extends EventEmitter {

    private method: any;

    private readonly socket: net.Socket = new net.Socket();

    private buffersCache: Array<Buffer> = [];
    private isConnected: boolean = false;

    constructor(
        private host: string,
        private port: number,
        password: string, method: string,
        private targetHost: string = "",
        private targetPort: number = 0,
    ) {
        super();
        this.method = new RC4MD5(password);
        this.socket.setNoDelay(true);
    }

    public connect(targetHost: string = "", targetPort: number = 0) {
        this.socket.on("data", this.onData.bind(this));
        this.socket.on("error", this.disconnect.bind(this));
        this.socket.connect(this.port, this.host, this.onConnected.bind(this));
        if (targetHost != "") {
            this.targetHost = targetHost;
        }
        if (targetPort != 0) {
            this.targetPort = targetPort;
        }
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

    private onConnected() {
        var isIPAddress = /^((25[0-5]|2[0-4]\d|[01]?\d\d?)($|(?!\.$)\.)){4}$/.test(this.targetHost);
        var buffer;
        if (isIPAddress) {
            var items = this.targetHost.split(".");
            buffer = Buffer.allocUnsafe(7);
            buffer[0] = 0x01;
            buffer[1] = items[0];
            buffer[2] = items[1];
            buffer[3] = items[2];
            buffer[4] = items[3];
            buffer[5] = ((this.targetPort >> 8) & 0xff);
            buffer[6] = (this.targetPort & 0xff);
        } else {
            buffer = Buffer.allocUnsafe(1 + 1 + this.targetHost.length + 2);
            buffer[0] = 0x03;
            buffer[1] = this.targetHost.length;
            buffer.write(this.targetHost, 2);
            buffer[buffer.length - 2] = ((this.targetPort >> 8) & 0xff);
            buffer[buffer.length - 1] = (this.targetPort & 0xff);
        }
        this.socket.write(this.method.encryptData(buffer));
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