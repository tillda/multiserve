var express = require('express');
var http = require('http');
var clc = require('cli-color');
var path = require('path');
var url = require("url");
var fs = require("fs");
var jade = require("jade");
var notice = clc.blue;
var favicon = require('serve-favicon');
var morgan = require('morgan');
var bodyParser = require('body-parser');
var methodOverride = require('method-override');
var errorhandler = require('errorhandler');
var mime = require('mime-types');

var logging = false;

function absolutePathFromCwd(p) {
    return path.join(process.cwd(), p).replace(/([^\/]*)\/\.\.\//g, "");
}

function absolutePathFromCurrentFile(p) {
    return path.join(__dirname, p).replace(/([^\/]*)\/\.\.\//g, "");
}

var servedDirectories = [];

function serve(app, urlPath, fsPath) {
    var fullFsPath = absolutePathFromCwd(fsPath);
    log("STATIC", leadingSlash(urlPath, true), fullFsPath);
    app.use(leadingSlash(urlPath, true), express.static(fullFsPath));
    servedDirectories.push({
        fsPath: fullFsPath,
        mountPath: urlPath
    });
}

function log() {
    if (logging) {
        console.log.apply(console, arguments);
    }
}

function exists(fsFilePath) {
    var ex = fs.existsSync(fsFilePath);
    log(ex ? "                EXISTS" : "                NOT EXIST", fsFilePath);
    return ex;
}

function getFile(somePath, add) {
    var fsFilePath = add ? path.join(somePath, add) : somePath;
    var ex = fs.existsSync(fsFilePath);
    var dir = ex ? fs.lstatSync(fsFilePath).isDirectory() : false;
    var result = ex && !dir;
    log(result ? "                  IS FILE" : "                  NOT FILE", fsFilePath);
    return result ? fsFilePath : null;
}

function getExistingMarkupTemplate(fsFilePath) {
    var newPath;

    if (newPath = getFile(fsFilePath)) {
        log("                ◉ FILE FOUND");
        return newPath;
    }

    if ((endsWithSlash(fsFilePath)) && (newPath = getFile(trailingSlash(fsFilePath, false)))) {
        log("                ◉ FILE FOUND");
        return newPath;
    }

    if (newPath = getFile(fsFilePath, "index.html")) {
        log("                ◉ FILE FOUND");
        return newPath;
    }

    if (newPath = getFile(fsFilePath, "index.jade")) {
        log("                ◉ FILE FOUND");
        return newPath;
    }

    log("                ✘ NO FILE FOUND");
    return null;
}

function leadingSlash(url, b) {
    return (b ? "/" : "") + url.replace(/^ *\//, "");
}

function trailingSlash(url, b) {
    return url.replace(/\/ *$/, "") + (b ? "/" : "");
}

function endsWithSlash(url) {
    return /\/ *$/.test(url);
}

function urlToPath(requestUrl) {
    log("\n");
    log("PROCESSING", requestUrl);
    var urlPathSegment;
    for (var i = 0; i < servedDirectories.length; i++) {
        urlPathSegment = url.parse(requestUrl).pathname || "";
        log("    TRYING MOUNT POINT ", i, ":", servedDirectories[i].mountPath, "->", servedDirectories[i].fsPath);
        log("    ► MATCHING", urlPathSegment);
        log("          WITH", servedDirectories[i].mountPath);
        if (urlPathSegment.indexOf(servedDirectories[i].mountPath) === 0) {
            log("        ✔ MATCH");
            var config = servedDirectories[i];
            urlPathSegment = urlPathSegment.slice(servedDirectories[i].mountPath.length);
            log("              REAL FS PART", leadingSlash(urlPathSegment, false));
            var fsTryPath = path.join(config.fsPath + "/", urlPathSegment);
            log("              TRANSLATED FS PATH", fsTryPath);
            var fsFilePath = getExistingMarkupTemplate(fsTryPath);
            log("              FILE", fsFilePath);
            if (fsFilePath) {
                return fsFilePath;
            }
        } else {
            log("        ✘ NOT MATCH");
        }
    }
    return null;
}

function renderFile(fsFilePath, res, next) {
    var ext = path.extname(fsFilePath);
    var data;
    var output;
    switch (ext) {
        case ".html":
            res.setHeader("Content-Type", "text/html");
            data = fs.readFileSync(fsFilePath);
            output = render(data, path.dirname(fsFilePath));
            respond(output);
            break;
        case ".jade":
            res.setHeader("Content-Type", "text/html");
            jade.renderFile(fsFilePath, renderData, function (err, html) {
                if (err) {
                    throw err;
                }
                respond(html);
            });
            break;
    }

    function render(data, dir) {
        return data.toString().replace(/\{\{>([^\}]*)\}\}/g, function (match, p) {
            var includeFile = path.join(dir, p.trim());
            return "<!-- @@ {source:'" + includeFile + "'} -->" + render(fs.readFileSync(includeFile), path.dirname(includeFile));
        });
    }

    function respond(data) {
        res.send(data);
    }

    return next();
}

var app;

function resolvePath(urlPath) {
    return urlToPath(leadingSlash(urlPath, true));
}

function startWebServer(port, isRestart) {

    app = express();

    app.set('port', port || process.env.PORT);
    app.use(favicon(absolutePathFromCurrentFile("favicon.ico")));

    app.use(function (req, res, next) {
        res.setHeader("Access-Control-Allow-Origin", "*");
        next();
    });

    app.use(function (req, res, next) {
        var p = resolvePath(req.url);
        if (p) {
            renderFile(p, res, next);
        } else {
            return next();
        }
    });


    app.use(errorhandler());
    app.locals.pretty = true;

    var server = http.createServer(app);
    server.listen(app.get('port'), function () {
        if (!isRestart) {
            console.log("Dev server started on port: " + app.get('port'));
        }
    });

    app.use(morgan('dev'));

    return server;

}

function mountDirectories(app, configs) {
    servedDirectories = [];
    configs.forEach(function (config) {
        serve(app, leadingSlash(config.urlPath, true), config.fsPath);
    });
}

function logRouting(configs) {
    configs.forEach(function (config) {
        console.log(notice(leadingSlash(config.urlPath, true)) + " ━► " + absolutePathFromCwd(config.fsPath));
    });
}

var renderData = {};

module.exports = {
    server: null,
    running: false,
    start: function (config, isRestart) {
        this.server = startWebServer(config.port, isRestart);
        renderData.config = config;
        mountDirectories(app, config.routing);
        if (!isRestart) {
            logRouting(config.routing);
        }
        this.running = true;
    },
    stop: function () {
        this.server.close();
        this.running = false;
    }
};