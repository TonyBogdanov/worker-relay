export default class message {

    static TYPE_INVOKE  = 'invoke';
    static TYPE_RESOLVE = 'resolve';
    static TYPE_REJECT  = 'reject';

    constructor( type, source, target, data = {} ) {

        this.__class = 'worker_relay_message';

        this.id = Math.random().toString( 36 ).substr( 2, 9 );
        this.type = type;

        this.source = source;
        this.target = target;

        this.data = data;

    }

}
