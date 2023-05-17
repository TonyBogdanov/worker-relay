import is from './is';
import singleton from './singleton';
import message from './message';
import execute from './execute';
import log from './log';

export default function listen() {
    singleton.handle.addEventListener( 'message', ( { data: payload } ) => {
        // Avoid processing non-WorkerRelay messages.
        if ( 'object' !== typeof payload || 'string' !== typeof payload.__class ||
            payload.__class !== 'worker_relay_message' ) {
            return;
        }

        switch ( payload.type ) {
            case message.TYPE_INVOKE:
                /* debug:start */
                log( `Received invoke request %s = %s (${ payload.source }->${ payload.target }).`,
                    payload.data.name, payload.id );
                /* debug:stop */

                execute( payload ).then( result => {
                    const response = new message( message.TYPE_RESOLVE, is.what, payload.source,
                        { ref: payload.id, result } );

                    /* debug:start */
                    log( `Dispatching resolve %s in response to %s (${ response.source }->${ response.target }).`,
                        response.id, payload.id );
                    /* debug:stop */

                    singleton.handle.postMessage( response );
                }, error => {
                    const response = new message( message.TYPE_REJECT, is.what, payload.source,
                        { ref: payload.id, error: error.toString() } ); // Some errors can't be serialized.

                    /* debug:start */
                    log( `Dispatching reject %s in response to %s (${ response.source }->${ response.target }).`,
                        response.id, payload.id );
                    /* debug:stop */

                    singleton.handle.postMessage( response );
                } );
                break;

            case message.TYPE_RESOLVE:
                /* debug:start */
                log( `Received resolve %s in response to %s (${ payload.source }->${ payload.target }).`,
                    payload.id, payload.data.ref );
                /* debug:stop */

                singleton.pool[ payload.data.ref ].resolve( payload.data.result );
                delete singleton.pool[ payload.data.ref ];
                break;

            case message.TYPE_REJECT:
                /* debug:start */
                log( `Received reject %s in response to %s (${ payload.source }->${ payload.target }).`,
                    payload.id, payload.data.ref );
                /* debug:stop */

                singleton.pool[ payload.data.ref ].reject( payload.data.error );
                delete singleton.pool[ payload.data.ref ];
                break;
        }
    } );
};
