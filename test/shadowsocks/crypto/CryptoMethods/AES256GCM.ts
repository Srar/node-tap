/*

    AEAD Code From: https://github.com/blinksocks/ (Apache License 2.0)
   
*/

import * as crypto from "crypto"
import ISSCryptoMethod from "../ISSCryptoMethod"
import AEADCryotoProcess from "./Share/AEADCryotoProcess"


export default class AES256GCM implements ISSCryptoMethod {

    private static readonly keyLength: number = 32;
    private static readonly saltLength: number = 32;
    private static readonly nonceLength: number = 12;
    private static readonly cryptoName: string = "aes-256-gcm";

    private readonly cryptoProcess: AEADCryotoProcess;

    constructor(private password?: string) {
        if (!password) {
            return;
        }
        this.cryptoProcess = new AEADCryotoProcess(
            this.getCryptoName(),
            AES256GCM.keyLength,
            AES256GCM.saltLength,
            AES256GCM.nonceLength,
            password
        );
    }

    public encryptData(data: Buffer): Buffer {
        return this.cryptoProcess.encryptData(data);
    }

    public decryptData(data?: Buffer): Buffer {
        return this.cryptoProcess.decryptData(data);
    }

    public encryptDataWithoutStream(data: Buffer): Buffer {
        return null;
    }

    public decryptDataWithoutStream(data: Buffer): Buffer {
        return null;
    }

    public getCryptoName(): string {
        return AES256GCM.cryptoName;
    }
}