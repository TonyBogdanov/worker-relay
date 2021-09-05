import is from '../src/is';

export default name => 'ping' === name ? challenge => [ 'ping:back', is.what, challenge ] : null;
