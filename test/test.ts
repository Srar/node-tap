// tslint:disable-next-line:no-var-requires
const native = require("../index.js");

import * as fs from "fs";
import * as dns from "dns";
import Config from "./Config";
import * as path from "path";
import { promisify } from "util";
import * as iconv from "iconv-lite";
import TAPControl from "./TAPControl";
import PacketUtils from "./PacketUtils";
import * as cprocess from "child_process";
import * as NativeTypes from "./NativeTypes";
import DeviceConfiguration from "./DeviceConfiguration";

// tslint:disable-next-line:no-var-requires
const optimist = require("optimist")
    .usage("Usage: $0 --host [shadowsocks host] --port [shadowsocks port] --passwd [shadowsocks password] --xtudp [x times udp packets]")
    .default("xtudp", 1)
    .default("host", undefined)
    .default("port", undefined)
    .default("passwd", undefined)
    .default("method", undefined)
    .default("tcphost", undefined)
    .default("tcpport", undefined)
    .default("tcppasswd", undefined)
    .default("tcpmethod", undefined)
    .default("udphost", undefined)
    .default("udpport", undefined)
    .default("udppasswd", undefined)
    .default("udpmethod", undefined)
    .default("dns", "8.8.8.8")
    .default("v6dns", "2001:4860:4860::8888")
    .default("skipdns", "false")
    .default("disablev6", "true")
    .default("routes", "0.0.0.0/0");

const argv = optimist.argv;

