import * as moment from "moment";
import * as winston from "winston";

moment.locale("zh-cn");

export default winston.createLogger({
    level: "info",
    format: winston.format.printf(info => {
        return `${moment().format("YYYY-MM-DD HH:mm:ss")} [${info.level}] ${info.message} ${info.stack || ''}`;
    }),
    transports: [
        new winston.transports.Console(),
    ]
});
