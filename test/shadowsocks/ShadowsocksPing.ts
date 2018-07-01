import {Address} from 'cluster';
import {ShadowsocksHeaderVersion} from './ShadowsocksFormatter';
import ShadowsocksTcpClient from './ShadowsocksTcpClient';
import TcpPing, {PingResult,IPing,Options} from './../util/TcpPing';
import { IpcNetConnectOpts } from 'net';

export interface ShadowsocksOptions extends Options{
    method :string,
    passwd :string,
    attempts:number
}

export interface ShadowsocksPingResult extends PingResult{
    available:boolean
}

export default class ShadowsocksPing implements IPing{
   
    public async ping(options:ShadowsocksOptions) {
        const targetAddress : Buffer = Buffer.from("google.com");
        const targetPort : number = 80;
        let shadowsocksTcpClient :ShadowsocksTcpClient;
        let result:ShadowsocksPingResult;
        return new Promise<ShadowsocksPingResult>(async (reslove,reject)=>{
            result = await new TcpPing().ping(options) as ShadowsocksPingResult
            if (result.min === undefined) {
                reject(new Error("shadowsocks server unavailable!"))
                return;
            } 
            // verify shadowsocks config is vaild
            shadowsocksTcpClient = new ShadowsocksTcpClient(options.address, options.port,options.passwd ,options.method, ShadowsocksHeaderVersion.Domain, targetAddress, targetPort)
            shadowsocksTcpClient.once("connected", () => {
                    shadowsocksTcpClient.write(Buffer.from("GET / HTTP/1.1\r\n\r\n"));
            })
            shadowsocksTcpClient.once("data", (data) => {
                result.available = true;
                reslove(result);
            })
            shadowsocksTcpClient.connect(ShadowsocksHeaderVersion.Domain, targetAddress, targetPort);
            setTimeout(() => {
                    shadowsocksTcpClient
                        .destroy();
                reject(new Error("shadowsocks server unavailable!"))
            }, options.timeout);
        })

        
    }
}