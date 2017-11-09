import http from 'http';
import { parseUrl } from './tools';


/**
 * Base class for proxy connection handlers.
 */
export default class HandlerBase {

    constructor({ srcRequest, srcResponse, trgHost, trgPort, verbose, proxyUrl }) {
        if (!srcRequest) throw new Error('The "srcRequest" option is required');

        this.srcRequest = srcRequest;
        this.srcResponse = srcResponse;

        this.trgHost = trgHost;
        this.trgPort = trgPort;

        this.verbose = !!verbose;
        this.proxyUrl = proxyUrl;

        console.log('heree');

        this.proxyUrlParsed = proxyUrl ? parseUrl(proxyUrl) : null;

        //this.trgHost = trgHost;
        //this.trgPort = trgPort;

        this.srcSocket = srcRequest.socket; // TODO: this used to be passed from outside
        this.trgSocket = null;

        // Indicates that source socket might have received some data already
        this.srcGotResponse = false;

        this.isDestroyed = false;

        this.trgRequest = null;

        if (proxyUrl) {
            if (!this.proxyUrlParsed.host || !this.proxyUrlParsed.port) throw new Error('Invalid "proxyUrl" option: URL must have host and port');
            if (this.proxyUrlParsed.scheme !== 'http') throw new Error('Invalid "proxyUrl" option: URL must have "http" scheme');
        }

        // Create ServerResponse for the client HTTP request if it doesn't exist
        // NOTE: This is undocummented API, it might break in the future
        if (!this.srcResponse) {
            this.srcResponse = new http.ServerResponse(srcRequest);
            this.srcResponse.shouldKeepAlive = false;
            this.srcResponse.chunkedEncoding = false;
            this.srcResponse.useChunkedEncodingByDefault = false;
            this.srcResponse.assignSocket(this.srcSocket);
        }

        // Bind all event handlers to this instance
        this.bindHandlersToThis(['onSrcResponseFinish', 'onSrcSocketClose', 'onSrcSocketEnd', 'onSrcSocketError']);

        // called for the ServerResponse's "finish" event
        // XXX: normally, node's "http" module has a "finish" event listener that would
        // take care of closing the socket once the HTTP response has completed, but
        // since we're making this ServerResponse instance manually, that event handler
        // never gets hooked up, so we must manually close the socket...
        this.srcResponse.once('finish', this.onSrcResponseFinish);

        this.srcSocket.on('close', this.onSrcSocketClose);
        this.srcSocket.on('end', this.onSrcSocketEnd);
        this.srcSocket.on('error', this.onSrcSocketError);

        // XXX: pause the socket during authentication so no data is lost
        this.srcSocket.pause();
    }

    bindHandlersToThis(handlerNames) {
        handlerNames.forEach((evt) => {
            this[evt] = this[evt].bind(this);
        });
    }

    // Abstract method, needs to be overridden
    log() {
    }

    // Abstract method, needs to be overridden
    run() {
    }

    // if the client closes the connection prematurely,
    // then close the upstream socket
    onSrcSocketClose() {
        this.log('Source socket closed');
        this.destroy();
    }

    onSrcSocketEnd() {
        this.log(`Source socket ended`);
        this.destroy();
    }

    onSrcSocketError(err) {
        this.log(`Source socket failed: ${err.stack || err}`);
        this.destroy();
    }

    onSrcResponseFinish () {
        this.log('Source response finished');
        this.removeListeners();
    }

    handleTargetError(err) {
        this.removeListeners();

        if (this.srcGotResponse) {
            this.log('Source already received a response, just destroying the socket...');
            this.destroy();
        } else if (err.code === 'ENOTFOUND') {
            this.log('Target server not found, sending 404 to source');
            this.srcResponse.writeHead(404);
            this.srcResponse.end();
        } else {
            this.log('Unknown error, sending 500 to source');
            this.srcResponse.writeHead(500);
            this.srcResponse.end();
        }
    };


    removeListeners() {
        this.log('Removing listeners');

        if (this.srcSocket) {
            this.srcSocket.removeListener('close', this.onSrcSocketClose);
            this.srcSocket.removeListener('end', this.onSrcSocketEnd);
            this.srcSocket.removeListener('error', this.onSrcSocketError);
        }
        if (this.srcResponse) {
            this.srcResponse.removeListener('finish', this.onSrcResponseFinish);
        }
    }

    /**
     * Detaches all listeners and destroys all sockets.
     */
    destroy() {
        if (!this.isDestroyed) {
            this.log('Destroying');

            this.removeListeners();

            if (this.srcSocket) {
                this.srcSocket.destroy();
                this.srcSocket = null;
            }

            // TODO: this.trgRequest.abort();

            this.isDestroyed = true;

            return true;
        }

        return false;
    }
}