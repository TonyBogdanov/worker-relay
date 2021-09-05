import doRun from '../run';

export default function runBackend( name, ... args ) {

    return doRun( 'backend', name, args );

};
