export default class ConnectionManager<T> {

    private timer: number;
    private connections: { [key: string]: { lastAccessTime: number, value: T } } = {};
    private connectionsCount: number = 0;

    constructor(private timeout: number = 30) {
        this.timer = setInterval(this.gc.bind(this), 1000 * 30);
    }

    private gc() {
        var keys = Object.keys(this.connections);
        var time: number = this.getTime();
        for (var key of keys) {
            var item = this.connections[key];
            if (!(time - item.lastAccessTime > this.timeout)) continue;
            if (item.value["onFree"] != undefined) {
                item.value["onFree"]();
            }
            this.remove(key);
        }
    }

    public add(key: string, value: T) {
        if (this.connections[key] != undefined) return;
        this.connections[key] = {
            value: value,
            lastAccessTime: this.getTime()
        };
        this.connectionsCount++;
    }

    public get(key: string): T {
        var value = this.connections[key];
        if (value == undefined) return null;
        value.lastAccessTime = this.getTime();
        return value.value;
    }

    public remove(key: string) {
        if (this.connections[key] == undefined) return;
        this.connectionsCount--;
        delete this.connections[key];
    }

    public getConnections(): number {
        return this.connectionsCount;
    }

    private getTime(): number {
        return Math.floor(new Date().getTime() / 1000);
    }

}