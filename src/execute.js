import singleton from './singleton';
import log from './log';

export default async function execute( payload ) {

    if ( ! singleton.cache.hasOwnProperty( payload.data.name ) ) {

        const task = await singleton.resolver( payload.data.name );

        /* debug:start */
        if ( 'function' !== typeof task ) {

            throw new Error( `[WorkerRelay] Invalid task: ${ payload.data.name
                }, resolver must return a function, or a promise resolving to a function, got: ${ typeof task }.` );

        }
        /* debug:stop */

        singleton.cache[ payload.data.name ] = task;

    }

    /* debug:start */
    log( `Executing %s = %s.`, payload.data.name, payload.id );
    /* debug:stop */

    return await singleton.cache[ payload.data.name ]( ... payload.data.args );

}
