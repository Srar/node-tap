const native = require("../index.js");

import { promisify } from "util"
import * as cprocess from "child_process"
import * as NativeTypes from "./NativeTypes"
import DeviceConfiguration from "./DeviceConfiguration"

import TCP from "./filters/TCP"
import ARP from "./filters/ARP"

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
    var deviceInfo: NativeTypes.DeviceInfo = <NativeTypes.DeviceInfo>await promisify(native.N_GetDeviceInfo)();

    var deviceHandle: number = native.N_CreateDeviceFile(deviceInfo.instanceId);
    await promisify(native.N_DeviceControl)(deviceHandle, TAP_IOCTL_SET_MEDIA_STATUS, TRUE, 32);

    var deafultGateway: string = (<Array<NativeTypes.IpforwardEntry>>native.N_GetIpforwardEntry())[0].nextHop;

    var initCommands: Array<Array<string>> = [
        ["netsh", "interface", "ipv4", "set", "interface", `${deviceInfo.name}`, "metric=1"],
        ["netsh", "interface", "ipv6", "set", "interface", `${deviceInfo.name}`, "metric=1"],
        ["netsh", "interface", "ip", "set", "address", `name=${deviceInfo.name}`, "static", 
            DeviceConfiguration.LOCAL_IP_ADDRESS, DeviceConfiguration.LOCAL_NETMASK, DeviceConfiguration.GATEWAY_IP_ADDRESS],
        ["route", "delete", "0.0.0.0",  DeviceConfiguration.GATEWAY_IP_ADDRESS],
        ["route", "add", "10.1.1.11", "mask", "255.255.255.255", deafultGateway],
        ["route", "add", "114.114.114.114", "mask", "255.255.255.255", deafultGateway],
        ["route", "add", "114.114.115.115", "mask", "255.255.255.255", deafultGateway],
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
            dwForwardIfIndex: deviceInfo.index,
            dwForwardType: NativeTypes.IpforwardEntryType.MIB_IPROUTE_TYPE_INDIRECT,
            dwForwardProto: NativeTypes.IpforwardEntryProto.MIB_IPPROTO_NETMGMT,
            dwForwardAge: 0,
            dwForwardNextHopAS: 0,
            dwForwardMetric1: 2,
        })
        console.log("create ip forward entry result:", code == 0 ? "SUCCESS" : `ERROR code: ${code}`);
    }

    var filters: Array<Function> = [];
    filters.push(TCP);
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
