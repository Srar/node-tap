// tslint:disable-next-line:no-var-requires
const Cap = require("cap").Cap;
import * as raw from "raw-socket";

import Config from "../Config";
import PacketUtils from "../PacketUtils";

function registerXTUdp() {
    const XTUdp: number = Config.get("XTUdp");
    if (XTUdp <= 1) {
        console.log("XTUdp: disabled");
        return;
    }

    console.log("XTUdp:", Config.get("XTUdp"));
    console.log("Default ip of adapter:", Config.get("DefaultIp"));
    console.log("Default gateway of adapter:", Config.get("DefaultGateway"));

    /* 注册Pcap */
    const cap = new Cap();
    const device = Cap.findDevice(Config.get("DefaultIp"));
    const filter = `udp and dst port ${Config.get("ShadowsocksUdpPort")} and dst host ${Config.get("ShadowsocksUdpHost")}`;
    const bufSize = 10 * 1024 * 1024;
    const buffer = Buffer.alloc(65535);
    const linkType = cap.open(device, filter, bufSize, buffer);
    // tslint:disable-next-line:no-unused-expression
    cap.setMinBytes && cap.setMinBytes(0);

    /* 注册RawScoket */
    const rawsocket = raw.createSocket({
        protocol: raw.Protocol.UDP,
    });
    rawsocket.setOption(raw.SocketLevel.IPPROTO_IP, raw.SocketOption.IP_HDRINCL, new Buffer([0x00, 0x00, 0x00, 0x01]), 4);

    const SPECIAL_TTL: number = 0x7B; // 123
    cap.on("packet",  (nbytes, trunc) => {
        /* Ethernet + IP/TCP */
        if (nbytes < 34) {
            return;
        }
        if (buffer[22] === SPECIAL_TTL) {
            return;
        }
        buffer[22] = SPECIAL_TTL;
        const sendingBuffer = buffer.slice(14, nbytes);
        const targetIpAddress: string = PacketUtils.ipToString(sendingBuffer.slice(16, 20));
        for (let i = 1; i < XTUdp; i++) {
            rawsocket.send(sendingBuffer, 0, sendingBuffer.length, targetIpAddress, (error, bytes) => {
                if (error) {
                    console.error(error);
                }
            });
        }
    });
}

registerXTUdp();

export default function(data: Buffer, write: (data: Buffer) => void, next: () => void) {
    next();
}
