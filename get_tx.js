// Copyright © 2018 GoldenEye
// Removal or modification of this copyright notice is prohibited.

var https = require('https');
var querystring = require('querystring');
var format = require('string-format');
var fs = require('fs');
var async = require('async');
var extend = require('extend');
var cfg = require('./get_tx_config.json');
var cfg_tpl = require('./get_tx_config_tpl.json');

function apiGet(path, params, cb) {

  params.limit = params.limit || 100;
  params.offset = params.offset || 0;
  
  var options = {
    host: data.node.host,
    port: data.node.port,
    path: path+'?'+querystring.stringify(params),
    method: 'GET',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    }
  };
  
  var req = https.request(options, function(response) {
    var body = '';
    response.on('data', function(d) {
      body += d;
    });

    response.on('end', function() {
      var parsed = ParseJsonString(body);
      if (parsed)
        cb( parsed );
      else
        data.cb(red(body));
    });
  });
  
  req.end();
  
  req.on('error', function(e) {
    data.async_cb(e.toString());
  });
  

};

//------------------------------------------------------------------------------------
const colReset       = "\x1b[0m";
const colBright      = "\x1b[1m";
const colDim         = "\x1b[2m";
const colUnderscore  = "\x1b[4m";
const colBlink       = "\x1b[5m";
const colReverse     = "\x1b[7m";
const colHidden      = "\x1b[8m";

const colFgBlack     = "\x1b[30m";
const colFgRed       = "\x1b[31m";
const colFgGreen     = "\x1b[32m";
const colFgYellow    = "\x1b[33m";
const colFgBlue      = "\x1b[34m";
const colFgMagenta   = "\x1b[35m";
const colFgCyan      =  "\x1b[36m";
const colFgWhite     = "\x1b[37m";

const colBgBlack     = "\x1b[40m";
const colBgRed       = "\x1b[41m";
const colBgGreen     = "\x1b[42m";
const colBgYellow    = "\x1b[43m";
const colBgBlue      = "\x1b[44m";
const colBgMagenta   = "\x1b[45m";
const colBgCyan      = "\x1b[46m";
const colBgWhite     = "\x1b[47m";

//------------------------------------------------------------------------------------
function green(txt) {
  return colFgGreen+txt+colReset;
}
  
//------------------------------------------------------------------------------------
function yellow(txt) {
  return colFgYellow+txt+colReset;
}

//------------------------------------------------------------------------------------
function accountData(account, d) {
  var ign    = cfg.accountDatas.ignore[account];
  var res    = cfg.accountDatas.names[account];
  var intern = cfg.analysed.includes(account);  // internal account (to be analysed here)

  d.name     = res ? res.name : ign ? ign.name : account;
  d.ign      = ign ? !(cfg.createInternalTx && intern) : false;      // do not ignore tx, if internal tx should be created
  d.intern   = intern;

  if (!res && !ign && !data.notFound.includes(account))
    {
    console.warn(yellow("  => Please add account %s to accountDatas.names or .ignore or .external section in get_tx_config.json"), account);
    data.notFound.push(account);
    }
  return d.name;
}

//------------------------------------------------------------------------------------
function pad(number) 
  { 
  return (number < 10) ? '0' + number : number; 
  }

//------------------------------------------------------------------------------------
function TimeStr(timestamp) 
  {
  var beginEpochTime  = new Date(Date.UTC(2016, 4, 24, 17, 0, 0, 0)).getTime();
  var d               = new Date(timestamp*1000+beginEpochTime);

  return d.getFullYear() +
  '-' + pad(d.getMonth() + 1) +
  '-' + pad(d.getDate()) +
  ' ' + pad(d.getHours()) +
  ':' + pad(d.getMinutes()) +
  ':' + pad(d.getSeconds());
  }

