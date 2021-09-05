import is from '../is';
import singleton from '../singleton';
import log from '../log';
import listen from '../listen';

export default function registerBackend() {

    if ( singleton.registered ) {

        return;

    }

    /* debug:start */
    if ( is.frontend ) {

        throw `Cannot register the backend in a frontend environment.`;

    }

    log( 'Registering %s.', is.what );
    /* debug:stop */

    singleton.registered = true;
    singleton.handle = self;

    listen();

}
