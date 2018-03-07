import ICryptoKeyIV from "./ICryptoKeyIV";

interface ISSCryptoMethod {
    encryptData(data: Buffer): Buffer;
    decryptData(data: Buffer): Buffer;
    getCryptoName(): string;
}

export type ISSCryptoConstructor = { 
    new(password: string): ISSCryptoMethod 
};

export default ISSCryptoMethod;