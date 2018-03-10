const Cap = require("cap").Cap;
import Config from "../Config"

var c = new Cap();
console.log("XTUdp:", Config.get("XTUdp"));
console.log("Default ip of adapter:", Config.get("DefaultIp"));
console.log("Default gateway of adapter:", Config.get("DefaultGateway"));

var device = Cap.findDevice(Config.get("DefaultIp"));
var filter = `udp and dst host ${Config.get("ShadowsocksHost")}`;
var bufSize = 10 * 1024 * 1024;
var buffer = Buffer.alloc(65535);
var linkType = c.open(device, filter, bufSize, buffer);
c.setMinBytes && c.setMinBytes(0);

const SPECIAL_TTL: number = 0x7B; // 123 
const XTUdp: number = Config.get("XTUdp") - 1;
if (XTUdp >= 1) {
    c.on("packet", function (nbytes, trunc) {
        // if (linkType !== "ETHERNET") return;

        /* Ethernet + IP/TCP */
        if (nbytes < 34) return;
        if (buffer[22] == SPECIAL_TTL) return;
        buffer[22] = SPECIAL_TTL;
        var sendingBuffer = buffer.slice(0, nbytes);
        for (var i = 0; i < XTUdp; i++) {
            c.send(sendingBuffer);
        }
    });
}

export default function (data: Buffer, write: Function, next: Function) {
    next();
}