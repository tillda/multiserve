var express = require('express');
var http = require('http');
var clc = require('cli-color');
var path = require('path');
var url = require("url");
var fs = require("fs");
var jade = require("jade");
var notice = clc.blue;

var logging = true;

function absolutePath(p) {
    return path.join(__dirname, p).replace(/([^\/]*)\/\.\.\//g, "");
}

var servedDirectories = [];

function serve(app, urlPath, fsPath) {
    var fullFsPath = absolutePath(fsPath);
    app.use("/" + urlPath, express.static(fullFsPath));
    app.use(function(req, res, next){
    	res.setHeader("Access-Control-Allow-Origin", "*");
    	next();
 	});    
    servedDirectories.push({
    	fsPath : fullFsPath,
    	mountPath : urlPath
    });
}

function log() {
	if (logging) {
		console.log.apply(console, arguments);
	}
}

function getExistingMarkupTemplate(fsFilePath) {
	if (!fs.existsSync(fsFilePath)) {
		return fsFilePath.replace(/\.html$/, ".jade");
	} else {
		return fsFilePath;
	}
}

function leadingSlash(url, b) {
	return (b ? "/" : "") + url.replace(/^\//, "");
}

function urlToPath(requestUrl) {
	var urlPathSegment = url.parse(requestUrl).pathname || "";
	for (var i=1; i<servedDirectories.length; i++) if (urlPathSegment.indexOf(servedDirectories[i].mountPath) === 0) {
		var config = servedDirectories[i];
		var fsFilePath = getExistingMarkupTemplate(path.join(config.fsPath+"/", urlPathSegment));
		if ((!/\.(html|jade)$/.test(fsFilePath)) || (!fs.existsSync(fsFilePath))) {
			return null;
		} else {
			return fsFilePath;
		}
	}
	return null;
}

function renderFile(fsFilePath, req, res, next, options) {

	var ext = path.extname(fsFilePath);
	var data;

	res.setHeader("Content-Type", "text/html");
	res.setHeader("Access-Control-Allow-Origin", "*");
	res.setHeader("Content-Disposition", "inline");

	var output;
	switch (ext) {
		case ".html":
				data = fs.readFileSync(fsFilePath);
				output = render(data, path.dirname(fsFilePath));
				respond(output);
				break;
		case ".jade":
				jade.renderFile(fsFilePath, renderData, function (err, html) {
                    if (err) {
                        throw err;
                    }
                    respond(html);
				});
				break;
		default :
				return next();
				throw new Error("Can't render " + fsFilePath);
	}

	function render(data, dir) {
		return data.toString().replace(/\{\{>([^\}]*)\}\}/g, function(match, p) {
			var includeFile = path.join(dir, p.trim());
			return "<!-- @@ {source:'" + includeFile+ "'} -->" + render(fs.readFileSync(includeFile), path.dirname(includeFile));
		});
	}

	function respond(data) {
		res.send(data);
	}

}

var app;

function trySlashVariants(urlPath) {
	return urlToPath(leadingSlash(urlPath, true)) || urlToPath(leadingSlash(urlPath, false));
}

function startWebServer(port, isRestart) {

	app = express();

	app.configure(function(){

	    app.set('port', port || process.env.PORT);

	    app.use(express.favicon());
	    app.use(express.logger('dev'));
	    app.use(express.bodyParser());
	    app.use(express.methodOverride());

		app.use(function(req, res, next) {
			var p = trySlashVariants(req.url);
			if (p) {
				renderFile(p, req, res, next, {});
			} else {
				return next();
			}
		});

		app.use(function(req, res, next) {
			var parsedUrl = url.parse(req.url);
			var urlPathSegment = parsedUrl.pathname.replace(/\/$/, "") + "/";
			var indexUrl = url.resolve(urlPathSegment, "index.html");
			var p = trySlashVariants(indexUrl);
			if (p) {
				if (!/\/$/.test(req.url.trim())) {
					res.statusCode = 302;
					res.setHeader('Location', req.url + "/" );
				}
				renderFile(p, req, res, next, {})
			} else {
				return next();
			}
		});

	});

	app.configure('development', function(){
	    app.use(express.errorHandler());
	    app.locals.pretty = true;
	});

	var server = http.createServer(app);
	server.listen(app.get('port'), function(){
	    if (!isRestart) {
            console.log("Dev server started on port: " + app.get('port'));
        }
	});

	return server;

}

function mountDirectories(app, configs) {
	servedDirectories = [];
	configs.forEach(function(config) {
		serve(app, leadingSlash(config.urlPath, false), config.fsPath);
	});
}

function logRouting(configs) {
	configs.forEach(function(config) {
		console.log(notice(leadingSlash(config.urlPath, true)) + " ━► " + config.fsPath);
	});
}

var renderData = {};

module.exports = {
	server : null,
	running : false,
	start : function(config, isRestart) {
		this.server = startWebServer(config.port, isRestart);
		renderData.config = config;
		mountDirectories(app, config.routing);
		if (!isRestart) {
            logRouting(config.routing);
        }
		this.running = true;
	},
	stop : function() {
		this.server.close();
		this.running = false;
	}
};