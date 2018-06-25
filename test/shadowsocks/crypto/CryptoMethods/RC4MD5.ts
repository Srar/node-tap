import * as crypto from "crypto";
import CryptoTools from "../CryptoTools";
import ICryptoKeyIV from "../ICryptoKeyIV";
import ISSCryptoMethod from "../ISSCryptoMethod";

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

    public encryptData(data: Buffer): Buffer {
          if (this.isFirstEncryptData) {
            this.isFirstEncryptData = false;
            this.cryptoKeyIV.iv = crypto.randomBytes(RC4MD5.ivLength);
            const rc4Process: Buffer = CryptoTools.generateRc4Md5KeyByKV(this.cryptoKeyIV);
            this.encryptProcess = crypto.createCipheriv("rc4", rc4Process , "");
            return Buffer.concat([this.cryptoKeyIV.iv, this.encryptProcess.update(data)]);
        }
        // tslint:disable-next-line:align
        return this.encryptProcess.update(data);
    }

    public  decryptData(data: Buffer): Buffer {
         if (this.isFirstDecryptData) {
            this.isFirstDecryptData = false;
            const decryptIV: Buffer = data.slice(0, RC4MD5.ivLength);
            const rc4Process: Buffer = CryptoTools.generateRc4Md5KeyByKV({ key: this.cryptoKeyIV.key, iv: decryptIV });
            this.decryptProcess = crypto.createDecipheriv("rc4", rc4Process, "");
            return this.decryptProcess.update(data.slice(RC4MD5.ivLength));
        }
        // tslint:disable-next-line:align
        return this.decryptProcess.update(data);
    }

    public encryptDataWithoutStream(data: Buffer) {
        this.cryptoKeyIV.iv = crypto.randomBytes(RC4MD5.ivLength);
        const rc4Process: Buffer = CryptoTools.generateRc4Md5KeyByKV(this.cryptoKeyIV);
        const encryptProcess = crypto.createCipheriv("rc4", rc4Process , "");
        return Buffer.concat([this.cryptoKeyIV.iv, encryptProcess.update(data)]);
    }

    public decryptDataWithoutStream(data: Buffer) {
        const decryptIV: Buffer = data.slice(0, RC4MD5.ivLength);
        const rc4Process: Buffer = CryptoTools.generateRc4Md5KeyByKV({ key: this.cryptoKeyIV.key, iv: decryptIV });
        const decryptProcess = crypto.createDecipheriv("rc4", rc4Process, "");
        return decryptProcess.update(data.slice(RC4MD5.ivLength));
    }

    public getCryptoName(): string {
        return RC4MD5.cryptoName;
    }
}

