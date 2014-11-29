
var wsHost = 'ws://' + window.location.host;
var ws = new WebSocket(wsHost + '/haring');
var NUM_ROWS = 4;
var COLS_PER_ROW = 6;

var DATA = { figures: [] };

var WARM_COLORS = [ 'red', 'yellow', 'pink', 'orange' ];
var COLD_COLORS = [ 'blue', 'dark-blue', 'green', 'dark-green' ];

var FIGURE_BACKGROUND_MODE = 'winter';

var LAST_PING = new Date();
var PING_INTERVAL = 5 * 60 * 1000;

function randomWarmColor() {
  return WARM_COLORS[Math.floor(Math.random() * WARM_COLORS.length)];
}

function randomColdColor() {
  return COLD_COLORS[Math.floor(Math.random() * COLD_COLORS.length)];
}

function isWarm(color) {
  return _.contains(WARM_COLORS, color);
}

function isCold(color) {
  return _.contains(COLD_COLORS, color);
}

function buildInitialGrid() {
  var container = $('.container');
  var figureContentHtml = '<div class="bg"></div>' +
    '<img src="images/default.png" class="grey">' +
    '<div class="letters top-left"></div>' +
    '<div class="letters bottom-right"></div>';
  for(var r = 0; r < NUM_ROWS; r++) {
    var rowDiv = $('<div class="figure-row flexbox"></div>').appendTo(container);
    for (var c = 0; c < COLS_PER_ROW; c++) {
      rowDiv.append(
      '<div class="figure-wrapper">' +
        '<div class="info"><span class="level-1"></span><span class="level-2">LEVEL 2</span></div>' +
        '<div class="figure solid">' +
            figureContentHtml +
        '</div>' +
      '</div>');
    }
  }
  container.append('<div class="figure announcement-figure">' + figureContentHtml + '</div>');
}


buildInitialGrid();

function iterateFigures(haringDescription, callback) {
  var rowIndex = -1;
  for(var i = 0; i < haringDescription.figures.length; i++) {
    var entry = haringDescription.figures[i];

    var colIndex = i % COLS_PER_ROW;
    if (i % COLS_PER_ROW === 0) rowIndex++;

    callback(i, entry, colIndex, rowIndex);

  }
}

function configureFigureDiv(entry, figureDiv) {
  var infoDiv = $(figureDiv.siblings('.info'));
  var imgTag = $(figureDiv.find('> img'));

  if (entry.border === 'dotted') {
    figureDiv.addClass('dotted');
  } else {
    figureDiv.addClass('solid');
  }

  infoDiv.find('.level-1').text(entry.info);
  console.log('entry.info2', entry.info2);
  infoDiv.find('.level-2').text(entry.info2);

  // TODO > body click toggle currently too simple for this
  //if (entry.showInfo) {
  //  infoDiv.show();
  //}

  var imgExtension = entry.type === 'building' ? '.gif' : '.png';
  imgTag.attr('src', 'images/' + entry.type + imgExtension);
  imgTag.removeClass();

  infoDiv.removeClass();
  infoDiv.addClass('info');

  if (entry.color === 'WARM') {
    imgTag.addClass(randomWarmColor());
    infoDiv.addClass('orange');
  } else if (entry.color === 'COLD') {
    imgTag.addClass(randomColdColor());
    infoDiv.addClass('green');
  } else {
    imgTag.addClass(entry.color);
    infoDiv.addClass(isWarm(entry.color) ? 'orange' : 'green');
  }

  if (entry.type === 'building') {
    imgTag.addClass('building');
    figureDiv.append('<div class="changer"></div>')
  }

  var topLeftLettersDiv = $(figureDiv.find('.letters.top-left'));
  var topLeftText = entry.word1;
  addLetters(topLeftLettersDiv, topLeftText);

  var bottomRightLettersDiv = $(figureDiv.find('.letters.bottom-right'));
  var bottomRightText = entry.initials || entry.word2;
  addLetters(bottomRightLettersDiv, bottomRightText);

  addMode(figureDiv, entry);
}

function addMode(figureDiv, entry) {
  if(FIGURE_BACKGROUND_MODE) {
    var bgDiv = figureDiv.find('.bg');
    bgDiv.removeClass();
    bgDiv.addClass(FIGURE_BACKGROUND_MODE);
    bgDiv.addClass(entry.type);
    bgDiv.addClass('bg');
  }
}

function addLetters(lettersDiv, text) {
  lettersDiv.empty();
  if (text) {
    for (var l = 0; l < text.length; l++) {
      $('<img src="images/alphabet/' + text[l].toLowerCase() + '.svg">').appendTo(lettersDiv);
    }
  }
}

function processFigure(index, entry, colIndex, rowIndex) {
  var previously = DATA.figures[index];

  if(_.isEqual(entry, previously)) {
    return;
  }

  var allRows = $('.figure-row');
  if(allRows.length > rowIndex) {
    var rowDiv = $(allRows[rowIndex]);

    var figureDiv = $(rowDiv.find('.figure')[colIndex]);

    figureDiv.removeClass();
    figureDiv.addClass('figure');

    configureFigureDiv(entry, figureDiv);

  } else {
    console.log('not enough rows');
  }

}

function setBackgroundStyle(styleClass) {
  var bodyTag = $('body');
  bodyTag.removeClass();
  bodyTag.addClass(styleClass);
}

ws.onmessage = function (event) {

  var data = JSON.parse(event.data);
  if(data.haring) {

    var haringDescription = data.haring;

    setBackgroundStyle(haringDescription.background);

    iterateFigures(haringDescription, processFigure);

    var announcementDiv = $('.announcement-figure');
    if(haringDescription.announcementFigure !== undefined) {

      configureFigureDiv(haringDescription.announcementFigure, announcementDiv);
      announcementDiv.show();
    } else {
      announcementDiv.hide();
    }

    DATA = haringDescription;
  } else if(data.ping) {
    LAST_PING = new Date();
    console.log('ping success - still connected to server', LAST_PING);
  }

};

// Let server know we're still watching (Keep alive Heroku)
setInterval(function() {

  var timeSinceLastPing = new Date() - LAST_PING;
  if(timeSinceLastPing > (PING_INTERVAL * 1.1)) {
    console.log('Last successful ping too long ago', timeSinceLastPing);
    setBackgroundStyle('grey');
    window.location = window.location;
  }

  var xmlHttp = new XMLHttpRequest();
  xmlHttp.open( "GET", location.origin + '/alive', false );
  xmlHttp.send( null );

  ws.send('ping');

}, PING_INTERVAL);

var body = $('body');
var infoStates = ['', 'info-level-1', 'info-level-2'];
var currentInfoState = 1;
body.on('click', function() {
  body.removeClass('info-level-1');
  body.removeClass('info-level-2');
  console.log('currentInfoStage', currentInfoState, currentInfoState % 3);
  body.addClass(infoStates[currentInfoState % 3]);
  currentInfoState ++;

});