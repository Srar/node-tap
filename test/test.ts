const native = require("../index.js");

import * as dns from "dns"
import Config from "./Config"
import { promisify } from "util"
import * as cprocess from "child_process"
import * as NativeTypes from "./NativeTypes"
import DeviceConfiguration from "./DeviceConfiguration"

import Ipip from "./Ipip"

import TCP from "./filters/TCP"
import UDP from "./filters/UDP"
import ARP from "./filters/ARP"

const argv = require("optimist")
    .usage("Usage: $0 --host [shadowsocks host] --port [shadowsocks port] --password [shadowsocks password]")
    .demand(["host", "port", "password"])
    .argv;


const TAP_IOCTL_GET_MTU = CTL_CODE(0x00000022, 3, 0, 0);
const TAP_IOCTL_SET_MEDIA_STATUS = CTL_CODE(0x00000022, 6, 0, 0);
const TAP_WIN_IOCTL_CONFIG_DHCP_MASQ = CTL_CODE(0x00000022, 7, 0, 0);
const TAP_WIN_IOCTL_CONFIG_DHCP_SET_OPT = CTL_CODE(0x00000022, 9, 0, 0);
const TAP_IOCTL_CONFIG_TUN = CTL_CODE(0x00000022, 10, 0, 0);

const TRUE = new Buffer([0x01, 0x00, 0x00, 0x00]);
const FALSE = new Buffer([0x00, 0x00, 0x00, 0x00]);

function CTL_CODE(deviceType, func, method, access) {
    return ((deviceType) << 16) | ((access) << 14) | ((func) << 2) | (method)
}

async function main() {

    {
        var isIP = function (str) {
            var ipArray = str.split(".");
            if (ipArray.length != 4) return false;
            for (var item of ipArray) {
                item = parseInt(item);
                if (isNaN(item)) return false;
                if (item >= 1 && item <= 254) continue;
                return false;
            }
            return true;
        }

        Config.set("ShadowsocksHost", argv.host);
        Config.set("ShadowsocksPort", parseInt(argv.port));
        Config.set("ShadowsocksPassword", argv.password);

        if (!isIP(argv.host)) {
            let ips: Array<string> = await promisify(dns.resolve4)(argv.host);
            Config.set("ShadowsocksHost", ips[0]);
        }
    }

    var allDevicesInfo: Array<NativeTypes.DeviceInfo> = <Array<NativeTypes.DeviceInfo>>native.N_GetAllDevicesInfo();

    /* 设置OpenVPN网卡 */
    var tunDevice: NativeTypes.DeviceInfo = null;
    for (const device of allDevicesInfo) {
        if (device.description.toLocaleLowerCase().indexOf("tap-windows adapter v9") != -1) {
            tunDevice = device;
        }
    }
    var deviceHandle: number = native.N_CreateDeviceFile(tunDevice.name);
    await promisify(native.N_DeviceControl)(deviceHandle, TAP_IOCTL_SET_MEDIA_STATUS, TRUE, 32);

    /* 获取默认网卡 */
    var deafultGateway: string = (<Array<NativeTypes.IpforwardEntry>>native.N_GetIpforwardEntry())[0].nextHop;
    var deafultDevice: NativeTypes.DeviceInfo = null;
    for (const device of allDevicesInfo) {
        if (device.gatewayIpAddress == deafultGateway) {
            deafultDevice = device;
        }
    }

    var initCommands: Array<Array<string>> = [
        ["netsh", "interface", "ipv4", "set", "interface", `${tunDevice.index}`, "metric=1"],
        ["netsh", "interface", "ipv6", "set", "interface", `${tunDevice.index}`, "metric=1"],
        ["netsh", "interface", "ipv4", "set", "dnsservers", `${tunDevice.index}`, "static", "8.8.8.8", "primary"],
        ["netsh", "interface", "ip", "set", "address", `name=${tunDevice.index}`, "static",
            DeviceConfiguration.LOCAL_IP_ADDRESS, DeviceConfiguration.LOCAL_NETMASK, DeviceConfiguration.GATEWAY_IP_ADDRESS],
        ["route", "delete", "0.0.0.0", DeviceConfiguration.GATEWAY_IP_ADDRESS],
        ["route", "add", Config.get("ShadowsocksHost"), "mask", "255.255.255.255", deafultGateway, "metric", "1"],
    ];
    initCommands.forEach(command => {
        console.log(command.join(" "));
        var result = cprocess.spawnSync(command[0], command.slice(1), { timeout: 1000 * 5 });
        var output = result.stdout.toString().trim();
        var errorOutput = result.stderr.toString().trim();
    });

    {
        let code: number = native.N_CreateIpforwardEntry({
            dwForwardDest: "0.0.0.0",
            dwForwardMask: "0.0.0.0",
            dwForwardPolicy: 0,
            dwForwardNextHop: DeviceConfiguration.GATEWAY_IP_ADDRESS,
            dwForwardIfIndex: tunDevice.index,
            dwForwardType: NativeTypes.IpforwardEntryType.MIB_IPROUTE_TYPE_INDIRECT,
            dwForwardProto: NativeTypes.IpforwardEntryProto.MIB_IPPROTO_NETMGMT,
            dwForwardAge: 0,
            dwForwardNextHopAS: 0,
            dwForwardMetric1: 2,
        })
        console.log("create ip forward entry result:", code == 0 ? "SUCCESS" : `ERROR code: ${code}`);
    }

    Ipip.load(`${__dirname}/17monipdb.dat`);

    var filters: Array<Function> = [];
    filters.push(TCP);
    filters.push(UDP);
    filters.push(ARP);

    var rwProcess = new native.RwEventProcess(deviceHandle);
    var read = function () {
        return new Promise((resolve, reject) => {
            rwProcess.read(function (err, data) {
                err ? reject(err) : resolve(data);
            });
        });
    }

    var write = function (data: Buffer) {
        rwProcess.writeSync(data);
    }

    async function loop() {
        var data: Buffer = <Buffer>await read();
        var index: number = 0;
        function next() {
            var func = filters[index++];
            if (func == undefined) return;
            func(data, write, next);
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
