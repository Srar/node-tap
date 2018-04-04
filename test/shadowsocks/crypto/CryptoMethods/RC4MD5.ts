import * as crypto from "crypto";
import CryptoTools from "../CryptoTools";
import ICryptoKeyIV from "../ICryptoKeyIV";
import ISSCryptoMethod from "../ISSCryptoMethod"

export default class RC4MD5 implements ISSCryptoMethod {

    private static readonly keyLength: number = 16;
    private static readonly ivLength: number = 16;
    private static readonly cryptoName: string = "rc4-md5";
    private cryptoKeyIV: ICryptoKeyIV;

    private isFirstEncryptData: boolean = true;
    private isFirstDecryptData: boolean = true;

    private encryptProcess: crypto.Cipher = null;
    private decryptProcess: crypto.Decipher = null;

    constructor(private password?: string) {
        if (!password) {
            return;
        }
        this.cryptoKeyIV = CryptoTools.generateKeyIVByPassword(this.password, RC4MD5.keyLength, RC4MD5.ivLength);
    }

    encryptData(data: Buffer): Buffer {
          if (this.isFirstEncryptData) {
            this.isFirstEncryptData = false;
            this.cryptoKeyIV.iv = crypto.randomBytes(RC4MD5.ivLength);
            var rc4Process: Buffer = CryptoTools.generateRc4Md5KeyByKV(this.cryptoKeyIV);
            this.encryptProcess = crypto.createCipheriv("rc4", rc4Process , "");
            return Buffer.concat([this.cryptoKeyIV.iv, this.encryptProcess.update(data)]);
        }
        return this.encryptProcess.update(data);
    }

    decryptData(data: Buffer): Buffer {
         if (this.isFirstDecryptData) {
            this.isFirstDecryptData = false;
            var decryptIV: Buffer = data.slice(0, RC4MD5.ivLength);
            var rc4Process: Buffer = CryptoTools.generateRc4Md5KeyByKV({ key: this.cryptoKeyIV.key, iv: decryptIV });
            this.decryptProcess = crypto.createDecipheriv("rc4", rc4Process, "");
            return this.decryptProcess.update(data.slice(RC4MD5.ivLength));
        }
        return this.decryptProcess.update(data);
    }

    encryptDataWithoutStream(data: Buffer) {
        this.cryptoKeyIV.iv = crypto.randomBytes(RC4MD5.ivLength);
        var rc4Process: Buffer = CryptoTools.generateRc4Md5KeyByKV(this.cryptoKeyIV);
        var encryptProcess = crypto.createCipheriv("rc4", rc4Process , "");
        return Buffer.concat([this.cryptoKeyIV.iv, encryptProcess.update(data)]);
    }

    decryptDataWithoutStream(data: Buffer) {
        var decryptIV: Buffer = data.slice(0, RC4MD5.ivLength);
        var rc4Process: Buffer = CryptoTools.generateRc4Md5KeyByKV({ key: this.cryptoKeyIV.key, iv: decryptIV });
        var decryptProcess = crypto.createDecipheriv("rc4", rc4Process, "");
        return decryptProcess.update(data.slice(RC4MD5.ivLength));
    }

    getCryptoName(): string {
        return RC4MD5.cryptoName;
    }
}

