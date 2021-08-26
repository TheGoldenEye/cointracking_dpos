// Copyright © 2018-20 GoldenEye
// Removal or modification of this copyright notice is prohibited.

const https = require('https');
const querystring = require('querystring');
const format = require('string-format');
const fs = require('fs');
const async = require('async');
const getPackageVersion = require('@jsbits/get-package-version');
const program = require('commander');

//------------------------------------------------------------------------------------
function LoadConfigFile(cfgFile) {
  const cfgFile_tpl = './config/get_forging3_config_tpl.json';

  // first copy config from template, if not there
  if (!fs.existsSync(cfgFile))
    fs.copyFileSync(cfgFile_tpl, cfgFile);
  return JSON.parse(fs.readFileSync(cfgFile, 'utf8'));
}

//------------------------------------------------------------------------------------
function apiGet(data, cb) {

  const options = {
    host: data.node.host,
    port: data.node.port,
    path: data.node.path + data.node.param,
    method: 'GET',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    }
  };

  const req = https.request(options, function (response) {
    let body = '';
    response.on('data', function (d) {
      body += d;
    });

    response.on('end', function () {
      const parsed = ParseJsonString(body);
      if (parsed)
        cb(data, parsed);
      else
        data.cb(red(body));
    });
  });

  req.end();

  req.on('error', function (e) {
    data.cb(red(e.toString()));
  });
}

//------------------------------------------------------------------------------------
// two-digit number format
function pad(number) {
  return (number < 10) ? '0' + number : number;
}

//------------------------------------------------------------------------------------
// timestamp as string
function TimeStr(timestamp, date, time) {
  const d = new Date(timestamp);

  let s = '';
  if (date)
    s = s + d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate());
  if (time) {
    if (s != '')
      s = s + ' ';
    s = s + pad(d.getUTCHours()) + ':' + pad(d.getUTCMinutes()) + ':' + pad(d.getUTCSeconds());
  }

  return s;
}

//---------------------------------------
function ParseJsonString(str) {
  try {
    return JSON.parse(str);
  } catch (e) {
    return undefined;
  }
}

//---------------------------------------
// callback
function forgeCallback(data, result) {
  //  const ok = data.node.newApi ? result.data : result.success;
  if (result.data) {
    processForged(data, result);
    data.cb(null);
  } else {
    data.cb(red(result.message));
  }
}

//---------------------------------------
// processing
function processForged(data, result) {
  let rewards = 0;
  let totalForged = 0;

  result.data.forEach(block => {
    rewards += Number(block.reward);
    totalForged += Number(block.totalForged);
  });

  const date = TimeStr(data.end, true, false);
  const sForged = Number(totalForged / 1e8).toFixed(8);
  const rewardBl = rewards / 1e8 / result.meta.count;

  data.total += totalForged;
  data.blocks += result.meta.count;

  process.stdout.write(format('Forging {0} : {1} {2}    \r', date, sForged, data.coin));
  if (sForged != '0') {
    let exch = data.exch;
    if (exch.includes('%y')) // replace '%y' with the current year
      exch = exch.replace('%y', date.substr(0, 4));
    fs.appendFileSync(data.fileName, format(cfg.csv.line, 'Mining', sForged, data.coin, data.id, result.meta.count, precisionRound(rewardBl, 4), date, exch, cfg.zeroCostBase ? "0.00000001" : ""));
  }
}

//------------------------------------------------------------------------------------
const colReset = "\x1b[0m";
const colFgGreen = "\x1b[32m";
const colFgYellow = "\x1b[33m";

//------------------------------------------------------------------------------------
function green(txt) {
  return colFgGreen + txt + colReset;
}

//------------------------------------------------------------------------------------
function red(txt) {
  return colFgYellow + txt + colReset;
}

//---------------------------------------
// exact round
function precisionRound(number, precision) {
  const factor = Math.pow(10, precision);
  return Math.round(number * factor) / factor;
}

//---------------------------------------
function mkdir(dirPath) {
  try {
    fs.mkdirSync(dirPath);
  } catch (err) {
    if (err.code !== 'EEXIST') throw err;
  }
}

//---------------------------------------
//---------------------------------------
// main

function main(data, intervall, idx, cb) {
  if (!data || !data.use || !data.node)
    return cb("disabled");

  data.start = intervall.start;
  data.end = intervall.end;
  data.node.param = format(data.node.params, data.id, Math.floor(data.start / 1000), Math.floor(data.end / 1000));
  data.cb = cb;

  if (idx == 0) {
    if (cfg.outputDir)
      mkdir(cfg.outputDir);

    if (fs.existsSync(data.fileName))
      fs.unlinkSync(data.fileName);

    fs.writeFileSync(data.fileName, cfg.csv.header);
  }

  apiGet(data, forgeCallback);
}

//--------------------------------------------------------------------------------------------------------------------------------------------------------------------------
//--------------------------------------------------------------------------------------------------------------------------------------------------------------------------
//--------------------------------------------------------------------------------------------------------------------------------------------------------------------------
// start:

program
  .version(getPackageVersion())
  //  .option('-d, --debug', 'output extra debugging')
  .option('-c, --config <configFile>', 'configFile to use', './config/get_forging3_config.json')
  .option('-y, --year <year>', 'the year to use (overwrites the values from config file)')
  .parse(process.argv);

const cfg = LoadConfigFile(program.opts().config);

// Lisk
// 1st Block with rewards: https://explorer.lisk.io/block/14795541625652526135
// 2016/11/30 17:38:00

let beginTime;
let endTime;
if (program.opts().year) {
  const y = Number(program.opts().year);
  beginTime = new Date(Date.UTC(y, 0, 1)).getTime();
  endTime = new Date(Date.UTC(y, 11, 31)).getTime();
} else {
  // ISO 8601 date strings are treated as UTC
  beginTime = new Date(cfg.start).getTime();
  endTime = new Date(cfg.end).getTime();
}

const nowTime = new Date().getTime();
const vctTimes = [];
let t;

//correct endTime, if in the future
if (endTime > nowTime)
  endTime = nowTime - 86400000; // only use complete days

// collect time slices (days)
for (t = beginTime; t <= endTime; t += 86400000)
  vctTimes.push({
    start: t,
    end: t + 86399999
  });

cfg.accounts.forEach(account => {
  account.total = 0;
  account.blocks = 0;

  if (account.use) {
    account.fileName = cfg.outputDir + TimeStr(endTime, true, false) + '_' + account.coin + '_' + account.name + '_FORGING.csv';
    account.node = cfg.nodes[account.node];

    async.eachOfSeries(vctTimes,
      function (item, idx, cb) {
        main(account, item, idx, cb);
      },
      function (err) {
        if (err)
          console.log('Lisk:', err, '            ');
        else
          console.log('Lisk  total forged: %s %s (%d blocks)    ', Number(account.total / 1e8).toFixed(8), account.coin, account.blocks);

      });
  }
});