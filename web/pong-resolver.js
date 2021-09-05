import is from '../src/is';

export default name => 'pong' === name ? challenge => [ 'pong:back', is.what, challenge ] : null;
