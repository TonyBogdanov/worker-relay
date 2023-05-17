import runBackend from '../src/backend/run-backend';
import runFrontend from '../src/frontend/run-frontend';

export default {
    'Should get challenge response from frontend.': async assert =>
        assert.deepEqual( [ 'pong:back', 'frontend', 'foo' ], await runFrontend( 'pong', 'foo' ) ),

    'Should get challenge response from backend.': async assert =>
        assert.deepEqual( [ 'pong:back', 'backend', 'bar' ], await runBackend( 'pong', 'bar' ) ),
};
