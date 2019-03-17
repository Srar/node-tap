
interface ISSCryptoMethod {
    encryptData(data: Buffer): Buffer;
    decryptData(data: Buffer): Buffer;
    getCryptoName(): string;
}

// tslint:disable-next-line:interface-over-type-literal
export type ISSCryptoConstructor = {
    new(password: string): ISSCryptoMethod;
};

export default ISSCryptoMethod;
