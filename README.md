# cointracking_dpos
Forging reports for cointracking.info

**cointracking_dpos** is a script collection to create forging reports usable with
https://cointracking.info.

Cointracking service helps you with tax return.
The created csv files can be imported in the cointracking database using the menu:

*Enter Coins | Bulk Imports | CSV Import*

The following coins are supported:
* Lisk
* Shift
* Oxycoin
* Rise


## 1 Prerequisites

Install nodejs, npm and git
```
sudo apt install nodejs npm git
```

Clone the git repository:
```
git clone https://github.com/TheGoldenEye/cointracking_dpos
```

## 2 Install
```
cd cointracking_dpos
npm install
```

## 3 get_forging.js script

The script creates a detailed report of forged coins in a given timeframe on a daily basis.

### 3.1 Configuration
Configuration is done with `get_forging_config.json` file:

`start` and `end` defines the time intervall

In the `accounts` section you can define the delegate data and which coins to use.

If `use` is set to true, then the data for this coin are queried.

In the `nodes` section you can define your own node (**node must allow API access**)


### 3.2 Start
```
node get_forging.js
```

## 4 get_tx.js script

The script creates a detailed report of sharing rewards and donations for the given accounts.

### 4.1 Configuration
Configuration is done with `get_tx_config.json` file:

`start` and `end` defines the time intervall

In the `accounts` section you can define the accounts to analyse

In the `nodes` section you can define your own node (**node must allow API access**)


### 4.2 Start
```
node get_tx.js
```

## 5 Authors
- Goldeneye

## 6 License
Apache-2.0

Copyright (c) 2018 GoldenEye
