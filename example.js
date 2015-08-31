<<<<<<< f82af63f2982a8f380b46d1ce58905fe31ba1af6
var multiserve = require("multiserve");

function startDevServer() {
  multiserve.start({
        port : 8888,
        routing : [
            { urlPath: '/',               fsPath: "foo" },
            { urlPath: '/src',            fsPath: "src" },
            { urlPath: '/',               fsPath: "bar" }
        ]
    }); 
=======
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
>>>>>>> Example
}

startDevServer();