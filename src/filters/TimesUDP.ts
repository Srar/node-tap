
import { Cap } from "cap";
import * as raw from "raw-socket";

import logger from "../logger";
import Config from "../Config";
import PacketUtils from "../PacketUtils";

(function () {
    const XTUdp: number = Config.get("XTUdp");
    if (XTUdp <= 1) {
        logger.info(`UDP多倍发包已禁用.`);
        return;
    }

    logger.info(`UDP多倍发包倍率: ${XTUdp}`);
    logger.info(`UDP多倍发包网卡IP: ${Config.get("DefaultIp")}`);

    /* 注册Pcap */
    const cap = new Cap();

    const device: string = Cap.findDevice(Config.get("DefaultIp"));
    if (device) {
        logger.info(`UDP多倍发包网卡: ${device}`);
    } else {
        logger.warn(`UDP多倍发包已禁用: 无法找到默认网卡`);
        return;
    }

    const filter: string = `udp and dst port ${Config.get("ShadowsocksUdpPort")} and dst host ${Config.get("ShadowsocksUdpHost")}`;
    logger.info(`UDP多倍发包规则: ${filter}`)
    
    const bufSize: number = 10 * 1024 * 1024;
    const buffer: Buffer = Buffer.alloc(65535);
    const linkType = cap.open(device, filter, bufSize, buffer);
    cap.setMinBytes && cap.setMinBytes(0);

    /* 注册RawScoket */
    const rawsocket = raw.createSocket({
        protocol: raw.Protocol.UDP,
    });
    rawsocket.setOption(raw.SocketLevel.IPPROTO_IP, raw.SocketOption.IP_HDRINCL, new Buffer([0x00, 0x00, 0x00, 0x01]), 4);

    /* 基于TTL过滤已多倍发送的数据包 */
    const SPECIAL_TTL: number = 0x7B;
    cap.on("packet", (nbytes, trunc) => {
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
                    logger.error(error);
                }
            });
        }
    });
})();

export default function (data: Buffer, write: (data: Buffer) => void, next: () => void) {
    next();
}
