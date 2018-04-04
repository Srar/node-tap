import * as crypto from "crypto";

import ISSCryptoMethod from "../ISSCryptoMethod";
import ICryptoKeyIV from "../ICryptoKeyIV";

import CryptoTools from "../CryptoTools";
import AESCryptoProcess from "./Share/AESCryptoProcess";

export default class AES256CFB implements ISSCryptoMethod {

    private static readonly keyLength: number = 32;
    private static readonly ivLength: number = 16;
    private static readonly cryptoName: string = "aes-256-cfb";
    private readonly cryptoKeyIV: ICryptoKeyIV;
    private readonly cryptoProcess: AESCryptoProcess;

    constructor(private password?: string) {
        if (!password) {
            return;
        }
        this.cryptoKeyIV = CryptoTools.generateKeyIVByPassword(this.password, AES256CFB.keyLength, AES256CFB.ivLength);
        this.cryptoProcess = new AESCryptoProcess(AES256CFB.cryptoName, this.cryptoKeyIV.key, this.cryptoKeyIV.iv)
    }

    encryptData(data: Buffer): Buffer {
        return this.cryptoProcess.encryptData(data);
    }

    decryptData(data: Buffer): Buffer {
        return this.cryptoProcess.decryptData(data);
    }

    encryptDataWithoutStream(data: Buffer): Buffer {
        return this.cryptoProcess.encryptDataWithoutStream(data);
    }

    decryptDataWithoutStream(data: Buffer): Buffer {
        return this.cryptoProcess.decryptDataWithoutStream(data);
    }

    getCryptoName(): string {
        return AES256CFB.cryptoName;
    }
}