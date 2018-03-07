
var config = {};

export default class Config {

    public static set(key: string, value: any) {
        config[key] = value;
    }

    public static get(key?: string): any {
        if(key == undefined) {
            return config;
        }

        var value: any = config[key];
        if (value == undefined) {
            return null;
        }
        return value;
    }

    public static remove(key: string) {
        delete config[key];
    }

}