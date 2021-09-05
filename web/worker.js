import registerBackend from '../src/backend/register-backend';
import registerResolver from '../src/register-resolver';
import pingResolver from './ping-resolver';
import pongResolver from './pong-resolver';

registerBackend();
registerResolver( pingResolver, pongResolver );
