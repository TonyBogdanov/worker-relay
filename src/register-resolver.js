import singleton from './singleton';

export default function registerResolver( ... resolvers ) {
    for ( const resolver of resolvers ) {
        /* debug:start */
        if ( 'function' !== typeof resolver ) {
            throw `[WorkerRelay] Resolver must be a function.`;
        }
        /* debug:stop */

        singleton.resolvers.push( resolver );
    }
};
