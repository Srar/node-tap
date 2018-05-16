import * as crypto from "crypto";
import ICryptoKeyIV from "./ICryptoKeyIV";

export default class CryptoTools {

    public static generateKeyIVByPassword(passwordStr: string, keyLength: number, ivLength: number): ICryptoKeyIV {
        var password: Buffer = new Buffer(passwordStr.toString(), "binary");
        var hashBuffers: Array<Buffer> = [];
        for (var dataCount = 0, loopCount = 0; dataCount < keyLength + ivLength; loopCount++) {
            var data: any = password;
            if (loopCount > 0) {
                data = Buffer.concat([hashBuffers[loopCount - 1], password]);
            }
            var md5: crypto.Hash = crypto.createHash("md5");
            var md5Buffer: Buffer = md5.update(data).digest();
            hashBuffers.push(md5Buffer);
            dataCount += md5Buffer.length;
        }
        var hashBuffer: Buffer = Buffer.concat(hashBuffers);
        var key: Buffer = hashBuffer.slice(0, keyLength);
        var iv: Buffer = hashBuffer.slice(keyLength, keyLength + ivLength);
        return {
            key: key, iv: iv
        };
    }

    public static generateRc4Md5KeyByKV(kv: ICryptoKeyIV): Buffer {
        var md5 = crypto.createHash("md5");
        md5.update(kv.key);
        md5.update(kv.iv);
        var hash = md5.digest();
        return hash
    }
}