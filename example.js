var multiserve = require("./multiserve");

function startDevServer() {
    multiserve.start({
        port: 10555,
        routing: [
            {urlPath: '/', fsPath: "env/stackone/htmlclient/index-dev.html"},
            {urlPath: '/style.css', fsPath: "src/vendor/htmlclient1/style.css"},
            {urlPath: '/htmlclient1-dev-working-directory', fsPath: "target/htmlclient1-dev-working-directory/"},
        ]
    });
}

startDevServer();