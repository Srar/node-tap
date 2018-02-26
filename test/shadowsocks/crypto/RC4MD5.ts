import * as crypto from "crypto";
import CryptoTools from "./CryptoTools";
import ICryptoKeyIV from "./ICryptoKeyIV";
import ISSCryptoMethod from "./ISSCryptoMethod"

export default class RC4MD5 implements ISSCryptoMethod {

    private readonly keyLength: number = 16;
    private readonly ivLength: number = 16;
    private readonly cryptoName: string = "rc4-md5";
    private readonly cryptoKeyIV: ICryptoKeyIV;

    private isFirstEncryptData: boolean = true;
    private isFirstDecryptData: boolean = true;

    private encryptProcess: crypto.Cipher = null;
    private decryptProcess: crypto.Decipher = null;

    constructor(private password?: string) {
        if (!password) {
            return;
        }
        this.cryptoKeyIV = CryptoTools.generateKeyIVByPassword(this.password, this.keyLength, this.ivLength);
    }

    encryptData(data: Buffer): Buffer {
          if (this.isFirstEncryptData) {
            this.isFirstEncryptData = false;
            this.cryptoKeyIV.iv = crypto.randomBytes(this.ivLength);
            var rc4Process: Buffer = CryptoTools.generateRc4Md5KeyByKV(this.cryptoKeyIV);
            this.encryptProcess = crypto.createCipheriv("rc4", rc4Process , "");
            return Buffer.concat([this.cryptoKeyIV.iv, this.encryptProcess.update(data)]);
        }
        return this.encryptProcess.update(data);
    }

    decryptData(data: Buffer): Buffer {
         if (this.isFirstDecryptData) {
            this.isFirstDecryptData = false;
            var decryptIV: Buffer = data.slice(0, this.ivLength);
            var rc4Process: Buffer = CryptoTools.generateRc4Md5KeyByKV({ key: this.cryptoKeyIV.key, iv: decryptIV });
            this.decryptProcess = crypto.createDecipheriv("rc4", rc4Process, "");
            return this.decryptProcess.update(data.slice(this.ivLength));
        }
        return this.decryptProcess.update(data);
    }

    getCryptoName(): string {
        return this.cryptoName;
    }
}

