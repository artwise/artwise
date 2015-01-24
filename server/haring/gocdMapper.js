
var _ = require('lodash');
var gocdReader = require('../gocdReader');
var config = require('../ymlHerokuConfig');

function haringGocdMapperModule() {

  var NUM_FIGURES_IN_VIS = 24;
  var NUM_ROWS = 4;
  var COLS_PER_ROW = 6;

  var IS_BUILDING_BACKGROUND = 'blue';

  var haringConfig = config.create('haring').get();

  function compareNumbers(a, b) {
    // JS does lexicographical sorting by default, need to sort by number
    return a - b;
  }

  function sortAndStripDownHistory(historyData, numberOfEntries) {
    var keysToKeep = _.keys(historyData).sort(compareNumbers).reverse().splice(0, numberOfEntries);
    var strippedDownHistory = {};
    _.each(keysToKeep, function(key) {
      if(keysToKeep.indexOf(key) >= 0) {
        strippedDownHistory[key] = historyData[key];
      }
    });
    return strippedDownHistory;
  }

  function isWinter() {
    var now = new Date();
    return now.getMonth() >= 11 || now.getMonth() === 0;
  }

  function getSpecialAnnouncementFigure(historyData) {
    var greatSuccess = ! _.any(_.keys(historyData), function(key) {
      return historyData[key].wasSuccessful() === false;
    });
    if(greatSuccess) {
      return {
        color: 'blue',
        type: isWinter() ? 'winter/great_success' : 'great_success',
        border: 'dotted',
        word1: 'great',
        word2: 'success'
      };
    }
  }

  function applyVierGewinnt(figures) {
    var NUM_TO_WIN = 4;

    function groupIsEligible(group) {
      var allDotted = _.every(group, { border: 'dotted' });
      return ! allDotted;
    }

    function checkGroup(rangeOfIndices, orientation) {
      var groupToCheck = _.at(figures, rangeOfIndices);
      if(_.compact(groupToCheck).length === NUM_TO_WIN) {
        var allPassedWithSameAuthor = _.every(groupToCheck, function (groupMember) {
          return isFigureSuccessful(groupMember) && groupMember.initials === groupToCheck[0].initials;
        });

        if (allPassedWithSameAuthor && groupIsEligible(groupToCheck)) {
          return markGroup(groupToCheck, orientation);
        }
      }
    }

    function markGroup(group, orientation) {
      if(group !== undefined && group.length > 0) {
        _.each(group, function (groupMember) {
          groupMember.four = {direction: orientation};
        });
        group[0].four.starter = true;
      }
      return group;
    }

    function checkHorizontal(index) {
      var colIndex = index % COLS_PER_ROW;
      if(colIndex + NUM_TO_WIN <= COLS_PER_ROW) {
        return checkGroup(_.range(index, index + NUM_TO_WIN), 'horizontal');
      }
    }

    function checkVertical(index) {
      var rowIndex = Math.floor(index / COLS_PER_ROW);
      if(rowIndex + NUM_TO_WIN <= NUM_ROWS) {
        var indices = [];
        _.times(NUM_TO_WIN, function(time) { indices.push(index + (time * COLS_PER_ROW)); })
        return checkGroup(indices, 'vertical');
      }
    }

    function checkDiagonalLeftToRight(index) {
      var colIndex = index % COLS_PER_ROW;
      if(colIndex + NUM_TO_WIN <= COLS_PER_ROW) {
        var indices = [  ];
        _.times(NUM_TO_WIN, function(time) {
          indices.push(index + ((time * COLS_PER_ROW) + time));
        });
        return checkGroup(indices, 'diagonal');
      }
    }

    var successfulGroup = undefined;
    _.each(figures, function(figure, index) {
      successfulGroup = successfulGroup || checkDiagonalLeftToRight(index) || checkVertical(index) || checkHorizontal(index);
    });
    return successfulGroup;

  }

  var readHistoryAndActivity = function() {
    return gocdReader.readData().then(function(data) {
      var activityHaring = mapActivityDataToFigures(data.activity);

      var numberOfHistoryFigures = NUM_FIGURES_IN_VIS - activityHaring.figures.length;
      var onlyHistoryWeNeed = sortAndStripDownHistory(data.history, numberOfHistoryFigures);
      var historyHaring = mapPipelineDataToFigures(onlyHistoryWeNeed);

      var historyFigures = historyHaring.figures;
      mapInitialsFromHistoryToActivity(historyFigures, activityHaring.figures);

      var finalFigures = {  };
      finalFigures.figures = activityHaring.figures.concat(historyFigures);
      finalFigures.background = activityHaring.background || historyHaring.background;
      finalFigures.announcementFigure = getSpecialAnnouncementFigure(onlyHistoryWeNeed);

      if(haringConfig.four === true && finalFigures.background !== IS_BUILDING_BACKGROUND) {
        applyVierGewinnt(finalFigures.figures);
      }

      return finalFigures;

    });

  };

  function mapInitialsFromHistoryToActivity(historyFigures, activityFigures) {
    _.each(activityFigures, function(activityFigure) {
      var historyFigureWithSameKey = _.find(historyFigures, function(historyFigure) {
        return activityFigure.key === historyFigure.key;
      });
      if(historyFigureWithSameKey !== undefined) {
        activityFigure.initials = historyFigureWithSameKey.initials;
      }
    });
  }

  function isFigureSuccessful(figure) {
    if(figure.type === 'passed' || figure.type === 'passed_after_fail') {
      return true;
    } else {
      return false;
    }
  }

  function getFigureType(entry, lastEntryWasSuccessful) {

    if(entry.wasSuccessful() && !lastEntryWasSuccessful) {
      return 'passed_after_fail';
    } else if (entry.wasSuccessful()) {
      return 'passed';
    } else if ( ! entry.wasSuccessful() && !lastEntryWasSuccessful) {
      return 'fail_repeated';
    } else {
      return 'fail';
    }
  }

  function getColor(entry) {
    if(entry.wasSuccessful()) {
      return 'COLD';
    } else {
      return 'WARM';
    }
  }

  function mapPipelineDataToFigures(history) {

    var keysDescending = _.keys(history).sort(compareNumbers).reverse();
    if(keysDescending.length === 0) {
      return { figures: [] };
    }

    var figures = _.map(keysDescending, function(key, index) {

      var entry = history[key];
      var previous = index < keysDescending.length ? history[keysDescending[index + 1]] : undefined;

      return {
        color: getColor(entry),
        info: entry.label,
        info2: entry.info,
        type: getFigureType(entry, previous ? previous.wasSuccessful() : true),
        initials: entry.author ? entry.author.initials : undefined,
        key: key
      };
    });

    var lastBuildSuccessful = history[keysDescending[0]].wasSuccessful();

    return {
      background: lastBuildSuccessful ? 'green' : 'orange',
      figures: figures
    };

  }

  function mapActivityDataToFigures(activity) {

    function getFigureTypeForActivity(entry) {

      if(entry.activity === 'Building') {
        return 'building';
      } else {
        return getFigureType(entry, true);
      }
    }

    function getColor(entry) {
      if(entry.lastBuildStatus === 'Success') {
        return 'COLD';
      } else if (entry.lastBuildStatus === 'Failure') {
        return 'WARM';
      } else {
        return 'grey';
      }
    }

    function getInfo(entry) {
      var entryTitle = '[' + entry.buildNumber + '] ' + entry.name;
      if(entry.activity === 'Building') {
        return entryTitle + ' is building';
      } else {
        var info = entryTitle + ' | ' + entry.lastBuildStatus;
        if(!entry.wasSuccessful() && entry.author) {
          info += ' | changes by ' + entry.author.name;
        }
        return info;
      }
    }

    var figures = _.map(activity.jobs, function(entry) {
      return {
        color: getColor(entry),
        info: entry.stageName,
        info2: getInfo(entry),
        type: getFigureTypeForActivity(entry),
        border: 'dotted',
        initials: entry.author ? entry.author.initials : undefined,
        key: entry.buildNumber
      }
    });

    var isBuilding = _.any(activity.jobs, function(entry) {
      return entry.activity === 'Building';
    });

    return {
      background: isBuilding ? IS_BUILDING_BACKGROUND : undefined,
      figures: figures
    };

  }

  return {
    readHistoryAndActivity: readHistoryAndActivity
  }
}

exports.readHistoryAndActivity = haringGocdMapperModule().readHistoryAndActivity;