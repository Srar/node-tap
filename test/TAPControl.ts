
const native = require("../index.js");

import * as path from "path"
import * as iconv from "iconv-lite"
import * as cprocess from "child_process"
import * as NativeTypes from "./NativeTypes"

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

export class NotFoundError extends Error {
    constructor(public message: string) {
        super();
    }
}

export default class TAPControl {

    private static tapControlObject: TAPControl = null;

    private deviceHandle: number = null;
    private deviceInfo: NativeTypes.DeviceInfo = null;
    private rwProcess = null;

    private constructor() {
        if (!TAPControl.checkAdapterIsInstalled()) {
            throw new NotFoundError("Openvpn adapter not found.");
        }
        const allDevicesInfo: Array<NativeTypes.DeviceInfo> = <Array<NativeTypes.DeviceInfo>>native.N_GetAllDevicesInfo();
        for (const device of allDevicesInfo) {
            if (device.description.toLocaleLowerCase().indexOf("tap-windows adapter v9") != -1) {
                this.deviceInfo = device;
            }
        }
    }

    public static init(): TAPControl {
        if (this.tapControlObject === null) {
            this.tapControlObject = new TAPControl();
        }
        return TAPControl.tapControlObject;
    }

    public static checkAdapterIsInstalled(): boolean {
        const allDevicesInfo: Array<NativeTypes.DeviceInfo> = <Array<NativeTypes.DeviceInfo>>native.N_GetAllDevicesInfo();
        for (const device of allDevicesInfo) {
            if (device.description.toLocaleLowerCase().indexOf("tap-windows adapter v9") != -1) {
                return true;
            }
        }
        return false;
    }

    public static installAdapter(installerPath: string): number {
        const result = cprocess.spawnSync(installerPath, ["install","OemVista.inf","tap0901"], {
            cwd: path.dirname(installerPath)
        } );
        const errorMessage: string = iconv.decode(result.stderr, "cp936").toString().trim();
        if (errorMessage.length != 0) {
            process.stderr.write(errorMessage);
            process.stdout.write("\n");
        }
        return result.status;
    }

    public getAdapterInfo(): NativeTypes.DeviceInfo {
        return this.deviceInfo;
    }

    public getAdapterHandle(): number {
        return this.deviceHandle;
    }

    public read(): Promise<Buffer> {
        return new Promise((resolve, reject) => {
            this.rwProcess.read(function (err, data) {
                err ? reject(err) : resolve(data);
            });
        });
    }

    public write(data: Buffer) {
        this.rwProcess.writeSync(data);
    }

    public enable(): number {
        if (this.deviceHandle !== null) {
            throw new Error("Openvpn adapter has been enabled.");
        }
        this.deviceHandle = native.N_CreateDeviceFile(this.deviceInfo.name);
        native.N_DeviceControl(this.deviceHandle, TAP_IOCTL_SET_MEDIA_STATUS, TRUE, 32);
        this.rwProcess = new native.RwEventProcess(this.deviceHandle);
        return this.deviceHandle;
    }

    public disable() {
        // unsupported.
    }
}