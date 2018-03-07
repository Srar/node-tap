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

export interface IpforwardEntry {
    destIp: string,
    netMask: string,
    nextHop: string,
    interfaceIndex: number,
    type: IpforwardEntryType,
    proto: IpforwardEntryProto,
    age: number,
    metric1: number,
}

export enum IpforwardEntryType {
    /* other */
    MIB_IPROUTE_TYPE_OTHER = 1,
    /* invalid route */
    MIB_IPROUTE_TYPE_INVALID = 2,
    /* local route where next hop is final destination */
    MIB_IPROUTE_TYPE_DIRECT = 3,
    /* remote route where next hop is not final destination */
    MIB_IPROUTE_TYPE_INDIRECT = 4,
}

export enum IpforwardEntryProto {
    /* other */
    MIB_IPPROTO_OTHER = 1,
    /* local interface */
    MIB_IPPROTO_LOCAL = 2,
    /* static route set through network management */
    MIB_IPPROTO_NETMGMT = 3,
    /* result of ICMP redirect */
    MIB_IPPROTO_ICMP = 4,
    /* Exterior Gateway Protocol (EGP) */
    MIB_IPPROTO_EGP = 5,
    /* Gateway-to-Gateway Protocol (GGP) */
    MIB_IPPROTO_GGP = 6,
    /* Hello protocol */
    MIB_IPPROTO_HELLO = 7,
    /* Routing Information Protocol (RIP) */
    MIB_IPPROTO_RIP = 8,
    /* Intermediate System-to-Intermediate System (IS-IS) protocol */
    MIB_IPPROTO_IS_IS = 9,
    /* End System-to-Intermediate System (ES-IS) protocol */
    MIB_IPPROTO_ES_IS = 10,
    /* Cisco Interior Gateway Routing Protocol (IGRP) */
    MIB_IPPROTO_CISCO = 11,
    /* BBN Internet Gateway Protocol (IGP) using SPF */
    MIB_IPPROTO_BBN = 12,
    /* Open Shortest Path First (OSPF) protocol */
    MIB_IPPROTO_OSPF = 13,
    /* Border Gateway Protocol (BGP) */
    MIB_IPPROTO_BGP = 14,
    /* special Windows auto static route */
    MIB_IPPROTO_NT_AUTOSTATIC = 10002,
    /* special Windows static route */
    MIB_IPPROTO_NT_STATIC = 10006,
    /* special Windows static route not based on Internet standards */
    MIB_IPPROTO_NT_STATIC_NON_DOD = 10007,
}