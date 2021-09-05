export default function log( message, ... args ) {

    const styles = [].concat( ... args.map( () =>
        [ 'font-weight:bold;color:#f00', 'font-weight:inherit;color:inherit' ] ) );

    console.debug( '[WorkerRelay] ' + message.replace( /%s/g, () => `%c${ args.shift() }%c` ), ... styles );

}
