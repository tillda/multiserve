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
}

startDevServer();