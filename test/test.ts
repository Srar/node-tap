const native = require("../index.js");

import * as fs from "fs"
import * as dns from "dns"
import Config from "./Config"
import { promisify } from "util"
import * as iconv from "iconv-lite"
import TAPControl from "./TAPControl"
import * as cprocess from "child_process"
import * as NativeTypes from "./NativeTypes"
import DeviceConfiguration from "./DeviceConfiguration"

import Ipip from "./Ipip"

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
    .default("skipdns", "false")
const argv = optimist.argv;

async function main() {

    if (argv.h != undefined || argv.help != undefined) {
        console.log(optimist.help())
        process.exit(-1);
    }

    {
        var isIP = function (str) {
            var ipArray = str.split(".");
            if (ipArray.length != 4) return false;
            for (var item of ipArray) {
                item = parseInt(item);
                if (isNaN(item)) return false;
                if (item >= 0 && item <= 254) continue;
                return false;
            }
            return true;
        }

        Config.set("XTUdp", parseInt(argv.xtudp));

        if (isNaN(Config.get("XTUdp"))) {
            Config.set("XTUdp", 1);
        }

        var allHost: string = argv.host;
        var tcpHost: string = argv.tcphost;
        var udpHost: string = argv.udphost;

        if (allHost != undefined && !isIP(allHost)) {
            let ips: Array<string> = await promisify(dns.resolve4)(allHost);
            allHost = ips[0];
        }

        if (tcpHost == undefined) {
            tcpHost = allHost
        } else {
            if (!isIP(tcpHost)) {
                let ips: Array<string> = await promisify(dns.resolve4)(tcpHost);
                tcpHost = ips[0];
            }
        }

        if (udpHost == undefined) {
            udpHost = allHost
        } else {
            if (!isIP(udpHost)) {
                let ips: Array<string> = await promisify(dns.resolve4)(udpHost);
                udpHost = ips[0];
            }
        }

        Config.set("ShadowsocksTcpHost", tcpHost);
        argv.tcpport == undefined ? Config.set("ShadowsocksTcpPort", argv.port) : Config.set("ShadowsocksTcpPort", argv.tcpport);
        argv.tcppasswd == undefined ? Config.set("ShadowsocksTcpPasswd", argv.passwd) : Config.set("ShadowsocksTcpPasswd", argv.tcppasswd);
        argv.tcpmethod == undefined ? Config.set("ShadowsocksTcpMethod", argv.method) : Config.set("ShadowsocksTcpMethod", argv.tcpmethod);

        Config.set("ShadowsocksUdpHost", udpHost);
        argv.udpport == undefined ? Config.set("ShadowsocksUdpPort", argv.port) : Config.set("ShadowsocksUdpPort", argv.udpport);
        argv.udppasswd == undefined ? Config.set("ShadowsocksUdpPasswd", argv.passwd) : Config.set("ShadowsocksUdpPasswd", argv.udppasswd);
        argv.udpmethod == undefined ? Config.set("ShadowsocksUdpMethod", argv.method) : Config.set("ShadowsocksUdpMethod", argv.udpmethod);

        if (Config.get("ShadowsocksTcpHost") == undefined ||
            Config.get("ShadowsocksUdpHost") == undefined ||
            Config.get("ShadowsocksTcpMethod") == undefined ||
            Config.get("ShadowsocksUdpMethod") == undefined) {
            console.log(optimist.help())
            process.exit(-1);
        }

        Config.set("DNS", argv.dns);
        Config.set("SkipDNS", (argv.skipdns.toLocaleLowerCase() == "true"));
    }

    if (argv.debug) {
        console.log(Config.get())
        process.exit(-1);
    }

    /* 设置OpenVPN网卡 */
    const tapControl: TAPControl = TAPControl.init();
    const tapInfo = tapControl.getAdapterInfo();
    tapControl.enable();

    /* 获取默认网卡 */
    const allDevicesInfo: Array<NativeTypes.DeviceInfo> = <Array<NativeTypes.DeviceInfo>>native.N_GetAllDevicesInfo();
    const deafultGateway: string = (<Array<NativeTypes.IpforwardEntry>>native.N_GetIpforwardEntry())[0].nextHop;
    var deafultDevice: NativeTypes.DeviceInfo = null;
    for (const device of allDevicesInfo) {
        if (device.gatewayIpAddress == deafultGateway) {
            deafultDevice = device;
        }
    }
    if (deafultDevice == null) {
        throw new Error("无法找到默认网卡.");
    }
    Config.set("DefaultIp", deafultDevice.currentIpAddress);
    Config.set("DefaultGateway", deafultDevice.gatewayIpAddress);

    /* 设置路由表 */
    var initCommands: Array<Array<string>> = [
        ["netsh", "interface", "ipv4", "set", "interface", `${tapInfo.index}`, "metric=1"],
        ["netsh", "interface", "ipv6", "set", "interface", `${tapInfo.index}`, "metric=1"],
        ["netsh", "interface", "ipv4", "set", "dnsservers", `${tapInfo.index}`, "static", Config.get("DNS"), "primary"],
        ["netsh", "interface", "ip", "set", "address", `name=${tapInfo.index}`, "static",
            DeviceConfiguration.LOCAL_IP_ADDRESS, DeviceConfiguration.LOCAL_NETMASK, DeviceConfiguration.GATEWAY_IP_ADDRESS],
        ["route", "delete", "0.0.0.0", DeviceConfiguration.GATEWAY_IP_ADDRESS],
        ["route", "delete", Config.get("DNS")],
        ["route", "add", "10.1.1.11", "mask", "255.255.255.255", deafultGateway, "metric", "1"],
        ["route", "add", Config.get("ShadowsocksTcpHost"), "mask", "255.255.255.255", deafultGateway, "metric", "1"],
        ["route", "add", Config.get("ShadowsocksUdpHost"), "mask", "255.255.255.255", deafultGateway, "metric", "1"],
    ];

    if (Config.get("SkipDNS")) {
        initCommands.push(
            ["route", "add", Config.get("DNS"), "mask", "255.255.255.255", deafultGateway, "metric", "1"],
        );
    }

    initCommands.forEach(command => {
        process.stdout.write(command.join(" ") + " ");
        var result = cprocess.spawnSync(command[0], command.slice(1), { timeout: 1000 * 5 });
        var errorMessage: string = iconv.decode(result.stderr, "cp936").toString().trim();
        if (errorMessage.length != 0) process.stderr.write(errorMessage);
        process.stdout.write("\n");
    });

    {
        let code: number = native.N_CreateIpforwardEntry({
            dwForwardDest: "0.0.0.0",
            dwForwardMask: "0.0.0.0",
            dwForwardPolicy: 0,
            dwForwardNextHop: DeviceConfiguration.GATEWAY_IP_ADDRESS,
            dwForwardIfIndex: tapInfo.index,
            dwForwardType: NativeTypes.IpforwardEntryType.MIB_IPROUTE_TYPE_INDIRECT,
            dwForwardProto: NativeTypes.IpforwardEntryProto.MIB_IPPROTO_NETMGMT,
            dwForwardAge: 0,
            dwForwardNextHopAS: 0,
            dwForwardMetric1: 2,
        })
        console.log("create ip forward entry result:", code == 0 ? "SUCCESS" : `ERROR code: ${code}`);
    }

    if (fs.existsSync(`${__dirname}/17monipdb.dat`)) {
        Ipip.load(`${__dirname}/17monipdb.dat`);
    } else if (fs.existsSync(`17monipdb.dat`)) {
        Ipip.load(`17monipdb.dat`);
    } else {
        throw new Error("Can't found ip database.");
    }

    var filters: Array<Function> = [];
    filters.push(require("./filters/TCP").default);
    filters.push(require("./filters/UDP").default);
    filters.push(require("./filters/ARP").default);
    filters.push(require("./filters/TimesUDP").default);

    async function loop() {
        var data: Buffer = <Buffer>await tapControl.read();
        var index: number = 0;
        function next() {
            var func = filters[index++];
            if (func == undefined) return;
            func(data, (data) => tapControl.write(data), next);
        }
        next();
        return setImmediate(loop);
    }
    loop();
}

process.on("unhandledRejection", function (reason, p) {
    console.log("Unhandled Rejection at: Promise", p, "reason:", reason);
});

main();