async function main() {

    if (argv.h !== undefined || argv.help !== undefined) {
        console.log(optimist.help());
        process.exit(-1);
    }

    {
        const isIP = (str: string) => {
            const ipArray = str.split(".");
            if (ipArray.length !== 4) {
                return false;
            }
            for (const item of ipArray) {
                const itemByte = parseInt(item, 10);
                if (isNaN(itemByte)) {
                    return false;
                }
                if (itemByte >= 0 && itemByte <= 254) {
                    continue;
                }
                return false;
            }
            return true;
        };

        Config.set("XTUdp", parseInt(argv.xtudp, 10));

        if (isNaN(Config.get("XTUdp"))) {
            Config.set("XTUdp", 1);
        }

        let allHost: string = argv.host;
        let tcpHost: string = argv.tcphost;
        let udpHost: string = argv.udphost;

        if (allHost !== undefined && !isIP(allHost)) {
            const ips: Array<string> = await promisify(dns.resolve4)(allHost);
            allHost = ips[0];
        }

        if (tcpHost === undefined) {
            tcpHost = allHost;
        } else {
            if (!isIP(tcpHost)) {
                const ips: Array<string> = await promisify(dns.resolve4)(tcpHost);
                tcpHost = ips[0];
            }
        }

        if (udpHost === undefined) {
            udpHost = allHost;
        } else {
            if (!isIP(udpHost)) {
                const ips: Array<string> = await promisify(dns.resolve4)(udpHost);
                udpHost = ips[0];
            }
        }

        Config.set("ShadowsocksTcpHost", tcpHost);
        argv.tcpport === undefined ? Config.set("ShadowsocksTcpPort", argv.port) : Config.set("ShadowsocksTcpPort", argv.tcpport);
        argv.tcppasswd === undefined ? Config.set("ShadowsocksTcpPasswd", argv.passwd) : Config.set("ShadowsocksTcpPasswd", argv.tcppasswd);
        argv.tcpmethod === undefined ? Config.set("ShadowsocksTcpMethod", argv.method) : Config.set("ShadowsocksTcpMethod", argv.tcpmethod);

        Config.set("ShadowsocksUdpHost", udpHost);
        argv.udpport === undefined ? Config.set("ShadowsocksUdpPort", argv.port) : Config.set("ShadowsocksUdpPort", argv.udpport);
        argv.udppasswd === undefined ? Config.set("ShadowsocksUdpPasswd", argv.passwd) : Config.set("ShadowsocksUdpPasswd", argv.udppasswd);
        argv.udpmethod === undefined ? Config.set("ShadowsocksUdpMethod", argv.method) : Config.set("ShadowsocksUdpMethod", argv.udpmethod);

        if (Config.get("ShadowsocksTcpHost") === undefined ||
            Config.get("ShadowsocksUdpHost") === undefined ||
            Config.get("ShadowsocksTcpMethod") === undefined ||
            Config.get("ShadowsocksUdpMethod") === undefined ||
            Config.get("ShadowsocksTcpPasswd") === undefined ||
            Config.get("ShadowsocksUdpPasswd") === undefined) {
            console.log(optimist.help());
            process.exit(-1);
        }

        Config.set("DNS", argv.dns);
        Config.set("SkipDNS", (argv.skipdns.toLocaleLowerCase() === "true"));
    }

    if (argv.debug) {
        console.log(Config.get());
        process.exit(-1);
    }

    /* 设置OpenVPN网卡 */
    if (!TAPControl.checkAdapterIsInstalled()) {
        console.log("Installing driver...");
        const result = TAPControl.installAdapter(path.join(process.cwd(), "driver/tapinstall.exe"));
        if (result !== 0) {
            console.error(`Driver was not successfully installed. Exit code: ${result}.`);
            if (result === 2) {
                console.log(`Please run as administrator.`);
            }
            process.exit(-1);
        }
        console.log("Install driver successfully.");
    }
    const tapControl: TAPControl = TAPControl.init();
    const tapInfo = tapControl.getAdapterInfo();
    tapControl.enable();

    /* 获取默认网卡 */
    const allDevicesInfo: Array<NativeTypes.DeviceInfo> = native.N_GetAllDevicesInfo() as Array<NativeTypes.DeviceInfo>;
    const defaultGateway: string = (native.N_GetIpforwardEntry() as Array<NativeTypes.IpforwardEntry>)[0].nextHop;
    let defaultDevice: NativeTypes.DeviceInfo = null;
    for (const device of allDevicesInfo) {
        if (device.gatewayIpAddress === defaultGateway) {
            defaultDevice = device;
        }
    }
    if (defaultDevice == null) {
        throw new Error("无法找到默认网卡.");
    }
    Config.set("DefaultIp", defaultDevice.currentIpAddress);
    Config.set("DefaultGateway", defaultDevice.gatewayIpAddress);

    /* 清理上次运行所留下的路由表 */
    {
        const routes = (native.N_GetIpforwardEntry() as Array<NativeTypes.IpforwardEntry>);
        for (const route of routes) {
            if (route.interfaceIndex !== tapInfo.index) {
                continue;
            }
            const code = native.N_DeleteIpforwardEntry({
                dwForwardDest: route.destIp,
                dwForwardMask: route.netMask,
                dwForwardPolicy: route.proto,
                dwForwardNextHop: route.nextHop,
                dwForwardIfIndex: route.interfaceIndex,
                dwForwardType: route.type,
                dwForwardAge: route.age,
                dwForwardMetric1: route.metric1,
            });
            if (code !== 0) {
                console.log(`Route deletion failed. Code: ${code}. Route: ${route.destIp}/${route.netMask}`);
            }
        }
    }

    /* 设置路由表 */
    {
        const initCommands: Array<Array<string>> = [
            ["netsh", "interface", "ipv4", "set", "interface", `${tapInfo.index}`, "metric=1"],
            ["netsh", "interface", "ipv6", "set", "interface", `${tapInfo.index}`, "metric=1"],
            ["netsh", "interface", "ipv4", "set", "dnsservers", `${tapInfo.index}`, "static", Config.get("DNS"), "primary"],
            ["netsh", "interface", "ip", "set", "address", `name=${tapInfo.index}`, "static",
                DeviceConfiguration.LOCAL_IP_ADDRESS, DeviceConfiguration.LOCAL_NETMASK, DeviceConfiguration.GATEWAY_IP_ADDRESS],
            ["route", "delete", "0.0.0.0", DeviceConfiguration.GATEWAY_IP_ADDRESS],
            ["route", "delete", Config.get("DNS")],

            ["route", "add", Config.get("ShadowsocksTcpHost"), "mask", "255.255.255.255", defaultGateway, "metric", "1"],
            ["route", "add", Config.get("ShadowsocksUdpHost"), "mask", "255.255.255.255", defaultGateway, "metric", "1"],
        ];

        if (Config.get("SkipDNS")) {
            initCommands.push(
                ["route", "add", Config.get("DNS"), "mask", "255.255.255.255", defaultGateway, "metric", "1"],
                ["netsh.exe", "interface", "ipv6", "set", "dnsserver", `name=${tapInfo.index}`, "source=static", `address=""`, "validate=no"],
            );
        }

        if (argv.disablev6 === "true") {
            console.log("IPv6 has been disabled.");
            initCommands.push(
                ["netsh", "int", "ipv6", "delete", "route", "::/0", `interface=${tapInfo.index}`, `nexthop=${DeviceConfiguration.GATEWAY_IPV6_ADDRESS}`],
                ["netsh", "int", "ipv6", "delete", "address", `interface=${tapInfo.index}`, `address=${DeviceConfiguration.LOCAL_IPV6_ADDRESS}`],
            );
        } else {
            initCommands.push(
                ["netsh", "interface", "ipv6", "set", "address", `interface=${tapInfo.index}`, `address=${DeviceConfiguration.LOCAL_IPV6_ADDRESS}`],
                ["netsh", "interface", "ipv6", "add", "route", "::/0", `interface=${tapInfo.index}`, `nexthop=${DeviceConfiguration.GATEWAY_IPV6_ADDRESS}`],
                ["netsh.exe", "interface", "ipv6", "set", "dnsserver", `name=${tapInfo.index}`, "source=static", `address=${argv.v6dns}`, "validate=no"],
            );
        }

        initCommands.forEach((command) => {
            process.stdout.write(command.join(" ") + " ");
            const result = cprocess.spawnSync(command[0], command.slice(1), { timeout: 1000 * 5 });
            const errorMessage: string = iconv.decode(result.stderr, "cp936").toString().trim();
            if (errorMessage.length !== 0) {
                process.stderr.write(errorMessage);
            }
            process.stdout.write("\n");
        });
    }

    // 添加自定义路由表
    {
        const routes: Array<Array<string | number>> = [];

        let cidrList: Array<string> = [];

        if (fs.existsSync(argv.routes)) {
            const rawData = fs.readFileSync(argv.routes).toString();
            cidrList = rawData.split("\n");
        } else {
            cidrList = argv.routes.split(",");
        }

        for (let cidr of cidrList) {
            cidr = cidr.trim();
            const [ip, range] = cidr.split("/");
            const netmask: string = PacketUtils.calculatenIpv4NetMask(parseInt(range, 10));
            routes.push([ip, netmask]);
        }

        for (const route of routes) {
            const [ip, netmask] = route;
            const code: number = native.N_CreateIpforwardEntry({
                dwForwardDest: ip,
                dwForwardMask: netmask,
                dwForwardPolicy: 0,
                dwForwardNextHop: DeviceConfiguration.GATEWAY_IP_ADDRESS,
                dwForwardIfIndex: tapInfo.index,
                dwForwardType: NativeTypes.IpforwardEntryType.MIB_IPROUTE_TYPE_INDIRECT,
                dwForwardProto: NativeTypes.IpforwardEntryProto.MIB_IPPROTO_NETMGMT,
                dwForwardAge: 0,
                dwForwardNextHopAS: 0,
                dwForwardMetric1: 2,
            });
            if (code !== 0) {
                console.log(`Route addition failed. Code: ${code}. Route: ${ip}/${netmask}`);
            }

        }
    }

    // tslint:disable-next-line:ban-types
    const filters: Array<Function> = [];
    filters.push(require("./filters/TCP").default);
    filters.push(require("./filters/UDP").default);
    filters.push(require("./filters/ARP").default);
    filters.push(require("./filters/NDP").default);
    filters.push(require("./filters/TimesUDP").default);

    async function loop() {
        const data: Buffer = await tapControl.read() as Buffer;
        let index: number = 0;
        function next() {
            const func = filters[index++];
            if (func === undefined) {
                return;
            }
            // tslint:disable-next-line:no-shadowed-variable
            func(data, (data) => tapControl.write(data), next);
        }
        next();
        return setImmediate(loop);
    }
    loop();
}

process.on("unhandledRejection", (reason, p) => {
    console.log("Unhandled Rejection at: Promise", p, "reason:", reason);
});

main();
