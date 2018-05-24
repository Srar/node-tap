# node-tap
基于TypeScript实现的Tun2Shadowsocks.
目前可用于Windows平台.

# 测试实现特性
* 缩水TCP实现(⚠️)
* UDP转发(✅)
* UDP转发多倍发包(✅)
* 自定义路由表(✅)

# 使用

1) 从Releases中下载已经打包完的版本.
> Releases中版本均64位编译, 可能无法在32位平台使用.
2) 安装[Npcap(Windows10)](https://nmap.org/npcap/), [WinPcap(Windows7)](https://www.winpcap.org/install/default.htm)来用于UDP多倍发包.
> 使用Npcap时安装页面`Installation Opentions`需要勾上`Install Npcap in WinPcap API-compatible Mode`. 
3) 使用管理员权限cmd或powershell中在已以下命令运行node-sstap.
```
.\sstap.exe --host [ss host] --port [ss port] --passwd [ss password] --xtudp [x times] --method [ss method]
```

* `host`: 默认 Shadowsocks地址(可选)
* `port`: 默认 Shadowsocks端口(可选)
* `passwd`: 默认 Shadowsocks密码(可选)
* `method`: 默认 Shadowsocks加密方式(可选)
* `tcphost`: TCP Shadowsocks地址(可选)
* `tcpport`: TCP Shadowsocks端口(可选)
* `tcppasswd`: TCP Shadowsocks密码(可选)
* `tcpmethod`: TCP Shadowsocks加密方式(可选)
* `udphost`: UDP Shadowsocks地址(可选)
* `udpport`: UDP Shadowsocks端口(可选)
* `udppasswd`: UDP Shadowsocks密码(可选)
* `udpmethod`: UDP Shadowsocks加密方式(可选)
* `xtudp`: UDP 多倍发包倍率(适用于游戏)
* `dns`: 指定DNS(默认8.8.8.8)
* `v6dns`: 指定IPv6 DNS(默认2001:4860:4860::8888)
* `skipdns`: DNS不经过Shadowsocks转发, IPv6 DNS会被禁用(默认`false`)
* `routes`: 指定单个或多个`CIDR`被转发, 例如: `1.1.1.1/32,2.2.2.2/24`(默认`0.0.0.0/0`)
* `disablev6`: 禁用IPv6转发(默认`true`)

> 启动添加路由时出现`对象已存在`或`找不到元素`为正常现象.

> 目前支持 `rc4-md5`, `aes-256-cfb`, `aes-128-gcm`, `aes-192-gcm`, `aes-256-gcm` 加密方式.

如果已经成功运行你应该会看到以下信息:
![snapshort.png](https://i.loli.net/2018/03/31/5abf7da82d4d1.png)

此时全部流量就全部转发到对应Shadowsocks服务器了.

# 框架图
![snapshort.png](https://i.loli.net/2018/03/31/5abf8255372bd.png)
> 该图来源: [http://blog.ucloud.cn/archives/3115](http://blog.ucloud.cn/archives/3115)

# 常见问题
Q: 启动过程中出现`The specified module could not be found`.

A: 重新安装`npcap`, 在`Installation Opentions`勾选`Install Npcap in WinPcap API-compatible Mode`.

Q: 启动过程中出现`create ip forward entry result: ERROR code: 5`.

A: 使用管理员权限运行.

Q: 目前是否支持不转发UDP?

A: 不支持.

Q: 参数内`TCP`与`UDP`作用.

A: 参数内`TCP`/`UDP`参数是针对`TCP`/`UDP`不同协议跑不同SS服务器所设计的. 如果您不需要协议单独分流那么只需要指定`host`, `port`, `passwd`, `method`即可.

Q: Windows7启动后无效果.

A: 卸载`npcap`使用[`winpcap`](https://www.winpcap.org/).

# 参考
* [net-speeder](https://github.com/snooda/net-speeder)
* [uIP](https://en.wikipedia.org/wiki/UIP_(micro_IP))
* [badvpn](https://github.com/ambrop72/badvpn)
* [gotun2socks](https://github.com/yinghuocho/gotun2socks)
* [blinksocks](https://github.com/blinksocks/blinksocks)
