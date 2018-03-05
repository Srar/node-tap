class ConnectionNode<T> {

    private lastAccessTime: number = 0;

    private lastNode: ConnectionNode<T> = null;
    private nextNode: ConnectionNode<T> = null;

    constructor(private key: string, private value: T) {
        this.updateLastAccessTime();
    }

    public updateLastAccessTime(): ConnectionNode<T> {
        this.lastAccessTime = Math.floor(new Date().getTime() / 1000);
        return this;
    }

    public getLastAccessTime(): number {
        return this.lastAccessTime;
    }

    public getKey(): string {
        return this.key;
    }

    public getValue(): T {
        return this.value;
    }

    public getLastNode(): ConnectionNode<T> {
        return this.lastNode;
    }

    public getNextNode(): ConnectionNode<T> {
        return this.nextNode;
    }

    public setLastNode(node: ConnectionNode<T>): ConnectionNode<T> {
        this.lastNode = node;
        return this;
    }

    public setNextNode(node: ConnectionNode<T>): ConnectionNode<T> {
        this.nextNode = node;
        return this;
    }

    public isLastNode() {
        return this.nextNode == null;
    }

    public isFirstNode() {
        return this.lastNode == null;
    }
}

export default class ConnectionManager<T> {

    private gcTimer: number;
    private timeout: number;
    private connectionCount: number = 0;

    private firstConnection: ConnectionNode<T>;
    private lastConnection: ConnectionNode<T>;
    private connectionHashContainer: { [key: string]: ConnectionNode<T> } = {};

    constructor(timeout: number = 30) {
        this.timeout = timeout;
        this.gcTimer = setInterval(this.gc.bind(this), 1000 * 30);
    }

    public gc() {
        var time: number = Math.floor(new Date().getTime() / 1000);
        while (true) {
            if (!this.lastConnection) {
                return;
            }

            if (time - this.lastConnection.getLastAccessTime() > this.timeout) {
                if(this.lastConnection.getValue()["onFree"]) {
                    this.lastConnection.getValue()["onFree"]();
                }
                this.remove(this.lastConnection.getKey());
                continue;
            }
            return;
        }
    }

    public get(key: string): T {
        var cache = this.connectionHashContainer[key];
        if (cache == undefined) return null;
        if (cache.isFirstNode()) return cache.getValue();

        if (cache.isLastNode()) {
            var newLastNode = cache.getLastNode();
            newLastNode.setNextNode(null);
        } else {
            cache.getLastNode().setNextNode(cache.getNextNode());
        }

        cache.setNextNode(this.firstConnection);
        this.firstConnection.setLastNode(cache);
        this.firstConnection = cache;

        return cache.getValue();
    }

    public getFirst(): T {
        if (this.firstConnection) {
            return this.firstConnection.getValue();
        }
        return null;
    }

    public getLast(raw): T {
        if (this.lastConnection) {
            return this.lastConnection.getValue();
        }
        return null;
    }

    public add(key: string, val: T): boolean {
        if (this.get(key) != null) return false;

        var connection: ConnectionNode<T> = new ConnectionNode(key, val);

        if (this.connectionCount == 0) {
            this.firstConnection = connection;
            this.lastConnection = connection;
        } else {
            this.firstConnection.setLastNode(connection);
            connection.setNextNode(this.firstConnection);
            this.firstConnection = connection;
        }
        this.connectionCount++;
        this.connectionHashContainer[key] = connection;

        return true;
    }

    public remove(key: string) {
        var cache = this.connectionHashContainer[key];
        if (cache == undefined) return;

        this.connectionCount--;
        delete this.connectionHashContainer[key];

        if (this.connectionCount == 0) {
            this.firstConnection = null;
            this.lastConnection = null;
        }

        if (cache.isFirstNode()) {
            this.firstConnection = cache.getNextNode();
            return;
        }

        if (cache.isLastNode()) {
            this.lastConnection = cache.getLastNode();
            return;
        }

        cache.getLastNode().setNextNode(cache.getNextNode());
        cache.getNextNode().setLastNode(cache.getLastNode());
    }

    getConnectionCount(): number {
        return this.connectionCount;
    }
}