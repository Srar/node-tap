import * as EventEmitter from "events";
import {TcpServerSession, TcpStack} from "../filters/TCP"
import ShadowsocksTcpClient from './../shadowsocks/ShadowsocksTcpClient';
import { ShadowsocksHeaderVersion } from "../shadowsocks/ShadowsocksFormatter";
import { EthernetType } from "../PacketsStruct";
import Config from "../Config";

const SHADOWSOCKS_TUNNEL_LOG_ENABLE = false;

class ShadowsocksTunnel extends EventEmitter{
    private shadowsocksTcpClient : ShadowsocksTcpClient = null;

    constructor(
        private host:string,
        private port:number,
        private passwd:string,
        private method:string,
        private tcpSession:TcpServerSession
    ){
        super();
        if(SHADOWSOCKS_TUNNEL_LOG_ENABLE)console.log("start tunnel")
        const ipversion:ShadowsocksHeaderVersion = tcpSession.connection.ipversion == EthernetType.IPv4 ? ShadowsocksHeaderVersion.IPv4:ShadowsocksHeaderVersion.IPv6;
        this.shadowsocksTcpClient = new ShadowsocksTcpClient(
            host,
            port,
            passwd,
            method,
            ipversion,
            this.tcpSession.connection.localIp,
            this.tcpSession.connection.localPort
        );
        this.shadowsocksTcpClient.connect(ipversion,null,null);
        this.shadowsocksTcpClient.on("data",this.shadowsocksToTcp.bind(this));
        this.shadowsocksTcpClient.on("disconnected",this.shadowsocksDisconnected.bind(this));
        this.tcpSession.on("read",this.tcpToShadowsocks.bind(this));
    }

    private shadowsocksToTcp(data:Buffer){
        if(SHADOWSOCKS_TUNNEL_LOG_ENABLE)console.log("send data to tcp")
        this.shadowsocksTcpClient.pause(true);
        this.tcpSession.write(data);
        this.shadowsocksTcpClient.pause(false);
    }

    private tcpToShadowsocks(data:Buffer){
        // console.log("send data to shadowsocks server")
        this.shadowsocksTcpClient.write(data);
    }

    private shadowsocksDisconnected(){
        if(SHADOWSOCKS_TUNNEL_LOG_ENABLE)console.log(`close ${this.tcpSession.connection.localIp}:${this.tcpSession.connection.localPort}`)
        this.tcpSession.close();
    }
    
}

export default function (data: Buffer, write: (data: Buffer) => void, next: () => void) {
    const tcpStack :TcpStack = new TcpStack(write);
    tcpStack.on("accept",(session)=>{
        if(SHADOWSOCKS_TUNNEL_LOG_ENABLE)console.log("accept new session")
        new ShadowsocksTunnel(
            Config.get("ShadowsocksTcpHost"),
            Config.get("ShadowsocksTcpPort"),
            Config.get("ShadowsocksTcpPasswd"),
            Config.get("ShadowsocksTcpMethod"),
            session
        )
    })
    tcpStack.input(data);
    next();
}
