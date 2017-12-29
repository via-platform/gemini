const axios = require('axios');
const {CompositeDisposable, Disposable} = require('via');
const Websocket = require('./websocket');

const BaseURI = 'https://api.binance.com/api/v1';

const Timeframes = {
    6e4: '1m',
    18e4: '3m',
    3e5: '5m',
    9e5: '15m',
    18e5: '30m',
    36e5: '1h',
    72e5: '2h',
    144e5: '4h',
    216e5: '6h',
    288e5: '8h',
    432e5: '12h',
    864e5: '1d',
    2592e5: '3d',
    6048e5: '1w',
    2628e6: '1M'
};

class BinanceAdapter {
    constructor(){
        this.maxCandlesFromRequest = 500;
        this.resolution = 60000;
    }

    activate(){
        this.disposables = new CompositeDisposable();
        this.websocket = new Websocket();
    }

    deactivate(){
        //TODO Unregister the symbols (i.e. set their ready states to inactive)
        this.websocket.destroy();
        this.disposables.dispose();
        this.disposables = null;
    }

    matches(symbol, callback){
        return this.websocket.subscribe(symbol.name.split('-').join('').toLowerCase() + '@aggTrade', message => callback({
            date: new Date(message.E),
            price: parseFloat(message.p),
            size: parseFloat(message.q),
            side: message.m ? 'sell' : 'buy',
            id: message.a
        }));
    }

    ticker(symbol, callback){
        return this.matches(symbol, callback);
    }

    orderbook(symbol, callback){
        //Get the orderbook via an HTTP request and fire a snapshot event if we are still subscribed
        //TODO Check to make sure we're still subscribed before firing the callback to nowhere
        axios.get(`${BaseURI}/depth`, {params: {symbol: symbol.name.split('-').join('')}})
        .then(result => callback({type: 'snapshot', bids: result.data.bids, asks: result.data.asks}))
        .catch(() => {}); //TODO Somehow handle this error

        return this.websocket.subscribe(symbol.name.split('-').join('').toLowerCase() + '@depth', message => {
            const changes = [];

            for(const bid of message.b){
                changes.push(['buy', bid[0], bid[1]]);
            }

            for(const ask of message.a){
                changes.push(['sell', ask[0], ask[1]]);
            }

            callback({type: 'update', changes});
        });
    }

    history(symbol){
        const id = symbol.name.split('-').join('');

        return axios.get(`${BaseURI}/aggTrades`, {params: {symbol: id}})
        .then(response => response.data.map(datum => {
            return {date: new Date(datum.T), id: datum.a, price: parseFloat(datum.p), size: parseFloat(datum.q), side: datum.m ? 'sell' : 'buy'};
        }));
    }

    async data({symbol, granularity, start, end}){
        const interval = Timeframes[granularity];
        const id = symbol.name.split('-').join('');

        if(!interval){
            //TODO, eventually implement a method to allow for a wider variety of time frames
            throw new Error('Invalid timeframe requested.');
        }

        const response = await axios.get(`${BaseURI}/klines`, {params: {startTime: start.getTime(), endTime: end.getTime(), interval, symbol: id}});
        return response.data.map(([date, open, high, low, close, volume]) => ({date: new Date(date), low, high, open, close, volume}));
    }
}

module.exports = new BinanceAdapter();
