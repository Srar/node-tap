import * as crypto from "crypto"

export default class AESCryptoProcess {

    private isFirstEncryptData: boolean = true;
    private isFirstDecryptData: boolean = true;

    private encryptProcess: crypto.Cipher = null;
    private decryptProcess: crypto.Decipher = null;

    constructor(
        private cryptoName: string,
        private KEY: any,
        private IV: any,
    ) {

    }

    encryptData(data: Buffer): Buffer {
        if (this.isFirstEncryptData) {
            this.isFirstEncryptData = false;
            var randomIV = crypto.randomBytes(this.IV.length);
            this.encryptProcess = crypto.createCipheriv(this.cryptoName, this.KEY, randomIV);
            return Buffer.concat([randomIV, this.encryptProcess.update(data)]);
        }
        return this.encryptProcess.update(data);
    }

    decryptData(data: Buffer): Buffer {
        if (this.isFirstDecryptData) {
            this.isFirstDecryptData = false;
            var decryptIV: Buffer = data.slice(0, this.IV.length);
            this.decryptProcess = crypto.createDecipheriv(this.cryptoName, this.KEY, decryptIV);
            return this.decryptProcess.update(data.slice(this.IV.length));
        }
        return this.decryptProcess.update(data);
    }

    encryptDataWithoutStream(data: Buffer): Buffer {
        var randomIV = crypto.randomBytes(this.IV.length);
        var encryptProcess = crypto.createCipheriv(this.cryptoName, this.KEY, randomIV);
        return Buffer.concat([randomIV, encryptProcess.update(data)]);
    }

    decryptDataWithoutStream(data: Buffer): Buffer {
        var decryptIV: Buffer = data.slice(0, this.IV.length);
        var decryptProcess = crypto.createDecipheriv(this.cryptoName, this.KEY, decryptIV);
        return decryptProcess.update(data.slice(this.IV.length));
    }
}