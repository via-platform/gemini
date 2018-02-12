const Socket = require('ws');
const {CompositeDisposable, Disposable, Emitter} = require('via');
const SocketURI = 'wss://api.gemini.com/v1/marketdata';

module.exports = class Websocket {
    constructor(options = {}){
        this.status = 'disconnected';
        this.subscriptions = [];
        this.connections = new Map();
        this.disposables = new CompositeDisposable();
        this.emitter = new Emitter();
        this.opened = false;

        return this;
    }

    connect(channel){
        if(!this.connections.has(channel)){
            const connection = new Socket(`${SocketURI}/${channel}`);

            //Add event listeners to the websocket
            connection.on('message', data => this.message(channel, data));
            connection.on('open', data => this.open(channel, data));
            connection.on('close', data => this.close(channel, data));
            connection.on('error', data => this.error(channel, data));
        }
    }

    disconnect(){
        if(this.connection){
            this.connection.close();
            this.connection = null;
            this.opened = false;
        }
    }

    open(channel, data){
        this.emitter.emit('did-open', channel);
    }

    send(channel, data){
        // if(this.opened){
        //     this.connection.send(JSON.stringify(data));
        // }
    }

    close(channel, data){
        this.emitter.emit('did-close', channel);
    }

    message(channel, data){
        if(this.channels.has(channel)){
            const message = JSON.parse(data);
            const subscriptions = this.channels.get(channel);

            for(let subscription of subscriptions){
                subscription(message);
            }
        }
    }

    error(){
        console.error('Error');
    }

    connected(){

    }

    disconnected(){

    }

    heartbeat(){
        // this.send();
    }

    connectedToChannel(channel){
        // return !!this.subscriptions.filter(sub => sub.channel === channel).length;
    }

    subscribe(channel, callback){
        if(this.channels.has(channel)){
            this.channels.get(channel).push(callback);
        }else{
            this.connect(channel);
            this.channels.set(channel, [callback]);
        }

        return new Disposable(() => this.unsubscribe(channel, callback));
    }

    unsubscribe(channel, callback){
        if(this.connections.has(channel)){
            const listeners = this.connections.get(channel);
            listeners.splice(listeners.indexOf(callback), 1);

            if(!listeners.length){

                this.connections.delete(channel);
                this.emitter.emit('did-close');
            }
        }
        this.subscriptions.splice(this.subscriptions.indexOf(group), 1);

        if(!this.subscriptions.length){
            this.disconnect();
        }
    }

    destroy(){
        for(const connection of this.connections.values()){
            connection.close();
        }

        this.disconnect();
        this.disposables.dispose();
        this.subscriptions = null;
        this.emitter.emit('did-destroy');
        this.emitter = null;
    }
}
