import * as crypto from "crypto";
import CryptoTools from "../CryptoTools";
import ICryptoKeyIV from "../ICryptoKeyIV";
import ISSCryptoMethod from "../ISSCryptoMethod";

export default class RC4 implements ISSCryptoMethod {

    private static readonly keyLength: number = 16;
    private static readonly ivLength: number = 0;
    private static readonly cryptoName: string = "rc4";
    private cryptoKeyIV: ICryptoKeyIV;

    private isFirstEncryptData: boolean = true;
    private isFirstDecryptData: boolean = true;

    private encryptProcess: crypto.Cipher = null;
    private decryptProcess: crypto.Decipher = null;

    constructor(private password?: string) {
        if (!password) {
            return;
        }
        this.cryptoKeyIV = CryptoTools.generateKeyIVByPassword(this.password, RC4.keyLength, RC4.ivLength);
    }

    public encryptData(data: Buffer): Buffer {
          if (this.isFirstEncryptData) {
            this.isFirstEncryptData = false;
            this.cryptoKeyIV.iv = crypto.randomBytes(RC4.ivLength);
            this.encryptProcess = crypto.createCipheriv("rc4", this.cryptoKeyIV.key , "");
            return Buffer.concat([this.cryptoKeyIV.iv, this.encryptProcess.update(data)]);
        }
        // tslint:disable-next-line:align
        return this.encryptProcess.update(data);
    }

    public  decryptData(data: Buffer): Buffer {
         if (this.isFirstDecryptData) {
            this.isFirstDecryptData = false;
            const decryptIV: Buffer = data.slice(0, RC4.ivLength);
            this.decryptProcess = crypto.createDecipheriv("rc4", this.cryptoKeyIV.key, "");
            return this.decryptProcess.update(data.slice(RC4.ivLength));
        }
        // tslint:disable-next-line:align
        return this.decryptProcess.update(data);
    }

    public encryptDataWithoutStream(data: Buffer) {
        this.cryptoKeyIV.iv = crypto.randomBytes(RC4.ivLength);
        // const rc4Process: Buffer = CryptoTools.generateRc4Md5KeyByKV(this.cryptoKeyIV);
        const encryptProcess = crypto.createCipheriv("rc4", this.cryptoKeyIV.key , "");
        return Buffer.concat([this.cryptoKeyIV.iv, encryptProcess.update(data)]);
    }

    public decryptDataWithoutStream(data: Buffer) {
        const decryptIV: Buffer = data.slice(0, RC4.ivLength);
        const decryptProcess = crypto.createDecipheriv("rc4", this.cryptoKeyIV.key, "");
        return decryptProcess.update(data.slice(RC4.ivLength));
    }

    public getCryptoName(): string {
        return RC4.cryptoName;
    }
}

