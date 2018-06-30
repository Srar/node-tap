import ISSCryptoMethod from "./ISSCryptoMethod";

import RC4 from "./CryptoMethods/RC4";
import RC4MD5 from "./CryptoMethods/RC4MD5";
import AES256CFB from "./CryptoMethods/AES256CFB";
import AES128GCM from "./CryptoMethods/AES128GCM";
import AES192GCM from "./CryptoMethods/AES192GCM";
import AES256GCM from "./CryptoMethods/AES256GCM";

const cryptoMethods: { [methodName: string]: any } = {};

cryptoMethods[new RC4().getCryptoName().toLocaleLowerCase()] = RC4;
cryptoMethods[new RC4MD5().getCryptoName().toLocaleLowerCase()] = RC4MD5;
cryptoMethods[new AES256CFB().getCryptoName().toLocaleLowerCase()] = AES256CFB;

cryptoMethods[new AES128GCM().getCryptoName().toLocaleLowerCase()] = AES128GCM;
cryptoMethods[new AES192GCM().getCryptoName().toLocaleLowerCase()] = AES192GCM;
cryptoMethods[new AES256GCM().getCryptoName().toLocaleLowerCase()] = AES256GCM;


export default class SSCrypto {

    public static getAllCryptoMethods(): Array<string> {
        return Object.keys(cryptoMethods);
    }

    public static createCryptoMethodObject(methodName: string, password: string): ISSCryptoMethod {
        if (!cryptoMethods[methodName.toLocaleLowerCase()]) {
            throw new Error(`Unsupported [${methodName}] crypto method.`);
        }
        const obj = new cryptoMethods[methodName](password);
        return obj;
    }
}
