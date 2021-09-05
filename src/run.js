import is from './is';
import singleton from './singleton';
import message from './message';
import log from './log';
import execute from './execute';

export default function run( target, name, args ) {

    return new Promise( ( resolve, reject ) => {

        const payload = new message( message.TYPE_INVOKE, is.what, target, { name, args } );
        if ( is.what === target ) {

            return execute( payload ).then( resolve, reject );

        }

        /* debug:start */
        log( `Dispatching %s (${ payload.source }->${ payload.target }).`,
            `${ message.TYPE_INVOKE }:${ payload.data.name }@${ payload.id }` );
        /* debug:stop */

        singleton.pool[ payload.id ] = { resolve, reject };
        singleton.handle.postMessage( payload );

    } );

};
