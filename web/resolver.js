import is from '../src/is';

export default name => {

    if ( 'ping' !== name ) {

        return null;

    }

    return challenge => [ 'ping:back', is.what, challenge ];

};
