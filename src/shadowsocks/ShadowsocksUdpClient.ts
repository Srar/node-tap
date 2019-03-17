import * as dgram from "dgram";
import * as EventEmitter from "events";

import SSCrypto from "./crypto/SSCrypto";
import ShadowsocksFormatter, { ShadowsocksHeaderVersion } from "./ShadowsocksFormatter";


export default class ShadowsocksUdpClient extends EventEmitter {

    private socket: dgram.Socket;
    private method: any;
    private header: Buffer;

    /* support ipv4, ipv6 without domain */
    constructor(
        private host: string,
        private port: number,
        password: string, method: string,
        isIPv4: boolean,
        private targetHost: Buffer,
        private targetPort: number,
    ) {
        super();
        this.method = SSCrypto.createCryptoMethodObject(method, password);
        this.header = ShadowsocksFormatter.build({
            version: isIPv4 ? ShadowsocksHeaderVersion.IPv4 : ShadowsocksHeaderVersion.IPv6,
            address: this.targetHost,
            port: this.targetPort,
        });
        this.socket = dgram.createSocket("udp4");
        this.socket.on("message", this.data.bind(this));
        this.socket.on(("error"), (err) => this.emit("error", err));
    }

    public write(data: Buffer) {
        const buffer = this.method.encryptDataWithoutStream(Buffer.concat([this.header, data]));
        this.socket.send(buffer, 0, buffer.length, this.port, this.host);
    }

    public data(data: Buffer) {
        try {
            data = this.method.decryptDataWithoutStream(data);
            this.emit("data", ShadowsocksFormatter.format(data).payload);
        } catch (error) {
            this.emit("error", error);
        }
    }

    public close() {
        this.socket.close();
    }
}
