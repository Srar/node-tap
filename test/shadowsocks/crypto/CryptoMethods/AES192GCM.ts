/*

    AEAD Code From: https://github.com/blinksocks/ (Apache License 2.0)
   
*/

import * as crypto from "crypto"
import ISSCryptoMethod from "../ISSCryptoMethod"
import AEADCryotoProcess from "./Share/AEADCryotoProcess"


export default class AES192GCM implements ISSCryptoMethod {

    private static readonly keyLength: number = 24;
    private static readonly saltLength: number = 24;
    private static readonly nonceLength: number = 12;
    private static readonly cryptoName: string = "aes-192-gcm";

    private readonly cryptoProcess: AEADCryotoProcess;

    constructor(private password?: string) {
        if (!password) {
            return;
        }
        this.cryptoProcess = new AEADCryotoProcess(
            this.getCryptoName(),
            AES192GCM.keyLength,
            AES192GCM.saltLength,
            AES192GCM.nonceLength,
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
        return this.cryptoProcess.encryptDataWithoutStream(data);
    }

    public decryptDataWithoutStream(data: Buffer): Buffer {
        return this.cryptoProcess.decryptDataWithoutStream(data);
    }

    public getCryptoName(): string {
        return AES192GCM.cryptoName;
    }
}