import {Socket} from 'net'

export interface Options {
    address : string,
    port : number,
    attempts?: number,
    timeout?: number
}

export interface PingResult {
    address : string,
    port : number,
    attempts : number,
    avg : number,
    max : number,
    min : number,
    results : Array < PingResultItem >
}

export interface PingResultItem {
    seq : number,
    time : number,
    err?: any
}

export interface IPing{
    ping(options:Options):any
}
export default class TcpPing implements IPing {
    public ping(options : Options) : Promise < PingResult > {
        return new Promise < PingResult > (function (reslove, reject) {
            let i = 0;
            let results : Array < PingResultItem >= [];
            options.address = options.address || 'localhost';
            options.port = options.port || 80;
            options.attempts = options.attempts || 10;
            options.timeout = options.timeout || 5000;
            let check = function (options) {
                if (i < options.attempts) {
                    connect(options);
                } else {
                    let avg = results.reduce(function (prev, curr) {
                        return prev + curr.time;
                    }, 0);
                    let max = results.reduce(function (prev, curr) {
                        return (prev > curr.time)
                            ? prev
                            : curr.time;
                    }, results[0].time);
                    let min = results.reduce(function (prev, curr) {
                        return (prev < curr.time)
                            ? prev
                            : curr.time;
                    }, results[0].time);
                    avg = avg / results.length;
                    let out : PingResult = {
                        address: options.address,
                        port: options.port,
                        attempts: options.attempts,
                        avg: avg,
                        max: max,
                        min: min,
                        results: results
                    };
                    reslove(out);
                }
            };

            let connect = function (options) {
                let s = new Socket();
                let start = process.hrtime();
                s.connect(options.port, options.address, function () {
                    let time_arr = process.hrtime(start);
                    let time = (time_arr[0] * 1e9 + time_arr[1]) / 1e6;
                    results.push({seq: i, time: time});
                    s.destroy();
                    i++;
                    check(options);
                });
                s.on('error', function (e) {
                    results.push({seq: i, time: undefined, err: e});
                    s.destroy();
                    i++;
                    check(options);
                });
                s.setTimeout(options.timeout, function () {
                    results.push({seq: i, time: undefined, err: Error('Request timeout')});
                    s.destroy();
                    i++;
                    check(options);
                });
            };
            connect(options);
        });
    }
}