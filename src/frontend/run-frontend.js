import doRun from '../run';

export default function runFrontend( name, ... args ) {

    return doRun( 'frontend', name, args );

};
