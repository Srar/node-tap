export default class ConnectionManager<T> {

    private timer: number;
    private connections: { [key: string]: { lastAccessTime: number, value: T } } = {};
    private connectionsCount: number = 0;

    constructor(private timeout: number = 30) {
        this.timer = setInterval(this.gc.bind(this), 1000 * 30);
    }

    private gc() {
        const keys = Object.keys(this.connections);
        const time: number = this.getTime();
        for (const key of keys) {
            const item = this.connections[key];
            if (!(time - item.lastAccessTime > this.timeout)) {
                continue;
            }
            // tslint:disable-next-line:no-string-literal
            if (item.value["onFree"] !== undefined) {
                // tslint:disable-next-line:no-string-literal
                item.value["onFree"]();
            }
            this.remove(key);
        }
    }

    // tslint:disable-next-line:member-ordering
    public add(key: string, value: T) {
        if (this.connections[key] !== undefined) {
            return;
        }
        this.connections[key] = {
            value,
            lastAccessTime: this.getTime(),
        };
        this.connectionsCount++;
    }

    // tslint:disable-next-line:member-ordering
    public get(key: string): T {
        const value = this.connections[key];
        if (value === undefined) {
            return null;
        }
        value.lastAccessTime = this.getTime();
        return value.value;
    }

    // tslint:disable-next-line:member-ordering
    public remove(key: string) {
        if (this.connections[key] === undefined) {
            return;
        }
        this.connectionsCount--;
        delete this.connections[key];
    }

    // tslint:disable-next-line:member-ordering
    public getConnections(): number {
        return this.connectionsCount;
    }

    private getTime(): number {
        return Math.floor(new Date().getTime() / 1000);
    }

}
