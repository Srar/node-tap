export interface DeviceInfo  {
    id: string,
    name: string,
    type: number,
    index: number,
    address: Buffer,
    dhcpEnable: boolean,
    instanceId: string,
    currentIpAddress: string,
    gatewayIpAddress: string,
    dhcpServer: string,
    primaryWinsServer: string,
    secondaryWinsServer: string
};