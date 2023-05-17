import runBackend from '../src/backend/run-backend';
import runFrontend from '../src/frontend/run-frontend';

export default {
    'Should get challenge response from frontend.': async assert =>
        assert.deepEqual( [ 'ping:back', 'frontend', 'foo' ], await runFrontend( 'ping', 'foo' ) ),

    'Should get challenge response from backend.': async assert =>
        assert.deepEqual( [ 'ping:back', 'backend', 'bar' ], await runBackend( 'ping', 'bar' ) ),
};
