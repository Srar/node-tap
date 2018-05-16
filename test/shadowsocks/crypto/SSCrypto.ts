import ISSCryptoMethod from "./ISSCryptoMethod"

import RC4MD5 from "./CryptoMethods/RC4MD5"
import AES256CFB from "./CryptoMethods/AES256CFB"
import AES128GCM from "./CryptoMethods/AES128GCM"
import AES192GCM from "./CryptoMethods/AES192GCM"
import AES256GCM from "./CryptoMethods/AES256GCM"

var cryptoMethods: { [methodName: string]: any } = {}

cryptoMethods[new RC4MD5().getCryptoName().toLocaleLowerCase()] = RC4MD5;
cryptoMethods[new AES256CFB().getCryptoName().toLocaleLowerCase()] = AES256CFB;

cryptoMethods[new AES128GCM().getCryptoName().toLocaleLowerCase()] = AES128GCM;
cryptoMethods[new AES192GCM().getCryptoName().toLocaleLowerCase()] = AES192GCM;
cryptoMethods[new AES256GCM().getCryptoName().toLocaleLowerCase()] = AES256GCM;

export default class SSCrypto {

    static getAllCryptoMethods(): Array<String> {
        return Object.keys(cryptoMethods);
    }

    static createCryptoMethodObject(methodName: string, password: string): ISSCryptoMethod {
        if (!cryptoMethods[methodName.toLocaleLowerCase()]) {
            throw new Error(`Unsupported [${methodName}] crypto method.`);
        }
        var obj = new cryptoMethods[methodName](password);
        return obj;
    }
}