/*

    AEAD Code From: https://github.com/blinksocks/ (Apache License 2.0)
   
*/

import * as crypto from "crypto";

import ICryptoKeyIV from "../../ICryptoKeyIV";
import CryptoTools from "../../CryptoTools";

const TAG_SIZE = 16;
const MIN_CHUNK_LEN = TAG_SIZE * 2 + 3;
const MIN_CHUNK_SPLIT_LEN = 0x0800;
const MAX_CHUNK_SPLIT_LEN = 0x3FFF;

/**
 * calculate the HMAC from key and message
 * @param algorithm
 * @param key
 * @param buffer
 * @returns {Buffer}
 */
function hmac(algorithm, key, buffer): Buffer {
    const hmac = crypto.createHmac(algorithm, key);
    return hmac.update(buffer).digest();
}

/**
 * HMAC-based Extract-and-Expand Key Derivation Function
 * @param hash, the message digest algorithm
 * @param salt, a non-secret random value
 * @param ikm, input keying material
 * @param info, optional context and application specific information
 * @param length, length of output keying material in octets
 * @returns {Buffer}
 */
function HKDF(hash, salt, ikm, info: string, length): Buffer {
    // Step 1: "extract" to fixed length pseudo-random key(prk)
    const prk = hmac(hash, salt, ikm);
    // Step 2: "expand" prk to several pseudo-random keys(okm)
    let t = Buffer.alloc(0);
    let okm = Buffer.alloc(0);
    for (let i = 0; i < Math.ceil(length / prk.length); ++i) {
        t = hmac(hash, prk, Buffer.concat([t, Buffer.from(info), Buffer.alloc(1, i + 1)]));
        okm = Buffer.concat([okm, t]);
    }
    // Step 3: crop okm to desired length
    return okm.slice(0, length);
}

/**
 * returns a random integer in [min, max].
 * @param min
 * @param max
 * @returns {Number}
 */
function getRandomInt(min: number, max: number): number {
    min = Math.ceil(min);
    max = Math.ceil(max);
    const random = crypto.randomBytes(1)[0] / (0xff + 1e-13);
    return Math.floor(random * (max - min + 1) + min);
}

/**
 * split buffer into chunks, each chunk size is picked randomly from [min, max]
 * @param buffer
 * @param min
 * @param max
 * @returns {Array<Buffer>}
 */
function getRandomChunks(buffer: Buffer, min: number, max: number): Array<Buffer> {
    const totalLen = buffer.length;
    const bufs = [];
    let ptr = 0;
    while (ptr < totalLen - 1) {
        const offset = getRandomInt(min, max);
        bufs.push(buffer.slice(ptr, ptr + offset));
        ptr += offset;
    }
    if (ptr < totalLen) {
        bufs.push(buffer.slice(ptr));
    }
    return bufs;
}

/**
 * convert a number to a buffer with specified length in specified byte order
 * @param num
 * @param len
 * @param byteOrder
 * @returns {Buffer}
 */
export function numberToBuffer(num: number, len: number = 2, bigEndian: boolean = true): Buffer {
    if (len < 1) {
        throw Error('len must be greater than 0');
    }

    const isOutOfRange = num > parseInt(`0x${'ff'.repeat(len)}`);
    if (isOutOfRange) {
        throw Error(`Number ${num} is too big to put into a ${len} byte(s) size buffer`);
    }

    const buf = Buffer.allocUnsafe(len);
    bigEndian ? buf.writeUIntBE(num, 0, len) : buf.writeUIntLE(num, 0, len);
    return buf;
}

export default class AEADCryotoProcess {

    private readonly cryptoKeyIV: ICryptoKeyIV;
    private readonly keyLength: number = -1;
    private readonly saltLength: number = -1;
    private readonly nonceLength: number = -1;
    private readonly cryptoName: string = "";

    private cipherKey: Buffer = null;
    private cipherNonce: number = 0;

    private decipherKey: Buffer = null;
    private decipherNonce: number = 0;

    private dataCache: Buffer = Buffer.allocUnsafe(0);

    constructor(cryptoName: string, keyLength: number, saltLength: number, nonceLength: number, password: string) {
        [this.cryptoName, this.keyLength, this.saltLength, this.nonceLength] = [cryptoName, keyLength, saltLength, nonceLength];
        this.cryptoKeyIV = CryptoTools.generateKeyIVByPassword(password, this.keyLength, 16);
    }

