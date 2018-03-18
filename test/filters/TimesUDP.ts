const Cap = require("cap").Cap;
import * as raw from "raw-socket"

import Config from "../Config"
import PacketUtils from "../PacketUtils"

console.log("XTUdp:", Config.get("XTUdp"));
console.log("Default ip of adapter:", Config.get("DefaultIp"));
console.log("Default gateway of adapter:", Config.get("DefaultGateway"));

/* 注册Pcap */
var cap = new Cap();
var device = Cap.findDevice(Config.get("DefaultIp"));
var filter = `udp and dst host ${Config.get("ShadowsocksUdpHost")}`;
var bufSize = 10 * 1024 * 1024;
var buffer = Buffer.alloc(65535);
var linkType = cap.open(device, filter, bufSize, buffer);
cap.setMinBytes && cap.setMinBytes(0);

/* 注册RawScoket */
var rawsocket = raw.createSocket({
    protocol: raw.Protocol.UDP
});
rawsocket.setOption(raw.SocketLevel.IPPROTO_IP, raw.SocketOption.IP_HDRINCL, new Buffer([0x00, 0x00, 0x00, 0x01]), 4);

const SPECIAL_TTL: number = 0x7B; // 123 
const XTUdp: number = Config.get("XTUdp");
if (XTUdp > 1) {
    cap.on("packet", function (nbytes, trunc) {
        /* Ethernet + IP/TCP */
        if (nbytes < 34) return;
        if (buffer[22] == SPECIAL_TTL) return;
        buffer[22] = SPECIAL_TTL;
        var sendingBuffer = buffer.slice(14, nbytes);
        var targetIpAddress: string = PacketUtils.ipAddressToString(sendingBuffer.slice(16, 21));
        for (var i = 1; i < XTUdp; i++) {
            rawsocket.send(sendingBuffer, 0, sendingBuffer.length, targetIpAddress, function (error, bytes) {
                if(error) {
                    console.error(error);
                }
            });
        }
    });
}

export default function (data: Buffer, write: Function, next: Function) {
    next();
}