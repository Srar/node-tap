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
            this.encryptProcess = crypto.createCipheriv("rc4", this.cryptoKeyIV.key , "");
        }
        return this.encryptProcess.update(data);
    }

    public decryptData(data: Buffer): Buffer {
        if (this.isFirstDecryptData) {
            this.isFirstDecryptData = false;
            this.decryptProcess = crypto.createDecipheriv("rc4", this.cryptoKeyIV.key, "");
        }
        return this.decryptProcess.update(data);
    }

    public encryptDataWithoutStream(data: Buffer) {
        const encryptProcess = crypto.createCipheriv("rc4", this.cryptoKeyIV.key , "");
        return  Buffer.concat([encryptProcess.update(data), encryptProcess.final()]);
    }

    public decryptDataWithoutStream(data: Buffer) {
        const decryptProcess = crypto.createDecipheriv("rc4", this.cryptoKeyIV.key, "");
        return decryptProcess.update(data);
    }

    public getCryptoName(): string {
        return RC4.cryptoName;
    }
}