    public encryptData(data: Buffer): Buffer {
        let salt = null;
        if (this.cipherKey === null) {
            salt = crypto.randomBytes(this.saltLength);
            this.cipherKey = HKDF("sha1", salt, this.cryptoKeyIV.key, "ss-subkey", this.keyLength);
        }
        const chunks = getRandomChunks(data, MIN_CHUNK_SPLIT_LEN, MAX_CHUNK_SPLIT_LEN).map((chunk) => {
            const dataLen = numberToBuffer(chunk.length);
            const [encLen, lenTag] = this.encrypt(dataLen);
            const [encData, dataTag] = this.encrypt(chunk);
            return Buffer.concat([encLen, lenTag, encData, dataTag]);
        });
        if (salt) {
            return Buffer.concat([salt, ...chunks]);
        } else {
            return Buffer.concat(chunks);
        }
    }

    public decryptData(data?: Buffer): Buffer {
        if (data) {
            this.dataCache = Buffer.concat([this.dataCache, data]);
        }

        if (this.decipherKey === null) {
            if (this.dataCache.length < this.saltLength) {
                return null;
            }
            let salt = this.dataCache.slice(0, this.saltLength);
            this.decipherKey = HKDF("sha1", salt, this.cryptoKeyIV.key, "ss-subkey", this.keyLength);
            this.dataCache = this.dataCache.slice(this.saltLength);
            return this.decryptData();
        }

        let decryptedData: Buffer = Buffer.allocUnsafe(0);

        while (true) {
            if (this.dataCache.length < MIN_CHUNK_LEN) {
                return (decryptedData.length == 0 ? null : decryptedData);
            }

            /**
             *
             *   +---------+-------------+----------------+--------------+
             *   | DataLen | DataLen_TAG |      Data      |   Data_TAG   |
             *   +---------+-------------+----------------+--------------+
             *   |    2    |    Fixed    |    Variable    |    Fixed     |
             *   +---------+-------------+----------------+--------------+
             *
             **/

            let dataLength: number = this.getDataLength(this.dataCache);
            if (dataLength == null) {
                return (decryptedData.length == 0 ? null : decryptedData);
            }

            let fullChunkSize: number = 2 + TAG_SIZE + dataLength + TAG_SIZE;

            if (this.dataCache.length < fullChunkSize) {
                this.rollbackDecipherNonce();
                return (decryptedData.length == 0 ? null : decryptedData);
            }

            if (this.dataCache.length == fullChunkSize) {
                decryptedData = Buffer.concat([decryptedData, this.decryptChunk(this.dataCache)]);
                this.dataCache = Buffer.allocUnsafe(0);
                return (decryptedData.length == 0 ? null : decryptedData);
            }

            if (this.dataCache.length > fullChunkSize) {
                decryptedData = Buffer.concat([decryptedData, this.decryptChunk(this.dataCache.slice(0, fullChunkSize))]);
                this.dataCache = this.dataCache.slice(fullChunkSize);
            }

        }
    }

    private decryptChunk(chunk: Buffer): Buffer {
        // verify Data, Data_TAG
        const [encData, dataTag] = [chunk.slice(2 + TAG_SIZE, -TAG_SIZE), chunk.slice(-TAG_SIZE)];
        const data = this.decrypt(encData, dataTag);
        return data;
    }

    private getDataLength(data: Buffer): number {
        let encLen: Buffer = this.dataCache.slice(0, 2);
        let lenTag: Buffer = this.dataCache.slice(2, 2 + TAG_SIZE);

        let dataLengthBuffer: Buffer = this.decrypt(encLen, lenTag);
        if (dataLengthBuffer === null) {
            return null;
        }

        let dataLength = dataLengthBuffer.readUInt16BE(0);
        if (dataLength > MAX_CHUNK_SPLIT_LEN) {
            return null;
        }

        return dataLength;
    }

    private encrypt(data: Buffer): [Buffer, Buffer] {
        const nonce = numberToBuffer(this.cipherNonce, this.nonceLength, false);
        let ciphertext = null;
        let tag = null;
        const cipher: crypto.Cipher = crypto.createCipheriv(this.cryptoName, this.cipherKey, nonce);
        ciphertext = Buffer.concat([cipher.update(data), cipher.final()]);
        tag = cipher.getAuthTag();
        this.cipherNonce++;
        return [ciphertext, tag];
    }


    private decrypt(data: Buffer, tag: any): Buffer {
        const nonce = numberToBuffer(this.decipherNonce, this.nonceLength, false);
        const decipher = crypto.createDecipheriv(this.cryptoName, this.decipherKey, nonce);
        decipher.setAuthTag(tag);
        let plaintext = Buffer.concat([decipher.update(data), decipher.final()]);
        this.decipherNonce++;
        return plaintext;
    }

    private rollbackDecipherNonce() {
        if (this.decipherNonce > 0) {
            this.decipherNonce--;
        }
    }
}