//------------------------------------------------------------------------------------
function CurrentTimeStr() 
  {
  var d  = new Date();
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
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
// tx callback
function txCallback(result)
  {
  var ok    = data.newApi ? result.data : result.success;
  if (ok)
    {
    var count = data.newApi ? result.meta.count : result.count;
    var arr   = data.newApi ? result.data : result.transactions;
    arr.forEach(function(tx) {
      if (tx.type==0)       // send
        tx.senderId==data.account ? outTx(tx) : inTx(tx);
      else if (tx.type==1)  // second signature creation
        secondsigTx(tx);
      else if (tx.type==2)  // delegate registration
        delegateTx(tx);
      else if (tx.type==3)  // vote
        voteTx(tx)
      else if (tx.type==4)  // multisignature creation
        multisigTx(tx)
      else
        console.warn(yellow("  => Unknown Transaction Type: %d"), tx.type);
    });
    
    if (count>data.ofs+arr.length)
      {
      data.ofs+=arr.length;
      apiGet('/api/transactions/', data.newApi ? { senderIdOrRecipientId: data.account, offset: data.ofs, sort: 'timestamp:asc' }
                                               : { senderId: data.account, recipientId: data.account, offset: data.ofs, orderBy: 'timestamp:asc' }, txCallback);
      }
    else
      data.async_cb(null, data.account);
    }
  else
    data.async_cb(data.newApi ? result.message : result.error);
  };
  
//---------------------------------------
// send outgoing
function outTx(tx)
  {
  var d = {};
  var accID = accountData(tx.recipientId, d);
  
  if (d.ign)  // ignore tx
    return;
  
  tx.amount = Number(tx.amount);
  tx.fee = Number(tx.fee);

  var ref = '';
  if (tx.asset && tx.asset.data)
    ref = ' [' +  tx.asset.data + ']';

  if (d.intern)
    fs.appendFileSync(data.fileName, format(cfg.csv.outTx, 'Withdrawal', Number((tx.amount+tx.fee)/1e8).toFixed(8), data.coin, Number(tx.fee/1e8).toFixed(8), tx.id, data.account, TimeStr(tx.timestamp), accID, ref));
  else if (cfg.zeroCostBase)
    // Currently it's not possible to import data with asset value=0 (zero cost base) in cointracking
    // we emulate this with a "Trade" transaction
    fs.appendFileSync(data.fileName, format(cfg.csv.outTx0, 'Trade', Number((tx.amount+tx.fee)/1e8).toFixed(8), data.coin, Number(tx.fee/1e8).toFixed(8), tx.id, data.account, TimeStr(tx.timestamp), accID, ref, 0.00000001, cfg.fiat_currency));
  else
    fs.appendFileSync(data.fileName, format(cfg.csv.outTx, 'Donation', Number((tx.amount+tx.fee)/1e8).toFixed(8), data.coin, Number(tx.fee/1e8).toFixed(8), tx.id, data.account, TimeStr(tx.timestamp), accID, ref));
  }

//---------------------------------------
// send incoming
function inTx(tx) 
  {
  var d = {};
  var accID = accountData(tx.senderId, d);
  
  if (d.ign)  // ignore tx
    return;

  tx.amount = Number(tx.amount);
  tx.fee = Number(tx.fee);

  var ref = '';
  if (tx.asset && tx.asset.data)
  ref = ' [' +  tx.asset.data + ']';

  if (d.intern)
    fs.appendFileSync(data.fileName, format(cfg.csv.inTx, 'Deposit', Number(tx.amount/1e8).toFixed(8), data.coin, 0, tx.id, data.account, TimeStr(tx.timestamp), accID, ref));
  else if (cfg.zeroCostBase)
    // Currently it's not possible to import data with asset value=0 (zero cost base) in cointracking
    // we emulate this with a "Trade" transaction
    fs.appendFileSync(data.fileName, format(cfg.csv.inTx0, 'Trade', Number(tx.amount/1e8).toFixed(8), data.coin, 0, tx.id, data.account, TimeStr(tx.timestamp), accID, ref, 0.00000001, cfg.fiat_currency));
  else
    fs.appendFileSync(data.fileName, format(cfg.csv.inTx, 'Gift/Tip', Number(tx.amount/1e8).toFixed(8), data.coin, 0, tx.id, data.account, TimeStr(tx.timestamp), accID, ref));
  }
  
//---------------------------------------
// second signature creation
function secondsigTx(tx)
  {
  fs.appendFileSync(data.fileName, format(cfg.csv.secondsig, Number(tx.fee/1e8).toFixed(8), data.coin, tx.id, data.account, TimeStr(tx.timestamp), cfg.fiat_currency));
  }

//---------------------------------------
// delegate registration
function delegateTx(tx)
  {
  fs.appendFileSync(data.fileName, format(cfg.csv.delegate, Number(tx.fee/1e8).toFixed(8), data.coin, tx.id, data.account, TimeStr(tx.timestamp), cfg.fiat_currency));
  }

//---------------------------------------
// vote
function voteTx(tx)
  {
  fs.appendFileSync(data.fileName, format(cfg.csv.vote, Number(tx.fee/1e8).toFixed(8), data.coin, tx.id, data.account, TimeStr(tx.timestamp), cfg.fiat_currency));
  }

//---------------------------------------
// multisignature creation
function multisigTx(tx)
  {
  fs.appendFileSync(data.fileName, format(cfg.csv.multisig, Number(tx.fee/1e8).toFixed(8), data.coin, tx.id, data.account, TimeStr(tx.timestamp), cfg.fiat_currency));
  }

//---------------------------------------
function mkdir(dirPath)
  {
  try
    {
    fs.mkdirSync(dirPath)
    }
  catch (err)
    {
    if (err.code !== 'EEXIST') throw err
    }
  }

//---------------------------------------
//---------------------------------------
// main

function main(coin, node, account, idx, async_cb)
  {
  data.ofs       = 0;
  data.coin      = coin;
  data.node      = node;
  data.account   = account.id;
  data.async_cb  = async_cb;
  data.fileName  = cfg.outputDir + CurrentTimeStr() + '_' + coin + '_WALLETS.csv';
  data.newApi    = node.newApi;
  data.notFound  = [];         // accountID not found in accountData

  console.log('Importing account %s ...', data.account);

  if (idx==0)
    {
    if (cfg.outputDir)
      mkdir(cfg.outputDir);

    if (fs.existsSync(data.fileName))
      fs.unlinkSync(data.fileName);

    fs.writeFileSync(data.fileName, cfg.csv.header);
    }


  apiGet('/api/transactions/', data.newApi ? { senderIdOrRecipientId: data.account, sort: 'timestamp:asc' }
                                           : { senderId: data.account, recipientId: data.account, orderBy: 'timestamp:asc' }, txCallback);
  }

//--------------------------------------------------------------------------------------------------------------------------------------------------------------------------

//apply config defaults (not deep, only root level)
cfg = extend(false, cfg_tpl, cfg);

var data = {};

// remember the accounts to analyse
cfg.analysed = [];
for (let coin in cfg.accounts) {
  cfg.accounts[coin].forEach(element => {
    cfg.analysed.push(element.id);
  });
}

async.eachOfSeries(cfg.accounts.lisk,
  function(account, idx, cb) {
    main('LSK', cfg.nodes.lisk, account, idx, cb);
  },  
  function(err) {
    if ( err )
      console.log(red(err));

  async.eachOfSeries(cfg.accounts.shift,
    function(account, idx, cb) {
      main('SHIFT', cfg.nodes.shift, account, idx, cb);
    },
    function(err) {
      if ( err )
        console.log(red(err));

      async.eachOfSeries(cfg.accounts.rise,
        function(account, idx, cb) {
          main('RISE', cfg.nodes.rise, account, idx, cb);
        },  
        function(err) {
          if ( err )
            console.log(red(err));
          
          async.eachOfSeries(cfg.accounts.oxy,
            function(account, idx, cb) {
              main('OXY', cfg.nodes.oxy, account, idx, cb);
            },  
            function(err) {
              if ( err )
                console.log(red(err));
              
            });
        });
    });
  });

