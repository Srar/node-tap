import * as net from "net";
import * as EventEmitter from "events";

import SSCrypto from "./crypto/SSCrypto";
import ShadowsocksFormatter, {ShadowsocksHeaderVersion} from "./ShadowsocksFormatter";
import {Address} from "cluster";


export interface ShadowsocksOptions{
    host   :string,
    port   :string,
    method :string,
    passwd :string,
}


export default class ShadowsocksTcpClient extends EventEmitter {


    private method: any;

    private readonly socket: net.Socket = new net.Socket();

    private buffersCache: Array<Buffer> = [];
    private isConnected: boolean = false;

    constructor(private host: string,
                private port: number,
                password: string, method: string,
                private addressType: ShadowsocksHeaderVersion = ShadowsocksHeaderVersion.IPv4,
                private targetHost: Buffer = Buffer.allocUnsafe(0),
                private targetPort: number = 0) {
        super();
        this.method = SSCrypto.createCryptoMethodObject(method, password);
        this.socket.setNoDelay(true);
    }

    public connect(addressType: ShadowsocksHeaderVersion, targetHost?: Buffer, targetPort?: number) {

        this.socket.on("data", this.onData.bind(this));
        this.socket.on("error", this.disconnect.bind(this));
        this.socket.connect(this.port, this.host, this.onConnected.bind(this));
        if (ShadowsocksHeaderVersion) {
            this.addressType = addressType;
        }
        if (targetHost) {
            // if addressType is domain,the first byte is the domain length
            this.targetHost = targetHost;
        }
        if (targetPort) {
            this.targetPort = targetPort;
        }

    }

    public disconnect() {
        if (!this.isConnected) {
            return;
        }
        this.socket.end();
        this.emit("disconnected");
        this.removeAllListeners();
    }

    public destroy() {
        if (!this.isConnected) {
            return;
        }
        this.socket.destroy();
        this.emit("destroy");
        this.removeAllListeners();
    }

    /* support ipv4, ipv6 without domain */
    private onConnected() {
        const headerBuffer: Buffer = ShadowsocksFormatter.build({
            version: this.addressType,
            address: this.targetHost,
            port: this.targetPort,
        });
        this.socket.write(this.method.encryptData(headerBuffer));
        for (const buffer of this.buffersCache) {
            this.socket.write(this.method.encryptData(buffer));
        }
        this.buffersCache = [];
        this.isConnected = true;
        this.emit("connected", this);
    }

    // tslint:disable-next-line:member-ordering
    public write(data: Buffer): Promise<void> {
        // tslint:disable-next-line:space-before-function-paren
        return new Promise(function (resolve, reject) {
            if (!this.isConnected) {
                this.buffersCache.push(data);
                return resolve();
            }
            this.socket.write(this.method.encryptData(data), resolve);
        }.bind(this));
    }

    // tslint:disable-next-line:member-ordering
    public pause(p: boolean = true) {
        if (this.isConnected) {
            p ? this.socket.pause() : this.socket.resume();
        }
    }

    private onData(data) {
        try {
            const decryptedData = this.method.decryptData(data);
            if (decryptedData) {
                this.emit("data", decryptedData);
            }
        } catch (error) {
            this.socket.emit("error", error);
        }
    }
}
