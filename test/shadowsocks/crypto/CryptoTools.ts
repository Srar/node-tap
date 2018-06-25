import * as crypto from "crypto";
import ICryptoKeyIV from "./ICryptoKeyIV";

export default class CryptoTools {

    public static generateKeyIVByPassword(passwordStr: string, keyLength: number, ivLength: number): ICryptoKeyIV {
        const password: Buffer = new Buffer(passwordStr.toString(), "binary");
        const hashBuffers: Array<Buffer> = [];
        for (let dataCount = 0, loopCount = 0; dataCount < keyLength + ivLength; loopCount++) {
            let data: any = password;
            if (loopCount > 0) {
                data = Buffer.concat([hashBuffers[loopCount - 1], password]);
            }
            const md5: crypto.Hash = crypto.createHash("md5");
            const md5Buffer: Buffer = md5.update(data).digest();
            hashBuffers.push(md5Buffer);
            dataCount += md5Buffer.length;
        }
        const hashBuffer: Buffer = Buffer.concat(hashBuffers);
        const key: Buffer = hashBuffer.slice(0, keyLength);
        const iv: Buffer = hashBuffer.slice(keyLength, keyLength + ivLength);
        return {
            key,
            iv,
        };
    }

    public static generateRc4Md5KeyByKV(kv: ICryptoKeyIV): Buffer {
        const md5 = crypto.createHash("md5");
        md5.update(kv.key);
        md5.update(kv.iv);
        return md5.digest();
    }
}
