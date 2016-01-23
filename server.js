
var ws = require('ws');
var https = require('https');
var http = require('http');
var express = require('express');
var fs = require('fs');
var path = require('path');
var _ = require('lodash');
var haringGocdMapper = require('./server/haring/gocdMapper');
var miroGocdMapper = require('./server/miro/gocdMapper');
var miroGocdMapperConstellation = require('./server/miro/gocdMapperConstellation');
var configReader = require('./server/ymlHerokuConfig');
var gocdCreator = require('./server/gocdReader');

function artwiseServer() {

  var WebSocketServer = ws.Server
    , app = express();

  var CACHE_INITIALISED = false;
  var UPDATE_INTERVAL = 10000;
  var USES_SSL = false;
  var port = process.env.PORT || 5000;

  var config = configReader.create('gocd').get();
  var artwiseConfig = configReader.create('artwise').get();

  function createServer() {
    var rootDir = path.resolve(path.dirname(module.uri));
    app.use(express.static(rootDir + '/app/'));

    try {
      var credentials = {
        key: fs.readFileSync('artwise-key.pem'),
        cert: fs.readFileSync('artwise-cert.pem')
      };
      USES_SSL = true;
      return https.createServer(credentials, app);
    } catch(couldNotReadKeyAndCert) {
      console.log("WARNING - could not use SSL, provide artwise-key.pem and artwise-cert.pem");
      return http.createServer(app);
    }

  }

  var server = createServer();


  var gocd;
  gocdCreator(config).then(function(instance) {
    console.log("GO CD DATA CACHE INITIALISED");
    console.log((USES_SSL ? 'https' : 'http') + ' server listening on %d', port);

    CACHE_INITIALISED = true;
    gocd = instance;
  }).done();

  function createListener(identifier, dataTransformer) {
    return function() {

      var wss = new WebSocketServer({server: server, path: '/' + identifier });
      console.log(identifier +' websocket server created');

      wss.on('connection', function(ws) {
        console.log('connected to /' + ws.upgradeReq.url);

        function newClient() {

          function getPipelineParameter() {
            var requestedUrl = ws.upgradeReq.url;
            var match = requestedUrl.match(/pipeline=([^&]+)/);
            return match ? match[1] : undefined;
          }

          var pipeline = getPipelineParameter();

          function getActivityAndUpdateClients() {
            var result = {};
            if (CACHE_INITIALISED !== true) {
              result[identifier] = {warmingUp: true};
              ws.send(JSON.stringify(result));
            } else {
              gocd.readData(pipeline).then(function (gocdData) {
                var visualisationData = dataTransformer(gocdData);
                result[identifier] = visualisationData;
                ws.send(JSON.stringify(result), function () {
                });
              }).fail(function(error) {
                console.log("COULD NOT READ DATA!", error);
                ws.send(JSON.stringify({error: error}));
              });
            }
          }

          getActivityAndUpdateClients();
          var clientId = setInterval(getActivityAndUpdateClients, UPDATE_INTERVAL);
          return clientId;
        }

        var clientId = newClient();

        console.log('websocket connection open on /' + identifier);

        ws.on('message', function(msg) {
          if(msg === 'ping') {
            console.log('PING');
            ws.send(JSON.stringify({ping: 'success'}));
          }
        });

        ws.on('close', function() {
          console.log('websocket connection close on /' + identifier);
          clearInterval(clientId);
        });
      });
    }
  }

  /** HARING ************************/

  var CACHE_INITIALISED = false;

  var listenToHaring = createListener('haring', haringGocdMapper.readHistoryAndActivity);
  listenToHaring();

  /** MIRO BLUE ************************/

  var listenToMiro = createListener('miro', miroGocdMapperConstellation.readHistoryAndActivity);
  listenToMiro();

  var listenToMiroBlue = createListener('miroBlue', miroGocdMapper.readHistoryAndActivity);
  listenToMiroBlue();

  /** ENDPOINTS ************************/

  function readAndRespondWithPromisedData(promise, res) {
    if(CACHE_INITIALISED) {
      promise.then(function (data) {
        respondWithJson(res, data);
      }).done();
    } else {
      res.send('warming up');
    }
  }

  function respondWithJson(response, data) {
    response.set({
      'Content-Type': 'application/json'
    });
    response.send(JSON.stringify(data));
  }

  app.get('/alive',
    function(req, res) {
      console.log('life sign');
      res.send('OK');
    });

  app.get('/data/gocd', function(req, res) {
    if(!req.query.pipeline) {
      res.send('ERROR - Please provide pipeline');
    } else {
      readAndRespondWithPromisedData(gocd.readData(req.query.pipeline), res);
    }
  });

  app.get('/data/gocd/haring', function(req, res) {
    readAndRespondWithPromisedData(gocd.readData().then(function(data) {
      return haringGocdMapper.readHistoryAndActivity(data);
    }), res).done();
  });

  app.get('/data/gocd/miro', function(req, res) {
    readAndRespondWithPromisedData(gocd.readData().then(function(data) {
      return miroGocdMapperConstellation.readHistoryAndActivity(data);
    }), res).done();
  });

  app.get('/data/gocd/miroBlue', function(req, res) {
    readAndRespondWithPromisedData(gocd.readData().then(function(data) {
      return miroGocdMapper.readHistoryAndActivity(data);
    }), res).done();
  });

  server.listen(port);

}

artwiseServer();
