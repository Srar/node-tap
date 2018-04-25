
const native = require("../index.js");
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
        const allDevicesInfo: Array<NativeTypes.DeviceInfo> = <Array<NativeTypes.DeviceInfo>>native.N_GetAllDevicesInfo();
        for (const device of allDevicesInfo) {
            if (device.description.toLocaleLowerCase().indexOf("tap-windows adapter v9") != -1) {
                this.deviceInfo = device;
            }
        }
        if (this.deviceInfo === null) {
            throw new NotFoundError("Openvpn adapter not found.");
        }
    }

    public static init(): TAPControl {
        if(this.tapControlObject === null) {
            this.tapControlObject = new TAPControl();
        }
        return TAPControl.tapControlObject;
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