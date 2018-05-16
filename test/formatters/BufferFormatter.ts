

export default class BufferFormatter {
    private offset: number;
    private readonly buffer: Buffer;

    constructor(buffer: Buffer) {
        this.offset = 0;
        this.buffer = buffer;
    }

    public skipBytes(bytes: number) {
        this.increaseOffset(bytes);
    }

    public readByte(increase: boolean = true): number {
        var byte = this.buffer[this.offset];
        if(increase) {
            this.increaseOffset(1);
        }
        return byte;
    }

    public writeByte(value: number) {
        this.buffer[this.offset] = value;
        this.increaseOffset(1);
    }

    public writeBytes(buffer: Buffer) {
        buffer.copy(this.buffer, this.offset);
        this.increaseOffset(buffer.length);
    }

    public readString(length?: number): string {
        return this.readBuffer(length).toString();
    }

    public readBuffer(length?: number): Buffer {
        var buffer;
        if (length == undefined) {
            buffer = this.buffer.slice(this.offset);
            this.setOffset(buffer.length);
        } else {
            buffer = this.buffer.slice(this.offset, this.offset + length);
            this.increaseOffset(length);
        }
        return buffer;
    }

    public readUInt16BE(increase: boolean = true): number {
        var value = this.buffer.readUInt16BE(this.offset);
        if(increase) {
            this.increaseOffset(2);
        }
        return value;
    }

    public readUInt32BE(increase: boolean = true): number {
        var value = this.buffer.readUInt32BE(this.offset);
        if(increase) {
            this.increaseOffset(4);
        }
        return value;
    }

    public writeUInt16BE(value: number) {
        this.buffer.writeUInt16BE(value, this.offset);
        this.increaseOffset(2);
    }

    public writeUInt32BE(value: number) {
        this.buffer.writeUInt32BE(value, this.offset);
        this.increaseOffset(4);
    }

    public setOffset(value: number) {
        this.offset = value;
    }

    public getOffset(): number {
        return this.offset;
    }

    public increaseOffset(value: number) {
        this.setOffset(this.offset + value);
    }
    
    public getBuffer(): Buffer {
        return this.buffer;
    }
}