
export enum EthernetType {
    ARP,
    IPv4,
    IPv6,
}

export interface BasePacket {
    sourceAddress?: Buffer,
    destinaltionAddress?: Buffer,
    type?: EthernetType,
}

export interface ArpPacket extends BasePacket {
    hardwareType: Buffer,
    protocolType: Buffer,
    hardwareSize: Buffer,
    protocalSize: Buffer,
    opCode: Buffer,
    senderMacAddress: Buffer,
    senderIpAdress: Buffer,
    targetMacAddress: Buffer,
    targetIpAddeess: Buffer,
}

export enum IpProtocol {
    IPv6HopByHop = 0,
    ICMPv4 = 1,
    IGMP = 2,
    IPv4 = 4,
    TCP = 6,
    UDP = 17,
    RUDP = 27,
    IPv6 = 41,
    IPv6Routing = 43,
    IPv6Fragment = 44,
    GRE = 47,
    ESP = 50,
    AH = 51,
    ICMPv6 = 58,
    NoNextHeader = 59,
    IPv6Destination = 60,
    IPIP = 94,
    EtherIP = 97,
    SCTP = 132,
    UDPLite = 136,
    MPLSInIP = 137,
    IPv4_PSEUDO_LENGTH = 12
}

export interface IpPacket extends BasePacket {
    version?: number,
    ipHeaderLength?: number,
    TOS?: number,
    totalLength?: number,
    identification?: number,
    flags?: number,
    fragOffset?: number,
    TTL?: number,
    protocol?: IpProtocol,
    checksum?: number,
    sourceIp?: Buffer,
    destinationIp?: Buffer
}

export interface Ipv6Packet extends BasePacket {
    /* 4 bits version, 8 bits TC, 20 bits flow-ID */
    flow?: number
    payloadLength?: number,
    protocol?: IpProtocol,
    hopLimit?: number,
    sourceIp?: Buffer,
    destinationIp?: Buffer
}

export interface TcpPacket extends IpPacket {
    sourcePort?: number,
    destinationPort?: number,
    sequenceNumber?: number,
    acknowledgmentNumber?: number,
    tcpHeaderLength?: number,
    FIN?: boolean,
    SYN?: boolean,
    RST?: boolean,
    PSH?: boolean,
    ACK?: boolean,
    URG?: boolean,
    ECE?: boolean,
    CWR?: boolean,
    NS?: boolean,
    window?: number,
    checksum?: number,
    urgent?: number,
    options?: Buffer,
    payload?: Buffer,
}

export interface UdpPacket extends IpPacket {
    sourcePort?: number,
    destinationPort?: number,
    totalLength?: number,
    checksum?: number
    payload?: Buffer
}