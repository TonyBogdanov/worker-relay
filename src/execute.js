import singleton from './singleton';
import log from './log';

export default async function execute( payload ) {

    if ( ! singleton.cache.hasOwnProperty( payload.data.name ) ) {

        let resolvedTask;
        for ( const resolver of singleton.resolvers ) {

            const task = await resolver( payload.data.name );
            if ( 'function' === typeof task ) {

                resolvedTask = task;
                break;

            }

        }

        /* debug:start */
        if ( ! resolvedTask ) {

            throw new Error( `[WorkerRelay] Invalid task: ${ payload.data.name }.` );

        }
        /* debug:stop */

        singleton.cache[ payload.data.name ] = resolvedTask;

    }

    /* debug:start */
    log( `Executing %s = %s.`, payload.data.name, payload.id );
    /* debug:stop */

    return await singleton.cache[ payload.data.name ]( ... payload.data.args );

}
