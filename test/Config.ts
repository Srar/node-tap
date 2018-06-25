const config = {};

export default class Config {

    public static set(key: string, value: any) {
        config[key] = value;
    }

    public static get(key?: string): any {
        if (key === undefined) {
            return config;
        }

        return config[key];
    }

    public static remove(key: string) {
        delete config[key];
    }

}
