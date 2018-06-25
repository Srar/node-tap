/*

    AEAD Code From: https://github.com/blinksocks/ (Apache License 2.0)

*/

import ISSCryptoMethod from "../ISSCryptoMethod";
import AEADCryotoProcess from "./Share/AEADCryotoProcess";

export default class AES128GCM implements ISSCryptoMethod {

    private static readonly keyLength: number = 16;
    private static readonly saltLength: number = 16;
    private static readonly nonceLength: number = 12;
    private static readonly cryptoName: string = "aes-128-gcm";

    private readonly cryptoProcess: AEADCryotoProcess;

    constructor(private password?: string) {
        if (!password) {
            return;
        }
        this.cryptoProcess = new AEADCryotoProcess(
            this.getCryptoName(),
            AES128GCM.keyLength,
            AES128GCM.saltLength,
            AES128GCM.nonceLength,
            password,
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
        return AES128GCM.cryptoName;
    }
}
