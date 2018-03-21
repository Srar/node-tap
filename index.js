var fs = require("fs");
var loaded = false;

if(fs.existsSync(__dirname + "/build/Release/addon.node")) {
    loaded = true;
    module.exports = require(__dirname + "/build/Release/addon.node");
}

if(fs.existsSync("addon.node") && !loaded) {
    loaded = true;
    module.exports = require(__dirname + "addon.node");
}